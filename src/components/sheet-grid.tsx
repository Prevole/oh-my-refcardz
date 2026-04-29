import type { ReactNode } from "react";

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
    <article className="sheet-card">
      <div className="sheet-card-header">
        <h2 className="sheet-card-title">{title}</h2>
        {badge ? <span className="sheet-card-badge">{badge}</span> : null}
      </div>
      <div className="sheet-card-body">{children}</div>
      {footer ? <div className="sheet-card-footer">{footer}</div> : null}
    </article>
  );
}
