/**
 * JSON-file backed store for Node deployments. Writes are serialised through a
 * promise chain so concurrent tool calls cannot interleave partial writes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { KeyValueStore } from "../server/store.js";

export class FileStore implements KeyValueStore {
  private data: Record<string, unknown> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private file: string) {}

  private async load(): Promise<Record<string, unknown>> {
    if (this.data) return this.data;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      this.data = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      this.data = {};
    }
    return this.data;
  }

  private flush(): Promise<void> {
    this.queue = this.queue.then(async () => {
      const data = await this.load();
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2));
      await fs.rename(tmp, this.file);
    });
    return this.queue;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.load();
    return key in data ? (data[key] as T) : null;
  }

  async put<T>(key: string, value: T): Promise<void> {
    const data = await this.load();
    data[key] = JSON.parse(JSON.stringify(value));
    await this.flush();
  }

  async delete(key: string): Promise<void> {
    const data = await this.load();
    delete data[key];
    await this.flush();
  }

  async list(prefix: string): Promise<string[]> {
    const data = await this.load();
    return Object.keys(data).filter((k) => k.startsWith(prefix)).sort();
  }
}
