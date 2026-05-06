"use client";

import { useState } from "react";
import { registerHandler } from "./entry-registry";
import styles from "../cheatsheet-rendering.module.css";

function IconCopy() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ContentEntry({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <pre
      className={styles.configBlock}
      data-copyable={value}
      data-copied={copied ? "true" : undefined}
    >
      <code>{value}</code>
      <button
        type="button"
        className={`${styles.configCopyButton} ${copied ? styles.configCopyButtonCopied : ""}`}
        aria-label="Copy"
        title="Copy (y)"
        onClick={handleCopy}
        data-copy-button
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </button>
    </pre>
  );
}

registerHandler("content", (value) => <ContentEntry value={value} />);
