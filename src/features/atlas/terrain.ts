// Seeded procedural terrain for The Atlas — value-noise fBm rendered as a
// vintage inked map on parchment. Deterministic: same seed, same world.

export const MAP_W = 960
export const MAP_H = 640

/** mulberry32 — tiny seeded PRNG */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Value-noise grid with bilinear sampling + fBm octaves. */
function makeNoise(seed: number) {
  const rand = mulberry32(seed)
  const SIZE = 64
  const grid = new Float32Array(SIZE * SIZE)
  for (let i = 0; i < grid.length; i++) grid[i] = rand()
  const at = (x: number, y: number) =>
    grid[((y % SIZE) + SIZE) % SIZE * SIZE + (((x % SIZE) + SIZE) % SIZE)]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const sample = (x: number, y: number): number => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = smooth(x - xi)
    const yf = smooth(y - yi)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
  return (x: number, y: number): number => {
    let value = 0
    let amp = 0.55
    let freq = 3
    for (let o = 0; o < 5; o++) {
      value += amp * sample(x * freq, y * freq)
      amp *= 0.5
      freq *= 2.1
    }
    return value
  }
}

export interface Terrain {
  /** Height at normalized coords (0-1); sea level is ~0.5 */
  height: (nx: number, ny: number) => number
  isLand: (nx: number, ny: number) => boolean
}

export function makeTerrain(seed: number): Terrain {
  const noise = makeNoise(seed)
  const height = (nx: number, ny: number) => {
    // Radial falloff pushes ocean to the edges so worlds read as regions/continents.
    const dx = nx - 0.5
    const dy = ny - 0.5
    const edge = 1 - 1.4 * Math.sqrt(dx * dx + dy * dy)
    return noise(nx, ny) * 0.85 + edge * 0.35
  }
  return { height, isLand: (nx, ny) => height(nx, ny) > 0.52 }
}

/** Vintage palette: deep sea → shallow → sand → lowland → hills → peaks. */
function color(h: number): [number, number, number] {
  if (h < 0.42) return [42, 52, 64] // deep water, inked
  if (h < 0.5) return [58, 74, 88] // shallows
  if (h < 0.52) return [96, 112, 118] // shoal line
  if (h < 0.545) return [196, 176, 134] // sand
  if (h < 0.62) return [166, 158, 116] // lowland parchment-green
  if (h < 0.7) return [142, 130, 96] // hills
  if (h < 0.78) return [116, 102, 82] // highlands
  if (h < 0.85) return [96, 84, 72] // mountains
  return [214, 206, 192] // snowcaps
}

/** Render the terrain (plus grid + coast ink) into a canvas 2D context. */
export function renderTerrain(ctx: CanvasRenderingContext2D, terrain: Terrain): void {
  const img = ctx.createImageData(MAP_W, MAP_H)
  const data = img.data
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const h = terrain.height(x / MAP_W, y / MAP_H)
      let [r, g, b] = color(h)
      // Coastline ink stroke
      if (Math.abs(h - 0.52) < 0.006) {
        r = 32
        g = 26
        b = 20
      }
      // Subtle hillshade from the height gradient
      const hx = terrain.height((x + 2) / MAP_W, y / MAP_H) - h
      const shade = Math.max(-0.12, Math.min(0.12, -hx * 6))
      const k = 1 + shade
      const i = (y * MAP_W + x) * 4
      data[i] = Math.min(255, r * k)
      data[i + 1] = Math.min(255, g * k)
      data[i + 2] = Math.min(255, b * k)
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // Faint graticule
  ctx.strokeStyle = 'rgba(233, 224, 205, 0.07)'
  ctx.lineWidth = 1
  for (let gx = 1; gx < 8; gx++) {
    ctx.beginPath()
    ctx.moveTo((MAP_W / 8) * gx, 0)
    ctx.lineTo((MAP_W / 8) * gx, MAP_H)
    ctx.stroke()
  }
  for (let gy = 1; gy < 6; gy++) {
    ctx.beginPath()
    ctx.moveTo(0, (MAP_H / 6) * gy)
    ctx.lineTo(MAP_W, (MAP_H / 6) * gy)
    ctx.stroke()
  }

  // Compass rose, top-right
  const cx = MAP_W - 64
  const cy = 64
  ctx.strokeStyle = 'rgba(233, 224, 205, 0.55)'
  ctx.fillStyle = 'rgba(233, 224, 205, 0.75)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, 26, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, cy - 22)
  ctx.lineTo(cx - 6, cy + 6)
  ctx.lineTo(cx, cy)
  ctx.lineTo(cx + 6, cy + 6)
  ctx.closePath()
  ctx.fill()
  ctx.font = '600 13px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('N', cx, cy - 32)
}

/** Deterministic land position for a name (used to auto-place codex pins). */
export function landSpotFor(name: string, terrain: Terrain, salt = 0): { x: number; y: number } {
  let h = 5381 + salt
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0
  const rand = mulberry32(h)
  for (let tries = 0; tries < 60; tries++) {
    const x = 0.1 + rand() * 0.8
    const y = 0.1 + rand() * 0.8
    if (terrain.isLand(x, y)) return { x, y }
  }
  return { x: 0.5, y: 0.5 }
}
