import type { BlockLayoutState } from "@/components/sheets/layout/layout-types";

/**
 * Push the current layout state to the dev backend, which persists it back
 * into the YAML cheatsheet file.
 *
 * Manual: triggered explicitly by the LAYOUT_DEV_SAVE action; there is no
 * automatic debounce. Callers should guard with `process.env.NODE_ENV` if
 * they want to limit this to development builds.
 *
 * Returns the fetch promise so callers can chain UI feedback.
 */
export function syncLayoutToDev(slug: string, layouts: BlockLayoutState[]): Promise<Response> {
  return fetch(`/api/dev/layouts/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layouts),
  });
}
