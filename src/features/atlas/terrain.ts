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

/** Deterministic position for city/floor maps (no land constraint). */
export function anySpotFor(name: string, salt = 0): { x: number; y: number } {
  let h = 5381 + salt
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0
  const rand = mulberry32(h)
  return { x: 0.12 + rand() * 0.76, y: 0.12 + rand() * 0.76 }
}

// ============================================================
// CITY — streets, blocks, parks, a river. Contemporary stories
// need neighborhoods, not continents.
// ============================================================

export function renderCity(ctx: CanvasRenderingContext2D, seed: number): void {
  const rand = mulberry32(seed)
  // Asphalt-dark ground
  ctx.fillStyle = '#171310'
  ctx.fillRect(0, 0, MAP_W, MAP_H)

  // Street grid with jitter: verticals and horizontals
  const xs: number[] = []
  const ys: number[] = []
  let x = 30 + rand() * 40
  while (x < MAP_W - 30) {
    xs.push(x)
    x += 70 + rand() * 60
  }
  let y = 30 + rand() * 40
  while (y < MAP_H - 30) {
    ys.push(y)
    y += 65 + rand() * 55
  }

  // Blocks between streets — subtly lighter, some parks/plazas
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const r = rand()
      const pad = 5
      const bx = xs[i] + pad
      const by = ys[j] + pad
      const bw = xs[i + 1] - xs[i] - pad * 2
      const bh = ys[j + 1] - ys[j] - pad * 2
      if (bw < 12 || bh < 12) continue
      if (r < 0.09) {
        ctx.fillStyle = 'rgba(111, 174, 155, 0.22)' // park
      } else if (r < 0.13) {
        ctx.fillStyle = 'rgba(201, 163, 92, 0.14)' // plaza
      } else {
        ctx.fillStyle = `rgba(233, 224, 205, ${0.045 + rand() * 0.035})` // buildings
      }
      ctx.fillRect(bx, by, bw, bh)
      // Building subdivisions inside ordinary blocks
      if (r >= 0.13 && bw > 34 && bh > 34) {
        ctx.strokeStyle = 'rgba(13, 11, 9, 0.55)'
        ctx.lineWidth = 1
        const splits = 1 + Math.floor(rand() * 3)
        for (let s = 0; s < splits; s++) {
          if (rand() < 0.5) {
            const sx = bx + 8 + rand() * (bw - 16)
            ctx.beginPath()
            ctx.moveTo(sx, by)
            ctx.lineTo(sx, by + bh)
            ctx.stroke()
          } else {
            const sy = by + 8 + rand() * (bh - 16)
            ctx.beginPath()
            ctx.moveTo(bx, sy)
            ctx.lineTo(bx + bw, sy)
            ctx.stroke()
          }
        }
      }
    }
  }

  // Streets: minor thin, every ~3rd an avenue
  ctx.strokeStyle = 'rgba(233, 224, 205, 0.35)'
  xs.forEach((sx, i) => {
    ctx.lineWidth = i % 3 === 1 ? 5 : 2
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, MAP_H)
    ctx.stroke()
  })
  ys.forEach((sy, j) => {
    ctx.lineWidth = j % 3 === 1 ? 5 : 2
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(MAP_W, sy)
    ctx.stroke()
  })

  // One diagonal boulevard
  if (rand() < 0.8) {
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(233, 224, 205, 0.28)'
    const fromTop = rand() < 0.5
    ctx.beginPath()
    ctx.moveTo(rand() * MAP_W * 0.4, fromTop ? 0 : MAP_H)
    ctx.lineTo(MAP_W * (0.6 + rand() * 0.4), fromTop ? MAP_H : 0)
    ctx.stroke()
  }

  // A river cutting through, with bridge gaps implied by street crossings
  if (rand() < 0.7) {
    ctx.strokeStyle = 'rgba(58, 74, 88, 0.9)'
    ctx.lineWidth = 26
    ctx.lineCap = 'round'
    ctx.beginPath()
    let ry = MAP_H * (0.2 + rand() * 0.6)
    ctx.moveTo(-10, ry)
    for (let rx = 0; rx <= MAP_W + 40; rx += 80) {
      ry += (rand() - 0.5) * 90
      ry = Math.max(40, Math.min(MAP_H - 40, ry))
      ctx.lineTo(rx, ry)
    }
    ctx.stroke()
    ctx.lineCap = 'butt'
  }

  // Compass N
  ctx.fillStyle = 'rgba(233, 224, 205, 0.6)'
  ctx.font = '600 14px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('N ↑', MAP_W - 40, 36)
}

