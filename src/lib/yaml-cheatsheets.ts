import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { z } from "zod";

export type CheatSheetMeta = {
  slug: string;
  title: string;
  summary: string;
  color: string;
  categoryId: string;
  icon?: string;
};

export type CheatSheetCategory = {
  id: string;
  title: string;
  description: string;
  sheets: CheatSheetMeta[];
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
  icon: z.string().optional(),
  sections: z.array(sectionSchema),
});

export const categoryMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
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

const CATEGORY_META_FILES = new Set(["meta.yaml", "_meta.yaml"]);

type ParsedFolderName = {
  order: number;
  id: string;
};

type SheetFile = {
  slug: string;
  filePath: string;
  categoryPath: string | null;
};

function parseFolderName(folderName: string): ParsedFolderName {
  const match = folderName.match(/^(\d+)[-_ ]?(.*)$/);
  if (!match) {
    return { order: Number.POSITIVE_INFINITY, id: folderName };
  }

  return {
    order: Number.parseInt(match[1], 10),
    id: match[2] || folderName,
  };
}

async function listSheetFiles(directory: string, categoryPath: string | null = null): Promise<SheetFile[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: SheetFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listSheetFiles(fullPath, entry.name)));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".yaml") || CATEGORY_META_FILES.has(entry.name)) {
      continue;
    }

    files.push({
      slug: entry.name.replace(/\.yaml$/, ""),
      filePath: fullPath,
      categoryPath,
    });
  }

  return files;
}

function assertUniqueSlugs(files: SheetFile[]) {
  const slugToPath = new Map<string, string>();

  for (const file of files) {
    const existingPath = slugToPath.get(file.slug);
    if (existingPath) {
      throw new Error(
        `Duplicate slug "${file.slug}" found in ${path.relative(contentDirectory, existingPath)} and ${path.relative(contentDirectory, file.filePath)}.`
      );
    }
    slugToPath.set(file.slug, file.filePath);
  }
}

async function readCategoryMeta(categoryPath: string | null): Promise<{ title: string; description: string }> {
  if (!categoryPath) {
    return {
      title: "General",
      description: "Uncategorized cheat sheets.",
    };
  }

  const fullCategoryPath = path.join(contentDirectory, categoryPath);

  for (const metaFileName of CATEGORY_META_FILES) {
    const metaPath = path.join(fullCategoryPath, metaFileName);
    try {
      const raw = await fs.readFile(metaPath, "utf8");
      const parsed = categoryMetaSchema.safeParse(load(raw));
      if (!parsed.success) {
        throw new Error(
          `Invalid category meta in ${path.relative(contentDirectory, metaPath)}: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
            .join(", ")}`
        );
      }
      return parsed.data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  const parsed = parseFolderName(categoryPath);
  return {
    title: parsed.id,
    description: "",
  };
}

export async function getYamlCheatSheet(slug: string): Promise<YamlCheatSheet | null> {
  const files = await listSheetFiles(contentDirectory);
  assertUniqueSlugs(files);
  const candidate = files.find((file) => file.slug === slug);

  if (!candidate) {
    return null;
  }

  let raw: string;
  try {
    raw = await fs.readFile(candidate.filePath, "utf8");
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

export async function getAllCheatSheetsMeta(): Promise<CheatSheetCategory[]> {
  const files = await listSheetFiles(contentDirectory);
  assertUniqueSlugs(files);

  const sheets = await Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(file.filePath, "utf8");
      const parsed = yamlCheatSheetSchema.safeParse(load(raw));
      if (!parsed.success) {
        throw new Error(
          `Invalid YAML cheatsheet ${path.relative(contentDirectory, file.filePath)}: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
            .join(", ")}`
        );
      }
      return {
        slug: file.slug,
        title: parsed.data.title,
        summary: parsed.data.summary,
        color: parsed.data.color,
        icon: parsed.data.icon,
        categoryId: file.categoryPath ?? "__root__",
      };
    })
  );

  const grouped = new Map<string, CheatSheetMeta[]>();
  for (const sheet of sheets) {
    const group = grouped.get(sheet.categoryId);
    if (group) {
      group.push(sheet);
    } else {
      grouped.set(sheet.categoryId, [sheet]);
    }
  }

  const categories = await Promise.all(
    Array.from(grouped.entries()).map(async ([categoryId, categorySheets]) => {
      categorySheets.sort((a, b) => a.title.localeCompare(b.title));
      const folderName = categoryId === "__root__" ? null : categoryId;
      const parsedFolder = folderName ? parseFolderName(folderName) : { order: -1, id: "general" };
      const meta = await readCategoryMeta(folderName);

      return {
        id: categoryId,
        title: meta.title,
        description: meta.description,
        order: parsedFolder.order,
        fallbackName: parsedFolder.id,
        sheets: categorySheets,
      };
    })
  );

  categories.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a.fallbackName.localeCompare(b.fallbackName);
  });

  return categories.map(({ id, title, description, sheets: categorySheets }) => ({
    id,
    title,
    description,
    sheets: categorySheets,
  }));
}
