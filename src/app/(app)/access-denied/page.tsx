// requireRole() redirects here — never a bare 404 — for a permission
// failure, and logs the attempt itself before redirecting (TASK-070).
export default function AccessDeniedPage() {
  return (
    <main>
      <h1>Access denied</h1>
      <p>You don&apos;t have permission to view that page. If you believe this is a mistake, contact an admin.</p>
    </main>
  )
}