// ============================================================
// FLOOR — a building interior via BSP rooms, blueprint-inked.
// ============================================================

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function renderFloor(ctx: CanvasRenderingContext2D, seed: number): void {
  const rand = mulberry32(seed)
  // Blueprint ground
  ctx.fillStyle = '#10151d'
  ctx.fillRect(0, 0, MAP_W, MAP_H)
  // Fine blueprint grid
  ctx.strokeStyle = 'rgba(140, 170, 200, 0.06)'
  ctx.lineWidth = 1
  for (let gx = 0; gx < MAP_W; gx += 24) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, MAP_H)
    ctx.stroke()
  }
  for (let gy = 0; gy < MAP_H; gy += 24) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(MAP_W, gy)
    ctx.stroke()
  }

  const outer: Rect = { x: 60, y: 50, w: MAP_W - 120, h: MAP_H - 100 }
  // BSP subdivision into rooms
  const rooms: Rect[] = []
  const split = (r: Rect, depth: number) => {
    const minSide = 95
    const canV = r.w > minSide * 2
    const canH = r.h > minSide * 2
    if (depth === 0 || (!canV && !canH)) {
      rooms.push(r)
      return
    }
    const vertical = canV && (!canH || r.w > r.h ? rand() < 0.75 : rand() < 0.25)
    const t = 0.35 + rand() * 0.3
    if (vertical) {
      const w1 = Math.floor(r.w * t)
      split({ x: r.x, y: r.y, w: w1, h: r.h }, depth - 1)
      split({ x: r.x + w1, y: r.y, w: r.w - w1, h: r.h }, depth - 1)
    } else {
      const h1 = Math.floor(r.h * t)
      split({ x: r.x, y: r.y, w: r.w, h: h1 }, depth - 1)
      split({ x: r.x, y: r.y + h1, w: r.w, h: r.h - h1 }, depth - 1)
    }
  }
  split(outer, 4)

  const wall = 'rgba(214, 226, 238, 0.85)'
  // Room floors
  for (const r of rooms) {
    ctx.fillStyle = `rgba(214, 226, 238, ${0.04 + rand() * 0.04})`
    ctx.fillRect(r.x, r.y, r.w, r.h)
  }
  // Walls
  ctx.strokeStyle = wall
  ctx.lineWidth = 3
  for (const r of rooms) ctx.strokeRect(r.x, r.y, r.w, r.h)
  ctx.lineWidth = 5
  ctx.strokeRect(outer.x, outer.y, outer.w, outer.h)

  // Doors: a gap punched into one interior wall per room
  ctx.fillStyle = '#10151d'
  for (const r of rooms) {
    const side = Math.floor(rand() * 4)
    const door = 20
    if (side === 0 && r.y > outer.y + 4) {
      ctx.fillRect(r.x + r.w * (0.3 + rand() * 0.4) - door / 2, r.y - 3, door, 6)
    } else if (side === 1 && r.y + r.h < outer.y + outer.h - 4) {
      ctx.fillRect(r.x + r.w * (0.3 + rand() * 0.4) - door / 2, r.y + r.h - 3, door, 6)
    } else if (side === 2 && r.x > outer.x + 4) {
      ctx.fillRect(r.x - 3, r.y + r.h * (0.3 + rand() * 0.4) - door / 2, 6, door)
    } else if (r.x + r.w < outer.x + outer.w - 4) {
      ctx.fillRect(r.x + r.w - 3, r.y + r.h * (0.3 + rand() * 0.4) - door / 2, 6, door)
    }
  }

  // Main entrance on the south face + stair glyph in one room
  ctx.fillStyle = '#10151d'
  ctx.fillRect(outer.x + outer.w * 0.5 - 22, outer.y + outer.h - 5, 44, 10)
  const stairRoom = rooms[Math.floor(rand() * rooms.length)]
  ctx.strokeStyle = 'rgba(214, 226, 238, 0.5)'
  ctx.lineWidth = 2
  for (let s = 0; s < 5; s++) {
    ctx.beginPath()
    ctx.moveTo(stairRoom.x + 12, stairRoom.y + 12 + s * 6)
    ctx.lineTo(stairRoom.x + 44, stairRoom.y + 12 + s * 6)
    ctx.stroke()
  }

  // Scale bar
  ctx.strokeStyle = 'rgba(214, 226, 238, 0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(MAP_W - 150, MAP_H - 26)
  ctx.lineTo(MAP_W - 60, MAP_H - 26)
  ctx.stroke()
  ctx.fillStyle = 'rgba(214, 226, 238, 0.7)'
  ctx.font = '11px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('10 m', MAP_W - 105, MAP_H - 34)
}
