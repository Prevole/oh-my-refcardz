import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { z } from "zod";
import {
  migrateSectionLayoutsToBlockLayouts,
  type CheatSheetMeta,
  type CheatSheetBlock as SharedCheatSheetBlock,
  type CheatSheetCard as SharedCheatSheetCard,
  type CheatSheetEntry as SharedCheatSheetEntry,
  type CheatSheetHeading as SharedCheatSheetHeading,
  type CheatSheetItem as SharedCheatSheetItem,
  type SavedBlockLayout,
  type SavedCardLayout,
  type SavedSectionLayout,
  type YamlCheatSheet as SharedYamlCheatSheet,
  type YamlCheatSheetWithMeta as SharedYamlCheatSheetWithMeta,
} from "./cheatsheet-shared";
import { isNewFormatArray, toOldBlockLayouts } from "./layout/migration";
import { anchorIdPattern } from "./anchors";
import { getCategoryPrimaryColor, getCategoryGradientPair } from "./color-palette";

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
const blockIdSchema = z.string().regex(anchorIdPattern);

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
  id: blockIdSchema,
  title: z.string().min(1),
  items: z.array(itemSchema),
});

const headingSchema = z.object({
  id: blockIdSchema,
  title: z.string().min(1),
  text: z.string().min(1).optional(),
});

const headingBlockSchema = z.object({ heading: headingSchema });
const cardBlockSchema = z.object({ card: cardSchema });
const blockSchema = z.union([headingBlockSchema, cardBlockSchema]);

export const yamlCheatSheetSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    color: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
    icon: z.string().optional(),
    blocks: z.array(blockSchema),
  })
  .superRefine((sheet, context) => {
    const seenIds = new Map<string, string>();
    let headingCount = 0;

    sheet.blocks.forEach((block, blockIndex) => {
      if ("heading" in block) {
        headingCount += 1;

        const headingPath = `blocks.${blockIndex}.heading.id`;
        const previousHeadingPath = seenIds.get(block.heading.id);
        if (previousHeadingPath) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blocks", blockIndex, "heading", "id"],
            message: `Duplicate block id \"${block.heading.id}\" already used at ${previousHeadingPath}`,
          });
          return;
        }

        seenIds.set(block.heading.id, headingPath);
        return;
      }

      if (headingCount === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", blockIndex, "card"],
          message: "Card blocks must appear after a heading block",
        });
      }

      const cardPath = `blocks.${blockIndex}.card.id`;
      const previousCardPath = seenIds.get(block.card.id);

      if (previousCardPath) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", blockIndex, "card", "id"],
          message: `Duplicate block id \"${block.card.id}\" already used at ${previousCardPath}`,
        });
        return;
      }

      seenIds.set(block.card.id, cardPath);
    });
  });

export const categoryMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

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
  data: SharedYamlCheatSheet;
};

export type YamlCheatSheet = SharedYamlCheatSheet;
export type YamlCheatSheetWithMeta = SharedYamlCheatSheetWithMeta;

// Compile-time guards to keep the shared client-safe types aligned with the
// server-side Zod schema.
type AssertExact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
type Assert<T extends true> = T;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertEntryType = Assert<AssertExact<z.infer<typeof entrySchema>, SharedCheatSheetEntry>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertItemType = Assert<AssertExact<z.infer<typeof itemSchema>, SharedCheatSheetItem>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertCardType = Assert<AssertExact<z.infer<typeof cardSchema>, SharedCheatSheetCard>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertHeadingType = Assert<AssertExact<z.infer<typeof headingSchema>, SharedCheatSheetHeading>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertBlockType = Assert<AssertExact<z.infer<typeof blockSchema>, SharedCheatSheetBlock>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertSheetType = Assert<AssertExact<z.infer<typeof yamlCheatSheetSchema>, SharedYamlCheatSheet>>;

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

function parseYamlCheatSheet(raw: string, fileLabel: string): SharedYamlCheatSheet {
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

async function readSheetFile(file: SheetFile): Promise<SharedYamlCheatSheet> {
  const raw = await fs.readFile(file.filePath, "utf8");
  return parseYamlCheatSheet(raw, path.relative(contentDirectory, file.filePath));
}

function isSavedCardLayout(value: unknown): value is SavedCardLayout {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (
    !("colStart" in value) ||
    !("rowStart" in value) ||
    !("colSpan" in value) ||
    !("rowSpan" in value)
  ) {
    return false;
  }

  return Boolean(
      typeof value.colStart === "number" &&
      typeof value.rowStart === "number" &&
      typeof value.colSpan === "number" &&
      typeof value.rowSpan === "number"
  );
}

function isSavedSectionLayout(value: unknown): value is SavedSectionLayout {
  return Boolean(
    value &&
      typeof value === "object" &&
      "cards" in value &&
      Array.isArray(value.cards) &&
      value.cards.every((card) => isSavedCardLayout(card))
  );
}

function isSavedBlockLayout(value: unknown): value is SavedBlockLayout {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("id" in value) || !("kind" in value)) {
    return false;
  }

  return Boolean(
      typeof value.id === "string" &&
      (value.kind === "heading" || value.kind === "card") &&
      isSavedCardLayout(value)
  );
}

function isLegacySavedSectionLayouts(value: unknown): value is SavedSectionLayout[] {
  return Array.isArray(value) && value.every((section) => isSavedSectionLayout(section));
}

function isSavedBlockLayouts(value: unknown): value is SavedBlockLayout[] {
  return Array.isArray(value) && value.every((block) => isSavedBlockLayout(block));
}


async function readLayoutFile(
  yamlFilePath: string,
  sheet: SharedYamlCheatSheet
): Promise<SavedBlockLayout[] | null> {
  const layoutPath = yamlFilePath.replace(/\.yaml$/, ".layout.json");
  try {
    const raw = await fs.readFile(layoutPath, "utf8");
    const parsed = JSON.parse(raw);

    // New format: { id, kind, position: { x, y, w, h } }
    if (isNewFormatArray(parsed)) {
      return toOldBlockLayouts(parsed);
    }

    // Old format: { id, kind, colStart, rowStart, colSpan, rowSpan }
    if (isSavedBlockLayouts(parsed)) {
      return parsed;
    }

    // Legacy section-based format
    if (isLegacySavedSectionLayouts(parsed)) {
      return migrateSectionLayoutsToBlockLayouts(sheet, parsed);
    }

    return null;
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

export async function getYamlCheatSheet(slug: string): Promise<SharedYamlCheatSheet | null> {
  return (await readParsedSheetBySlug(slug))?.data ?? null;
}

export async function getYamlCheatSheetWithMeta(slug: string): Promise<SharedYamlCheatSheetWithMeta | null> {
  const parsedSheet = await readParsedSheetBySlug(slug);
  /* v8 ignore next -- defensive: sheet not found by slug */
  if (!parsedSheet) {
    return null;
  }

  const { categoryId, categoryColor } = getSheetCategoryMeta(parsedSheet.file.categoryPath);
  const savedBlockLayout = await readLayoutFile(parsedSheet.file.filePath, parsedSheet.data);

  return {
    ...parsedSheet.data,
    colorFrom: categoryColor,
    categoryId,
    ...(savedBlockLayout && { savedBlockLayout }),
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
