import path from "node:path";

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

export function getAppConfig() {
  const cwd = process.cwd();

  const timeoutRaw = process.env.LLM_TIMEOUT_MS;
  const parsedTimeout =
    timeoutRaw !== undefined ? Number.parseInt(timeoutRaw, 10) : NaN;
  const requestTimeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : DEFAULT_REQUEST_TIMEOUT_MS;

  return {
    appName: "TravelNeko",
    baseURL: process.env.DEFAULT_BASE_URL || "https://api.openai.com/v1",
    model: process.env.DEFAULT_MODEL || "gpt-4o-mini",
    visionModel: process.env.DEFAULT_VISION_MODEL || "gpt-4o",
    imageModel: process.env.DEFAULT_IMAGE_MODEL || "dall-e-3",
    apiKey: process.env.LLM_API_KEY || "",
    journalPath:
      process.env.JOURNAL_PATH || path.join(cwd, "data", "journals.json"),
    imageGenerationEnabled: process.env.ENABLE_IMAGE_GENERATION === "true",
    requestTimeoutMs
  };
}

export function getPublicConfig() {
  const config = getAppConfig();

  return {
    baseURL: config.baseURL,
    model: config.model,
    visionModel: config.visionModel,
    imageModel: config.imageModel,
    imageGenerationEnabled: config.imageGenerationEnabled
  };
}

