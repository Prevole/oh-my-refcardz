"use client";

import { RotateCcw } from "lucide-react";
import floatingActionStyles from "@/components/settings/floating-action-button.module.css";

type Props = {
  onClick: () => void;
};

export function LayoutBufferResetButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`${floatingActionStyles.button} ${floatingActionStyles.resetLayout}`}
      aria-label="Reset layout changes"
      title="Reset layout changes (Shift+R)"
      data-testid="layout-buffer-reset-button"
    >
      <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
