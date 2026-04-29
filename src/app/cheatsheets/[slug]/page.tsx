import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { SheetShortcuts } from "@/app/cheatsheets/[slug]/sheet-shortcuts";
import { SheetCommand } from "@/components/sheet-command";
import { SheetCode } from "@/components/sheet-code";
import { SheetCard, SheetGrid } from "@/components/sheet-grid";
import { SheetCommandsShell } from "@/components/sheet-commands-shell";
import { cheatSheetFrontmatterSchema, getCheatSheetSource } from "@/lib/cheatsheets";
import { ArrowGlyph } from "@/components/arrow-glyph";
import { Keycap } from "@/components/keycap";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function CheatSheetPage({ params }: Props) {
  const { slug } = await params;
  const source = await getCheatSheetSource(slug);

  if (!source) {
    notFound();
  }

  const { content, frontmatter } = await compileMDX<Record<string, unknown>>({
    source,
    options: {
      parseFrontmatter: true,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
      },
    },
    components: {
      SheetGrid,
      SheetCard,
      SheetCommand,
      code: SheetCode,
    },
  });
  const parsedFrontmatter = cheatSheetFrontmatterSchema.parse(frontmatter);

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 md:px-12">
      <SheetShortcuts />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />
      <main className="relative z-10 mx-auto max-w-7xl" style={{ "--sheet-accent": parsedFrontmatter.color } as React.CSSProperties}>
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
        <h1 className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: parsedFrontmatter.color }}>
          {parsedFrontmatter.title}
        </h1>
        <p className="mt-2 max-w-2xl text-white/80">{parsedFrontmatter.summary}</p>

        <div className="sheet-content mt-8 max-w-none">
          <SheetCommandsShell>
            {content}
          </SheetCommandsShell>
        </div>
      </main>
    </div>
  );
}
