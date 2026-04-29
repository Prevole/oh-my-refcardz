type Props = {
  direction: "left" | "right" | "up" | "down";
  className?: string;
};

export function ArrowGlyph({ direction, className }: Props) {
  if (direction === "left") {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
        <path d="M14 8H4" />
        <path d="M7 5L4 8L7 11" />
      </svg>
    );
  }

  if (direction === "right") {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
        <path d="M2 8H12" />
        <path d="M9 5L12 8L9 11" />
      </svg>
    );
  }

  if (direction === "up") {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
        <path d="M8 14V4" />
        <path d="M5 7L8 4L11 7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M8 2V12" />
      <path d="M5 9L8 12L11 9" />
    </svg>
  );
}
