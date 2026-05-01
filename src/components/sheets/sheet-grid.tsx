import type { ReactNode } from "react";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

export function SheetGrid({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</section>;
}

type SheetCardProps = {
  title: string;
  badge?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function SheetCard({ title, badge, footer, children }: SheetCardProps) {
  return (
    <article className={cheatsheetStyles.card}>
      <div className={cheatsheetStyles.cardHeader}>
        <h2 className={cheatsheetStyles.cardTitle}>{title}</h2>
        {badge ? <span className={cheatsheetStyles.cardBadge}>{badge}</span> : null}
      </div>
      <div className={cheatsheetStyles.cardBody}>{children}</div>
      {footer ? <div className={cheatsheetStyles.cardFooter}>{footer}</div> : null}
    </article>
  );
}
