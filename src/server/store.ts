/**
 * Minimal key-value persistence used for profiles and saved reports.
 * Implementations: in-memory (tests, fallbacks), JSON file (Node), Cloudflare KV (Workers).
 */
import type { Profile, Report, ReportSummary } from "./schemas.js";

export interface KeyValueStore {
  get<T = unknown>(key: string): Promise<T | null>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.map.has(key) ? (this.map.get(key) as T) : null);
  }
  async put<T>(key: string, value: T): Promise<void> {
    this.map.set(key, JSON.parse(JSON.stringify(value)));
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

/** Shape of a Cloudflare KV namespace binding (subset we use). Avoids a types dependency. */
export interface KVNamespaceLike {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export class KVStore implements KeyValueStore {
  constructor(private kv: KVNamespaceLike) {}
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.kv.get(key, "text");
    return raw === null ? null : (JSON.parse(raw) as T);
  }
  async put<T>(key: string, value: T): Promise<void> {
    await this.kv.put(key, JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
  async list(prefix: string): Promise<string[]> {
    const names: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.kv.list({ prefix, cursor });
      names.push(...page.keys.map((k) => k.name));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return names.sort();
  }
}

// ---------------------------------------------------------------------------
// Domain repository on top of the KV store
// ---------------------------------------------------------------------------

const KEYS = {
  profile: (id: string) => `profile:${id}`,
  profilePrefix: "profile:",
  activeProfile: "meta:activeProfile",
  report: (id: string) => `report:${id}`,
  reportIndex: "meta:reportIndex",
};

const MAX_SAVED_REPORTS = 60;

export class ResearchRepository {
  constructor(private store: KeyValueStore) {}

  async listProfiles(): Promise<Profile[]> {
    const keys = await this.store.list(KEYS.profilePrefix);
    const profiles = await Promise.all(keys.map((k) => this.store.get<Profile>(k)));
    return profiles.filter((p): p is Profile => !!p).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getProfile(id: string): Promise<Profile | null> {
    return this.store.get<Profile>(KEYS.profile(id));
  }

  async getActiveProfileId(): Promise<string | null> {
    return this.store.get<string>(KEYS.activeProfile);
  }

  async getActiveProfile(): Promise<Profile | null> {
    const id = await this.getActiveProfileId();
    if (id) {
      const p = await this.getProfile(id);
      if (p) return p;
    }
    const all = await this.listProfiles();
    return all[0] ?? null;
  }

  async saveProfile(profile: Profile, makeActive: boolean): Promise<void> {
    await this.store.put(KEYS.profile(profile.id), profile);
    if (makeActive || !(await this.getActiveProfileId())) {
      await this.store.put(KEYS.activeProfile, profile.id);
    }
  }

  async setActiveProfile(id: string): Promise<void> {
    await this.store.put(KEYS.activeProfile, id);
  }

  async deleteProfile(id: string): Promise<boolean> {
    const existing = await this.getProfile(id);
    if (!existing) return false;
    await this.store.delete(KEYS.profile(id));
    if ((await this.getActiveProfileId()) === id) {
      const rest = await this.listProfiles();
      if (rest[0]) await this.store.put(KEYS.activeProfile, rest[0].id);
      else await this.store.delete(KEYS.activeProfile);
    }
    return true;
  }

  async saveReport(id: string, report: Report): Promise<ReportSummary> {
    const summary: ReportSummary = {
      id,
      company: report.company.name,
      purpose: report.meta.purpose,
      purposeLabel: report.meta.purposeLabel,
      headline: report.summary.headline,
      fitScore: report.fit?.score,
      researchedAt: report.meta.researchedAt,
      savedAt: new Date().toISOString(),
    };
    await this.store.put(KEYS.report(id), report);
    const index = (await this.store.get<ReportSummary[]>(KEYS.reportIndex)) ?? [];
    const next = [summary, ...index.filter((r) => r.id !== id)].slice(0, MAX_SAVED_REPORTS);
    const evicted = index.filter((r) => !next.some((n) => n.id === r.id));
    await Promise.all(evicted.map((r) => this.store.delete(KEYS.report(r.id))));
    await this.store.put(KEYS.reportIndex, next);
    return summary;
  }

  async listReports(): Promise<ReportSummary[]> {
    return (await this.store.get<ReportSummary[]>(KEYS.reportIndex)) ?? [];
  }

  async getReport(id: string): Promise<Report | null> {
    return this.store.get<Report>(KEYS.report(id));
  }

  async deleteReport(id: string): Promise<boolean> {
    const index = await this.listReports();
    if (!index.some((r) => r.id === id)) return false;
    await this.store.delete(KEYS.report(id));
    await this.store.put(KEYS.reportIndex, index.filter((r) => r.id !== id));
    return true;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
}

export function shortId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
