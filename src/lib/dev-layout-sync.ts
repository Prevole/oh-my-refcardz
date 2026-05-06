import type { SectionLayoutState } from "@/components/sheets/layout/layout-types";

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 1000;

export function syncLayoutToDev(slug: string, layouts: SectionLayoutState[]): void {
  const existing = pendingTimers.get(slug);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingTimers.delete(slug);

    fetch(`/api/dev/layouts/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layouts),
    }).catch((err) => {
      console.warn(`[dev] Failed to sync layout for ${slug}:`, err);
    });
  }, DEBOUNCE_MS);

  pendingTimers.set(slug, timer);
}
