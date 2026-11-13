// PROTOTYPE — throwaway. 共用的底部浮動切換列（?variant= + ←/→），正式版不會出現。
import { useEffect, useState, type ReactNode } from 'react'

export type VariantInfo = { key: string; name: string }

export function useVariantParam(variants: VariantInfo[]): [string, (key: string) => void] {
  const [variant, setVariant] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
    return variants.some((x) => x.key === v) ? (v as string) : variants[0].key
  })
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', variant)
    window.history.replaceState(null, '', url)
  }, [variant])
  return [variant, setVariant]
}

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
  children,
}: {
  variants: VariantInfo[]
  current: string
  onChange: (key: string) => void
  children?: ReactNode
}) {
  const i = Math.max(0, variants.findIndex((v) => v.key === current))
  const go = (d: number) => onChange(variants[(i + d + variants.length) % variants.length].key)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!import.meta.env.DEV) return null
  return (
    <div className="proto-bar" role="toolbar" aria-label="原型切換列">
      <button type="button" onClick={() => go(-1)} aria-label="上一個版本">
        ←
      </button>
      <span className="proto-label">
        {current}（{variants[i].name}）
      </span>
      <button type="button" onClick={() => go(1)} aria-label="下一個版本">
        →
      </button>
      {children ? <span className="proto-sep" /> : null}
      {children}
    </div>
  )
}
