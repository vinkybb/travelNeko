import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getAppConfig } from "./config";
import type { JourneyRecord } from "./types";

function sanitizeRecord(record: JourneyRecord): JourneyRecord {
  return {
    ...record,
    agentNotes: record.agentNotes.map((note) => ({
      ...note,
      highlights: note.highlights.filter((highlight) => highlight !== "No image clue uploaded")
    }))
  };
}

export class JsonJournalStore {
  constructor(private readonly filePath = getAppConfig().journalPath) {}

  private async ensureFile() {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch {
      await writeFile(this.filePath, "[]\n", "utf8");
    }
  }

  async listRecords() {
    await this.ensureFile();
    const raw = await readFile(this.filePath, "utf8");

    try {
      return (JSON.parse(raw) as JourneyRecord[]).map(sanitizeRecord);
    } catch {
      return [];
    }
  }

  async saveRecord(record: JourneyRecord) {
    const records = await this.listRecords();
    const nextRecords = [sanitizeRecord(record), ...records].slice(0, 20);
    await writeFile(this.filePath, `${JSON.stringify(nextRecords, null, 2)}\n`, "utf8");
    return record;
  }
}
