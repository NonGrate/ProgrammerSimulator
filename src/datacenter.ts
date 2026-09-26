// Layer 4: GPU racks make compute, compute trains fish-named models, each deployed model multiplies all income.
import * as E from './economy.ts'
import { s, el, sfx, toast, floatText, ghostTile } from './game.ts'
import { workText } from './lines.ts'
import { t, tl } from './i18n.ts'

type Rack = { root: HTMLElement; big: HTMLElement; status: HTMLElement; action: HTMLElement; hot: boolean; ht: number; next: number }
const racks: Rack[] = []
let ghost: ReturnType<typeof ghostTile>, grid: HTMLElement, fill: HTMLElement, label: HTMLElement, deployBox: HTMLElement, onAgi: () => void

const count = () => 1 + s.lv.rack
const perRack = () => E.compute(1, s.lv.gpu)
const modelName = (tier: number) => tl('models')[tier]

function cool(r: Rack, at: HTMLElement) {
  if (!r.hot) return
  r.hot = false; r.root.classList.remove('hot'); r.action.innerHTML = ''
  floatText(t('d.cooled'), at); sfx.mini()
}

function overheat(r: Rack) {
  r.hot = true; r.ht = 0; r.root.classList.add('hot')
  r.status.textContent = t('d.overheat')
  const b = el('button', 'yes', t('d.cool')); b.onclick = () => cool(r, b)
  r.action.append(b)
  if (!s.lv.cooling) sfx.alarm()
}

export function addRack(i: number) {
  const root = el('div', 'win rack'), head = el('div', 'bar'), body = el('div', 'body')
  head.append(el('i', 'dot'), el('i', 'dot'), el('i', 'dot'), el('span', 'title', `rack-${String(i + 1).padStart(2, '0')}`))
  const leds = el('div', 'leds')
  for (let j = 0; j < 8; j++) { const d = el('i'); d.style.animationDelay = `${Math.random()}s`; leds.append(d) }
  const big = el('div', 'product', `${E.fmt(perRack())} PF/s`), status = el('p', '', workText('rackWork')), action = el('div')
  body.append(leds, big, status, action)
  root.append(head, body)
  grid.insertBefore(root, ghost.el)
  racks.push({ root, big, status, action, hot: false, ht: 0, next: 3 })
  const n = count() + (count() < E.MAX_RACKS ? 1 : 0)
  grid.style.gridTemplateColumns = `repeat(${n <= 4 ? 2 : 4}, 1fr)`
  updateRackGhost()
}
export const updateRackGhost = () => ghost.update(E.upgradePrice('rack', s.lv.rack), count() >= E.MAX_RACKS)

function deploy(at: HTMLElement) {
  if (s.tier >= E.MODEL_COUNT || s.progress < E.trainCost(s.tier)) return
  s.progress = 0; s.tier++
  floatText(t('d.incomeMult', { m: E.MODEL_MULT }), at); sfx.deploy()
  deployBox.innerHTML = ''
  if (s.tier === E.MODEL_COUNT) onAgi()
  else toast(t('toast.deployed', { model: modelName(s.tier - 1), mult: E.fmt(E.modelMult(s.tier)) }))
}

export const dcAlert = () => racks.some(r => r.hot) || !!deployBox?.firstChild

export function initDc(container: HTMLElement, agi: () => void, buyRack: () => void) {
  onAgi = agi
  const panel = el('div', 'train'), bar = el('div', 'release')
  fill = el('i'); label = el('span'); deployBox = el('div')
  bar.append(fill, label)
  panel.append(bar, deployBox)
  grid = el('div', 'racks')
  ghost = ghostTile(t('ghost.rack'), buyRack)
  grid.append(ghost.el)
  container.append(panel, grid)
  for (let i = 0; i < count(); i++) addRack(i)
}

export function tickDc(dt: number) {
  let running = 0
  for (const r of racks) {
    if (r.hot) { if (s.lv.cooling && (r.ht += dt) >= E.AUTO_DELAY) cool(r, r.root); continue }
    running++
    if (Math.random() < E.OVERHEAT_CHANCE * dt) { overheat(r); continue }
    if ((r.next -= dt) <= 0) { r.next = 3; r.big.textContent = `${E.fmt(perRack())} PF/s`; r.status.textContent = workText('rackWork') }
  }
  if (s.tier >= E.MODEL_COUNT) { label.textContent = t('d.agi', { model: modelName(E.MODEL_COUNT - 1) }); fill.style.width = '100%'; return }

  const cost = E.trainCost(s.tier), speed = running * perRack()
  s.progress = Math.min(cost, s.progress + speed * dt)
  fill.style.width = `${(s.progress / cost) * 100}%`
  const eta = speed ? Math.ceil((cost - s.progress) / speed) : Infinity
  label.textContent = t('d.training', { model: modelName(s.tier), a: E.fmt(s.progress), b: E.fmt(cost) }) +
    (s.progress < cost ? ` · ETA ${isFinite(eta) ? `${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, '0')}` : '∞'}` : '')
  if (s.progress >= cost && !deployBox.firstChild) {
    const b = el('button', 'yes', t('d.deploy', { model: modelName(s.tier), m: E.MODEL_MULT }))
    b.onclick = () => deploy(b)
    deployBox.append(b)
  }
}
