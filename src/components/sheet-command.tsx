type SheetCommandProps = {
  title: string;
  command: string;
  description?: string;
};

export function SheetCommand({ title, command, description }: SheetCommandProps) {
  return (
    <div className="sheet-command">
      <p className="sheet-command-title">{title}</p>
      <p className="sheet-terminal">$ {command}</p>
      {description ? <p className="sheet-command-description">{description}</p> : null}
    </div>
  );
}
