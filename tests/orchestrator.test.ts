import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { JsonGameStateStore } from "../lib/game-state-store";
import { JsonJournalStore } from "../lib/journal-store";
import { runJourney } from "../lib/orchestrator";
import type { CompleteJsonOptions, JourneyLLMClient } from "../lib/openai-journey-client";
import type { PlotBeat } from "../lib/types";
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
  public userPrompts: string[] = [];
  public generatedPrompt = "";
  /** Plot id the fake director returns; null keeps the encounter free-form. */
  public directorChoice: string | null = null;

  async completeJson<T>({
    system,
    user,
    imageDataUrl,
    schema
  }: CompleteJsonOptions<T>): Promise<T> {
    this.calls.push(system);
    this.userPrompts.push(user);

    if (system.includes("Plot Director")) {
      return schema.parse({
        selectedPlotId: this.directorChoice,
        reason: "测试导演选择"
      }) as T;
    }

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

const harborPlot: PlotBeat = {
  id: "harbor_lost_letter",
  title: "港口的旧信",
  synopsis: "伴猫捡到一封没能寄出的旧信。",
  priority: 20,
  once: true,
  preconditions: { zoneId: "harbor", npcId: "companion-cat" },
  beats: ["伴猫抽出旧信。", "信封名字被盐渍晕开。", "邀请旅行猫一起打听收信人。"],
  effects: { setFlags: ["harbor_lost_letter_done"], relationship: { "companion-cat": 1 } }
};

describe("runJourney", () => {
  it("coordinates multiple cat agents, stores the journal, and returns a postcard", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "travel-neko-test-"));
    const store = new JsonJournalStore(path.join(tempDirectory, "journals.json"));
    const stateStore = new JsonGameStateStore(path.join(tempDirectory, "game-state.json"));
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
        store,
        stateStore,
        catalog: []
      }
    );

    expect(result.record.archive.chapterTitle).toBe("The Bell at Rainy Harbor");
    expect(result.record.imageInsight?.travelClue).toContain("fish-shaped bell");
    expect(result.record.agentNotes).toHaveLength(5);
    expect(result.record.postcardImageUrl).toBe("https://example.com/postcard.png");
    expect(result.record.triggeredPlot).toBeNull();

    const records = await store.listRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe(result.record.id);

    await rm(tempDirectory, { recursive: true, force: true });
  });

  it("triggers a plot the director selects, injects it, and commits state effects", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "travel-neko-plot-"));
    const store = new JsonJournalStore(path.join(tempDirectory, "journals.json"));
    const stateStore = new JsonGameStateStore(path.join(tempDirectory, "game-state.json"));
    const client = new FakeJourneyClient();
    client.directorChoice = "harbor_lost_letter";

    const result = await runJourney(
      {
        catName: "团子",
        destination: "雾灯港",
        zoneId: "harbor",
        focusCatName: "伴猫",
        focusNpcId: "companion-cat",
        mood: "好奇",
        travelStyle: "慢悠悠采风",
        userAction: "想和伴猫聊聊港口的旧事"
      },
      { client, store, stateStore, catalog: [harborPlot] }
    );

    expect(result.record.triggeredPlot?.id).toBe("harbor_lost_letter");
    // The plot synopsis must have been injected into the generation prompts.
    expect(client.userPrompts.some((prompt) => prompt.includes("港口的旧信"))).toBe(true);

    const state = await stateStore.getState();
    expect(state.flags).toContain("harbor_lost_letter_done");
    expect(state.completedPlots).toContain("harbor_lost_letter");
    expect(state.relationship["companion-cat"]).toBe(1);
    expect(state.zoneVisits.harbor).toBe(1);

    await rm(tempDirectory, { recursive: true, force: true });
  });

  it("stays free-form when the director declines every candidate", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "travel-neko-decline-"));
    const store = new JsonJournalStore(path.join(tempDirectory, "journals.json"));
    const stateStore = new JsonGameStateStore(path.join(tempDirectory, "game-state.json"));
    const client = new FakeJourneyClient();
    client.directorChoice = null;

    const result = await runJourney(
      {
        catName: "团子",
        destination: "雾灯港",
        zoneId: "harbor",
        focusCatName: "伴猫",
        focusNpcId: "companion-cat",
        mood: "好奇",
        travelStyle: "慢悠悠采风",
        userAction: "只想安静地看海"
      },
      { client, store, stateStore, catalog: [harborPlot] }
    );

    expect(result.record.triggeredPlot).toBeNull();
    const state = await stateStore.getState();
    expect(state.flags).not.toContain("harbor_lost_letter_done");
    expect(state.zoneVisits.harbor).toBe(1);

    await rm(tempDirectory, { recursive: true, force: true });
  });
});
