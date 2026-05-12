import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import type { DebugSession } from "@/lib/debug/types";

const debugDirectory = path.join(process.cwd(), ".debug-sessions");

async function ensureDebugDirectory(): Promise<void> {
  try {
    await fs.access(debugDirectory);
  } catch {
    await fs.mkdir(debugDirectory, { recursive: true });
  }
}

function getSessionFilePath(sessionId: string): string {
  const sanitizedId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(debugDirectory, `${sanitizedId}.json`);
}

/**
 * POST /api/dev/debug
 * Save a debug session to disk.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const session: DebugSession = await request.json();

    if (!session.id || !session.events) {
      return NextResponse.json(
        { error: "Invalid session format" },
        { status: 400 }
      );
    }

    await ensureDebugDirectory();
    const filePath = getSessionFilePath(session.id);

    await fs.writeFile(
      filePath,
      JSON.stringify(session, null, 2) + "\n",
      "utf8"
    );

    return NextResponse.json({
      success: true,
      path: path.relative(process.cwd(), filePath),
      eventCount: session.events.length,
    });
  } catch (error) {
    console.error("[debug API] Error saving session:", error);
    return NextResponse.json(
      { error: "Failed to save session" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dev/debug
 * List all debug sessions.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    await ensureDebugDirectory();

    const files = await fs.readdir(debugDirectory);
    const sessions: Array<{
      id: string;
      filename: string;
      startedAt: string;
      duration: number;
      eventCount: number;
      page: string;
      description?: string;
    }> = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const content = await fs.readFile(
          path.join(debugDirectory, file),
          "utf8"
        );
        const session: DebugSession = JSON.parse(content);
        sessions.push({
          id: session.id,
          filename: file,
          startedAt: session.startedAt,
          duration: session.duration,
          eventCount: session.eventCount,
          page: session.page,
          description: session.description,
        });
      } catch {
        // Skip invalid files
      }
    }

    // Sort by date, newest first
    sessions.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[debug API] Error listing sessions:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dev/debug
 * Delete all debug sessions or a specific one.
 */
export async function DELETE(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("id");

    await ensureDebugDirectory();

    if (sessionId) {
      // Delete specific session
      const filePath = getSessionFilePath(sessionId);
      try {
        await fs.unlink(filePath);
        return NextResponse.json({ success: true, deleted: sessionId });
      } catch {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
    } else {
      // Delete all sessions
      const files = await fs.readdir(debugDirectory);
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith(".json")) {
          await fs.unlink(path.join(debugDirectory, file));
          deletedCount++;
        }
      }

      return NextResponse.json({ success: true, deletedCount });
    }
  } catch (error) {
    console.error("[debug API] Error deleting sessions:", error);
    return NextResponse.json(
      { error: "Failed to delete sessions" },
      { status: 500 }
    );
  }
}
