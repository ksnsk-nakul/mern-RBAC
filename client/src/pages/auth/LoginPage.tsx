import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { CenteredLogin } from './templates/CenteredLogin'
import { ModalLogin } from './templates/ModalLogin'
import { SplitLogin } from './templates/SplitLogin'

export interface LoginConfig {
  roleRoute:         string
  template:          'modal' | 'centered' | 'split'
  bgImage:           string | null
  logoUrl:           string | null
  brandTitle:        string
  brandSubtitle:     string | null
  googleAuthEnabled: boolean
  roleColor:         string
}

export interface LoginTemplateProps {
  config:       LoginConfig
  onSubmit:     (email: string, password: string) => void
  error:        string
  submitting:   boolean
  mfaRequired:  boolean
  totpCode:     string
  onTotpChange: (code: string) => void
}

const TEMPLATES = {
  centered: CenteredLogin,
  modal:    ModalLogin,
  split:    SplitLogin,
}

export default function LoginPage() {
  const { roleRoute = 'user' } = useParams<{ roleRoute: string }>()
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)

  const [config,      setConfig]     = useState<LoginConfig | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [totpCode,    setTotpCode]    = useState('')

  useEffect(() => {
    api.get(`/auth/login-config/${roleRoute}`)
      .then((r) => {
        setConfig(r.data)
        document.documentElement.style.setProperty('--role-accent', r.data.roleColor)
      })
      .catch(() => setError('Login portal not found'))
      .finally(() => setLoading(false))
  }, [roleRoute])

  async function handleLogin(email: string, password: string) {
    setSubmitting(true)
    setError('')
    try {
      const payload: Record<string, unknown> = { email, password }
      if (mfaRequired && totpCode) payload.totpCode = totpCode

      const { data } = await api.post(`/auth/login/${roleRoute}`, payload)

      if (data.mfaRequired) {
        setMfaRequired(true)
        return
      }

      setAuth(data.user, data.role, data.permissions ?? [])
      navigate(data.redirectTo)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>
  }
  if (!config) {
    return <div className="flex h-screen items-center justify-center text-destructive">{error || 'Portal not found'}</div>
  }

  const Template = TEMPLATES[config.template] ?? CenteredLogin

  return (
    <Template
      config={config}
      onSubmit={handleLogin}
      error={error}
      submitting={submitting}
      mfaRequired={mfaRequired}
      totpCode={totpCode}
      onTotpChange={setTotpCode}
    />
  )
}
