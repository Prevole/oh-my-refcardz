"use client";

import { RotateCcw } from "lucide-react";
import floatingActionStyles from "@/components/settings/floating-action-button.module.css";

type Props = {
  onClick: () => void;
};

export function LayoutResetButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`${floatingActionStyles.button} ${floatingActionStyles.resetLayout}`}
      aria-label="Reset layout to original"
      title="Reset layout to original (Shift+R)"
      data-testid="layout-reset-button"
    >
      <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
