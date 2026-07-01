import { randomUUID } from "node:crypto";

import { getAppConfig, getPublicConfig } from "./config";
import { JsonJournalStore } from "./journal-store";
import { JsonGameStateStore, type GameStateStore } from "./game-state-store";
import { loadPlotCatalog } from "./plot-library";
import { resolvePlot } from "./plot-resolver";
import {
  buildArchivePrompt,
  buildCompanionPrompt,
  buildOraclePrompt,
  buildPainterPrompt,
  buildScoutPrompt
} from "./prompts";
import {
  archiveStorySchema,
  companionDialogueSchema,
  imageInsightSchema,
  oracleClueSchema,
  painterDraftSchema,
  scoutSceneSchema
} from "./llm-schemas";
import { OpenAIJourneyClient, type JourneyLLMClient } from "./openai-journey-client";
import type {
  AgentNote,
  ArchiveStory,
  CompanionDialogue,
  ImageInsight,
  JourneyRecord,
  JourneyRequest,
  JourneyResponse,
  OracleClue,
  PainterDraft,
  PlotBeat,
  ScoutScene,
  TriggeredPlot
} from "./types";

type RunJourneyDependencies = {
  client?: JourneyLLMClient;
  store?: JsonJournalStore;
  stateStore?: GameStateStore;
  /** Injectable plot catalog; defaults to loading from the plots directory. */
  catalog?: PlotBeat[];
  /** Override the director toggle (defaults to app config). */
  directorEnabled?: boolean;
};

function summarizeHistory(records: JourneyRecord[]) {
  if (!records.length) {
    return "No previous memories yet.";
  }

  return records
    .slice(0, 3)
    .map(
      (record) =>
        `${record.archive.chapterTitle}: ${record.archive.summary} (keepsake: ${record.archive.keepsake})`
    )
    .join(" | ");
}

function buildAgentNotes(args: {
  scout: ScoutScene;
  companion: CompanionDialogue;
  oracle: OracleClue;
  archive: ArchiveStory;
  painter: PainterDraft | null;
  imageInsight: ImageInsight | null;
}) {
  const oracleHighlights = [
    args.oracle.emotionalShift,
    args.oracle.prophecy,
    args.imageInsight?.travelClue
  ].filter(Boolean) as string[];

  const notes: AgentNote[] = [
    {
      agentId: "scout-cat",
      displayName: "Scout Cat",
      role: "行程导演",
      content: `${args.scout.title}。${args.scout.challenge}`,
      highlights: [args.scout.weather, args.scout.atmosphere, args.scout.wonder]
    },
    {
      agentId: "companion-cat",
      displayName: "Companion Cat",
      role: "互动搭子",
      content: args.companion.openingLine,
      highlights: [...args.companion.banter, args.companion.invitation]
    },
    {
      agentId: "oracle-cat",
      displayName: "Oracle Cat",
      role: "线索侦探",
      content: args.oracle.hiddenClue,
      highlights: oracleHighlights
    },
    {
      agentId: "archivist-cat",
      displayName: "Archivist Cat",
      role: "记忆归档员",
      content: args.archive.summary,
      highlights: [args.archive.keepsake, args.archive.nextHook]
    }
  ];

  if (args.painter) {
    notes.push({
      agentId: "painter-cat",
      displayName: "Painter Cat",
      role: "明信片画师",
      content: args.painter.postcardTitle,
      highlights: args.painter.styleNotes
    });
  }

  return notes;
}

async function maybeAnalyseImage(
  client: JourneyLLMClient,
  imageDataUrl: string | undefined
) {
  if (!imageDataUrl) {
    return null;
  }

  return client.completeJson({
    model: getPublicConfig().visionModel,
    system:
      "You are Oracle Cat's vision lens. Analyze the uploaded travel image for story-relevant details. Respond with a single JSON object only.",
    user: `Describe the image in story-game terms and return JSON with keys:
- mood
- observedObjects (array)
- colorPalette (array)
- travelClue
- interpretation`,
    imageDataUrl,
    schema: imageInsightSchema
  });
}

