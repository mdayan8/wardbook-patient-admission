import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches
const currentTheme = () => document.documentElement.dataset.theme || (systemDark() ? 'dark' : 'light')

// Sun/moon button. The new theme wipes in as a circle growing from the button.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme)

  function toggle(e) {
    const next = theme === 'dark' ? 'light' : 'dark'
    const apply = () => {
      document.documentElement.dataset.theme = next
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#141310' : '#FAF9F6')
      setTheme(next)
    }
    try { localStorage.setItem('theme', next) } catch { /* private mode: still works for this visit */ }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) return apply()
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
    const x = left + width / 2, y = top + height / 2
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const root = document.documentElement.style
    root.setProperty('--tx', `${x}px`); root.setProperty('--ty', `${y}px`); root.setProperty('--tr', `${r}px`)
    document.startViewTransition(apply)
  }

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button type="button" className={`theme-toggle ${theme === 'dark' ? 'is-dark' : ''}`} onClick={toggle} aria-label={label} title={label}>
      <Sun size={18} className="sun" aria-hidden />
      <Moon size={18} className="moon" aria-hidden />
    </button>
  )
}
