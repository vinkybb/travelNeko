import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { JsonJournalStore } from "../lib/journal-store";
import type { JourneyRecord } from "../lib/types";

function makeRecord(id: string, createdAt: string): JourneyRecord {
  return {
    id,
    createdAt,
    input: {
      catName: "团子",
      destination: "港口",
      mood: "开心",
      travelStyle: "散步",
      userAction: "闻闻海风",
      generatePostcard: false
    },
    imageInsight: null,
    scout: {
      title: "Pier",
      weather: "fog",
      atmosphere: "quiet",
      challenge: "find a clue",
      wonder: "lanterns",
      keepsakeHint: "ticket"
    },
    companion: {
      openingLine: "hello",
      banter: ["a", "b", "c"],
      invitation: "come on"
    },
    oracle: {
      hiddenClue: "clue",
      emotionalShift: "warmth",
      prophecy: "tomorrow"
    },
    archive: {
      chapterTitle: `Record ${id}`,
      summary: "summary",
      story: "story",
      memoryTags: ["tag"],
      keepsake: "shell",
      nextHook: "next"
    },
    painter: null,
    postcardImageUrl: null,
    agentNotes: []
  };
}

describe("JsonJournalStore", () => {
  it("keeps the most recent journals first", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "travel-neko-store-"));
    const filePath = path.join(tempDirectory, "journals.json");
    const store = new JsonJournalStore(filePath);

    await store.saveRecord(makeRecord("one", "2026-03-26T10:00:00.000Z"));
    await store.saveRecord(makeRecord("two", "2026-03-26T11:00:00.000Z"));

    const records = await store.listRecords();
    expect(records.map((record) => record.id)).toEqual(["two", "one"]);

    await rm(tempDirectory, { recursive: true, force: true });
  });
});

