import Link from "next/link";
import { parseInlineReferenceTarget } from "@/lib/anchors";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";
import { useKnownSheetSlugs } from "./sheet-links-context";

type InlineRichTextProps = {
  text: string;
};

function InlineSheetLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`${cheatsheetStyles.inlineSheetLinkIcon} ${className ?? ""}`}
      fill="none"
    >
      <path d="M6.2 5.1L4.7 6.6C3.83 7.47 3.83 8.88 4.7 9.75C5.57 10.62 6.98 10.62 7.85 9.75L9.35 8.25" />
      <path d="M9.8 10.9L11.3 9.4C12.17 8.53 12.17 7.12 11.3 6.25C10.43 5.38 9.02 5.38 8.15 6.25L6.65 7.75" />
    </svg>
  );
}

function InlineAnchorLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={cheatsheetStyles.inlineAnchorLinkIcon} fill="none">
      <circle cx="8" cy="8" r="4.6" />
      <circle cx="8" cy="8" r="1.45" fill="currentColor" stroke="none" />
      <path d="M8 1.5V3.2" />
      <path d="M8 12.8V14.5" />
      <path d="M1.5 8H3.2" />
      <path d="M12.8 8H14.5" />
    </svg>
  );
}

function parseSheetRefToken(token: string) {
  const inner = token.slice(2, -2);
  const separatorIndex = inner.indexOf("|");

  if (separatorIndex === -1) {
    return { target: inner.trim(), label: "" };
  }

  const target = inner.slice(0, separatorIndex).trim();
  const label = inner.slice(separatorIndex + 1).trim();

  return {
    target,
    label,
  };
}

export function resolveInlineReferenceToken(token: string, knownSlugs: Set<string>) {
  const { target, label } = parseSheetRefToken(token);
  const referenceTarget = parseInlineReferenceTarget(target);

  if (!referenceTarget) {
    return null;
  }

  if (!referenceTarget.slug) {
    if (!referenceTarget.anchor) {
      return null;
    }

    return {
      href: `#${referenceTarget.anchor}`,
      label: label || referenceTarget.anchor,
      variant: "anchor" as const,
    };
  }

  if (!knownSlugs.has(referenceTarget.slug)) {
    return null;
  }

  return {
    href: `/cheatsheets/${referenceTarget.slug}${referenceTarget.anchor ? `#${referenceTarget.anchor}` : ""}`,
    label: label || target,
    variant: referenceTarget.anchor ? ("anchor" as const) : ("sheet" as const),
  };
}

function renderInlineRichText(text: string, knownSlugs: Set<string>) {
  return text.split(/(`[^`]*`|\[\[[^\]]+\]\])/g).map((part, index) => {
    if (!part) {
      return null;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <span key={index} className={cheatsheetStyles.inlineTextCode}>
          {part.slice(1, -1)}
        </span>
      );
    }

    if (part.startsWith("[[") && part.endsWith("]]")) {
      const reference = resolveInlineReferenceToken(part, knownSlugs);

      if (!reference) {
        return part;
      }

      const className = `${cheatsheetStyles.inlineSheetLink} ${reference.variant === "anchor" ? cheatsheetStyles.inlineAnchorLink : ""}`;

      if (reference.href.startsWith("#")) {
        return (
          <a key={index} href={reference.href} className={className}>
            {reference.label}
            <InlineAnchorLinkIcon />
          </a>
        );
      }

      return (
        <Link
          key={index}
          href={reference.href}
          className={className}
        >
          {reference.label}
          {reference.variant === "anchor" ? <InlineAnchorLinkIcon /> : <InlineSheetLinkIcon />}
        </Link>
      );
    }

    return part;
  });
}

export function InlineRichText({ text }: InlineRichTextProps) {
  const knownSlugs = useKnownSheetSlugs();
  return <>{renderInlineRichText(text, knownSlugs)}</>;
}
