import fs from "node:fs/promises";
import path from "node:path";
import { getBlockConstraints, isRegisteredBlockKind, reconcileBlockLayouts } from "../src/lib/layout/blocks";
import { isNewFormatArray, toOldBlockLayouts } from "../src/lib/layout/migration";

/**
 * One-shot migration script for content/cheatsheets/ **\/ *.layout.json files.
 *
 * Historical .layout.json files in the repo were written before the block
 * registry became authoritative for constraints, and before the persisted
 * schema was strictly enforced. Some entries miss numeric fields (e.g.
 * headings without rowSpan), which the runtime reconciler drops as
 * "malformed" — defensive at load time, but lossy for committed files.
 *
 * This script reads every layout file, completes any missing numeric
 * fields from the registry, runs the canonical reconcileBlockLayouts(),
 * and writes the result back. It is idempotent: re-running it on already
 * clean files is a no-op.
 *
 * Once all checked-in files have been migrated, this script should be
 * removed together with the corresponding npm command.
 */

const LAYOUTS_ROOT = path.join(process.cwd(), "content", "cheatsheets");

type PreFillStats = {
  /** Entries where one or more numeric fields were completed from defaults. */
  completed: number;
};

type FileReport = {
  relativePath: string;
  converted: boolean;
  preFill: PreFillStats;
  drifted: number;
  dropped: number;
  rewritten: boolean;
};

async function collectLayoutFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectLayoutFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".layout.json")) {
      files.push(fullPath);
    }
  }

  return files;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Completes missing numeric fields from the block registry defaults.
 * Operates on entries that have a valid id + registered kind; entries
 * with structural problems are passed through untouched so the
 * downstream reconciler can drop them with the proper "malformed"
 * reason.
 */
function preFillMissingNumericFields(input: unknown): { entries: unknown[]; stats: PreFillStats } {
  const stats: PreFillStats = { completed: 0 };

  if (!Array.isArray(input)) {
    return { entries: [], stats };
  }

  const entries = input.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== "string" || obj.id.length === 0) return entry;
    if (typeof obj.kind !== "string" || !isRegisteredBlockKind(obj.kind)) return entry;

    const constraints = getBlockConstraints(obj.kind);
    const completion: Record<string, number> = {};
    let touched = false;

    if (!isNumber(obj.colStart)) {
      completion.colStart = 1;
      touched = true;
    }
    if (!isNumber(obj.rowStart)) {
      completion.rowStart = 1;
      touched = true;
    }
    if (!isNumber(obj.colSpan)) {
      completion.colSpan = constraints.minColSpan;
      touched = true;
    }
    if (!isNumber(obj.rowSpan)) {
      completion.rowSpan = constraints.minRowSpan;
      touched = true;
    }

    if (!touched) return entry;
    stats.completed += 1;
    return { ...obj, ...completion };
  });

  return { entries, stats };
}

async function migrateFile(filePath: string): Promise<FileReport> {
  const relativePath = path.relative(process.cwd(), filePath);
  const raw = await fs.readFile(filePath, "utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON — ${(error as Error).message}`);
  }

  // Convert legacy { id, kind, position: { x, y, w, h } } shape to the
  // canonical flat shape before reconciliation. The runtime loader
  // performs the same conversion via toOldBlockLayouts.
  let converted = false;
  let normalized: unknown = parsed;
  if (isNewFormatArray(parsed)) {
    normalized = toOldBlockLayouts(parsed);
    converted = true;
  }

  const { entries, stats: preFill } = preFillMissingNumericFields(normalized);
  const result = reconcileBlockLayouts(entries);

  const wasConverted = converted;
  const wasFilled = preFill.completed > 0;
  const wasReconciled = result.modified;
  const shouldRewrite = wasConverted || wasFilled || wasReconciled;

  if (shouldRewrite) {
    const next = JSON.stringify(result.blocks, null, 2) + "\n";
    await fs.writeFile(filePath, next, "utf8");
  }

  return {
    relativePath,
    converted: wasConverted,
    preFill,
    drifted: result.drifted.length,
    dropped: result.dropped.length,
    rewritten: shouldRewrite,
  };
}

function formatReport(report: FileReport): string {
  const flags: string[] = [];
  if (report.converted) flags.push("converted from { position } format");
  if (report.preFill.completed > 0) flags.push(`completed ${report.preFill.completed}`);
  if (report.drifted > 0) flags.push(`drifted ${report.drifted}`);
  if (report.dropped > 0) flags.push(`dropped ${report.dropped}`);
  const summary = flags.length === 0 ? "clean" : flags.join(", ");
  const action = report.rewritten ? "rewrote" : "skipped";
  return `${action} ${report.relativePath} (${summary})`;
}

async function main() {
  let files: string[];
  try {
    files = await collectLayoutFiles(LAYOUTS_ROOT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      process.stdout.write(`No layouts directory at ${LAYOUTS_ROOT}.\n`);
      return;
    }
    throw error;
  }

  if (files.length === 0) {
    process.stdout.write("No .layout.json files found.\n");
    return;
  }

  let rewrittenCount = 0;
  for (const file of files) {
    const report = await migrateFile(file);
    process.stdout.write(`${formatReport(report)}\n`);
    if (report.rewritten) rewrittenCount += 1;
  }

  process.stdout.write(`\nProcessed ${files.length} file(s), rewrote ${rewrittenCount}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
