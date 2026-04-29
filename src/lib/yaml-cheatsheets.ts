import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { z } from "zod";

export type CheatSheetMeta = {
  slug: string;
  title: string;
  summary: string;
  color: string;
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const commandItemSchema = z.object({
  type: z.literal("command"),
  title: z.string().min(1),
  command: z.string().min(1),
  description: z.string().optional(),
  examples: z.array(z.string()).optional(),
});

const shortcutItemSchema = z.object({
  type: z.literal("shortcut"),
  keys: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
});

const itemSchema = z.discriminatedUnion("type", [commandItemSchema, shortcutItemSchema]);

const cardSchema = z.object({
  title: z.string().min(1),
  items: z.array(itemSchema),
});

const sectionSchema = z.object({
  title: z.string().min(1),
  cards: z.array(cardSchema),
});

export const yamlCheatSheetSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  color: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
  sections: z.array(sectionSchema),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandItem = z.infer<typeof commandItemSchema>;
export type ShortcutItem = z.infer<typeof shortcutItemSchema>;
export type CheatSheetItem = z.infer<typeof itemSchema>;
export type CheatSheetCard = z.infer<typeof cardSchema>;
export type CheatSheetSection = z.infer<typeof sectionSchema>;
export type YamlCheatSheet = z.infer<typeof yamlCheatSheetSchema>;

// ---------------------------------------------------------------------------
// FS reader
// ---------------------------------------------------------------------------

const contentDirectory = path.join(process.cwd(), "content", "cheatsheets");

export async function getYamlCheatSheet(slug: string): Promise<YamlCheatSheet | null> {
  const filePath = path.join(contentDirectory, `${slug}.yaml`);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const parsed = yamlCheatSheetSchema.safeParse(load(raw));
  if (!parsed.success) {
    throw new Error(
      `Invalid YAML cheatsheet ${slug}.yaml: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
        .join(", ")}`
    );
  }

  return parsed.data;
}

export async function getAllCheatSheetsMeta(): Promise<CheatSheetMeta[]> {
  const files = await fs.readdir(contentDirectory);
  const yamlFiles = files.filter((f) => f.endsWith(".yaml"));

  const sheets = await Promise.all(
    yamlFiles.map(async (file) => {
      const slug = file.replace(/\.yaml$/, "");
      const raw = await fs.readFile(path.join(contentDirectory, file), "utf8");
      const parsed = yamlCheatSheetSchema.safeParse(load(raw));
      if (!parsed.success) {
        throw new Error(
          `Invalid YAML cheatsheet ${file}: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
            .join(", ")}`
        );
      }
      return {
        slug,
        title: parsed.data.title,
        summary: parsed.data.summary,
        color: parsed.data.color,
      };
    })
  );

  return sheets.sort((a, b) => a.title.localeCompare(b.title));
}
