// src/components/panels/subpanels/PanelTabBar.tsx
// Reusable tab bar with pipe dividers, active indicator, and responsive
// collapse to single-letter labels when the panel is narrower than `collapseAt`.

import { useState, useEffect, useRef } from 'react'

export interface TabDef {
  id: string
  label: string
}

interface Props {
  tabs:       TabDef[]
  active:     string
  onChange:   (id: string) => void
  collapseAt?: number   // px width below which labels collapse to initials
}

export default function PanelTabBar({ tabs, active, onChange, collapseAt = 200 }: Readonly<Props>) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      setCollapsed(entry.contentRect.width < collapseAt)
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [collapseAt])

  return (
    <div ref={containerRef} className="flex w-full border-b border-[#3c3c3c] shrink-0 bg-[#1e1e1e] overflow-hidden">
      {tabs.map((t, i) => {
        const isActive = active === t.id
        return (
          <div key={t.id} className="flex flex-1 items-center min-w-0">
            {i > 0 && <div className="w-px h-3 bg-[#3c3c3c] shrink-0" />}
            <button
              onClick={() => onChange(t.id)}
              title={t.label}
              className={[
                'flex-1 flex items-center justify-center py-2 px-1 transition-all duration-150 min-w-0 relative',
                isActive
                  ? 'text-white bg-[#2d2d2d]/40'
                  : 'text-[#969696] hover:text-white hover:bg-[#2a2d2e]/50',
              ].join(' ')}
            >
              <span className="text-[11px] uppercase tracking-wider truncate px-1 font-medium">
                {collapsed ? t.label.charAt(0) : t.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#00ffff]" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
