import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SheetShortcuts } from "@/app/cheatsheets/[slug]/sheet-shortcuts";
import { SheetCommandsShell } from "@/components/sheet-commands-shell";
import { YamlSheetRenderer } from "@/components/yaml-sheet-renderer";
import { getYamlCheatSheet } from "@/lib/yaml-cheatsheets";
import { ArrowGlyph } from "@/components/arrow-glyph";
import { Keycap } from "@/components/keycap";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function CheatSheetPage({ params }: Props) {
  const { slug } = await params;
  const sheet = await getYamlCheatSheet(slug);

  if (!sheet) {
    notFound();
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 md:px-12">
      <SheetShortcuts />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />
      <main className="relative z-10 mx-auto max-w-7xl" style={{ "--sheet-accent": sheet.color } as React.CSSProperties}>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs text-white/75">
          <Link href="/" className="transition hover:text-white">{"<- Back to grid"}</Link>
          <span>with</span>
          <Keycap><span className="small-caps">esc</span></Keycap>
          <span>or</span>
          <Keycap>⌫</Keycap>
          <span>, navigate with</span>
          <Keycap>h<span className="text-white/30 font-normal">|</span>j<span className="text-white/30 font-normal">|</span>k<span className="text-white/30 font-normal">|</span>l</Keycap>
          <span>or</span>
          <span className="keycap"><ArrowGlyph direction="left" className="keycap-arrow" /><span className="text-white/30 font-normal">|</span><ArrowGlyph direction="up" className="keycap-arrow" /><span className="text-white/30 font-normal">|</span><ArrowGlyph direction="down" className="keycap-arrow" /><span className="text-white/30 font-normal">|</span><ArrowGlyph direction="right" className="keycap-arrow" /></span>
          <span>, copy with</span>
          <Keycap>y</Keycap>
          <span>, example with</span>
          <Keycap>i</Keycap>
          <span>.</span>
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: sheet.color }}>
          {sheet.title}
        </h1>
        <p className="mt-2 max-w-2xl text-white/80">{sheet.summary}</p>

        <div className="sheet-content mt-8 max-w-none">
          <SheetCommandsShell>
            <YamlSheetRenderer sheet={sheet} />
          </SheetCommandsShell>
        </div>
      </main>
    </div>
  );
}
