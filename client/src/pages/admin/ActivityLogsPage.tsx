export default function ActivityLogsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">
          Hash-chained audit trail of all system actions.
        </p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <p className="text-sm">Activity log viewer coming in Sub-project 5.</p>
        <p className="mt-1 text-xs">Logs are being written to the database.</p>
      </div>
    </div>
  )
}
