import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { cheatSheetFrontmatterSchema } from "../src/lib/cheatsheets";

async function main() {
  const contentDirectory = path.join(process.cwd(), "content", "cheatsheets");
  const files = await fs.readdir(contentDirectory);
  const mdxFiles = files.filter((file) => file.endsWith(".mdx"));

  if (mdxFiles.length === 0) {
    throw new Error("No .mdx cheatsheets found in content/cheatsheets.");
  }

  const errors: string[] = [];

  for (const file of mdxFiles) {
    const source = await fs.readFile(path.join(contentDirectory, file), "utf8");
    const { data } = matter(source);
    const parsed = cheatSheetFrontmatterSchema.safeParse(data);

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"} ${issue.message}`)
        .join(", ");
      errors.push(`${file}: ${details}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Cheatsheet validation failed:\n- ${errors.join("\n- ")}`);
  }

  process.stdout.write(`Validated ${mdxFiles.length} cheatsheets successfully.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
