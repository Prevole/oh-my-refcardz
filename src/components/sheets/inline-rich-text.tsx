import Link from "next/link";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";
import { useKnownSheetSlugs } from "./sheet-links-context";

type InlineRichTextProps = {
  text: string;
};

function InlineSheetLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={cheatsheetStyles.inlineSheetLinkIcon}
      fill="none"
    >
      <path d="M6.2 5.1L4.7 6.6C3.83 7.47 3.83 8.88 4.7 9.75C5.57 10.62 6.98 10.62 7.85 9.75L9.35 8.25" />
      <path d="M9.8 10.9L11.3 9.4C12.17 8.53 12.17 7.12 11.3 6.25C10.43 5.38 9.02 5.38 8.15 6.25L6.65 7.75" />
    </svg>
  );
}

function parseSheetRefToken(token: string) {
  const inner = token.slice(2, -2);
  const separatorIndex = inner.indexOf("|");

  if (separatorIndex === -1) {
    return { slug: inner.trim(), label: inner.trim() };
  }

  const slug = inner.slice(0, separatorIndex).trim();
  const label = inner.slice(separatorIndex + 1).trim();

  return {
    slug,
    label: label || slug,
  };
}

export function renderInlineRichText(text: string, knownSlugs: Set<string>) {
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
      const { slug, label } = parseSheetRefToken(part);

      if (!slug || !knownSlugs.has(slug)) {
        return part;
      }

      return (
        <Link key={index} href={`/cheatsheets/${slug}`} className={cheatsheetStyles.inlineSheetLink}>
          {label}
          <InlineSheetLinkIcon />
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
