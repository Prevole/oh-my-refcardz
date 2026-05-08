"use client";

import { useState, useSyncExternalStore } from "react";
import { registerHandler } from "./entry-registry";
import { useShowCopyModal } from "../sheet-commands-shell";
import { hasPlaceholders } from "@/lib/placeholder-parser";
import styles from "../cheatsheet-rendering.module.css";

type PathLikeProps = {
  type: "file" | "where";
  value: string;
};

function getFileLabel(value: string): string {
  return value.endsWith("/") ? "Folder" : "File";
}

export function PathLike({ type, value }: PathLikeProps) {
  const label = type === "file" ? getFileLabel(value) : "Where";
  const lineClass = type === "file" ? styles.configFileLine : styles.appSettingsLocationLine;
  const labelClass = type === "file" ? styles.configFileLabel : styles.appSettingsLocationLabel;
  const valueClass = type === "file" ? styles.configFile : styles.appSettingsLocation;
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (type === "file") {
    if (!mounted) {
      return (
        <p className={lineClass}>
          <span className={labelClass}>{label}</span>
          <span className={valueClass}>{value}</span>
        </p>
      );
    }

    return <CopyableFilePath label={label} value={value} lineClass={lineClass} labelClass={labelClass} valueClass={valueClass} />;
  }

  return (
    <p className={lineClass}>
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </p>
  );
}

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

type CopyableFilePathProps = {
  label: string;
  value: string;
  lineClass: string;
  labelClass: string;
  valueClass: string;
};

function CopyableFilePath({ label, value, lineClass, labelClass, valueClass }: CopyableFilePathProps) {
  const [copied, setCopied] = useState(false);
  const showCopyModal = useShowCopyModal();
  const copyTitle = value.endsWith("/") ? "Copy Folder" : "Copy File";

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

    if (hasPlaceholders(value)) {
      const copyLabel = value.endsWith("/") ? "Copy Folder" : "Copy File";
      showCopyModal({ title: copyLabel, value, previewPrefix: "" });
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={lineClass}>
      <span className={labelClass}>{label}</span>
      <div
        className={styles.configFileCopyable}
        data-copyable={value}
        data-copy-title={copyTitle}
        data-copied={copied ? "true" : undefined}
        onClick={handleSelect}
      >
        <span className={valueClass}>{value}</span>
        <button
          type="button"
          className={`${styles.configFileCopyButton} ${copied ? styles.configFileCopyButtonCopied : ""}`}
          aria-label="Copy"
          title="Copy (y)"
          onClick={handleCopy}
          data-copy-button
        >
          {copied ? <IconCheck /> : <IconCopy />}
        </button>
      </div>
    </div>
  );
}

registerHandler("file", (value) => <PathLike type="file" value={value} />);

registerHandler("where", (value) => <PathLike type="where" value={value} />);
