import { plotDirectorSchema } from "./llm-schemas";
import { buildPlotDirectorPrompt } from "./prompts";
import type { JourneyLLMClient } from "./openai-journey-client";
import type { EncounterMode, GameState, PlotBeat } from "./types";

export type PlotResolverContext = {
  zoneId?: string;
  npcId?: string;
  encounterMode?: EncounterMode;
  catName: string;
  mood: string;
  travelStyle: string;
  userAction: string;
  currentArea?: string;
  focusCatName?: string;
  focusCatRole?: string;
  historySummary: string;
};

export type PlotResolution = {
  plot: PlotBeat | null;
  reason: string;
  /** Plots that passed hard preconditions, before the director's judgment. */
  candidates: PlotBeat[];
};

/** Hard, deterministic gate. A plot must clear every declared precondition. */
export function matchesPreconditions(
  plot: PlotBeat,
  state: GameState,
  context: PlotResolverContext
): boolean {
  const pre = plot.preconditions;

  if (plot.once && state.completedPlots.includes(plot.id)) {
    return false;
  }
  if (pre.zoneId && pre.zoneId !== context.zoneId) {
    return false;
  }
  if (pre.npcId && pre.npcId !== context.npcId) {
    return false;
  }
  if (pre.encounterMode && pre.encounterMode !== context.encounterMode) {
    return false;
  }
  if (pre.requiredFlags?.some((flag) => !state.flags.includes(flag))) {
    return false;
  }
  if (pre.forbiddenFlags?.some((flag) => state.flags.includes(flag))) {
    return false;
  }
  if (pre.minZoneVisits !== undefined) {
    const zoneId = pre.zoneId ?? context.zoneId;
    const visits = zoneId ? state.zoneVisits[zoneId] ?? 0 : 0;
    if (visits < pre.minZoneVisits) {
      return false;
    }
  }
  if (pre.minRelationship) {
    const score = state.relationship[pre.minRelationship.npcId] ?? 0;
    if (score < pre.minRelationship.value) {
      return false;
    }
  }

  return true;
}

/** Deterministic fallback: highest priority wins, weight breaks ties. */
function pickByPriority(candidates: PlotBeat[]): PlotBeat {
  return [...candidates].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return (b.weight ?? 1) - (a.weight ?? 1);
  })[0];
}

/**
 * Resolve which plot (if any) should fire.
 *
 * 1. Rule prefilter — keep only plots whose hard preconditions are satisfied.
 * 2. Director judgment — when enabled and a client is available, an LLM picks
 *    the most fitting candidate or declines; otherwise fall back to priority.
 */
export async function resolvePlot(args: {
  catalog: PlotBeat[];
  state: GameState;
  context: PlotResolverContext;
  client?: JourneyLLMClient;
  directorEnabled?: boolean;
}): Promise<PlotResolution> {
  const { catalog, state, context, client, directorEnabled = true } = args;

  const candidates = catalog.filter((plot) => matchesPreconditions(plot, state, context));

  if (candidates.length === 0) {
    return { plot: null, reason: "No plot cleared its preconditions.", candidates };
  }

  if (!directorEnabled || !client) {
    const plot = pickByPriority(candidates);
    return { plot, reason: `Rule-based pick by priority: ${plot.title}.`, candidates };
  }

  const prompt = buildPlotDirectorPrompt(context, candidates);
  const decision = await client.completeJson({
    system: prompt.system,
    user: prompt.user,
    schema: plotDirectorSchema
  });

  if (!decision.selectedPlotId) {
    return { plot: null, reason: decision.reason || "Director kept it free-form.", candidates };
  }

  const selected = candidates.find((plot) => plot.id === decision.selectedPlotId);
  if (!selected) {
    // Director hallucinated an id outside the candidate set: fail safe to free-form.
    return {
      plot: null,
      reason: `Director returned unknown plot id "${decision.selectedPlotId}".`,
      candidates
    };
  }

  return { plot: selected, reason: decision.reason || `Director chose ${selected.title}.`, candidates };
}
