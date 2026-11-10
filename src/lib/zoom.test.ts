import { describe, expect, it } from 'vitest'
import { FIT, clampView, fitSize, panBy, zoomAt } from './zoom'

describe('zoom maths', () => {
  it('zooming keeps the point under the cursor in place', () => {
    const v = zoomAt(FIT, 2, 100, 50)
    expect(v.scale).toBe(2)
    // image point under the cursor before: (100 - 0) / 1 = 100; after: (100 - x) / 2 must still be 100
    expect((100 - v.x) / v.scale).toBeCloseTo(100)
    expect((50 - v.y) / v.scale).toBeCloseTo(50)
  })

  it('zooming around the centre does not move the image', () => {
    expect(zoomAt(FIT, 3, 0, 0)).toEqual({ scale: 3, x: 0, y: 0 })
  })

  it('stays between 1x and 8x', () => {
    expect(zoomAt(FIT, 0.5, 10, 10).scale).toBe(1)
    expect(zoomAt({ scale: 6, x: 0, y: 0 }, 4, 0, 0).scale).toBe(8)
  })

  it('back at 1x the image is centred again', () => {
    expect(clampView({ scale: 1, x: 40, y: -20 }, 400, 300, 800, 600)).toEqual(FIT)
  })

  it('cannot be dragged past its own edges', () => {
    // 400x300 fitted image at 2x = 800x600 in a 600x500 stage: overhang 100 / 50 each side
    expect(clampView(panBy({ scale: 2, x: 0, y: 0 }, 500, -500), 400, 300, 600, 500)).toEqual({ scale: 2, x: 100, y: -50 })
  })

  it('a zoomed image smaller than the stage stays centred', () => {
    expect(clampView({ scale: 1.5, x: 30, y: 30 }, 200, 100, 800, 600)).toEqual({ scale: 1.5, x: 0, y: 0 })
  })

  it('fits inside the stage without enlarging', () => {
    expect(fitSize(4000, 3000, 800, 600)).toEqual({ w: 800, h: 600 })
    expect(fitSize(3000, 4000, 800, 600)).toEqual({ w: 450, h: 600 })
    expect(fitSize(200, 100, 800, 600)).toEqual({ w: 200, h: 100 })
    expect(fitSize(0, 0, 800, 600)).toEqual({ w: 0, h: 0 })
  })
})
