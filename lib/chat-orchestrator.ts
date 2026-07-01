import { randomUUID } from "node:crypto";

import { getAppConfig } from "./config";
import { JsonChatStore, type ChatStore } from "./chat-store";
import { JsonGameStateStore, type GameStateStore } from "./game-state-store";
import { chatReplySchema } from "./llm-schemas";
import { OpenAIJourneyClient, type JourneyLLMClient } from "./openai-journey-client";
import { loadPlotCatalog } from "./plot-library";
import { resolvePlot } from "./plot-resolver";
import { buildChatReplyPrompt } from "./prompts";
import type {
  ChatMessage,
  ChatSession,
  ChatTurnRequest,
  ChatTurnResponse,
  PlotBeat,
  TriggeredPlot
} from "./types";

type RunChatTurnDependencies = {
  client?: JourneyLLMClient;
  chatStore?: ChatStore;
  stateStore?: GameStateStore;
  catalog?: PlotBeat[];
  directorEnabled?: boolean;
};

const MAX_HISTORY_TURNS = 8;

function renderHistory(messages: ChatMessage[]): string {
  return messages
    .slice(-MAX_HISTORY_TURNS)
    .map((message) => `${message.speaker}: ${message.text}`)
    .join("\n");
}

/**
 * Advance a live conversation by one turn.
 *
 * Each turn: append the player's message, let the plot director judge whether
 * this moment should trigger/advance a plot, generate the NPC's in-character
 * reply (steered by any active plot), then persist the session and any effects.
 */
export async function runChatTurn(
  input: ChatTurnRequest,
  dependencies: RunChatTurnDependencies = {}
): Promise<ChatTurnResponse> {
  const client = dependencies.client || new OpenAIJourneyClient();
  const chatStore = dependencies.chatStore || new JsonChatStore();
  const stateStore = dependencies.stateStore || new JsonGameStateStore();
  const config = getAppConfig();
  const catalog = dependencies.catalog ?? (await loadPlotCatalog());

  const now = new Date().toISOString();
  const existing = input.sessionId ? await chatStore.getSession(input.sessionId) : null;

  let session: ChatSession;
  if (existing && existing.npcId === input.npcId) {
    session = existing;
  } else {
    session = {
      id: randomUUID(),
      npcId: input.npcId,
      npcAlias: input.npcAlias,
      npcRole: input.npcRole,
      zoneId: input.zoneId,
      zoneName: input.zoneName,
      catName: input.catName,
      messages: [],
      createdAt: now,
      updatedAt: now
    };
    // Starting a fresh conversation at a zone counts as visiting it.
    await stateStore.recordVisit(input.zoneId);
  }

  const playerMessage: ChatMessage = {
    role: "player",
    speaker: input.catName,
    text: input.playerMessage,
    at: now
  };
  session.messages.push(playerMessage);

  const historyText = renderHistory(session.messages);
  const gameState = await stateStore.getState();

  const resolution = await resolvePlot({
    catalog,
    state: gameState,
    context: {
      zoneId: input.zoneId,
      npcId: input.npcId,
      encounterMode: "manual_talk",
      catName: input.catName,
      mood: "conversational",
      travelStyle: "chatting",
      userAction: input.playerMessage,
      currentArea: input.zoneName,
      focusCatName: input.npcAlias,
      focusCatRole: input.npcRole,
      historySummary: historyText || "no prior turns"
    },
    client,
    directorEnabled: dependencies.directorEnabled ?? config.plotDirectorEnabled
  });
  const activePlot = resolution.plot;

  const replyPrompt = buildChatReplyPrompt({
    catName: input.catName,
    npcAlias: input.npcAlias,
    npcRole: input.npcRole,
    zoneName: input.zoneName,
    nearbyCats: input.nearbyCats,
    historyText,
    playerMessage: input.playerMessage,
    activePlot
  });

  const reply = await client.completeJson({
    system: replyPrompt.system,
    user: replyPrompt.user,
    schema: chatReplySchema
  });

  const triggeredPlot: TriggeredPlot | null = activePlot
    ? { id: activePlot.id, title: activePlot.title, reason: resolution.reason }
    : null;

  const npcMessage: ChatMessage = {
    role: "npc",
    speaker: input.npcAlias,
    text: reply.reply,
    at: new Date().toISOString(),
    triggeredPlot
  };
  session.messages.push(npcMessage);
  session.updatedAt = npcMessage.at;

  await chatStore.saveSession(session);
  if (activePlot) {
    await stateStore.applyPlot(activePlot);
  }

  return { session, reply: npcMessage, triggeredPlot };
}
