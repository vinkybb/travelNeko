import { randomUUID } from "node:crypto";

import { getPublicConfig } from "./config";
import { JsonJournalStore } from "./journal-store";
import {
  buildArchivePrompt,
  buildCompanionPrompt,
  buildOraclePrompt,
  buildPainterPrompt,
  buildScoutPrompt
} from "./prompts";
import { StepJourneyClient, type JourneyLLMClient } from "./step-client";
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
  ScoutScene
} from "./types";

type RunJourneyDependencies = {
  client?: JourneyLLMClient;
  store?: JsonJournalStore;
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

  return client.completeJson<ImageInsight>({
    model: getPublicConfig().visionModel,
    system:
      "You are Oracle Cat's vision lens. Analyze the uploaded travel image for story-relevant details. Respond with a single JSON object only.",
    user: `Describe the image in story-game terms and return JSON with keys:
- mood
- observedObjects (array)
- colorPalette (array)
- travelClue
- interpretation`,
    imageDataUrl
  });
}

export async function runJourney(
  input: JourneyRequest,
  dependencies: RunJourneyDependencies = {}
): Promise<JourneyResponse> {
  const client = dependencies.client || new StepJourneyClient();
  const store = dependencies.store || new JsonJournalStore();
  const history = await store.listRecords();
  const historySummary = summarizeHistory(history);
  const imageInsight = await maybeAnalyseImage(client, input.imageDataUrl);

  const scoutPrompt = buildScoutPrompt({
    ...input,
    historySummary,
    imageInsight
  });

  const scout = await client.completeJson<ScoutScene>({
    system: scoutPrompt.system,
    user: scoutPrompt.user
  });

  const companionPrompt = buildCompanionPrompt({
    ...input,
    historySummary,
    imageInsight,
    scout
  });
  const oraclePrompt = buildOraclePrompt({
    ...input,
    historySummary,
    imageInsight,
    scout
  });

  const [companion, oracle] = await Promise.all([
    client.completeJson<CompanionDialogue>({
      system: companionPrompt.system,
      user: companionPrompt.user
    }),
    client.completeJson<OracleClue>({
      system: oraclePrompt.system,
      user: oraclePrompt.user
    })
  ]);

  const archivePrompt = buildArchivePrompt({
    ...input,
    historySummary,
    imageInsight,
    scout,
    companion,
    oracle
  });

  const archive = await client.completeJson<ArchiveStory>({
    system: archivePrompt.system,
    user: archivePrompt.user
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
      user: painterPrompt.user
    });
    postcardImageUrl = await client.generateImage({
      prompt: painter.visualPrompt
    });
  }

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
    })
  };

  await store.saveRecord(record);

  return {
    record,
    config: getPublicConfig()
  };
}
