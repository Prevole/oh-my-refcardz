"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { getCheatSheetBySlug } from "@/lib/cheatsheets";

type Props = {
  params: Promise<{ slug: string }>;
};

export default function CheatSheetPage({ params }: Props) {
  const router = useRouter();
  const resolved = use(params);
  const sheet = getCheatSheetBySlug(resolved.slug);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        router.push("/");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  if (!sheet) {
    notFound();
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 md:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />
      <main className="relative z-10 mx-auto max-w-6xl">
        <Link href="/" className="font-mono text-xs text-white/75 transition hover:text-white">
          {"<- Back to grid (Esc)"}
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{sheet.title}</h1>
        <p className="mt-2 max-w-2xl text-white/80">{sheet.summary}</p>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sheet.sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-white/15 bg-white/8 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold" style={{ color: sheet.color }}>
                {section.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <li key={item.keys}>
                    <p className="font-mono text-sm text-[var(--accent)]">{item.keys}</p>
                    <p className="text-sm text-white/80">{item.description}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
