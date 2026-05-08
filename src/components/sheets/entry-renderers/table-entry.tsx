import { registerHandler } from "./entry-registry";
import { InlineRichText } from "../inline-rich-text";
import styles from "./table-entry.module.css";

type TableRow = {
  cols: string[];
};

type TableEntryProps = {
  headers?: string[];
  rows: TableRow[];
};

export function TableEntry({ headers, rows }: TableEntryProps) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        {headers && headers.length > 0 && (
          <thead className={styles.tableHead}>
            <tr className={styles.tableRow}>
              {headers.map((header, index) => (
                <th key={index} className={styles.tableHeaderCell}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className={styles.tableBody}>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={styles.tableRow}>
              {row.cols.map((cell, cellIndex) => (
                <td key={cellIndex} className={styles.tableCell}>
                  <InlineRichText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

registerHandler("table", (value) => (
  <TableEntry headers={value.headers} rows={value.rows} />
));
