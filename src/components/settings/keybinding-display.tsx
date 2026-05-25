"use client";

import { useMemo } from "react";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import { useKeybindings } from "@/hooks/use-keybindings";
import {
  type ActionId,
  type KeyCombo,
  type KeyDisplayPart,
  getComboSequenceDisplayParts,
  isArrowKey,
  getArrowDirection,
} from "@/lib/keybindings";
import keybindingStyles from "./keybinding-display.module.css";

type KeycapVariant = "inline" | "legend";

type KeycapDisplayProps = {
  part: KeyDisplayPart;
  variant?: KeycapVariant;
};

function KeycapDisplayInner({ part, variant = "inline" }: KeycapDisplayProps) {
  const display = part.value;
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

function isCompactSequenceDisplay(sequence: KeyDisplayPart[][]) {
  return sequence.length > 1 && sequence.every((step) => step.length === 1 && step[0]?.type === "key" && step[0].value.length === 1);
}

export function ComboDisplay({ combo, variant = "inline" }: ComboDisplayProps) {
  const sequence = getComboSequenceDisplayParts(combo);
  const isCompactSequence = isCompactSequenceDisplay(sequence);
  const className = variant === "legend" ? keybindingStyles.comboBoxLegend : keybindingStyles.comboBox;

  return (
    <span className={className} data-compact-sequence={isCompactSequence}>
      {sequence.map((step, stepIndex) => (
        <span key={stepIndex} className={keybindingStyles.comboStep}>
          {step.map((part, partIndex) => (
            <KeycapDisplayInner
              key={`${stepIndex}-${partIndex}-${part.type}-${part.value}`}
              part={part}
              variant={variant}
            />
          ))}
        </span>
      ))}
    </span>
  );
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

type InlineBindingTextProps = {
  combos: KeyCombo[];
  maxCombos?: number;
  className?: string;
  separatorClassName?: string;
};

function InlineBindingPart({ part, className }: { part: KeyDisplayPart; className?: string }) {
  if (isArrowKey(part.value)) {
    const direction = getArrowDirection(part.value);
    if (direction) {
      return (
        <span className={className}>
          <ArrowGlyph direction={direction} className={keybindingStyles.keycapArrow} />
        </span>
      );
    }
  }

  if (part.value === "esc") {
    return <span className={className}>Esc</span>;
  }

  return <span className={className}>{part.value}</span>;
}

export function InlineBindingText({
  combos,
  maxCombos,
  className,
  separatorClassName,
}: InlineBindingTextProps) {
  const displayCombos = maxCombos ? combos.slice(0, maxCombos) : combos;
  const lastIndex = displayCombos.length - 1;

  return (
    <>
      {displayCombos.map((combo, index) => {
        const sequence = getComboSequenceDisplayParts(combo);
        const separator =
          index === 0
            ? null
            : index === lastIndex
              ? <span className={separatorClassName}>or</span>
              : <span className={separatorClassName} style={{ marginLeft: 0 }}>, </span>;

        return (
        <span key={index} className="whitespace-nowrap">
          {separator}
          {sequence.map((step, stepIndex) => (
            <span key={stepIndex}>
              {stepIndex > 0 ? " " : null}
              {step.map((part, partIndex) => (
                <InlineBindingPart
                  key={`${stepIndex}-${partIndex}-${part.type}-${part.value}`}
                  part={part}
                  className={className}
                />
              ))}
            </span>
          ))}
        </span>
      )})}
    </>
  );
}

type ActionInlineBindingProps = {
  actionId: ActionId;
  maxCombos?: number;
  className?: string;
  separatorClassName?: string;
};

export function ActionInlineBinding({
  actionId,
  maxCombos,
  className,
  separatorClassName,
}: ActionInlineBindingProps) {
  const { getAction } = useKeybindings();
  const action = getAction(actionId);

  if (!action || action.combos.length === 0) {
    return null;
  }

  return (
    <InlineBindingText
      combos={action.combos}
      maxCombos={maxCombos}
      className={className}
      separatorClassName={separatorClassName}
    />
  );
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
