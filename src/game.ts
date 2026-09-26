// Shared state, save/load, sound and small DOM helpers used by every layer.
import * as E from './economy.ts'

export type Save = {
  money: number; windows: number; lv: E.Levels; users: number; tier: number; progress: number
  sound: boolean; theme: string; cod: boolean; agi: boolean; played: number; savedAt: number
}
const KEY = 'clodcod-save'
const zeroLevels = () => Object.fromEntries(Object.keys(E.UPGRADES).map(k => [k, 0])) as E.Levels
export const fresh = (): Save => ({
  money: 0, windows: 1, lv: zeroLevels(), users: 0, tier: 0, progress: 0,
  sound: true, theme: 'green', cod: false, agi: false, played: 0, savedAt: Date.now(),
})
const loaded = JSON.parse(localStorage.getItem(KEY) ?? '{}')
export const s: Save = { ...fresh(), ...loaded, lv: { ...zeroLevels(), ...loaded.lv } } // merge so old saves get new upgrades
export const save = () => { s.savedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(s)) }

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
export const el = (tag: string, cls = '', text = '') => { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e }

// ---------- sound (synthesised, no asset files) ----------
let ac: AudioContext | undefined
function beep(freq: number, dur = 0.06, type: OscillatorType = 'square', vol = 0.04, delay = 0) {
  if (!s.sound) return
  ac ??= new AudioContext()
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur)
}
const seq = (notes: number[], step: number, type: OscillatorType = 'triangle', dur = 0.1) =>
  notes.forEach((f, i) => beep(f, dur, type, 0.05, i * step))
export const sfx = {
  click: () => beep(880 + Math.random() * 120),
  mini: () => beep(1320, 0.04, 'square', 0.03),
  buy: () => seq([660, 880, 1320], 0.06, 'triangle', 0.08),
  bad: () => beep(110, 0.35, 'sawtooth', 0.06),
  good: () => seq([990, 1480], 0.08),
  ship: () => seq([392, 523, 659, 784, 1047], 0.05, 'square', 0.07),
  alarm: () => seq([880, 660, 880], 0.12, 'sawtooth', 0.1),
  deploy: () => seq([523, 659, 784, 1047, 1319, 1568], 0.09, 'triangle', 0.18),
  cod: () => seq([523, 659, 784, 1047, 784, 1047], 0.1, 'triangle', 0.12),
}

// ---------- effects ----------
export function floatText(text: string, at: HTMLElement, bad = false) {
  const r = at.getBoundingClientRect(), f = el('span', bad ? 'float bad' : 'float', text)
  f.style.left = `${r.left + r.width / 2 - 20}px`; f.style.top = `${r.top - 10}px`
  document.body.append(f); setTimeout(() => f.remove(), 900)
}
let toastTimer = 0
export function toast(msg: string) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show')
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4000)
}
// The dashed "+ buy another" tile at the end of each grid
export function ghostTile(label: string, onclick: () => void) {
  const b = el('button', 'ghost-tile') as HTMLButtonElement
  b.onclick = onclick
  return { el: b, update(price: number, maxed: boolean) {
    b.hidden = maxed; b.disabled = s.money < price
    b.innerHTML = `<span>+ ${label}</span><span>$${E.fmt(price)}</span>`
  } }
}
// Red flash + shake, cleared after a moment (restarting it if you mess up twice in a row)
const hurtTimers = new WeakMap<HTMLElement, number>()
export function hurt(e: HTMLElement) {
  e.classList.remove('hurt'); void e.offsetWidth; e.classList.add('hurt')
  clearTimeout(hurtTimers.get(e))
  hurtTimers.set(e, setTimeout(() => e.classList.remove('hurt'), 1500))
}

// Every $ goes through here so the $/sec readout sees it.
export const stats = { earned: 0 }
export function earn(amount: number, at: HTMLElement, extra = '') {
  s.money += amount; stats.earned += amount
  floatText(`+$${E.fmt(amount)}${extra}`, at)
}
export function lose(share: number, at: HTMLElement) {
  const loss = s.money * share
  s.money -= loss
  floatText(`-$${E.fmt(loss)}`, at, true); sfx.bad()
  return loss
}
