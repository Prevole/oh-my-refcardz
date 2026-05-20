import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { yamlCheatSheetSchema, categoryMetaSchema } from "../src/lib/yaml-cheatsheets";

const CATEGORY_META_FILES = new Set(["meta.yaml", "_meta.yaml"]);

async function collectYamlFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectYamlFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".yaml")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function validateRoot(root: string): Promise<number> {
  let yamlFiles: string[];
  try {
    yamlFiles = await collectYamlFiles(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw error;
  }

  if (yamlFiles.length === 0) return 0;

  const errors: string[] = [];

  for (const file of yamlFiles) {
    const raw = await fs.readFile(file, "utf8");
    const parsedYaml = load(raw);
    const relativeFile = path.relative(root, file);

    if (CATEGORY_META_FILES.has(path.basename(file))) {
      const parsed = categoryMetaSchema.safeParse(parsedYaml);
      if (!parsed.success) {
        const details = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
          .join(", ");
        errors.push(`${relativeFile}: ${details}`);
      }
      continue;
    }

    const parsed = yamlCheatSheetSchema.safeParse(parsedYaml);

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
        .join(", ");
      errors.push(`${relativeFile}: ${details}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Cheatsheet validation failed in ${root}:\n- ${errors.join("\n- ")}`);
  }

  return yamlFiles.length;
}

async function main() {
  const roots = [
    path.join(process.cwd(), "content", "cheatsheets"),
    path.join(process.cwd(), "content_test", "cheatsheets"),
  ];

  let total = 0;
  for (const root of roots) {
    const count = await validateRoot(root);
    if (count > 0) {
      process.stdout.write(
        `Validated ${count} cheatsheets in ${path.relative(process.cwd(), root)}.\n`,
      );
    }
    total += count;
  }

  if (total === 0) {
    throw new Error("No .yaml cheatsheets found in any content root.");
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
