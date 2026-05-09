import React from "react";
import { notFound } from "next/navigation";
import { SheetShortcuts } from "@/app/cheatsheets/[slug]/sheet-shortcuts";
import { SheetAccentProvider } from "@/app/cheatsheets/[slug]/sheet-accent-provider";
import { SheetHeadingNavigation } from "@/app/cheatsheets/[slug]/sheet-heading-navigation";
import { SheetLinksProvider } from "@/components/sheets/sheet-links-context";
import { SheetCommandsShell } from "@/components/sheets/sheet-commands-shell";
import { YamlSheetRenderer } from "@/components/sheets/sheet-renderer";
import { TechIcon } from "@/components/ui/tech-icon";
import { SheetInlineHelp } from "@/components/help/inline-keybinding-help";
import { getRenderableBlocks } from "@/lib/cheatsheet-shared";
import { getAllCheatSheetsMeta, getYamlCheatSheetWithMeta } from "@/lib/yaml-cheatsheets";
import cheatsheetStyles from "@/components/sheets/cheatsheet-rendering.module.css";

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
  const categories = await getAllCheatSheetsMeta();
  const sheet = await getYamlCheatSheetWithMeta(slug);

  if (!sheet) {
    notFound();
  }

  const iconName = sheet.icon ?? "default";
  const knownSlugs = categories.flatMap((category) => category.sheets.map((entry) => entry.slug));
  const headings = getRenderableBlocks(sheet).filter((block) => block.kind === "heading");

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 md:px-12">
      <SheetShortcuts />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />
      <SheetAccentProvider sheetColor={sheet.color} sheetColorFrom={sheet.colorFrom}>
        <SheetLinksProvider knownSlugs={knownSlugs}>
        <main className="relative z-10 mx-auto max-w-7xl">
          <SheetInlineHelp />
          <div className="mt-16 flex items-center gap-4">
            <TechIcon
              icon={iconName}
              className={cheatsheetStyles.headerIcon}
            />
            <h1 className={cheatsheetStyles.headerTitle}>
              {sheet.title}
            </h1>
          </div>
          <p className="mt-2 text-white/80">{sheet.summary}</p>

          <div className={`${cheatsheetStyles.content} mt-8 max-w-none`}>
            <SheetCommandsShell>
              <YamlSheetRenderer key={slug} sheetSlug={slug} sheet={sheet} />
            </SheetCommandsShell>
          </div>
        </main>
        <SheetHeadingNavigation sections={headings} sheetColor={sheet.color} sheetColorFrom={sheet.colorFrom} />
        </SheetLinksProvider>
      </SheetAccentProvider>
    </div>
  );
}
