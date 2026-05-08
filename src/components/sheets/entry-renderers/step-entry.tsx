import { registerHandler } from "./entry-registry";
import styles from "./step-entry.module.css";

type StepEntryProps = {
  value: string;
};

export function StepEntry({ value }: StepEntryProps) {
  return (
    <p className={styles.stepLabel} data-entry-step>
      {value}
    </p>
  );
}

registerHandler("step", (value) => <StepEntry value={value} />);
