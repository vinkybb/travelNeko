import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getAppConfig } from "./config";
import type { JourneyRecord } from "./types";

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

export class JsonJournalStore {
  constructor(private readonly filePath = getAppConfig().journalPath) {}

  private async ensureFile() {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (isEnoent(error)) {
        await writeFile(this.filePath, "[]\n", "utf8");
        return;
      }
      throw error;
    }
  }

  async listRecords(): Promise<JourneyRecord[]> {
    await this.ensureFile();
    const raw = await readFile(this.filePath, "utf8");

    try {
      return JSON.parse(raw) as JourneyRecord[];
    } catch (error) {
      console.error(
        `[JsonJournalStore] Failed to parse JSON at ${this.filePath}:`,
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  async saveRecord(record: JourneyRecord) {
    const records = await this.listRecords();
    const nextRecords = [record, ...records].slice(0, 20);
    await writeFile(this.filePath, `${JSON.stringify(nextRecords, null, 2)}\n`, "utf8");
    return record;
  }
}
