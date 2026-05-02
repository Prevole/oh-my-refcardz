import { Children, type ReactNode } from "react";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

export function SheetGrid({ children }: { children: ReactNode }) {
  const cardCount = Children.count(children);

  const gridColumnsClass =
    cardCount <= 1 ? "grid-cols-1" : cardCount === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";

  return <section className={`grid gap-4 ${gridColumnsClass}`}>{children}</section>;
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
