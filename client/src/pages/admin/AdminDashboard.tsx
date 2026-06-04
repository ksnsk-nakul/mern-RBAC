export default function AdminDashboard() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Users, roles, activity, and system health.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['Total Users', 'Active Roles', 'Open Tickets'].map((label) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <div className="mt-3 text-2xl font-semibold">0</div>
          </div>
        ))}
      </div>
    </div>
  )
}
