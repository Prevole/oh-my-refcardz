/**
 * Replay a recorded debug session and compare the engine's behavior against
 * the recorded events.
 *
 * Usage:
 *   tsx scripts/replay-layout-journal.ts <path-to-session.json>
 *
 * The session must have been recorded with the current engine version (the
 * `engine` field must be present with `gridColumns` and `constraints`).
 *
 * For each engine session captured in the recording (delimited by
 * `session.start` / `session.end`), this script:
 *   1. Reconstructs the initial layout from `session.start.initial`.
 *   2. Re-runs `applyOperation` with the recorded operation and engine setup.
 *   3. Diffs the produced events against the recorded events.
 *   4. Diffs the final layout against `session.end.final`.
 *
 * Exit code 0 if the replay matches; 1 otherwise.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { applyOperation } from "../src/lib/layout/engine";
import { createEventEmitter } from "../src/lib/layout/engine";
import type {
  BlockConstraints,
  EngineEvent,
  EngineEventEmitter,
  LayoutBlock,
  Operation,
} from "../src/lib/layout/engine";
import type {
  DebugEvent,
  DebugSession,
  EngineEventRecord,
} from "../src/lib/dev-mode/types";

// -----------------------------------------------------------------------------
// CLI parsing
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: tsx scripts/replay-layout-journal.ts <path-to-session.json>");
  process.exit(2);
}

const sessionPath = path.resolve(args[0]);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type SessionSlice = {
  index: number;
  opId: string;
  initial: LayoutBlock[];
  operation: Operation;
  recordedEvents: EngineEvent[];
  /** Final blocks emitted by the recorded session.end (or null if missing) */
  recordedFinal: LayoutBlock[] | null;
};

const isEngineRecord = (e: DebugEvent): e is EngineEventRecord => e.type === "engine";

/**
 * Split the recorded event stream into one slice per engine session
 * (`session.start` ... `session.end`). User actions are ignored for replay.
 */
function sliceSessions(events: DebugEvent[]): SessionSlice[] {
  const slices: SessionSlice[] = [];
  let current: SessionSlice | null = null;

  for (const wrapped of events) {
    if (!isEngineRecord(wrapped)) continue;
    const event = wrapped.event;

    if (event.type === "session.start") {
      current = {
        index: slices.length,
        opId: event.opId,
        initial: cloneBlocks(event.initial),
        operation: event.operation,
        recordedEvents: [event],
        recordedFinal: null,
      };
      slices.push(current);
      continue;
    }

    if (!current) continue;
    current.recordedEvents.push(event);

    if (event.type === "session.end" && event.opId === current.opId) {
      current.recordedFinal = cloneBlocks(event.final);
      current = null;
    }
  }

  return slices;
}

const cloneBlocks = (blocks: readonly LayoutBlock[]): LayoutBlock[] =>
  blocks.map((b) => ({ id: b.id, kind: b.kind, position: { ...b.position } }));

function deserializeConstraints(
  raw: Record<string, BlockConstraints>
): Map<string, BlockConstraints> {
  const m = new Map<string, BlockConstraints>();
  for (const [k, v] of Object.entries(raw)) m.set(k, v);
  return m;
}

/**
 * Strip volatile/expected-different fields so two event streams can be compared
 * structurally. Currently a no-op — both runs share the same opId by virtue of
 * us passing it explicitly — but kept as a hook for future hardening.
 */
const canonicalize = (e: EngineEvent): unknown => e;

function diffEvents(
  recorded: EngineEvent[],
  replayed: EngineEvent[]
): { ok: boolean; details: string[] } {
  const details: string[] = [];

  if (recorded.length !== replayed.length) {
    details.push(
      `event count differs: recorded=${recorded.length} replayed=${replayed.length}`
    );
  }

  const max = Math.max(recorded.length, replayed.length);
  for (let i = 0; i < max; i++) {
    const r = recorded[i];
    const p = replayed[i];
    const rs = JSON.stringify(canonicalize(r));
    const ps = JSON.stringify(canonicalize(p));
    if (rs !== ps) {
      details.push(`event[${i}] differs:\n  recorded: ${rs}\n  replayed: ${ps}`);
    }
  }

  return { ok: details.length === 0, details };
}

function diffBlocks(
  recorded: LayoutBlock[] | null,
  replayed: LayoutBlock[]
): { ok: boolean; details: string[] } {
  const details: string[] = [];
  if (!recorded) {
    details.push("no recorded final layout (session.end missing)");
    return { ok: false, details };
  }

  const byId = (list: LayoutBlock[]) => new Map(list.map((b) => [b.id, b]));
  const rec = byId(recorded);
  const rep = byId(replayed);

  for (const [id, rb] of rec) {
    const pb = rep.get(id);
    if (!pb) {
      details.push(`block ${id} missing in replay`);
      continue;
    }
    const rs = JSON.stringify(rb.position);
    const ps = JSON.stringify(pb.position);
    if (rs !== ps) {
      details.push(`block ${id} position differs: recorded=${rs} replayed=${ps}`);
    }
  }
  for (const id of rep.keys()) {
    if (!rec.has(id)) details.push(`block ${id} unexpected in replay`);
  }

  return { ok: details.length === 0, details };
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main(): Promise<number> {
  const raw = await fs.readFile(sessionPath, "utf8");
  const session = JSON.parse(raw) as DebugSession;

  if (!session.engine) {
    console.error(`session "${session.id}" has no engine setup — cannot replay`);
    return 2;
  }

  const gridColumns = session.engine.gridColumns;
  const constraints = deserializeConstraints(session.engine.constraints);
  const slices = sliceSessions(session.events);

  if (slices.length === 0) {
    console.log("No engine sessions found in journal — nothing to replay.");
    return 0;
  }

  console.log(`Replaying ${slices.length} engine session(s) from ${session.id}`);
  console.log(`  page: ${session.page}`);
  console.log(`  duration: ${session.duration}ms`);
  console.log("");

  let failures = 0;

  for (const slice of slices) {
    const replayedEvents: EngineEvent[] = [];
    const emitter: EngineEventEmitter = createEventEmitter();
    emitter.on((e) => replayedEvents.push(e));

    const result = applyOperation(slice.initial, slice.operation, {
      gridColumns,
      constraints,
      emitter,
      opId: slice.opId,
    });

    const eventDiff = diffEvents(slice.recordedEvents, replayedEvents);
    const finalDiff = diffBlocks(slice.recordedFinal, result.blocks);
    const ok = eventDiff.ok && finalDiff.ok;

    const tag = ok ? "OK" : "FAIL";
    console.log(
      `[${tag}] session ${slice.index} opId=${slice.opId} ` +
        `op=${describeOp(slice.operation)} events=${slice.recordedEvents.length}`
    );
    if (!eventDiff.ok) {
      console.log("  events:");
      for (const line of eventDiff.details) console.log(`    - ${line}`);
    }
    if (!finalDiff.ok) {
      console.log("  final layout:");
      for (const line of finalDiff.details) console.log(`    - ${line}`);
    }

    if (!ok) failures++;
  }

  console.log("");
  if (failures === 0) {
    console.log(`OK — all ${slices.length} session(s) replayed identically.`);
    return 0;
  }
  console.log(`FAIL — ${failures}/${slices.length} session(s) diverged from the journal.`);
  return 1;
}

function describeOp(op: Operation): string {
  if (op.kind === "move") return `move(${op.blockId}, dx=${op.dx}, dy=${op.dy})`;
  return `resize(${op.blockId}, edge=${op.edge}, delta=${op.delta})`;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(2);
  });
