import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export function SheetCode({ children }: Props) {
  const text = typeof children === "string" ? children : "";

  if (text.includes(" + ")) {
    const parts = text.split(" + ");
    return (
      <code className="sheet-code-combo">
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className="sheet-code-part-wrap">
            {renderPart(part)}
            {index < parts.length - 1 ? <span className="sheet-code-sep">+</span> : null}
          </span>
        ))}
      </code>
    );
  }

  if (containsArrow(text)) {
    return <code>{renderWithArrows(text)}</code>;
  }

  if (isSingleTouch(text)) {
    return <code className="sheet-code-single">{text}</code>;
  }

  return <code>{children}</code>;
}

function renderPart(part: string) {
  if (containsArrow(part)) {
    return <span className="sheet-code-part">{renderWithArrows(part)}</span>;
  }

  if (isSingleTouch(part)) {
    return <span className="sheet-code-part sheet-code-single">{part}</span>;
  }

  return <span className="sheet-code-part">{part}</span>;
}

function isSingleTouch(value: string): boolean {
  return ["^", "⌘", "⌥", "⇧", "↩", "⎋", "←", "↑", "↓", "→"].includes(value.trim());
}

function containsArrow(value: string): boolean {
  return /[←↑↓→]/.test(value);
}

function renderWithArrows(value: string) {
  return value.split("").map((char, index) => {
    if (char === " ") {
      return " ";
    }
    if (char === "←") {
      return <ArrowGlyph key={`left-${index}`} direction="left" />;
    }
    if (char === "↑") {
      return <ArrowGlyph key={`up-${index}`} direction="up" />;
    }
    if (char === "↓") {
      return <ArrowGlyph key={`down-${index}`} direction="down" />;
    }
    if (char === "→") {
      return <ArrowGlyph key={`right-${index}`} direction="right" />;
    }
    return <span key={`char-${index}`}>{char}</span>;
  });
}

function ArrowGlyph({ direction }: { direction: "left" | "right" | "up" | "down" }) {
  if (direction === "left") {
    return (
      <svg viewBox="0 0 16 16" className="sheet-inline-arrow" aria-hidden="true">
        <path d="M14 8H4" />
        <path d="M7 5L4 8L7 11" />
      </svg>
    );
  }

  if (direction === "right") {
    return (
      <svg viewBox="0 0 16 16" className="sheet-inline-arrow" aria-hidden="true">
        <path d="M2 8H12" />
        <path d="M9 5L12 8L9 11" />
      </svg>
    );
  }

  if (direction === "up") {
    return (
      <svg viewBox="0 0 16 16" className="sheet-inline-arrow" aria-hidden="true">
        <path d="M8 14V4" />
        <path d="M5 7L8 4L11 7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" className="sheet-inline-arrow" aria-hidden="true">
      <path d="M8 2V12" />
      <path d="M5 9L8 12L11 9" />
    </svg>
  );
}
