import { matchesPreconditions, resolvePlot } from "../lib/plot-resolver";
import type { CompleteJsonOptions, JourneyLLMClient } from "../lib/openai-journey-client";
import type { GameState, PlotBeat } from "../lib/types";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    flags: [],
    completedPlots: [],
    zoneVisits: {},
    relationship: {},
    ...overrides
  };
}

const baseContext = {
  zoneId: "harbor",
  npcId: "companion-cat",
  encounterMode: "manual_talk" as const,
  catName: "团子",
  mood: "好奇",
  travelStyle: "慢悠悠",
  userAction: "聊聊旧事",
  focusCatName: "伴猫",
  focusCatRole: "港口搭子",
  historySummary: "no memories"
};

const letterPlot: PlotBeat = {
  id: "harbor_lost_letter",
  title: "港口的旧信",
  synopsis: "旧信剧情",
  priority: 20,
  once: true,
  preconditions: { zoneId: "harbor", npcId: "companion-cat", forbiddenFlags: ["harbor_lost_letter_done"] },
  beats: ["beat"]
};

const bellPlot: PlotBeat = {
  id: "oldstreet_riddle_bell",
  title: "旧街的谜语铃",
  synopsis: "谜语剧情",
  priority: 30,
  once: true,
  preconditions: { zoneId: "old-street", npcId: "oracle-cat", requiredFlags: ["harbor_lost_letter_done"] },
  beats: ["beat"]
};

class StubDirector implements JourneyLLMClient {
  public seenUser: string[] = [];
  constructor(private readonly choice: string | null) {}
  async completeJson<T>({ user, schema }: CompleteJsonOptions<T>): Promise<T> {
    this.seenUser.push(user);
    return schema.parse({ selectedPlotId: this.choice, reason: "stub" }) as T;
  }
  async generateImage() {
    return null;
  }
}

describe("matchesPreconditions", () => {
  it("passes when zone, npc, and flags all line up", () => {
    expect(matchesPreconditions(letterPlot, makeState(), baseContext)).toBe(true);
  });

  it("rejects when the zone does not match", () => {
    expect(matchesPreconditions(letterPlot, makeState(), { ...baseContext, zoneId: "market" })).toBe(false);
  });

  it("rejects a once-only plot that already completed", () => {
    const state = makeState({ completedPlots: ["harbor_lost_letter"] });
    expect(matchesPreconditions(letterPlot, state, baseContext)).toBe(false);
  });

  it("respects a forbidden flag", () => {
    const state = makeState({ flags: ["harbor_lost_letter_done"] });
    expect(matchesPreconditions(letterPlot, state, baseContext)).toBe(false);
  });

  it("gates a chained plot behind its required flag", () => {
    const context = { ...baseContext, zoneId: "old-street", npcId: "oracle-cat" };
    expect(matchesPreconditions(bellPlot, makeState(), context)).toBe(false);
    expect(
      matchesPreconditions(bellPlot, makeState({ flags: ["harbor_lost_letter_done"] }), context)
    ).toBe(true);
  });

  it("enforces minimum zone visits", () => {
    const plot: PlotBeat = {
      ...letterPlot,
      id: "windmill_storm_signal",
      once: false,
      preconditions: { zoneId: "windmill", minZoneVisits: 2 }
    };
    const context = { ...baseContext, zoneId: "windmill", npcId: "scout-cat" };
    expect(matchesPreconditions(plot, makeState({ zoneVisits: { windmill: 1 } }), context)).toBe(false);
    expect(matchesPreconditions(plot, makeState({ zoneVisits: { windmill: 2 } }), context)).toBe(true);
  });
});

describe("resolvePlot", () => {
  it("returns null with no candidates and never calls the director", async () => {
    const director = new StubDirector("harbor_lost_letter");
    const resolution = await resolvePlot({
      catalog: [letterPlot],
      state: makeState(),
      context: { ...baseContext, zoneId: "market" },
      client: director
    });
    expect(resolution.plot).toBeNull();
    expect(director.seenUser).toHaveLength(0);
  });

  it("uses the director to choose among candidates", async () => {
    const director = new StubDirector("harbor_lost_letter");
    const resolution = await resolvePlot({
      catalog: [letterPlot],
      state: makeState(),
      context: baseContext,
      client: director
    });
    expect(resolution.plot?.id).toBe("harbor_lost_letter");
    expect(director.seenUser).toHaveLength(1);
  });

  it("stays free-form when the director declines", async () => {
    const director = new StubDirector(null);
    const resolution = await resolvePlot({
      catalog: [letterPlot],
      state: makeState(),
      context: baseContext,
      client: director
    });
    expect(resolution.plot).toBeNull();
  });

  it("falls back to priority when the director is disabled", async () => {
    const highPriority: PlotBeat = { ...letterPlot, id: "extra", priority: 99, preconditions: { zoneId: "harbor" } };
    const resolution = await resolvePlot({
      catalog: [letterPlot, highPriority],
      state: makeState(),
      context: baseContext,
      directorEnabled: false
    });
    expect(resolution.plot?.id).toBe("extra");
  });

  it("fails safe to free-form if the director hallucinates an id", async () => {
    const director = new StubDirector("does_not_exist");
    const resolution = await resolvePlot({
      catalog: [letterPlot],
      state: makeState(),
      context: baseContext,
      client: director
    });
    expect(resolution.plot).toBeNull();
  });
});
