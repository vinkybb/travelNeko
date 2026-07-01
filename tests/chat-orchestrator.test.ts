import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runChatTurn } from "../lib/chat-orchestrator";
import { JsonChatStore } from "../lib/chat-store";
import { JsonGameStateStore } from "../lib/game-state-store";
import type { CompleteJsonOptions, JourneyLLMClient } from "../lib/openai-journey-client";
import type { ChatTurnRequest, PlotBeat } from "../lib/types";

class FakeChatClient implements JourneyLLMClient {
  public directorChoice: string | null = null;
  public replyPrompts: string[] = [];

  async completeJson<T>({ system, user, schema }: CompleteJsonOptions<T>): Promise<T> {
    if (system.includes("Plot Director")) {
      return schema.parse({ selectedPlotId: this.directorChoice, reason: "测试导演" }) as T;
    }
    // Chat reply agent.
    this.replyPrompts.push(user);
    return schema.parse({ reply: "喵，很高兴见到你。", mood: "友好" }) as T;
  }

  async generateImage() {
    return null;
  }
}

const harborPlot: PlotBeat = {
  id: "harbor_lost_letter",
  title: "港口的旧信",
  synopsis: "伴猫捡到一封没能寄出的旧信。",
  priority: 20,
  once: true,
  preconditions: { zoneId: "harbor", npcId: "companion-cat" },
  beats: ["伴猫抽出旧信。"],
  effects: { setFlags: ["harbor_lost_letter_done"], relationship: { "companion-cat": 1 } }
};

function makeRequest(overrides: Partial<ChatTurnRequest> = {}): ChatTurnRequest {
  return {
    catName: "团子",
    zoneId: "harbor",
    zoneName: "雾灯港",
    npcId: "companion-cat",
    npcAlias: "伴猫",
    npcRole: "港口搭子",
    playerMessage: "你好呀，最近港口有什么新鲜事？",
    ...overrides
  };
}

async function makeStores() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "travel-neko-chat-"));
  return {
    dir,
    chatStore: new JsonChatStore(path.join(dir, "chat.json")),
    stateStore: new JsonGameStateStore(path.join(dir, "state.json"))
  };
}

describe("runChatTurn", () => {
  it("creates a session, replies in character, and keeps it free-form when the director declines", async () => {
    const { dir, chatStore, stateStore } = await makeStores();
    const client = new FakeChatClient();
    client.directorChoice = null;

    const result = await runChatTurn(makeRequest(), {
      client,
      chatStore,
      stateStore,
      catalog: [harborPlot]
    });

    expect(result.session.messages).toHaveLength(2);
    expect(result.session.messages[0]?.role).toBe("player");
    expect(result.reply.role).toBe("npc");
    expect(result.reply.text).toBe("喵，很高兴见到你。");
    expect(result.triggeredPlot).toBeNull();

    const state = await stateStore.getState();
    expect(state.flags).not.toContain("harbor_lost_letter_done");
    // Starting a conversation counts as a zone visit.
    expect(state.zoneVisits.harbor).toBe(1);

    await rm(dir, { recursive: true, force: true });
  });

  it("triggers a plot mid-conversation and applies its effects", async () => {
    const { dir, chatStore, stateStore } = await makeStores();
    const client = new FakeChatClient();
    client.directorChoice = "harbor_lost_letter";

    const result = await runChatTurn(makeRequest({ playerMessage: "跟我说说港口的旧事吧" }), {
      client,
      chatStore,
      stateStore,
      catalog: [harborPlot]
    });

    expect(result.triggeredPlot?.id).toBe("harbor_lost_letter");
    expect(result.reply.triggeredPlot?.title).toBe("港口的旧信");
    // The active plot beat must be injected into the reply prompt.
    expect(client.replyPrompts.some((prompt) => prompt.includes("港口的旧信"))).toBe(true);

    const state = await stateStore.getState();
    expect(state.flags).toContain("harbor_lost_letter_done");
    expect(state.completedPlots).toContain("harbor_lost_letter");
    expect(state.relationship["companion-cat"]).toBe(1);

    await rm(dir, { recursive: true, force: true });
  });

  it("continues an existing session and preserves earlier turns", async () => {
    const { dir, chatStore, stateStore } = await makeStores();
    const client = new FakeChatClient();

    const first = await runChatTurn(makeRequest(), {
      client,
      chatStore,
      stateStore,
      catalog: []
    });

    const second = await runChatTurn(
      makeRequest({ sessionId: first.session.id, playerMessage: "那我们一起去看看吧" }),
      { client, chatStore, stateStore, catalog: [] }
    );

    expect(second.session.id).toBe(first.session.id);
    expect(second.session.messages).toHaveLength(4);
    // A second turn on the same session must not double-count the zone visit.
    const state = await stateStore.getState();
    expect(state.zoneVisits.harbor).toBe(1);

    await rm(dir, { recursive: true, force: true });
  });
});
