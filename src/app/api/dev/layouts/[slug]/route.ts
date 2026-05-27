import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { reconcileBlockLayouts } from "@/lib/layout/blocks";
import { yamlCheatSheetSchema } from "@/lib/yaml-cheatsheets";

const contentDirectory = path.join(process.cwd(), "content", "cheatsheets");

async function findYamlFilePath(dir: string, slug: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = await findYamlFilePath(fullPath, slug);
      if (found) return found;
      continue;
    }

    if (entry.isFile() && entry.name === `${slug}.yaml`) {
      return fullPath;
    }
  }

  return null;
}

function getLayoutPath(yamlFilePath: string): string {
  return yamlFilePath.replace(/\.yaml$/, ".layout.json");
}

async function readSheetAtPath(yamlFilePath: string) {
  const raw = await fs.readFile(yamlFilePath, "utf8");
  const parsed = yamlCheatSheetSchema.safeParse(load(raw));

  if (!parsed.success) {
    throw new Error(
      `Invalid YAML cheatsheet ${path.relative(contentDirectory, yamlFilePath)}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"} — ${issue.message}`)
        .join(", ")}`
    );
  }

  return parsed.data;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const { slug } = await params;
  const body = await request.json();

  const yamlFilePath = await findYamlFilePath(contentDirectory, slug);
  if (!yamlFilePath) {
    return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
  }

  await readSheetAtPath(yamlFilePath);

  // Reconcile before writing. This both clamps drifted values to the
  // current constraints and strips any unknown fields, ensuring the
  // persisted file contains only { id, kind, colStart, rowStart,
  // colSpan, rowSpan } and that those values are valid.
  const reconciled = reconcileBlockLayouts(body);

  const layoutPath = getLayoutPath(yamlFilePath);
  await fs.writeFile(layoutPath, JSON.stringify(reconciled.blocks, null, 2) + "\n", "utf8");

  return NextResponse.json({ success: true, path: path.relative(process.cwd(), layoutPath) });
}
