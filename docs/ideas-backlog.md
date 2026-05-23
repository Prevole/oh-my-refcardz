# Ideas Backlog

Loose ideas that have come up during development but are not yet
scheduled. Each entry should capture *why* the idea exists (the
problem) and what would need to be true to justify investing in it.

## Per-binding propagation control

**Surfaced during**: Phase G feedback round on settings UX (`feature/layout-v3`).

**Problem**: The scope cascade today is "all or nothing per scope": a
scope is either `modal` (event stops here on no match) or non-modal
(event cascades down). There is no way to say "this *specific*
binding should never propagate, even though the scope is non-modal".

**Concrete pain point that motivated the note**: when we removed
modality on `layout-navigation` / `layout-move` / `layout-resize` to
let mode-switch keybindings live in the parent `layout` scope (Phase
G2), we became vulnerable to lower scopes (`sheet`, `global`)
matching `Escape` or other shared keys and triggering unintended
actions. We solved this case by checking that `global`/`sheet` does
not bind `Escape` to anything harmful, but the problem is structural.

**Proposed shape (rough)**: a per-binding flag in the config:

```ts
{
  id: ACTION_IDS.LAYOUT_EXIT,
  combos: [key("Escape")],
  propagation: "stop"  // or "fall-through" (default)
}
```

The dispatcher would `event.preventDefault()` and skip the cascade
when an action with `propagation: "stop"` matches, even if the scope
itself is non-modal.

**Why we did not build it yet**: speculative — we have no second use
case beyond the hypothetical one above, and "modal scope" already
covers the 90% case. Two data points before building.

**When to revisit**: if we end up with at least two real cases where
a non-modal scope wants to swallow a specific shared key without
becoming fully modal. Likely candidates: developer overlays, future
command palettes.
