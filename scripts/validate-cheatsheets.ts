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

async function main() {
  const contentDirectory = path.join(process.cwd(), "content", "cheatsheets");
  const yamlFiles = await collectYamlFiles(contentDirectory);

  if (yamlFiles.length === 0) {
    throw new Error("No .yaml cheatsheets found in content/cheatsheets.");
  }

  const errors: string[] = [];

  for (const file of yamlFiles) {
    const raw = await fs.readFile(file, "utf8");
    const parsedYaml = load(raw);
    const relativeFile = path.relative(contentDirectory, file);

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
    throw new Error(`Cheatsheet validation failed:\n- ${errors.join("\n- ")}`);
  }

  process.stdout.write(`Validated ${yamlFiles.length} cheatsheets successfully.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
