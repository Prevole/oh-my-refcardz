import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { z } from "zod";
import { anchorIdPattern } from "./anchors";
import { getCategoryPrimaryColor, getCategoryGradientPair } from "./color-palette";

export type SavedCardLayout = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

export type SavedSectionLayout = {
  cards: SavedCardLayout[];
};

export type CheatSheetMeta = {
  slug: string;
  title: string;
  summary: string;
  color: string;
  colorFrom: string;
  categoryId: string;
  icon?: string;
};

export type CheatSheetCategory = {
  id: string;
  title: string;
  description: string;
  order: number;
  color: string;
  colorFrom: string;
  colorTo: string;
  sheets: CheatSheetMeta[];
};

// Entry schemas - each entry has exactly one key that defines its type
const titleEntrySchema = z.object({ title: z.string().min(1) });
const commandEntrySchema = z.object({ command: z.string().min(1) });
const aliasEntrySchema = z.object({
  alias: z.object({
    content: z.string().min(1),
    copy: z.string().min(1).optional(),
  }),
});
const commandExampleEntrySchema = z.object({ commandExample: z.string().min(1) });
const commandExamplesEntrySchema = z.object({ commandExamples: z.array(z.string().min(1)).min(1) });
const textEntrySchema = z.object({ text: z.string().min(1) });
const anchorEntrySchema = z.object({ anchor: z.string().regex(anchorIdPattern) });
const keysEntrySchema = z.object({ keys: z.array(z.string().min(1)).min(1) });
const fileEntrySchema = z.object({ file: z.string().min(1) });
const whereEntrySchema = z.object({ where: z.string().min(1) });
const contentValueSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "Content cannot be empty",
});
const contentEntrySchema = z.object({ content: contentValueSchema });
const contentExampleEntrySchema = z.object({ contentExample: contentValueSchema });
const settingsEntrySchema = z.object({ settings: z.array(z.string().min(1)).min(1) });
const tableRowSchema = z.object({ cols: z.array(z.string()).min(1) });
const tableEntrySchema = z.object({
  table: z.object({
    headers: z.array(z.string().min(1)).optional(),
    rows: z.array(tableRowSchema).min(1),
  }),
});
const stepEntrySchema = z.object({ step: z.string().min(1) });
const linkTypeSchema = z.enum(["github", "docs", "website"]);
const linkEntrySchema = z.object({
  link: z.object({
    type: linkTypeSchema,
    url: z.string().url(),
    label: z.string().min(1).optional(),
  }),
});

const entrySchema = z.union([
  titleEntrySchema,
  commandEntrySchema,
  aliasEntrySchema,
  commandExampleEntrySchema,
  commandExamplesEntrySchema,
  textEntrySchema,
  anchorEntrySchema,
  keysEntrySchema,
  fileEntrySchema,
  whereEntrySchema,
  contentEntrySchema,
  contentExampleEntrySchema,
  settingsEntrySchema,
  tableEntrySchema,
  stepEntrySchema,
  linkEntrySchema,
]);

const itemSchema = z
  .object({
    entries: z.array(entrySchema).min(1),
    detailedEntries: z.array(entrySchema).optional(),
  })
  .superRefine((item, context) => {
    const anchorCount = item.entries.filter((entry) => "anchor" in entry).length;

    if (anchorCount > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries"],
        message: "Items can define at most one anchor entry",
      });
    }

    if (item.detailedEntries?.some((entry) => "anchor" in entry)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["detailedEntries"],
        message: "Anchor entries are not supported in detailedEntries",
      });
    }
  });

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

// Entry types
export type TitleEntry = z.infer<typeof titleEntrySchema>;
export type CommandEntry = z.infer<typeof commandEntrySchema>;
export type AliasEntry = z.infer<typeof aliasEntrySchema>;
export type CommandExampleEntry = z.infer<typeof commandExampleEntrySchema>;
export type CommandExamplesEntry = z.infer<typeof commandExamplesEntrySchema>;
export type TextEntry = z.infer<typeof textEntrySchema>;
export type AnchorEntry = z.infer<typeof anchorEntrySchema>;
export type KeysEntry = z.infer<typeof keysEntrySchema>;
export type FileEntry = z.infer<typeof fileEntrySchema>;
export type WhereEntry = z.infer<typeof whereEntrySchema>;
export type ContentEntry = z.infer<typeof contentEntrySchema>;
export type ContentExampleEntry = z.infer<typeof contentExampleEntrySchema>;
export type SettingsEntry = z.infer<typeof settingsEntrySchema>;
export type TableRow = z.infer<typeof tableRowSchema>;
export type TableEntry = z.infer<typeof tableEntrySchema>;
export type StepEntry = z.infer<typeof stepEntrySchema>;
export type LinkEntry = z.infer<typeof linkEntrySchema>;

export type CheatSheetEntry = z.infer<typeof entrySchema>;
export type CheatSheetItem = z.infer<typeof itemSchema>;
export type CheatSheetCard = z.infer<typeof cardSchema>;
export type CheatSheetSection = z.infer<typeof sectionSchema>;
export type YamlCheatSheet = z.infer<typeof yamlCheatSheetSchema>;

