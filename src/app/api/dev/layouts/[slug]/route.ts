import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

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

  const layoutPath = getLayoutPath(yamlFilePath);
  await fs.writeFile(layoutPath, JSON.stringify(body, null, 2) + "\n", "utf8");

  return NextResponse.json({ success: true, path: path.relative(process.cwd(), layoutPath) });
}
