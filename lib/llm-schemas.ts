import { z } from "zod";

/** Runtime validation for model JSON outputs (aligned with lib/types.ts). */
export const imageInsightSchema = z.object({
  mood: z.string(),
  observedObjects: z.array(z.string()),
  colorPalette: z.array(z.string()),
  travelClue: z.string(),
  interpretation: z.string()
});

export const scoutSceneSchema = z.object({
  title: z.string(),
  weather: z.string(),
  atmosphere: z.string(),
  challenge: z.string(),
  wonder: z.string(),
  keepsakeHint: z.string()
});

export const companionDialogueSchema = z.object({
  openingLine: z.string(),
  banter: z.array(z.string()),
  invitation: z.string()
});

export const oracleClueSchema = z.object({
  hiddenClue: z.string(),
  emotionalShift: z.string(),
  prophecy: z.string()
});

export const archiveStorySchema = z.object({
  chapterTitle: z.string(),
  summary: z.string(),
  story: z.string(),
  memoryTags: z.array(z.string()),
  keepsake: z.string(),
  nextHook: z.string()
});

export const painterDraftSchema = z.object({
  postcardTitle: z.string(),
  visualPrompt: z.string(),
  styleNotes: z.array(z.string())
});
