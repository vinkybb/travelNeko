export type EncounterMode = "manual_talk" | "auto_explore";

export type JourneyRequest = {
  catName: string;
  destination: string;
  mood: string;
  travelStyle: string;
  userAction: string;
  currentArea?: string;
  /** Stable zone id (map area) used to match plot preconditions. */
  zoneId?: string;
  focusCatName?: string;
  focusCatRole?: string;
  /** Stable NPC id used to match plot preconditions and relationship deltas. */
  focusNpcId?: string;
  nearbyCats?: string[];
  encounterMode?: EncounterMode;
  imageDataUrl?: string;
  generatePostcard?: boolean;
};

/** Conditions a plot must satisfy before it is eligible to fire. */
export type PlotPreconditions = {
  zoneId?: string;
  npcId?: string;
  encounterMode?: EncounterMode;
  requiredFlags?: string[];
  forbiddenFlags?: string[];
  minZoneVisits?: number;
  minRelationship?: { npcId: string; value: number };
};

/** State mutations applied after a plot fires. */
export type PlotEffects = {
  setFlags?: string[];
  relationship?: Record<string, number>;
};

/** An authored story beat living in the plot library. */
export type PlotBeat = {
  id: string;
  title: string;
  /** One-line pitch shown to the director agent and injected as a constraint. */
  synopsis: string;
  priority: number;
  /** Tie-break weight among equal priority (defaults to 1). */
  weight?: number;
  /** When true, the plot fires at most once per game state. */
  once?: boolean;
  preconditions: PlotPreconditions;
  /** Ordered outline steps the generation pipeline must anchor the scene around. */
  beats: string[];
  effects?: PlotEffects;
};

/** Persistent game progression that gates the plot library. */
export type GameState = {
  flags: string[];
  completedPlots: string[];
  zoneVisits: Record<string, number>;
  relationship: Record<string, number>;
};

/** Summary of the plot the director chose for this encounter. */
export type TriggeredPlot = {
  id: string;
  title: string;
  reason: string;
};

export type ImageInsight = {
  mood: string;
  observedObjects: string[];
  colorPalette: string[];
  travelClue: string;
  interpretation: string;
};

export type ScoutScene = {
  title: string;
  weather: string;
  atmosphere: string;
  challenge: string;
  wonder: string;
  keepsakeHint: string;
};

export type CompanionDialogue = {
  openingLine: string;
  banter: string[];
  invitation: string;
};

export type OracleClue = {
  hiddenClue: string;
  emotionalShift: string;
  prophecy: string;
};

export type ArchiveStory = {
  chapterTitle: string;
  summary: string;
  story: string;
  memoryTags: string[];
  keepsake: string;
  nextHook: string;
};

export type PainterDraft = {
  postcardTitle: string;
  visualPrompt: string;
  styleNotes: string[];
};

export type AgentNote = {
  agentId: string;
  displayName: string;
  role: string;
  content: string;
  highlights: string[];
};

export type JourneyRecord = {
  id: string;
  createdAt: string;
  input: JourneyRequest;
  imageInsight: ImageInsight | null;
  scout: ScoutScene;
  companion: CompanionDialogue;
  oracle: OracleClue;
  archive: ArchiveStory;
  painter: PainterDraft | null;
  postcardImageUrl: string | null;
  agentNotes: AgentNote[];
  triggeredPlot: TriggeredPlot | null;
};

export type JourneyResponse = {
  record: JourneyRecord;
  config: {
    baseURL: string;
    model: string;
    visionModel: string;
    imageModel: string;
    imageGenerationEnabled: boolean;
  };
};
