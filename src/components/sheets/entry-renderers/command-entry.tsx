import { registerHandler } from "./entry-registry";
import styles from "../sheet-commands.module.css";

type CommandLikeProps = {
  type: "command" | "example";
  value: string;
  showLabel?: boolean;
};

type AliasesProps = {
  aliases: string[];
};

export function CommandLike({ type, value, showLabel }: CommandLikeProps) {
  const label = type === "command" ? "Command" : "Example";

  return (
    <>
      {showLabel && <p className={styles.commandBlockLabel}>{label}</p>}
      <p className={styles.commandTerminal}>
        $ {value}
      </p>
    </>
  );
}

export function AliasesEntry({ aliases }: AliasesProps) {
  const displayValue = aliases.length === 1
    ? aliases[0]
    : `(${aliases.join("|")})`;

  return (
    <>
      <p className={styles.commandBlockLabel}>Alias</p>
      <p className={`${styles.commandTerminal} ${styles.commandAliasTerminal}`}>
        $ git {displayValue}
      </p>
    </>
  );
}

registerHandler("command", (value, { hasAliases }) => (
  <CommandLike type="command" value={value} showLabel={hasAliases} />
));

registerHandler("alias", (value) => <AliasesEntry aliases={[value]} />);

registerHandler("aliases", (value) => <AliasesEntry aliases={value} />);

registerHandler("example", (value) => <CommandLike type="example" value={value} />);

registerHandler("examples", (value) => (
  <>
    {value.map((example, index) => (
      <CommandLike key={index} type="example" value={example} />
    ))}
  </>
));
