export type Rejection = { row: number; field: string; value: string; reason: string }

export function RejectionTable({ rejections }: { rejections: Rejection[] }) {
  return (
    <table>
      <caption>Rejected rows</caption>
      <thead>
        <tr>
          <th scope="col">Row</th>
          <th scope="col">Field</th>
          <th scope="col">Value</th>
          <th scope="col">Reason</th>
        </tr>
      </thead>
      <tbody>
        {rejections.map((rejection, index) => (
          <tr key={`${rejection.row}-${rejection.field}-${index}`}>
            <td>{rejection.row}</td>
            <td>{rejection.field}</td>
            <td>{rejection.value || '—'}</td>
            <td>{rejection.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
