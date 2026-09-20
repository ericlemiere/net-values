import { alignClass, type ColumnDef } from "./DataTable";

interface SimpleTableProps<Row> {
  title: string;
  columns: ColumnDef<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
}

export function SimpleTable<Row>({ title, columns, rows, rowKey }: SimpleTableProps<Row>) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-2 text-white">{title}</h2>
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-white">
        <table className="min-w-full text-sm text-black">
          <thead className="bg-white">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-medium whitespace-nowrap border-b border-black/10 ${alignClass(
                    col.align
                  )}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={`${i % 2 === 0 ? "bg-white" : "bg-gray-100"} hover:bg-accent transition-colors`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-1.5 whitespace-nowrap ${alignClass(col.align)} ${
                      col.align === "right" || col.align === "center" ? "tabular-nums" : ""
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-black/40">
                  No data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
