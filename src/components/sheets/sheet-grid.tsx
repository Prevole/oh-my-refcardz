import type { ReactNode } from "react";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

type SheetGridProps = {
  children: ReactNode;
  columns: number;
  editMode?: boolean;
};

export function SheetGrid({ children, columns, editMode = false }: SheetGridProps) {
  return (
    <section
      className={`${cheatsheetStyles.dashboardGrid} ${editMode ? cheatsheetStyles.dashboardGridEditMode : ""}`}
      style={{ ["--sheet-grid-columns" as string]: String(columns) }}
    >
      {children}
    </section>
  );
}

type SheetCardProps = {
  title: string;
  badge?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  colSpan?: number;
  rowSpan?: number;
  editMode?: boolean;
  layoutLabel?: string;
  controls?: ReactNode;
};

export function SheetCard({
  title,
  badge,
  footer,
  children,
  colSpan = 1,
  rowSpan = 1,
  editMode = false,
  layoutLabel,
  controls,
}: SheetCardProps) {
  return (
    <article
      className={`${cheatsheetStyles.card} ${editMode ? cheatsheetStyles.cardEditMode : ""}`}
      style={{
        ["--card-col-span" as string]: String(colSpan),
        ["--card-row-span" as string]: String(rowSpan),
      }}
    >
      {editMode ? (
        <div className={cheatsheetStyles.cardLayoutBadgeRow}>
          <div className={cheatsheetStyles.cardLayoutBadge}>{layoutLabel ?? `${colSpan}x${rowSpan}`}</div>
          {controls}
        </div>
      ) : null}
      <div className={cheatsheetStyles.cardHeader}>
        <h2 className={cheatsheetStyles.cardTitle}>{title}</h2>
        {badge ? <span className={cheatsheetStyles.cardBadge}>{badge}</span> : null}
      </div>
      <div className={cheatsheetStyles.cardBody}>{children}</div>
      {footer ? <div className={cheatsheetStyles.cardFooter}>{footer}</div> : null}
    </article>
  );
}
