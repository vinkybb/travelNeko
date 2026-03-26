export type JourneyRequest = {
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
  imageDataUrl?: string;
  generatePostcard?: boolean;
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
