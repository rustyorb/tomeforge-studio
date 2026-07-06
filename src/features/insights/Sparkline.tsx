/** Tiny inline-SVG sparkline. Flat baseline when all values are zero. */
export function Sparkline(props: {
  values: number[]
  width?: number
  height?: number
  stroke?: string
}) {
  const vals = props.values.length >= 2 ? props.values : [0, 0]
  const w = props.width ?? 130
  const h = props.height ?? 30
  const max = Math.max(...vals, 1)
  const points = vals
    .map((v, i) => {
      const x = 1 + (i / (vals.length - 1)) * (w - 2)
      const y = h - 2 - (v / max) * (h - 6)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={props.stroke ?? 'var(--ember)'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
