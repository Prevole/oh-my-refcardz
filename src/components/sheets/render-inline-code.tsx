import cheatsheetStyles from "./cheatsheet-rendering.module.css";

export function renderInlineCode(text: string) {
  return text.split(/(`[^`]*`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <span key={index} className={cheatsheetStyles.inlineTextCode}>
          {part.slice(1, -1)}
        </span>
      );
    }

    return part;
  });
}
