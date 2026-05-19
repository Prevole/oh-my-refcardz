"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw, ScrollText, Trash2 } from "lucide-react";
import styles from "./dev-overlay.module.css";

type SessionEntry = {
  id: string;
  filename: string;
  startedAt: string;
  duration: number;
  eventCount: number;
  page: string;
  description?: string;
};

type ListResponse = {
  sessions: SessionEntry[];
};

/**
 * Dropdown listing debug sessions stored under `.debug-sessions/`. Each entry
 * exposes a grouped copy/delete pair (clipboard / DELETE via
 * `/api/dev/debug?id=<id>`). The footer offers a refresh action and a
 * delete-all action (DELETE on `/api/dev/debug` without `?id`). The list is
 * fetched lazily when the dropdown opens.
 *
 * Only rendered in development; in production builds the parent should not
 * mount this component, but we also gate the network calls defensively.
 */
export function DevLogsDropdown() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedFilename, setCopiedFilename] = useState<string | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const fetchSessions = useCallback(async () => {
    if (process.env.NODE_ENV !== "development") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/debug");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ListResponse = await res.json();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const handleCopy = useCallback(async (filename: string) => {
    try {
      await navigator.clipboard.writeText(filename);
      setCopiedFilename(filename);
      setTimeout(() => {
        setCopiedFilename((cur) => (cur === filename ? null : cur));
      }, 1500);
    } catch {
      // Clipboard not available; ignore silently.
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `/api/dev/debug?id=${encodeURIComponent(id)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSessions((cur) => (cur ? cur.filter((s) => s.id !== id) : cur));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    },
    []
  );

  const handleDeleteAll = useCallback(async () => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const res = await fetch("/api/dev/debug", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all");
    }
  }, []);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <span className={styles.logsContainer} ref={containerRef}>
      <button
        type="button"
        className={styles.toolbarButton}
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next && sessions === null) {
              void fetchSessions();
            }
            return next;
          });
        }}
        title="Browse recorded debug sessions"
        aria-label="Open debug logs"
      >
        <ScrollText className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
        {sessions ? (
          <span className={styles.toolbarCount}>{sessions.length}</span>
        ) : null}
      </button>

      {open ? (
        <div className={styles.logsDropdown} role="dialog">
          {loading ? (
            <div className={styles.logsState}>Loading…</div>
          ) : error ? (
            <div className={styles.logsState}>{error}</div>
          ) : !sessions || sessions.length === 0 ? (
            <div className={styles.logsState}>No sessions recorded.</div>
          ) : (
            <ul className={styles.logsList}>
              {sessions.map((session) => (
                <li key={session.id} className={styles.logsItem}>
                  <div className={styles.logsItemMain}>
                    <span className={styles.logsItemFilename}>
                      {session.filename}
                    </span>
                    <span className={styles.logsItemMeta}>
                      {session.eventCount} events · {session.page}
                      {session.description ? ` · ${session.description}` : ""}
                    </span>
                  </div>
                  <div className={styles.logsItemActions}>
                    <span className={styles.toolbarGroup}>
                      <button
                        type="button"
                        className={`${styles.toolbarButton} ${styles.toolbarButtonGrouped}`}
                        onClick={() => handleCopy(session.filename)}
                        title={
                          copiedFilename === session.filename
                            ? "Copied to clipboard"
                            : "Copy filename to clipboard"
                        }
                        aria-label="Copy filename to clipboard"
                      >
                        {copiedFilename === session.filename ? (
                          <Check className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <Copy className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={`${styles.toolbarButton} ${styles.toolbarButtonGrouped}`}
                        onClick={() => handleDelete(session.id)}
                        title="Delete this session"
                        aria-label="Delete this session"
                      >
                        <Trash2 className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.logsFooter}>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={handleDeleteAll}
              disabled={loading || !sessions || sessions.length === 0}
              title="Delete all recorded sessions"
              aria-label="Delete all recorded sessions"
            >
              <Trash2 className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
              <span className={styles.toolbarButtonText}>all</span>
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={fetchSessions}
              disabled={loading}
              title="Refresh session list"
              aria-label="Refresh session list"
            >
              <RefreshCw className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
