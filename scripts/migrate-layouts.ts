/**
 * One-time migration script to convert .layout.json files from old to new format.
 *
 * Run with: npx tsx scripts/migrate-layouts.ts
 *
 * Old format: { id, kind, colStart, rowStart, colSpan, rowSpan }
 * New format: { id, kind, position: { x, y, w, h } }
 */

import * as fs from "node:fs";
import * as path from "node:path";

type OldBlock = {
  id: string;
  kind: "heading" | "card";
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

type NewBlock = {
  id: string;
  kind: "heading" | "card";
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

function migrateBlock(old: OldBlock): NewBlock {
  return {
    id: old.id,
    kind: old.kind,
    position: {
      x: old.colStart - 1,
      y: old.rowStart - 1,
      w: old.colSpan,
      h: old.rowSpan,
    },
  };
}

function isOldFormat(data: unknown): data is OldBlock[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;

  return data.every(
    (block) =>
      typeof block === "object" &&
      block !== null &&
      "colStart" in block &&
      "rowStart" in block &&
      "colSpan" in block &&
      "rowSpan" in block
  );
}

function findLayoutFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".layout.json")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function main() {
  const contentDir = path.join(process.cwd(), "content/cheatsheets");

  if (!fs.existsSync(contentDir)) {
    console.error("Error: content/cheatsheets directory not found");
    process.exit(1);
  }

  const layoutFiles = findLayoutFiles(contentDir);
  console.log(`Found ${layoutFiles.length} layout files\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of layoutFiles) {
    const relativePath = path.relative(process.cwd(), file);

    try {
      const content = fs.readFileSync(file, "utf-8");
      const data = JSON.parse(content);

      if (!isOldFormat(data)) {
        console.log(`SKIP  ${relativePath} (already new format or empty)`);
        skipped++;
        continue;
      }

      const newData = data.map(migrateBlock);
      const newContent = JSON.stringify(newData, null, 2) + "\n";

      fs.writeFileSync(file, newContent, "utf-8");
      console.log(`OK    ${relativePath}`);
      migrated++;
    } catch (err) {
      console.error(`ERROR ${relativePath}: ${err}`);
      errors++;
    }
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
}

main();
