"use client";

import { useMemo } from "react";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import { useKeybindings } from "@/hooks/use-keybindings";
import {
  type ActionId,
  type KeyCombo,
  getComboDisplay,
  isArrowKey,
  getArrowDirection,
} from "@/lib/keybindings";
import keybindingStyles from "./keybinding-display.module.css";

type KeycapVariant = "inline" | "legend";

type KeycapDisplayProps = {
  display: string;
  variant?: KeycapVariant;
};

function KeycapDisplayInner({ display, variant = "inline" }: KeycapDisplayProps) {
  const className = variant === "legend" ? keybindingStyles.legendKeycap : keybindingStyles.keycap;
  const arrowClassName = variant === "legend" ? keybindingStyles.legendArrow : keybindingStyles.keycapArrow;

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

  if (display === "esc") {
    return (
      <span className={className}>
        <span className="small-caps">{display}</span>
      </span>
    );
  }

  return <span className={className}>{display}</span>;
}

type ComboDisplayProps = {
  combo: KeyCombo;
  variant?: KeycapVariant;
};

export function ComboDisplay({ combo, variant = "inline" }: ComboDisplayProps) {
  const display = getComboDisplay(combo);
  return <KeycapDisplayInner display={display} variant={variant} />;
}

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

type HelpRowProps = {
  actionId: ActionId;
  label?: string;
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

export function useActionCombos(actionId: ActionId): KeyCombo[] {
  const { getAction } = useKeybindings();
  const action = getAction(actionId);
  return useMemo(() => action?.combos ?? [], [action]);
}

export function useActionLabel(actionId: ActionId): string {
  const { getAction } = useKeybindings();
  const action = getAction(actionId);
  return action?.label ?? "";
}
