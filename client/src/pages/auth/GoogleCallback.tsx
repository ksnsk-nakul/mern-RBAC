import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'

export default function GoogleCallback() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => {
        if (data.user && data.role) {
          setAuth(data.user, data.role, data.permissions ?? [])
          navigate(`/${data.role.route}`)
        } else {
          navigate('/login/user?error=google_failed')
        }
      })
      .catch(() => navigate('/login/user?error=google_failed'))
  }, [])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Completing sign in…</p>
    </div>
  )
}
