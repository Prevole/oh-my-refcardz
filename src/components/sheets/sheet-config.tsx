import cheatsheetStyles from "./cheatsheet-rendering.module.css";

type SheetConfigProps = {
  title: string;
  file: string;
  context?: string;
  entries: string[];
  description?: string;
};

export function SheetConfig({ title, file, context, entries, description }: SheetConfigProps) {
  return (
    <div className={cheatsheetStyles.configItem}>
      <div className={cheatsheetStyles.configHeader}>
        <p className={cheatsheetStyles.configTitle}>{title}</p>
      </div>
      <p className={cheatsheetStyles.configFileLine}>
        <span className={cheatsheetStyles.configFileLabel}>file:</span>
        <span className={cheatsheetStyles.configFile}>{file}</span>
      </p>
      {context ? <p className={cheatsheetStyles.configContext}>{renderInlineCode(context)}</p> : null}
      <pre className={cheatsheetStyles.configBlock}>
        <code>{entries.join("\n")}</code>
      </pre>
      {description ? <p className={cheatsheetStyles.configDescription}>{renderInlineCode(description)}</p> : null}
    </div>
  );
}

function renderInlineCode(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
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
