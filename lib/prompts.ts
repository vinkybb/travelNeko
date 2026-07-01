import type {
  ArchiveStory,
  CompanionDialogue,
  ImageInsight,
  OracleClue,
  PainterDraft,
  PlotBeat,
  ScoutScene
} from "./types";

type JourneyPromptInput = {
  catName: string;
  destination: string;
  mood: string;
  travelStyle: string;
  userAction: string;
  currentArea?: string;
  focusCatName?: string;
  focusCatRole?: string;
  nearbyCats?: string[];
  encounterMode?: "manual_talk" | "auto_explore";
  historySummary: string;
  imageInsight: ImageInsight | null;
  /** When set, the pipeline must anchor the scene around this authored beat. */
  activePlot?: PlotBeat | null;
  scout?: ScoutScene;
  companion?: CompanionDialogue;
  oracle?: OracleClue;
  archive?: ArchiveStory;
};

export const JSON_ONLY_SUFFIX =
  "Respond with a single JSON object only. Do not wrap it in markdown fences.";

/**
 * Render the active plot as a constraint block. Returns a "free-form" note when
 * no plot fired, so downstream prompts stay explicit either way.
 */
function describeActivePlot(activePlot: PlotBeat | null | undefined) {
  if (!activePlot) {
    return "Active plot beat: none. Improvise a fresh, self-contained encounter.";
  }

  const beats = activePlot.beats.map((beat, index) => `${index + 1}. ${beat}`).join("\n");
  return `Active plot beat (you MUST anchor this encounter around it, staying faithful to its intent):
- Title: ${activePlot.title}
- Synopsis: ${activePlot.synopsis}
- Required story beats:
${beats}`;
}

function stringifyImageInsight(imageInsight: ImageInsight | null) {
  if (!imageInsight) {
    return "No uploaded image.";
  }

  return JSON.stringify(imageInsight, null, 2);
}

export function buildScoutPrompt(input: JourneyPromptInput) {
  return {
    system:
      "You are Scout Cat, an adventurous feline game master. You design the next travel scene for a cat explorer. Keep it whimsical, specific, and grounded in sensory details. " +
      JSON_ONLY_SUFFIX,
    user: `Traveler profile:
- Cat name: ${input.catName}
- Destination: ${input.destination}
- Current area: ${input.currentArea || input.destination}
- Focus cat: ${input.focusCatName || "No fixed target cat"}
- Focus cat role: ${input.focusCatRole || "Unknown"}
- Nearby cats: ${(input.nearbyCats || []).join(", ") || "No nearby cat list"}
- Encounter mode: ${input.encounterMode || "manual_talk"}
- Mood: ${input.mood}
- Travel style: ${input.travelStyle}
- Player action: ${input.userAction}
- Previous memories: ${input.historySummary}
- Image insight: ${stringifyImageInsight(input.imageInsight)}

${describeActivePlot(input.activePlot)}

Return JSON with keys:
- title
- weather
- atmosphere
- challenge
- wonder
- keepsakeHint`
  };
}

export function buildCompanionPrompt(input: JourneyPromptInput) {
  return {
    system:
      "You are Companion Cat, the social butterfly in a traveling cat ensemble. Write short, vivid dialogue that feels like a playable encounter. The focused NPC should lead the exchange, while one or two nearby cats may occasionally chime in. " +
      JSON_ONLY_SUFFIX,
    user: `Scene context:
${JSON.stringify(input.scout, null, 2)}

Traveler:
- Cat name: ${input.catName}
- Mood: ${input.mood}
- Action: ${input.userAction}
- Current area: ${input.currentArea || input.destination}
- Focus NPC: ${input.focusCatName || "No fixed target cat"} (${input.focusCatRole || "unknown role"})
- Nearby cats who may interject: ${(input.nearbyCats || []).join(", ") || "None listed"}
- Encounter mode: ${input.encounterMode || "manual_talk"}

${describeActivePlot(input.activePlot)}

Return JSON with keys:
- openingLine
- banter (array of exactly 3 short lines, each prefixed with a speaker name like "伴猫: ..."; the focus NPC should speak most, but nearby cats may occasionally interject)
- invitation`
  };
}

