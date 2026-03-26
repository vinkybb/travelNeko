import path from "node:path";

export function getAppConfig() {
  const cwd = process.cwd();

  return {
    appName: "TravelNeko",
    baseURL: process.env.DEFAULT_BASE_URL || "https://api.stepfun.com/v1",
    model: process.env.DEFAULT_MODEL || "step-3.5-flash",
    visionModel: process.env.DEFAULT_VISION_MODEL || "step-1o-turbo-vision",
    imageModel: process.env.DEFAULT_IMAGE_MODEL || "step-1x-medium",
    apiKey: process.env.STEP_API_KEY || process.env.OPENAI_API_KEY || "",
    journalPath:
      process.env.JOURNAL_PATH || path.join(cwd, "data", "journals.json"),
    imageGenerationEnabled: process.env.ENABLE_IMAGE_GENERATION === "true"
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

