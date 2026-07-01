import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getAppConfig } from "./config";
import type { GameState, PlotBeat } from "./types";

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function emptyState(): GameState {
  return {
    flags: [],
    completedPlots: [],
    zoneVisits: {},
    relationship: {}
  };
}

/** Coerce arbitrary JSON into a well-formed GameState without throwing. */
function normalizeState(value: unknown): GameState {
  const base = emptyState();
  if (typeof value !== "object" || value === null) {
    return base;
  }

  const record = value as Record<string, unknown>;
  const toStringArray = (input: unknown) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === "string") : [];
  const toNumberRecord = (input: unknown) => {
    const out: Record<string, number> = {};
    if (typeof input === "object" && input !== null) {
      for (const [key, raw] of Object.entries(input)) {
        if (typeof raw === "number" && Number.isFinite(raw)) {
          out[key] = raw;
        }
      }
    }
    return out;
  };

  return {
    flags: toStringArray(record.flags),
    completedPlots: toStringArray(record.completedPlots),
    zoneVisits: toNumberRecord(record.zoneVisits),
    relationship: toNumberRecord(record.relationship)
  };
}

export interface GameStateStore {
  getState(): Promise<GameState>;
  commitJourney(args: { zoneId?: string; plot?: PlotBeat | null }): Promise<GameState>;
}

export class JsonGameStateStore implements GameStateStore {
  constructor(private readonly filePath = getAppConfig().gameStatePath) {}

  private async ensureFile() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (isEnoent(error)) {
        await this.writeState(emptyState());
        return;
      }
      throw error;
    }
  }

  private async writeState(state: GameState) {
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async getState(): Promise<GameState> {
    await this.ensureFile();
    const raw = await readFile(this.filePath, "utf8");

    try {
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.error(
        `[JsonGameStateStore] Failed to parse JSON at ${this.filePath}:`,
        error instanceof Error ? error.message : error
      );
      return emptyState();
    }
  }

  /**
   * Record that a journey happened: bump the zone visit counter and, when a
   * plot fired, mark it complete (if once), set flags, and apply relationship
   * deltas. Returns the updated state.
   */
  async commitJourney({ zoneId, plot }: { zoneId?: string; plot?: PlotBeat | null }) {
    const state = await this.getState();

    if (zoneId) {
      state.zoneVisits[zoneId] = (state.zoneVisits[zoneId] ?? 0) + 1;
    }

    if (plot) {
      if (plot.once && !state.completedPlots.includes(plot.id)) {
        state.completedPlots.push(plot.id);
      }

      for (const flag of plot.effects?.setFlags ?? []) {
        if (!state.flags.includes(flag)) {
          state.flags.push(flag);
        }
      }

      for (const [npcId, delta] of Object.entries(plot.effects?.relationship ?? {})) {
        state.relationship[npcId] = (state.relationship[npcId] ?? 0) + delta;
      }
    }

    await this.writeState(state);
    return state;
  }
}
