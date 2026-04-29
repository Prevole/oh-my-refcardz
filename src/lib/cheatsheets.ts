import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

export type CheatSheetMeta = {
  slug: string;
  title: string;
  summary: string;
  color: string;
};

export const cheatSheetFrontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  color: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
});

export type CheatSheetFrontmatter = z.infer<typeof cheatSheetFrontmatterSchema>;

const contentDirectory = path.join(process.cwd(), "content", "cheatsheets");

export async function getAllCheatSheetsMeta(): Promise<CheatSheetMeta[]> {
  const files = await fs.readdir(contentDirectory);
  const mdxFiles = files.filter((file) => file.endsWith(".mdx"));

  const sheets = await Promise.all(
    mdxFiles.map(async (file) => {
      const slug = file.replace(/\.mdx$/, "");
      const source = await fs.readFile(path.join(contentDirectory, file), "utf8");
      const { data } = matter(source);
      const frontmatter = parseFrontmatter(data, file);

      return {
        slug,
        title: frontmatter.title,
        summary: frontmatter.summary,
        color: frontmatter.color,
      };
    })
  );

  return sheets.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getCheatSheetSource(slug: string): Promise<string | null> {
  const filePath = path.join(contentDirectory, `${slug}.mdx`);

  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseFrontmatter(data: unknown, file: string): CheatSheetFrontmatter {
  const parsed = cheatSheetFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid frontmatter in ${file}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"} ${issue.message}`)
        .join(", ")}`
    );
  }

  return parsed.data;
}
