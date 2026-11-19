import { expect, it } from 'vitest'
import { FIT, clampView, fitSize, panBy, zoomAt } from './zoom'

it('zooming keeps the point under the cursor in place and stays between 1x and 8x', () => {
  const v = zoomAt(FIT, 2, 100, 50)
  expect((100 - v.x) / v.scale).toBeCloseTo(100)
  expect((50 - v.y) / v.scale).toBeCloseTo(50)
  expect(zoomAt(FIT, 0.5, 10, 10).scale).toBe(1)
  expect(zoomAt({ scale: 6, x: 0, y: 0 }, 4, 0, 0).scale).toBe(8)
})

it('the image fits without enlarging, recenters at 1x and cannot be dragged past its edges', () => {
  expect(fitSize(3000, 4000, 800, 600)).toEqual({ w: 450, h: 600 })
  expect(fitSize(200, 100, 800, 600)).toEqual({ w: 200, h: 100 })
  expect(clampView({ scale: 1, x: 40, y: -20 }, 400, 300, 800, 600)).toEqual(FIT)
  // 400x300 fitted image at 2x = 800x600 in a 600x500 stage: overhang 100 / 50 each side
  expect(clampView(panBy({ scale: 2, x: 0, y: 0 }, 500, -500), 400, 300, 600, 500)).toEqual({ scale: 2, x: 100, y: -50 })
})
