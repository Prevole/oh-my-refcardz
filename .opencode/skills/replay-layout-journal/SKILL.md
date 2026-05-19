---
name: replay-layout-journal
description: When the user reports a layout bug with a recorded debug session, replay the journal to compare engine behavior against the recording and diagnose divergence.
---

# Replaying a layout debug journal

Use this workflow when a user reports a layout glitch and provides a recorded
session (path to a `.debug-sessions/*.json` file or pasted contents).

## Prerequisites

1. **A session JSON file** under `.debug-sessions/` produced by the in-app
   debug recorder (see `docs/architecture.md`, debug section).
2. The session must contain an `engine` field with `gridColumns` and
   `constraints`. Sessions recorded before the engine refactor (without this
   field) cannot be replayed and must be discarded.

## Step 1: Inspect the session

Quickly summarize the recording before replaying:

```bash
jq '{id, page, duration, eventCount, sessionCount: ([.events[] | select(.event.type=="session.start")] | length)}' <session-file>
```

If the session has many engine sessions, ask the user which one is suspect
(by index or by description).

## Step 2: Run the replay script

```bash
npx tsx scripts/replay-layout-journal.ts <path-to-session.json>
```

The script reconstructs the initial layout, re-runs `applyOperation` for each
recorded engine session, and diffs the produced events and final layout against
the recording.

Expected outputs:

- **`OK`** for every session: the engine reproduces the recording exactly. The
  bug is upstream of the engine (input mapping, persistence, rendering) or
  downstream (visual rendering of the same correct positions).
- **`FAIL`** for one or more sessions: the engine no longer reproduces what
  the user observed. Inspect the diff — it points to the exact event index
  where behavior diverges.

## Step 3: Interpret the diff

The script reports two kinds of divergence:

1. **Event mismatch** — the replayed event stream differs from the recorded
   one. The diff shows the recorded vs replayed event side by side. Common
   causes:
   - Engine code changed semantics (regression).
   - The recorded session itself was corrupted or partially captured.
   - `gridColumns` or `constraints` recorded do not match what the app
     actually used.
2. **Final layout mismatch** — the engine ended in a different state. Each
   differing block is listed with its recorded vs replayed position.

## Step 4: Reproduce the failing case as a unit test

When the diff identifies a clear regression, encode it as a Vitest test in
`src/lib/layout/engine/step.test.ts` (or `engine.test.ts` for orchestration
issues). Use the recorded `initial`, `operation`, `gridColumns`, and the
expected positions from the recording as the test fixture. This way the bug
is locked down before fixing the engine.

## Step 5: Discuss findings with the user

Present:

1. Whether the engine reproduces the recording (OK/FAIL).
2. If FAIL: which event diverged, the recorded vs replayed values, your
   hypothesis on the root cause.
3. If OK: the bug is outside the engine. Suggest investigating the chain
   between input event and `applyOperation` call (mouse hooks, keyboard
   hooks, persistence round-trip) or the chain between `applyOperation`
   result and DOM rendering.

Wait for user input before changing engine code.

## References

- `docs/layout-engine.md` — engine contract, event schema.
- `docs/layout-actions.md` — input-to-engine mapping.
- `src/lib/debug/types.ts` — `DebugSession` shape.
- `scripts/replay-layout-journal.ts` — the script itself.
