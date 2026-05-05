import cheatsheetStyles from "./cheatsheet-rendering.module.css";
import { renderInlineCode } from "./render-inline-code";

type SheetConfigProps = {
  title: string;
  file: string;
  context?: string;
  content: string;
  description?: string;
};

export function SheetConfig({ title, file, context, content, description }: SheetConfigProps) {
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
        <code>{content}</code>
      </pre>
      {description ? <p className={cheatsheetStyles.configDescription}>{renderInlineCode(description)}</p> : null}
    </div>
  );
}