export function buildOraclePrompt(input: JourneyPromptInput) {
  return {
    system:
      "You are Oracle Cat, a mysterious clue finder. Extract a hidden clue from the scene and, when available, from the uploaded image insight. Make it suitable for a story game. " +
      JSON_ONLY_SUFFIX,
    user: `Scene context:
${JSON.stringify(input.scout, null, 2)}

Image insight:
${stringifyImageInsight(input.imageInsight)}

Focus NPC:
- Name: ${input.focusCatName || "No fixed target cat"}
- Role: ${input.focusCatRole || "unknown role"}
- Nearby cats: ${(input.nearbyCats || []).join(", ") || "None listed"}

Return JSON with keys:
- hiddenClue
- emotionalShift
- prophecy`
  };
}

export function buildArchivePrompt(input: JourneyPromptInput) {
  return {
    system:
      "You are Archivist Cat, keeper of travel memories. Turn the shared agent notes into a concise travel chapter and memory record in a warm storybook tone. " +
      JSON_ONLY_SUFFIX,
    user: `Traveler:
- Cat name: ${input.catName}
- Destination: ${input.destination}
- Current area: ${input.currentArea || input.destination}
- Focus cat: ${input.focusCatName || "No fixed target cat"}
- Focus cat role: ${input.focusCatRole || "unknown role"}
- Nearby cats: ${(input.nearbyCats || []).join(", ") || "None listed"}
- Encounter mode: ${input.encounterMode || "manual_talk"}
- Mood: ${input.mood}
- Travel style: ${input.travelStyle}
- Action: ${input.userAction}

Scout Cat:
${JSON.stringify(input.scout, null, 2)}

Companion Cat:
${JSON.stringify(input.companion, null, 2)}

Oracle Cat:
${JSON.stringify(input.oracle, null, 2)}

${describeActivePlot(input.activePlot)}

Return JSON with keys:
- chapterTitle
- summary
- story
- memoryTags (array of 4 to 6 items)
- keepsake
- nextHook`
  };
}

export function buildPainterPrompt(input: JourneyPromptInput) {
  return {
    system:
      "You are Painter Cat, the illustrator of the travel journal. Draft an image-generation prompt for a whimsical postcard scene with strong composition and tactile details. " +
      JSON_ONLY_SUFFIX,
    user: `Traveler:
- Cat name: ${input.catName}
- Destination: ${input.destination}

Archive:
${JSON.stringify(input.archive, null, 2)}

Image insight:
${stringifyImageInsight(input.imageInsight)}

Return JSON with keys:
- postcardTitle
- visualPrompt
- styleNotes (array of exactly 3 items)`
  };
}

type PlotDirectorInput = {
  catName: string;
  mood: string;
  travelStyle: string;
  userAction: string;
  currentArea?: string;
  focusCatName?: string;
  focusCatRole?: string;
  encounterMode?: "manual_talk" | "auto_explore";
  historySummary: string;
};

/**
 * Ask the director to pick the single most fitting plot for this moment, or to
 * decline (null) when nothing fits — the judgment layer of the trigger system.
 */
export function buildPlotDirectorPrompt(
  input: PlotDirectorInput,
  candidates: Array<Pick<PlotBeat, "id" | "title" | "synopsis" | "beats">>
) {
  const catalog = candidates
    .map(
      (plot) =>
        `- id: ${plot.id}
  title: ${plot.title}
  synopsis: ${plot.synopsis}
  beats: ${plot.beats.join(" / ")}`
    )
    .join("\n");

  return {
    system:
      "You are Plot Director, the story conductor for a travelling-cat game. You decide whether this exact moment should trigger one of the pre-authored plot beats. Only trigger a plot when it genuinely fits the player's intent, mood, and the current place; otherwise decline so the encounter stays free-form. Prefer the most emotionally resonant fit over merely eligible ones. " +
      JSON_ONLY_SUFFIX,
    user: `Current moment:
- Traveler cat: ${input.catName}
- Mood: ${input.mood}
- Travel style: ${input.travelStyle}
- Player action / intent: ${input.userAction}
- Current area: ${input.currentArea || "unknown"}
- Focus NPC: ${input.focusCatName || "none"} (${input.focusCatRole || "unknown role"})
- Encounter mode: ${input.encounterMode || "manual_talk"}
- Recent memories: ${input.historySummary}

Eligible plot candidates (already filtered by hard preconditions):
${catalog}

Return JSON with keys:
- selectedPlotId: the id of the plot to trigger now, or null to keep it free-form
- reason: one short sentence explaining the choice (in Chinese)`
  };
}