export type YamlCheatSheetWithMeta = YamlCheatSheet & {
  colorFrom: string;
  categoryId: string;
  savedLayout?: SavedSectionLayout[];
};

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

type ParsedSheet = {
  file: SheetFile;
  data: YamlCheatSheet;
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

function parseYamlCheatSheet(raw: string, fileLabel: string): YamlCheatSheet {
  const parsed = yamlCheatSheetSchema.safeParse(load(raw));
  if (!parsed.success) {
    throw new Error(
      `Invalid YAML cheatsheet ${fileLabel}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
        .join(", ")}`
    );
  }

  return parsed.data;
}

async function getSheetFileBySlug(slug: string): Promise<SheetFile | null> {
  const files = await listSheetFiles(contentDirectory);
  assertUniqueSlugs(files);
  return files.find((file) => file.slug === slug) ?? null;
}

async function readSheetFile(file: SheetFile): Promise<YamlCheatSheet> {
  const raw = await fs.readFile(file.filePath, "utf8");
  return parseYamlCheatSheet(raw, path.relative(contentDirectory, file.filePath));
}

async function readLayoutFile(yamlFilePath: string): Promise<SavedSectionLayout[] | null> {
  const layoutPath = yamlFilePath.replace(/\.yaml$/, ".layout.json");
  try {
    const raw = await fs.readFile(layoutPath, "utf8");
    return JSON.parse(raw) as SavedSectionLayout[];
  } catch {
    return null;
  }
}

async function readParsedSheetBySlug(slug: string): Promise<ParsedSheet | null> {
  const file = await getSheetFileBySlug(slug);
  if (!file) {
    return null;
  }

  try {
    const data = await readSheetFile(file);
    return { file, data };
  } catch (error) {
    /* v8 ignore start -- defensive: file deleted between listing and reading */
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    /* v8 ignore stop */

    throw error;
  }
}

function getSheetCategoryMeta(categoryPath: string | null) {
  const categoryId = categoryPath ?? "__root__";
  const folderName = categoryId === "__root__" ? null : categoryId;
  const parsedFolder = folderName ? parseFolderName(folderName) : { order: -1, id: "general" };

  return {
    categoryId,
    folderName,
    order: parsedFolder.order,
    fallbackName: parsedFolder.id,
    categoryColor: getCategoryPrimaryColor(parsedFolder.order),
  };
}

async function readCategoryMeta(categoryPath: string | null): Promise<{ title: string; description: string }> {
  /* v8 ignore start -- defensive: root category has no meta file */
  if (!categoryPath) {
    return {
      title: "General",
      description: "Uncategorized cheat sheets.",
    };
  }
  /* v8 ignore stop */

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
  return (await readParsedSheetBySlug(slug))?.data ?? null;
}

export async function getYamlCheatSheetWithMeta(slug: string): Promise<YamlCheatSheetWithMeta | null> {
  const parsedSheet = await readParsedSheetBySlug(slug);
  /* v8 ignore next -- defensive: sheet not found by slug */
  if (!parsedSheet) {
    return null;
  }

  const { categoryId, categoryColor } = getSheetCategoryMeta(parsedSheet.file.categoryPath);
  const savedLayout = await readLayoutFile(parsedSheet.file.filePath);

  return {
    ...parsedSheet.data,
    colorFrom: categoryColor,
    categoryId,
    ...(savedLayout && { savedLayout }),
  };
}

export async function getAllCheatSheetsMeta(): Promise<CheatSheetCategory[]> {
  const files = await listSheetFiles(contentDirectory);
  assertUniqueSlugs(files);

  const sheetsRaw = await Promise.all(
    files.map(async (file) => {
      const parsed = await readSheetFile(file);
      const { categoryId } = getSheetCategoryMeta(file.categoryPath);

      return {
        slug: file.slug,
        title: parsed.title,
        summary: parsed.summary,
        color: parsed.color,
        icon: parsed.icon,
        categoryId,
      };
    })
  );

  const grouped = new Map<string, typeof sheetsRaw>();
  for (const sheet of sheetsRaw) {
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
      const { folderName, order, fallbackName } = getSheetCategoryMeta(
        categoryId === "__root__" ? null : categoryId
      );
      const meta = await readCategoryMeta(folderName);

      return {
        id: categoryId,
        title: meta.title,
        description: meta.description,
        order,
        fallbackName,
        sheetsRaw: categorySheets,
      };
    })
  );

  categories.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.fallbackName.localeCompare(b.fallbackName);
  });

  return categories.map(({ id, title, description, order, sheetsRaw: categorySheets }) => {
    const categoryColor = getCategoryPrimaryColor(order);
    const gradientPair = getCategoryGradientPair(order);
    const sheets: CheatSheetMeta[] = categorySheets.map((sheet) => ({
      slug: sheet.slug,
      title: sheet.title,
      summary: sheet.summary,
      color: sheet.color,
      colorFrom: categoryColor,
      categoryId: sheet.categoryId,
      icon: sheet.icon,
    }));

    return {
      id,
      title,
      description,
      order,
      color: categoryColor,
      colorFrom: gradientPair.from,
      colorTo: gradientPair.to,
      sheets,
    };
  });
}
