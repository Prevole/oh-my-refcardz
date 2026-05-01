"use client";

import { useMemo } from "react";
import { ArrowGlyph } from "@/components/arrow-glyph";
import { useKeybindings } from "@/hooks/use-keybindings";
import {
  type ActionId,
  type KeyCombo,
  getComboDisplay,
  isArrowKey,
  getArrowDirection,
} from "@/lib/keybindings";

// ─────────────────────────────────────────────────────────────────────────────
// KeycapDisplay - Renders a single keycap with proper styling
// ─────────────────────────────────────────────────────────────────────────────

type KeycapVariant = "inline" | "legend";

type KeycapDisplayProps = {
  display: string;
  variant?: KeycapVariant;
};

function KeycapDisplayInner({ display, variant = "inline" }: KeycapDisplayProps) {
  const className = variant === "legend" ? "legend-keycap" : "keycap";
  const arrowClassName = variant === "legend" ? "legend-arrow" : "keycap-arrow";

  if (isArrowKey(display)) {
    const direction = getArrowDirection(display);
    if (direction) {
      return (
        <span className={className}>
          <ArrowGlyph direction={direction} className={arrowClassName} />
        </span>
      );
    }
  }

  // Check for small-caps display (esc)
  if (display === "esc") {
    return (
      <span className={className}>
        <span className="small-caps">{display}</span>
      </span>
    );
  }

  return <span className={className}>{display}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ComboDisplay - Renders a single key combo
// ─────────────────────────────────────────────────────────────────────────────

type ComboDisplayProps = {
  combo: KeyCombo;
  variant?: KeycapVariant;
};

export function ComboDisplay({ combo, variant = "inline" }: ComboDisplayProps) {
  const display = getComboDisplay(combo);
  return <KeycapDisplayInner display={display} variant={variant} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// CombosDisplay - Renders multiple combos with "or" separator
// ─────────────────────────────────────────────────────────────────────────────

type CombosDisplayProps = {
  combos: KeyCombo[];
  variant?: KeycapVariant;
  maxCombos?: number;
};

export function CombosDisplay({ combos, variant = "inline", maxCombos }: CombosDisplayProps) {
  const displayCombos = maxCombos ? combos.slice(0, maxCombos) : combos;

  return (
    <span className="inline-flex items-center gap-1">
      {displayCombos.map((combo, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          {index > 0 && <span className="text-xs text-white/40">or</span>}
          <ComboDisplay combo={combo} variant={variant} />
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionKeybinding - Renders keybinding(s) for an action by ID
// ─────────────────────────────────────────────────────────────────────────────

type ActionKeybindingProps = {
  actionId: ActionId;
  variant?: KeycapVariant;
  maxCombos?: number;
};

export function ActionKeybinding({
  actionId,
  variant = "inline",
  maxCombos,
}: ActionKeybindingProps) {
  const { getAction } = useKeybindings();
  const action = getAction(actionId);

  if (!action || action.combos.length === 0) {
    return null;
  }

  return <CombosDisplay combos={action.combos} variant={variant} maxCombos={maxCombos} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionLabel - Renders just the label for an action by ID
// ─────────────────────────────────────────────────────────────────────────────

type ActionLabelProps = {
  actionId: ActionId;
};

export function ActionLabel({ actionId }: ActionLabelProps) {
  const { getAction } = useKeybindings();
  const action = getAction(actionId);

  if (!action) {
    return null;
  }

  return <>{action.label}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HelpRow - A single row in a help table with keybinding and description
// ─────────────────────────────────────────────────────────────────────────────

type HelpRowProps = {
  actionId: ActionId;
  label?: string; // Override the action label if needed
};

export function HelpRow({ actionId, label }: HelpRowProps) {
  const { getAction } = useKeybindings();
  const action = getAction(actionId);

  if (!action) {
    return null;
  }

  return (
    <>
      <td>
        <CombosDisplay combos={action.combos} variant="legend" maxCombos={2} />
      </td>
      <td>{label ?? action.label}</td>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useActionCombos - Hook to get combos for an action
// ─────────────────────────────────────────────────────────────────────────────

export function useActionCombos(actionId: ActionId): KeyCombo[] {
  const { getAction } = useKeybindings();
  const action = getAction(actionId);
  return useMemo(() => action?.combos ?? [], [action]);
}

// ─────────────────────────────────────────────────────────────────────────────
// useActionLabel - Hook to get label for an action
// ─────────────────────────────────────────────────────────────────────────────

export function useActionLabel(actionId: ActionId): string {
  const { getAction } = useKeybindings();
  const action = getAction(actionId);
  return action?.label ?? "";
}
