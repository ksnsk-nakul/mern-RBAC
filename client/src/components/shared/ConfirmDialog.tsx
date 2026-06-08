import { Button } from '@/components/ui/button'

interface Props {
  open:      boolean
  title:     string
  message:   string
  onConfirm: () => void
  onCancel:  () => void
  danger?:   boolean
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'destructive' : 'default'} onClick={onConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  )
}
