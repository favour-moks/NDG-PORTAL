'use client'

import { useTable } from '@tanstack/react-table'
import type { ColumnDef, RowData } from '@tanstack/react-table'
import { tableFeaturesConfig } from './tableFeatures'

type DataTableProps<TData extends RowData> = {
  columns: ColumnDef<typeof tableFeaturesConfig, TData, unknown>[]
  data: TData[]
  emptyMessage?: string
  caption?: string
}

// Headless by design: rows arrive already filtered, sorted, and paginated
// by the server (see src/lib/query/participations.ts + useFilterState) —
// this component only turns { columns, data } into markup, never fetches
// or re-derives table state itself.
export function DataTable<TData extends RowData>({
  columns,
  data,
  emptyMessage = 'No records match the current filters.',
  caption,
}: DataTableProps<TData>) {
  const table = useTable({ features: tableFeaturesConfig, columns, data })

  if (data.length === 0) {
    return <p role="status">{emptyMessage}</p>
  }

  return (
    <table>
      {caption && <caption>{caption}</caption>}
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th key={header.id} scope="col">
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getAllCells().map((cell) => (
              <td key={cell.id}>
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
