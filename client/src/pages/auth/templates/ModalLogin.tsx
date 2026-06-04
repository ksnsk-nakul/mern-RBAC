import { useState } from 'react'
import type { LoginConfig } from '../LoginPage'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'

interface Props {
  config:     LoginConfig
  onSubmit:   (email: string, password: string) => void
  error:      string
  submitting: boolean
}

export function ModalLogin({ config, onSubmit, error, submitting }: Props) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

  const bgStyle = config.bgImage
    ? { backgroundImage: `url(${config.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `color-mix(in srgb, ${config.roleColor} 15%, transparent)` }

  return (
    <div className="relative flex min-h-screen items-center justify-center" style={bgStyle}>
      <div className="absolute inset-0 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md space-y-6 rounded-2xl border bg-card/95 p-8 shadow-2xl backdrop-blur-md">
        {config.logoUrl && (
          <img src={config.logoUrl} alt="Logo" className="mx-auto h-10 object-contain" />
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{config.brandTitle}</h1>
          {config.brandSubtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{config.brandSubtitle}</p>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(email, password) }} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {config.googleAuthEnabled && (
          <a
            href={`/api/auth/google/redirect?roleRoute=${config.roleRoute}`}
            className="flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            Continue with Google
          </a>
        )}
      </div>
    </div>
  )
}
