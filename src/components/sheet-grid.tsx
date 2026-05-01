import type { ReactNode } from "react";
import styles from "./sheet-rendering.module.css";

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
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {badge ? <span className={styles.cardBadge}>{badge}</span> : null}
      </div>
      <div className={styles.cardBody}>{children}</div>
      {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
    </article>
  );
}
