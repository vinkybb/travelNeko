import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { getAppConfig } from "./config";
import type { PlotBeat } from "./types";

const plotPreconditionsSchema = z.object({
  zoneId: z.string().optional(),
  npcId: z.string().optional(),
  encounterMode: z.enum(["manual_talk", "auto_explore"]).optional(),
  requiredFlags: z.array(z.string()).optional(),
  forbiddenFlags: z.array(z.string()).optional(),
  minZoneVisits: z.number().int().nonnegative().optional(),
  minRelationship: z
    .object({ npcId: z.string(), value: z.number() })
    .optional()
});

const plotEffectsSchema = z.object({
  setFlags: z.array(z.string()).optional(),
  relationship: z.record(z.string(), z.number()).optional()
});

export const plotBeatSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  synopsis: z.string().min(1),
  priority: z.number(),
  weight: z.number().positive().optional(),
  once: z.boolean().optional(),
  preconditions: plotPreconditionsSchema,
  beats: z.array(z.string().min(1)).min(1),
  effects: plotEffectsSchema.optional()
});

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

const catalogCache = new Map<string, PlotBeat[]>();

/**
 * Load and validate every plot file in a directory. A missing directory yields
 * an empty catalog, which safely falls back to free-form encounters.
 */
export async function loadPlotCatalog(
  directory = getAppConfig().plotsDir
): Promise<PlotBeat[]> {
  const cached = catalogCache.get(directory);
  if (cached) {
    return cached;
  }

  let fileNames: string[];
  try {
    fileNames = await readdir(directory);
  } catch (error) {
    if (isEnoent(error)) {
      catalogCache.set(directory, []);
      return [];
    }
    throw error;
  }

  const jsonFiles = fileNames.filter((name) => name.endsWith(".json")).sort();
  const plots: PlotBeat[] = [];
  const seenIds = new Set<string>();

  for (const fileName of jsonFiles) {
    const filePath = path.join(directory, fileName);
    const raw = await readFile(filePath, "utf8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `[plot-library] ${fileName} is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const result = plotBeatSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `[plot-library] ${fileName} does not match the plot schema: ${result.error.message}`
      );
    }

    if (seenIds.has(result.data.id)) {
      throw new Error(`[plot-library] Duplicate plot id "${result.data.id}" in ${fileName}.`);
    }
    seenIds.add(result.data.id);
    plots.push(result.data);
  }

  catalogCache.set(directory, plots);
  return plots;
}

/** Test helper: drop cached catalogs so a fresh directory is re-read. */
export function clearPlotCatalogCache() {
  catalogCache.clear();
}