export async function runJourney(
  input: JourneyRequest,
  dependencies: RunJourneyDependencies = {}
): Promise<JourneyResponse> {
  const client = dependencies.client || new OpenAIJourneyClient();
  const store = dependencies.store || new JsonJournalStore();
  const stateStore = dependencies.stateStore || new JsonGameStateStore();
  const config = getAppConfig();
  const history = await store.listRecords();
  const historySummary = summarizeHistory(history);
  const imageInsight = await maybeAnalyseImage(client, input.imageDataUrl);

  const catalog = dependencies.catalog ?? (await loadPlotCatalog());
  const gameState = await stateStore.getState();
  const resolution = await resolvePlot({
    catalog,
    state: gameState,
    context: {
      zoneId: input.zoneId,
      npcId: input.focusNpcId,
      encounterMode: input.encounterMode,
      catName: input.catName,
      mood: input.mood,
      travelStyle: input.travelStyle,
      userAction: input.userAction,
      currentArea: input.currentArea,
      focusCatName: input.focusCatName,
      focusCatRole: input.focusCatRole,
      historySummary
    },
    client,
    directorEnabled: dependencies.directorEnabled ?? config.plotDirectorEnabled
  });
  const activePlot = resolution.plot;

  const scoutPrompt = buildScoutPrompt({
    ...input,
    historySummary,
    imageInsight,
    activePlot
  });

  const scout = await client.completeJson<ScoutScene>({
    system: scoutPrompt.system,
    user: scoutPrompt.user,
    schema: scoutSceneSchema
  });

  const companionPrompt = buildCompanionPrompt({
    ...input,
    historySummary,
    imageInsight,
    activePlot,
    scout
  });
  const oraclePrompt = buildOraclePrompt({
    ...input,
    historySummary,
    imageInsight,
    activePlot,
    scout
  });

  const [companion, oracle] = await Promise.all([
    client.completeJson<CompanionDialogue>({
      system: companionPrompt.system,
      user: companionPrompt.user,
      schema: companionDialogueSchema
    }),
    client.completeJson<OracleClue>({
      system: oraclePrompt.system,
      user: oraclePrompt.user,
      schema: oracleClueSchema
    })
  ]);

  const archivePrompt = buildArchivePrompt({
    ...input,
    historySummary,
    imageInsight,
    activePlot,
    scout,
    companion,
    oracle
  });

  const archive = await client.completeJson<ArchiveStory>({
    system: archivePrompt.system,
    user: archivePrompt.user,
    schema: archiveStorySchema
  });

  let painter: PainterDraft | null = null;
  let postcardImageUrl: string | null = null;

  if (input.generatePostcard) {
    const painterPrompt = buildPainterPrompt({
      ...input,
      historySummary,
      imageInsight,
      archive
    });

    painter = await client.completeJson<PainterDraft>({
      system: painterPrompt.system,
      user: painterPrompt.user,
      schema: painterDraftSchema
    });
    postcardImageUrl = await client.generateImage({
      prompt: painter.visualPrompt
    });
  }

  const triggeredPlot: TriggeredPlot | null = activePlot
    ? { id: activePlot.id, title: activePlot.title, reason: resolution.reason }
    : null;

  const record: JourneyRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    input,
    imageInsight,
    scout,
    companion,
    oracle,
    archive,
    painter,
    postcardImageUrl,
    agentNotes: buildAgentNotes({
      scout,
      companion,
      oracle,
      archive,
      painter,
      imageInsight
    }),
    triggeredPlot
  };

  await store.saveRecord(record);
  await stateStore.commitJourney({ zoneId: input.zoneId, plot: activePlot });

  return {
    record,
    config: getPublicConfig()
  };
}
