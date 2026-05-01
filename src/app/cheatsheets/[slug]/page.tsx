import React from "react";
import { notFound } from "next/navigation";
import { SheetShortcuts } from "@/app/cheatsheets/[slug]/sheet-shortcuts";
import { SheetAccentProvider } from "@/app/cheatsheets/[slug]/sheet-accent-provider";
import { SheetCommandsShell } from "@/components/sheet-commands-shell";
import { YamlSheetRenderer } from "@/components/yaml-sheet-renderer";
import { TechIcon } from "@/components/tech-icon";
import { SheetInlineHelp } from "@/components/inline-help";
import { getAllCheatSheetsMeta, getYamlCheatSheetWithMeta } from "@/lib/yaml-cheatsheets";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const categories = await getAllCheatSheetsMeta();
  return categories.flatMap((category) =>
    category.sheets.map((sheet) => ({ slug: sheet.slug }))
  );
}

export default async function CheatSheetPage({ params }: Props) {
  const { slug } = await params;
  const sheet = await getYamlCheatSheetWithMeta(slug);

  if (!sheet) {
    notFound();
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 md:px-12">
      <SheetShortcuts />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />
      <SheetAccentProvider sheetColor={sheet.color} sheetColorFrom={sheet.colorFrom}>
        <main className="relative z-10 mx-auto max-w-7xl">
          <SheetInlineHelp />
          <div className="mt-3 flex items-center gap-4">
            {sheet.icon ? (
              <TechIcon
                icon={sheet.icon}
                className="sheet-header-icon"
              />
            ) : null}
            <h1 className="sheet-header-title">
              {sheet.title}
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-white/80">{sheet.summary}</p>

          <div className="sheet-content mt-8 max-w-none">
            <SheetCommandsShell>
              <YamlSheetRenderer sheet={sheet} />
            </SheetCommandsShell>
          </div>
        </main>
      </SheetAccentProvider>
    </div>
  );
}
