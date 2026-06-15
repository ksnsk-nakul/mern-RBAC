import { useState } from 'react'
import type { LoginTemplateProps } from '../LoginPage'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'

export function ModalLogin({ config, onSubmit, error, submitting, mfaRequired, totpCode, onTotpChange }: LoginTemplateProps) {
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
          {mfaRequired && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Authenticator Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={totpCode}
                onChange={(e) => onTotpChange(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Enter the code from your authenticator app.
              </p>
            </div>
          )}
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
