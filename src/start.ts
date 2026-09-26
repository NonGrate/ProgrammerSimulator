// Start screen: a parody of a certain CLI's welcome screen, with a cod instead of the mascot.
import { t } from './i18n.ts'
import { $ } from './game.ts'
import pkg from '../package.json'

// Pixel maps: X = filled, o = hole (eye), anything else = empty
const COD = [
  '....XXXXXX.....X',
  '..XXXXXXXXXX..XX',
  '.XoXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  '.XXXXXXXXXXXXXXX',
  '..XXXXXXXXXX..XX',
  '....XXXXXX.....X',
  '....X.X..X.X....',
  '....X.X..X.X....',
]
const MOON = [
  '....XXXXXX..',
  '..XXXXXXXXX.',
  '.XXXX....XX.',
  'XXXX........',
  'XXX.........',
  'XXX.........',
  'XXXX........',
  '.XXXX....XX.',
  '..XXXXXXXXX.',
  '....XXXXXX..',
]
const CLOUD_A = [
  '.........XXXXX.........',
  '....XXX.XXXXXXXXX......',
  '.XXXXXXXXXXXXXXXXXXXX..',
  'XXXXXXXXXXXXXXXXXXXXXXX',
]
const CLOUD_B = [
  '.....XXXX.......',
  '...XXXXXXXX.....',
  'XXXXXXXXXXXXXXXX',
]

// One <rect> per horizontal run keeps the SVG small
function pix(map: string[], x0: number, y0: number, fill: string, cls = '') {
  let out = `<g class="${cls}">`
  map.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x]
      if (c !== 'X' && c !== 'o') { x++; continue }
      let w = 0
      while (row[x + w] === c) w++
      out += `<rect x="${x0 + x}" y="${y0 + y}" width="${w}" height="1" fill="${c === 'o' ? 'var(--bg)' : fill}"/>`
      x += w
    }
  })
  return out + '</g>'
}

// Small standalone cod for the settings dialog
export const codSvg = () =>
  `<svg viewBox="0 -1 16 10" shape-rendering="crispEdges">${pix(COD, 0, 0, 'var(--g)', 'cod')}</svg>`

const STARS: [number, number, number][] = [[9, 5, 0], [45, 7, 1.2], [36, 15, 0.6], [3, 20, 1.8], [79, 24, 0.3], [56, 29, 1.5], [31, 33, 0.9]]

export function initStart(onStart: () => void, onSettings: () => void) {
  $('version').textContent = `v${pkg.version}`
  $('scene').innerHTML = `
    <defs><pattern id="dither" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
      <rect width="0.25" height="0.25" fill="#8a9099"/><rect x="0.25" y="0.25" width="0.25" height="0.25" fill="#8a9099"/>
    </pattern></defs>
    ${pix(CLOUD_A, 5, 10, 'url(#dither)')}
    ${pix(CLOUD_B, 42, 19, 'url(#dither)')}
    ${pix(MOON, 62, 3, '#dfe4ee')}
    ${STARS.map(([x, y, d]) => `<text x="${x}" y="${y}" class="star" style="animation-delay:${d}s">*</text>`).join('')}
    ${pix(COD, 10, 26, 'var(--g)', 'cod')}`
  const key = (k: string) => `<b>${k}</b>`
  $('start-btn').innerHTML = t('start.press', { key: key('Enter') })
  $('start-settings').innerHTML = t('start.pressSettings', { key: key('S') })
  $('start-btn').onclick = onStart
  $('start-settings').onclick = onSettings
  addEventListener('keydown', e => {
    if ($('start').classList.contains('gone') || $<HTMLDialogElement>('settings').open) return
    if (e.key === 'Enter') onStart()
    else if (e.code === 'KeyS') onSettings() // physical key, so it works on any keyboard layout
  })
}
