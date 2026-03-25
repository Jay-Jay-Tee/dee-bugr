// src/renderer/heatmapDecorations.ts
// Converts a line-hit-count map into Monaco decoration descriptors.
// Pure function — no React, no side effects. CodeEditor calls this.
//
// Usage:
//   const decors = buildHeatmapDecorations(monaco, hitMap)
//   heatmapCollectionRef.current?.set(decors)

import type * as Monaco from 'monaco-editor'

// CSS class names injected via index.css (see bottom of this file for required CSS).
// Four tiers: cold → warm → hot → very-hot
const TIER_CLASS = [
  'lucid-heat-1',  // 1–2 hits
  'lucid-heat-2',  // 3–9 hits
  'lucid-heat-3',  // 10–29 hits
  'lucid-heat-4',  // 30+ hits
] as const

function tierFor(hits: number): string {
  if (hits >= 30) return TIER_CLASS[3]
  if (hits >= 10) return TIER_CLASS[2]
  if (hits >= 3)  return TIER_CLASS[1]
  return TIER_CLASS[0]
}

export function buildHeatmapDecorations(
  monaco: typeof Monaco,
  hitMap: Map<number, number>,
): Monaco.editor.IModelDeltaDecoration[] {
  const result: Monaco.editor.IModelDeltaDecoration[] = []
  for (const [line, hits] of hitMap) {
    if (hits < 1) continue
    result.push({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className:   tierFor(hits),
        overviewRuler: {
          color:    hits >= 10 ? '#ff6b35' : '#f5a623',
          position: monaco.editor.OverviewRulerLane.Right,
        },
      },
    })
  }
  return result
}

/*
Required CSS to add to src/index.css:

.lucid-heat-1 { background: rgba(245, 166,  35, 0.08); }
.lucid-heat-2 { background: rgba(245, 166,  35, 0.18); }
.lucid-heat-3 { background: rgba(255, 107,  53, 0.25); }
.lucid-heat-4 { background: rgba(255,  59,  48, 0.35); }
*/
