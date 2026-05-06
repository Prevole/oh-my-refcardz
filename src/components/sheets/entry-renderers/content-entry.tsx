"use client";

import { useState } from "react";
import { registerHandler } from "./entry-registry";
import { useShowCopyModal } from "../sheet-commands-shell";
import { hasPlaceholders, formatDisplayValue } from "@/lib/placeholder-parser";
import commandStyles from "../sheet-commands.module.css";
import styles from "../cheatsheet-rendering.module.css";

type CopyableContentBlockProps = {
  value: string;
  copyTitle: string;
  example?: boolean;
};

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

function CopyableContentBlock({ value, copyTitle, example = false }: CopyableContentBlockProps) {
  const [copied, setCopied] = useState(false);
  const showCopyModal = useShowCopyModal();
  const withPlaceholders = hasPlaceholders(value);
  const displayValue = formatDisplayValue(value);

  function handleSelect(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-copy-button]")) return;

    document.querySelectorAll<HTMLElement>("[data-copyable]").forEach((el) => {
      el.dataset.navFocused = "false";
    });
    (e.currentTarget as HTMLElement).dataset.navFocused = "true";
  }

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();

    if (withPlaceholders) {
      showCopyModal({ title: copyTitle, value, previewPrefix: "" });
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <pre
      className={styles.configBlock}
      data-content-example={example ? "true" : undefined}
      data-copyable={value}
      data-copy-title={copyTitle}
      data-copied={copied ? "true" : undefined}
      onClick={handleSelect}
    >
      <code>{displayValue}</code>
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

export function ContentEntry({ value }: { value: string }) {
  return <CopyableContentBlock value={value} copyTitle="Copy Content" />;
}

export function ContentExampleEntry({ value }: { value: string }) {
  return (
    <>
      <p className={commandStyles.commandBlockLabel}>Example</p>
      <CopyableContentBlock value={value} copyTitle="Copy Content Example" example={true} />
    </>
  );
}

registerHandler("content", (value) => <ContentEntry value={value} />);

registerHandler("contentExample", (value) => <ContentExampleEntry value={value} />);
