import { test } from "@playwright/test";

// All tests in this file targeted the V1 flat keyboard layout model
// (Shift+hjkl for navigation, Alt+hjkl for move, Alt+Shift+hjkl for
// resize). That model was removed with the V2 engine rewrite and the
// hook `use-card-keyboard-v2.ts` is currently inert.
//
// Phase E of `.opencode/plans/layout-v3-completion.md` replaces this
// keyboard layer with a Zellij-style modal model (master key + n/m/r
// sub-modes, immediate-commit). The tests below will be rewritten there
// against the new bindings.
//
// We keep the file as a skipped placeholder so the suite stays
// discoverable and the rewrite has an obvious anchor point.

test.describe.skip("Keyboard layout management (legacy V1 model — replaced in Phase E)", () => {
  test("placeholder", () => {});
});
