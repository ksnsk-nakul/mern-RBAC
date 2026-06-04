import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const api = axios.create({
  baseURL:         '/api',
  withCredentials: true,
})

let isRefreshing = false
let refreshQueue: Array<(ok: boolean) => void> = []

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((ok) => {
          if (ok) resolve(api(original))
          else reject(err)
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      await api.post('/auth/refresh')
      refreshQueue.forEach((cb) => cb(true))
      refreshQueue = []
      return api(original)
    } catch {
      refreshQueue.forEach((cb) => cb(false))
      refreshQueue = []
      useAuthStore.getState().clearAuth()
      const role = useAuthStore.getState().role
      window.location.href = `/login/${role?.route ?? 'user'}`
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
