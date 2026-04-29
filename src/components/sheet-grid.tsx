import type { ReactNode } from "react";

export function SheetGrid({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</section>;
}

export function SheetCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-white/15 bg-white/8 p-5 text-left backdrop-blur transition duration-150 hover:border-white/25 hover:bg-white/12">
      <h2 className="text-lg font-semibold text-[var(--accent)]">{title}</h2>
      <div className="mt-3">{children}</div>
    </article>
  );
}
