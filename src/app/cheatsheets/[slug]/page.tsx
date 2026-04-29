import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { SheetShortcuts } from "@/app/cheatsheets/[slug]/sheet-shortcuts";
import { SheetCode } from "@/components/sheet-code";
import { SheetCard, SheetGrid } from "@/components/sheet-grid";
import { cheatSheetFrontmatterSchema, getCheatSheetSource } from "@/lib/cheatsheets";

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
      code: SheetCode,
    },
  });
  const parsedFrontmatter = cheatSheetFrontmatterSchema.parse(frontmatter);

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 md:px-12">
      <SheetShortcuts />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />
      <main className="relative z-10 mx-auto max-w-7xl">
        <Link href="/" className="font-mono text-xs text-white/75 transition hover:text-white">
          {"<- Back to grid (Esc)"}
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: parsedFrontmatter.color }}>
          {parsedFrontmatter.title}
        </h1>
        <p className="mt-2 max-w-2xl text-white/80">{parsedFrontmatter.summary}</p>

        <div className="sheet-content mt-8 max-w-none">
          {content}
        </div>
      </main>
    </div>
  );
}
