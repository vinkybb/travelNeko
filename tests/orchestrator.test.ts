import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { JsonJournalStore } from "../lib/journal-store";
import { runJourney } from "../lib/orchestrator";
import type { CompleteJsonOptions, JourneyLLMClient } from "../lib/openai-journey-client";
import type {
  ArchiveStory,
  CompanionDialogue,
  ImageInsight,
  OracleClue,
  PainterDraft,
  ScoutScene
} from "../lib/types";

class FakeJourneyClient implements JourneyLLMClient {
  public calls: string[] = [];
  public generatedPrompt = "";

  async completeJson<T>({ system, imageDataUrl, schema }: CompleteJsonOptions<T>): Promise<T> {
    this.calls.push(system);

    if (system.includes("vision lens")) {
      expect(imageDataUrl).toContain("data:image/png;base64");
      const insight = {
        mood: "salt-air wonder",
        observedObjects: ["lantern pier", "wet footprints"],
        colorPalette: ["teal", "peach"],
        travelClue: "A fish-shaped bell glows near the pier.",
        interpretation: "The photo suggests a harbor that remembers old promises."
      } satisfies ImageInsight;
      return schema.parse(insight) as T;
    }

    if (system.includes("Scout Cat")) {
      const scout = {
        title: "Moonlit Lantern Pier",
        weather: "misty sea breeze",
        atmosphere: "a playful hush before midnight",
        challenge: "The bell keeper will only speak in riddles.",
        wonder: "Each lantern carries a tiny pawprint constellation.",
        keepsakeHint: "a salt-crusted ticket stub"
      } satisfies ScoutScene;
      return schema.parse(scout) as T;
    }

    if (system.includes("Companion Cat")) {
      const companion = {
        openingLine: "A caramel stray taps the map with its tail.",
        banter: [
          "伴猫: 潮水又在说闲话了。",
          "伴猫: 那我们客气点问它。",
          "伴猫: 我带了勇气和沙丁鱼罐头。"
        ],
        invitation: "Follow the cat choir to the last lit pier."
      } satisfies CompanionDialogue;
      return schema.parse(companion) as T;
    }

    if (system.includes("Oracle Cat")) {
      const oracle = {
        hiddenClue: "The glowing bell rings only for homesick travelers.",
        emotionalShift: "Curiosity softens into belonging.",
        prophecy: "Tonight's keepsake will unlock tomorrow's shortcut."
      } satisfies OracleClue;
      return schema.parse(oracle) as T;
    }

    if (system.includes("Archivist Cat")) {
      const archive = {
        chapterTitle: "The Bell at Rainy Harbor",
        summary: "团子 followed a trail of lanterns and found a clue wrapped in sea mist.",
        story:
          "团子沿着潮湿木栈桥往前走，尾巴扫过微凉的雾气。几只爱说话的猫轮流带路，最后在会发光的鱼铃前停下。铃声一响，港口像认出了这位旅人，把一张旧车票轻轻推到团子脚边。",
        memoryTags: ["港口", "鱼铃", "潮汐", "结伴"],
        keepsake: "一张带盐粒的旧车票",
        nextHook: "车票背面写着通往山顶神社的时间。"
      } satisfies ArchiveStory;
      return schema.parse(archive) as T;
    }

    const painter = {
      postcardTitle: "Lantern Harbor Postcard",
      visualPrompt:
        "storybook postcard, curious cat on a misty pier, teal sea, peach lanterns, tactile paper grain, cinematic lighting",
      styleNotes: ["storybook texture", "teal-orange palette", "wide travel composition"]
    } satisfies PainterDraft;
    return schema.parse(painter) as T;
  }

  async generateImage() {
    this.generatedPrompt = "generated";
    return "https://example.com/postcard.png";
  }
}

describe("runJourney", () => {
  it("coordinates multiple cat agents, stores the journal, and returns a postcard", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "travel-neko-test-"));
    const store = new JsonJournalStore(path.join(tempDirectory, "journals.json"));
    const client = new FakeJourneyClient();

    const result = await runJourney(
      {
        catName: "团子",
        destination: "雨巷港口",
        mood: "兴奋",
        travelStyle: "慢悠悠采风",
        userAction: "抱着地图去找最会讲传说的猫",
        imageDataUrl: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
        generatePostcard: true
      },
      {
        client,
        store
      }
    );

    expect(result.record.archive.chapterTitle).toBe("The Bell at Rainy Harbor");
    expect(result.record.imageInsight?.travelClue).toContain("fish-shaped bell");
    expect(result.record.agentNotes).toHaveLength(5);
    expect(result.record.postcardImageUrl).toBe("https://example.com/postcard.png");

    const records = await store.listRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe(result.record.id);

    await rm(tempDirectory, { recursive: true, force: true });
  });
});
