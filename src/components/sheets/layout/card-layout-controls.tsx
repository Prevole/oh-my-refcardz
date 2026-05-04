import { GRID_COLUMNS } from "../sheet-grid";
import cheatsheetStyles from "../cheatsheet-rendering.module.css";
import { MAX_ROW_SPAN } from "./layout-types";

type CardLayoutControlsProps = {
  colSpan: number;
  rowSpan: number;
  onDecreaseWidth: () => void;
  onIncreaseWidth: () => void;
  onDecreaseHeight: () => void;
  onIncreaseHeight: () => void;
};

export function CardLayoutControls({
  colSpan,
  rowSpan,
  onDecreaseWidth,
  onIncreaseWidth,
  onDecreaseHeight,
  onIncreaseHeight,
}: CardLayoutControlsProps) {
  return (
    <div className={cheatsheetStyles.cardLayoutControls} data-card-layout-controls>
      <LayoutAxisControl
        label="W"
        value={colSpan}
        minValue={1}
        maxValue={GRID_COLUMNS}
        onDecrease={onDecreaseWidth}
        onIncrease={onIncreaseWidth}
      />
      <LayoutAxisControl
        label="H"
        value={rowSpan}
        minValue={1}
        maxValue={MAX_ROW_SPAN}
        onDecrease={onDecreaseHeight}
        onIncrease={onIncreaseHeight}
      />
    </div>
  );
}

type LayoutAxisControlProps = {
  label: string;
  value: number;
  minValue: number;
  maxValue: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

function LayoutAxisControl({ label, value, minValue, maxValue, onDecrease, onIncrease }: LayoutAxisControlProps) {
  return (
    <div className={cheatsheetStyles.layoutAxisControl}>
      <span className={cheatsheetStyles.layoutAxisLabel}>{label}</span>
      <button
        type="button"
        className={cheatsheetStyles.layoutAxisButton}
        onClick={onDecrease}
        disabled={value <= minValue}
        aria-label={`Decrease ${label === "W" ? "width" : "height"}`}
      >
        -
      </button>
      <span className={cheatsheetStyles.layoutAxisValue}>{value}</span>
      <button
        type="button"
        className={cheatsheetStyles.layoutAxisButton}
        onClick={onIncrease}
        disabled={value >= maxValue}
        aria-label={`Increase ${label === "W" ? "width" : "height"}`}
      >
        +
      </button>
    </div>
  );
}
