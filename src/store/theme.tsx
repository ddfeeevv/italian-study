import { useEffect } from 'react'
import type { ThemePreference } from '../types/models'
import { useAppStore } from './app-store'

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return preference
}

export function ThemeSync() {
  const { settings } = useAppStore()

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(settings.theme)
      document.documentElement.classList.toggle('dark', resolved === 'dark')
      document.documentElement.style.colorScheme = resolved
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#14110F' : '#F6F1E8')
    }

    apply()
    if (settings.theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme])

  return null
}
