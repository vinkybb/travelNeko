import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runJourney } from "../lib/orchestrator";

async function main() {
  const required = ["DEFAULT_BASE_URL", "DEFAULT_MODEL", "STEP_API_KEY"] as const;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "travel-neko-smoke-"));
  process.env.JOURNAL_PATH = path.join(tempDirectory, "smoke-journals.json");
  process.env.ENABLE_IMAGE_GENERATION = process.env.ENABLE_IMAGE_GENERATION || "false";

  try {
    const result = await runJourney({
      catName: "团子",
      destination: "雾灯港",
      mood: "准备结识新朋友",
      travelStyle: "边走边收集传说",
      userAction: "想找会讲港口秘密的猫，并把这段经历记进手账",
      generatePostcard: process.env.ENABLE_IMAGE_GENERATION === "true"
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          recordId: result.record.id,
          title: result.record.archive.chapterTitle,
          summary: result.record.archive.summary,
          tags: result.record.archive.memoryTags,
          model: result.config.model,
          visionModel: result.config.visionModel,
          imageGenerationEnabled: result.config.imageGenerationEnabled
        },
        null,
        2
      )
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

