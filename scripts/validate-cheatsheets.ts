import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { yamlCheatSheetSchema } from "../src/lib/yaml-cheatsheets";

async function main() {
  const contentDirectory = path.join(process.cwd(), "content", "cheatsheets");
  const files = await fs.readdir(contentDirectory);
  const yamlFiles = files.filter((file) => file.endsWith(".yaml"));

  if (yamlFiles.length === 0) {
    throw new Error("No .yaml cheatsheets found in content/cheatsheets.");
  }

  const errors: string[] = [];

  for (const file of yamlFiles) {
    const raw = await fs.readFile(path.join(contentDirectory, file), "utf8");
    const parsed = yamlCheatSheetSchema.safeParse(load(raw));

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
        .join(", ");
      errors.push(`${file}: ${details}`);
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
