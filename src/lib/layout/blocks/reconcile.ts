import { GRID_COLUMNS } from "../grid-constants";
import type { BlockConstraints, LayoutBlockKind } from "./block-types";
import { getBlockConstraints, isRegisteredBlockKind } from "./blocks-registry";

/**
 * Persisted layout for a single block.
 *
 * The persisted shape carries position and size only. Constraints (minimum
 * and maximum span) live in the block-type registry and are applied at
 * load time via reconcileBlockLayouts(). Never include constraints here.
 */
export type PersistedBlockLayout = {
  id: string;
  kind: LayoutBlockKind;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

/**
 * Why a block entry was dropped during reconciliation.
 */
export type DropReason = "malformed" | "unknown-kind";

/**
 * A field that drifted from the persisted value to the reconciled one.
 */
export type DriftField = "colStart" | "colSpan" | "rowSpan";

/**
 * Record of a single drift correction applied to a block.
 */
export type DriftRecord = {
  id: string;
  field: DriftField;
  from: number;
  to: number;
};

/**
 * Record of a single dropped block entry.
 */
export type DropRecord = {
  /** May be undefined if the entry was so malformed it had no readable id. */
  id: string | undefined;
  reason: DropReason;
};

/**
 * Outcome of reconciling a batch of persisted block layouts.
 */
export type ReconciliationResult = {
  /** Reconciled, ready-to-render blocks. Drift-corrected and drop-filtered. */
  blocks: PersistedBlockLayout[];
  /** True when at least one drift was corrected or one entry was dropped. */
  modified: boolean;
  /** Detailed list of corrections applied. */
  drifted: DriftRecord[];
  /** Detailed list of entries dropped, with reasons. */
  dropped: DropRecord[];
};

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Validates the structural shape of a persisted block entry. Position is
 * not range-checked here (clamping is the reconciliation step's job);
 * we only confirm fields are present and well-typed.
 */
function readPersistedShape(value: unknown): PersistedBlockLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  if (typeof v.id !== "string" || v.id.length === 0) return null;
  if (typeof v.kind !== "string") return null;
  if (!isFiniteInteger(v.colStart)) return null;
  if (!isFiniteInteger(v.rowStart)) return null;
  if (!isFiniteInteger(v.colSpan)) return null;
  if (!isFiniteInteger(v.rowSpan)) return null;

  return {
    id: v.id,
    kind: v.kind as LayoutBlockKind,
    colStart: v.colStart,
    rowStart: v.rowStart,
    colSpan: v.colSpan,
    rowSpan: v.rowSpan,
  };
}

/**
 * Reconciles one block against the constraints registered for its kind.
 * Returns the reconciled block plus any drift records, or null if the
 * block must be dropped (kind not registered).
 */
function reconcileOne(
  block: PersistedBlockLayout,
  constraints: BlockConstraints
): { block: PersistedBlockLayout; drifts: DriftRecord[] } {
  const drifts: DriftRecord[] = [];

  // Clamp size first. maxColSpan is also bounded by GRID_COLUMNS as a
  // defensive measure in case a definition declares a larger value.
  const colSpanCap = Math.min(constraints.maxColSpan, GRID_COLUMNS);
  const newColSpan = clamp(block.colSpan, constraints.minColSpan, colSpanCap);
  if (newColSpan !== block.colSpan) {
    drifts.push({ id: block.id, field: "colSpan", from: block.colSpan, to: newColSpan });
  }

  const newRowSpan = clamp(block.rowSpan, constraints.minRowSpan, constraints.maxRowSpan);
  if (newRowSpan !== block.rowSpan) {
    drifts.push({ id: block.id, field: "rowSpan", from: block.rowSpan, to: newRowSpan });
  }

  // Clamp colStart to the grid. rowStart is unconstrained: the engine
  // grows the grid downward as needed.
  let newColStart = clamp(block.colStart, 1, GRID_COLUMNS);

  // If the block now overflows to the right, shift it left so it fits.
  // newColSpan is guaranteed <= GRID_COLUMNS so this can always succeed.
  const overflow = newColStart + newColSpan - 1 - GRID_COLUMNS;
  if (overflow > 0) {
    newColStart = newColStart - overflow;
  }

  if (newColStart !== block.colStart) {
    drifts.push({ id: block.id, field: "colStart", from: block.colStart, to: newColStart });
  }

  return {
    block: {
      ...block,
      colStart: newColStart,
      colSpan: newColSpan,
      rowSpan: newRowSpan,
    },
    drifts,
  };
}

/**
 * Reconciles a batch of persisted block layouts against the current
 * block-type definitions.
 *
 * - Entries whose structural shape is invalid are dropped as "malformed".
 * - Entries whose kind is not registered are dropped as "unknown-kind".
 * - Surviving entries have colSpan, rowSpan, and colStart clamped to the
 *   registered constraints and the grid bounds. rowStart is preserved.
 * - When the clamped block would overflow the grid to the right, it is
 *   shifted left so it fits.
 *
 * Drifts and drops are reported to the console for visibility. Callers
 * may also inspect the structured `drifted` and `dropped` fields if they
 * need to persist the reconciled state back to its source (JSON file,
 * localStorage).
 */
export function reconcileBlockLayouts(input: unknown): ReconciliationResult {
  if (!Array.isArray(input)) {
    return { blocks: [], modified: false, drifted: [], dropped: [] };
  }

  const blocks: PersistedBlockLayout[] = [];
  const drifted: DriftRecord[] = [];
  const dropped: DropRecord[] = [];

  for (const entry of input) {
    const shape = readPersistedShape(entry);
    if (!shape) {
      const rawId =
        entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string"
          ? (entry as { id: string }).id
          : "";
      dropped.push({ id: rawId.length > 0 ? rawId : undefined, reason: "malformed" });
      continue;
    }

    if (!isRegisteredBlockKind(shape.kind)) {
      dropped.push({ id: shape.id, reason: "unknown-kind" });
      continue;
    }

    const constraints = getBlockConstraints(shape.kind);
    const { block, drifts } = reconcileOne(shape, constraints);
    blocks.push(block);
    drifted.push(...drifts);
  }

  if (drifted.length > 0) {
    for (const d of drifted) {
      console.warn(
        `[reconcileBlockLayouts] block "${d.id}": ${d.field} ${d.from} -> ${d.to}`
      );
    }
  }
  if (dropped.length > 0) {
    for (const d of dropped) {
      console.warn(
        `[reconcileBlockLayouts] dropped block "${d.id ?? "<no id>"}": ${d.reason}`
      );
    }
  }

  return {
    blocks,
    modified: drifted.length > 0 || dropped.length > 0,
    drifted,
    dropped,
  };
}
