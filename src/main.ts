import * as E from './economy.ts'
import { s, save, fresh, $, el, sfx, toast, stats, setHtml, ngpMult } from './game.ts'
import { t, tl, setLang, applyStatic, LANGS, type StrKey } from './i18n.ts'
import { initSessions, addSession, layoutSessions, updateGhost, tickSessions } from './sessions.ts'
import { initTeams, addTeam, layoutTeams, tickTeams, teamsWaiting, updateTeamGhost } from './teams.ts'
import { initDc, addRack, tickDc, dcAlert, updateRackGhost } from './datacenter.ts'
import { initStart, codSvg } from './start.ts'
import { initTakeover, refreshTakeover } from './takeover.ts'
import { COMPANIES } from './lines.ts'

setLang(s.lang) // before anything builds text
applyStatic()
let rate = 0 // smoothed $/sec for the HUD
const away = (Date.now() - s.savedAt) / 1000 // measured now, paid out when the player presses Start

// ---------- views ----------
type View = 'grid' | 'teams' | 'dc' | 'takeover'
let view: View = 'grid'
function show(v: View) {
  view = v
  for (const id of ['grid', 'teams', 'dc', 'takeover'] as const) $(id).hidden = id !== v
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v))
}
document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach(b => b.onclick = () => show(b.dataset.v as View))

function enterTeams() {
  $('grid').replaceChildren() // the sessions live on inside team 1 now
  initTeams($('teams'), () => buy('team')); show('teams')
}
function enterDc() {
  initDc($('dc'), agi, () => buy('rack')); $('tabs').hidden = false; show('dc')
}
let takeoverReady = false
function enterTakeover() {
  if (takeoverReady) return
  takeoverReady = true
  initTakeover($('takeover'), () => buy('acq'), () => buy('internet'))
  document.querySelector<HTMLElement>('#tabs [data-v="takeover"]')!.hidden = false
  buildShop()
}
function agi() {
  if (s.agi) return
  s.agi = true; save()
  $('agi-p1').textContent = t('agi.p1', { model: tl('models').at(-1)! })
  $('agi-time').textContent = t('agi.duration', { h: Math.floor(s.played / 3600), m: Math.floor((s.played % 3600) / 60) })
  $<HTMLDialogElement>('agi').showModal()
}
$('agi-close').onclick = () => {
  $<HTMLDialogElement>('agi').close()
  enterTakeover(); show('takeover'); toast(t('toast.takeover'))
}

// ---------- the final goal: bought the Internet ----------
function ending() {
  $('end-bonus').textContent = t('end.bonus', { mult: E.fmt(E.NGP_MULT ** (s.ngp + 1)) })
  $<HTMLDialogElement>('end').showModal()
}
$('end-no').onclick = () => $<HTMLDialogElement>('end').close()
$('end-yes').onclick = () => {
  // New Game+: start over, keep settings and the easter egg, and earn ×2 more per finished run
  const keep = { sound: s.sound, theme: s.theme, lang: s.lang, cod: s.cod, ngp: s.ngp + 1 }
  Object.assign(s, fresh(), keep); save(); sessionStorage.removeItem('clodcod-started'); location.reload()
}

// ---------- shop ----------
type ItemId = E.UpgradeId | 'window'
type Item = { desc: () => string; price: () => number; maxed: () => boolean; locked: () => E.LockReason | false
              buy: () => void; btn?: HTMLButtonElement }
const AFTER: Partial<Record<E.UpgradeId, () => void>> = {
  auto: layoutSessions,
  agents: () => toast(t('toast.agents')),
  teams: () => { enterTeams(); toast(t('toast.teams', { n: E.MAX_WINDOWS })) },
  team: () => addTeam(s.lv.team),
  cicd: layoutTeams,
  dc: () => { enterDc(); toast(t('toast.dc')) },
  rack: () => addRack(s.lv.rack),
  acq: () => { refreshTakeover(); toast(t('toast.acq', { company: COMPANIES[s.lv.acq - 1][1], joke: tl('companyLines')[s.lv.acq - 1] })) },
  internet: () => { refreshTakeover(); ending() },
}
const items = {
  window: { desc: () => `${t('upd.window')} · ${s.windows}/${E.MAX_WINDOWS}`,
            price: () => E.windowPrice(s.windows), maxed: () => s.windows >= E.MAX_WINDOWS, locked: () => false,
            buy: () => { s.windows++; addSession(s.windows - 1) } },
} as Record<ItemId, Item>
for (const id of Object.keys(E.UPGRADES) as E.UpgradeId[]) {
  const u = E.UPGRADES[id]
  const text = () => id !== 'acq' ? t(`upd.${id}`)
    : s.lv.acq < E.COMPANY_COUNT ? t('upd.acq', { company: COMPANIES[s.lv.acq][1] }) : t('upd.acqDone')
  items[id] = { desc: () => `${text()}${u.max > 1 ? ` · ${t('shop.lv')} ${s.lv[id]}` : ''}`,
                price: () => E.upgradePrice(id, s.lv[id]), maxed: () => s.lv[id] >= E.maxLevel(id, s.tier),
                locked: () => E.locked(id, s.lv, s.windows, s.tier), buy: () => { s.lv[id]++; AFTER[id]?.() } }
}

const UNLOCKS = ['agents', 'teams', 'dc', 'internet'] as const
const SECTIONS: [StrKey, ItemId[], () => boolean][] = [
  ['shop.takeover', ['acq'], () => s.tier >= E.MODEL_COUNT],
  ['shop.dc', ['rack', 'gpu', 'cooling'], () => !!s.lv.dc],
  ['shop.teams', ['team', 'sprint', 'mkt', 'cicd', 'staging'], () => !!s.lv.teams],
  ['shop.subagents', ['slots', 'aspeed', 'aauto'], () => !!s.lv.agents],
  ['shop.sessions', ['window', 'model', 'context', 'auto', 'allow'], () => true],
]
const OBSOLETE_IN_TEAMS: ItemId[] = ['window', 'auto', 'allow', 'slots', 'aauto'] // sessions are fully automated inside teams
const lockText = (r: E.LockReason) => t(`lock.${r}`, { n: r === 'teams' ? E.MAX_TEAMS : r === 'companies' ? E.COMPANY_COUNT : E.MAX_WINDOWS })

function buy(id: ItemId) {
  const it = items[id], p = it.price()
  if (it.maxed() || it.locked() || s.money < p) return
  s.money -= p; it.buy(); sfx.buy(); save()
  if ((UNLOCKS as readonly string[]).includes(id)) buildShop()
  refreshShop()
}

function buildShop() {
  const shop = $('shop'); shop.innerHTML = ''
  const add = (id: ItemId) => { const b = el('button', 'item') as HTMLButtonElement; b.onclick = () => buy(id); items[id].btn = b; shop.append(b) }
  for (const it of Object.values(items)) it.btn = undefined
  for (const [title, ids, visible] of SECTIONS) {
    const shown = ids.filter(id => !(s.lv.teams && OBSOLETE_IN_TEAMS.includes(id)))
    if (!visible() || !shown.length) continue
    shop.append(el('h3', '', t(title))); shown.forEach(add)
  }
  const next = UNLOCKS.find(id => !s.lv[id])
  if (next) { shop.append(el('h3', '', t('shop.next'))); add(next) }
}

function refreshShop() {
  for (const [id, it] of Object.entries(items) as [ItemId, Item][]) {
    const b = it.btn; if (!b) continue
    const p = it.price(), maxed = it.maxed(), locked = !maxed && it.locked()
    setHtml(b, `<div>${t(`up.${id}`)}<small>${locked ? '🔒 ' + lockText(locked) : it.desc()}</small></div><span class="price">${maxed ? '—' : '$' + E.fmt(p)}</span>`)
    b.disabled = maxed || !!locked || s.money < p
    b.classList.toggle('can', !b.disabled)
    b.classList.toggle('locked', !!locked && locked !== 'moreSessions' && locked !== 'moreTeams')
  }
  $('shop-toggle').classList.toggle('has', !!document.querySelector('#shop .item.can')) // dot: something is affordable
  if (!s.lv.teams) updateGhost(); else updateTeamGhost()
  if (s.lv.dc) updateRackGhost()
}

function refreshHud() {
  const stat = (k: StrKey, v: string) => `<div class="stat">${t(k)} <span>${v}</span></div>`
  const parts = [stat('hud.perSec', '$' + E.fmt(rate))]
  if (!s.lv.teams) parts.push(stat('hud.perProceed', '$' + E.fmt(E.clickValue(s.lv.context) * ngpMult())), stat('hud.sessions', `${s.windows}/${E.MAX_WINDOWS}`))
  else parts.push(stat('hud.users', E.fmt(s.users)), stat('hud.teams', `${1 + s.lv.team}/${E.MAX_TEAMS}`))
  const model = tl('models')[Math.min(s.tier, E.MODEL_COUNT) - 1], ft = s.tier - E.MODEL_COUNT
  if (s.lv.dc) parts.push(stat('hud.model', s.tier ? `Clod ${model}${ft > 0 ? ` +${ft}` : ''} ×${E.fmt(E.modelMult(s.tier))}` : t('hud.noModel')))
  $('ngp').hidden = !s.ngp; $('ngp').textContent = `NG+${s.ngp}` // its ×2 per run is part of the total multiplier
  // everything that multiplies all income: models, fine-tunes, acquisitions, New Game+
  const total = E.globalMult(s.lv, s.tier) * ngpMult()
  if (total > 1) parts.push(stat('hud.total', `×${E.fmt(total)}`))
  $('stats').innerHTML = parts.join('')
  // tabs blink when the hidden view needs a click
  document.querySelector('#tabs [data-v="teams"]')!.classList.toggle('alert', view !== 'teams' && teamsWaiting() > 0)
  document.querySelector('#tabs [data-v="dc"]')!.classList.toggle('alert', view !== 'dc' && dcAlert())
}

// ---------- settings ----------
const THEMES = [['green', '#3dff8b'], ['amber', '#ffb547'], ['cyan', '#3de0ff'], ['synth', '#ff5fd2'], ['frost', '#dfe9ff'], ['deepsea', '#4fa8ff']] as const
function applyTheme() {
  document.documentElement.dataset.theme = s.theme
  const logo = s.theme === 'deepsea' ? '🐟 Clod Cod' : '✻ Clod Cod'
  document.querySelectorAll('.logo, .start-logo').forEach(e => { e.textContent = logo })
  const box = $('themes'); box.innerHTML = ''
  for (const [name, c] of THEMES) {
    const b = el('button', 'swatch' + (s.theme === name ? ' on' : '')) as HTMLButtonElement
    const locked = name === 'deepsea' && !s.cod
    b.style.setProperty('--c', c); b.disabled = locked
    b.title = locked ? t('settings.secret') : t(`theme.${name}`)
    b.onclick = () => { s.theme = name; save(); applyTheme() }
    box.append(b)
  }
}
// ---------- phone: shop as a bottom sheet ----------
$('shop-toggle').onclick = () => document.body.classList.toggle('shop-open')

const dialog = $<HTMLDialogElement>('settings')
$('fun-cod').innerHTML = codSvg()
const openSettings = () => { $<HTMLInputElement>('sound').checked = s.sound; dialog.showModal() }
$('open-settings').onclick = openSettings
$('open-settings').title = t('settings.title')
$('close-settings').onclick = () => dialog.close()
$<HTMLInputElement>('sound').onchange = e => { s.sound = (e.target as HTMLInputElement).checked; save() }
const langSelect = $<HTMLSelectElement>('lang')
for (const [code, name] of Object.entries(LANGS)) langSelect.append(Object.assign(el('option', '', name), { value: code }))
langSelect.value = s.lang
langSelect.onchange = () => {
  // ponytail: reload instead of re-rendering every view; settings reopen after the reload
  s.lang = langSelect.value; save()
  sessionStorage.setItem('clodcod-reopen-settings', '1'); location.reload()
}
$('reset').onclick = () => {
  if (!confirm(t('settings.confirmReset'))) return
  Object.assign(s, fresh()); save(); sessionStorage.removeItem('clodcod-started'); location.reload()
}

// ---------- easter egg: Konami code -> Cod mode ----------
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
let k = 0
addEventListener('keydown', e => {
  k = e.key === KONAMI[k] ? k + 1 : e.key === KONAMI[0] ? 1 : 0
  if (k < KONAMI.length) return
  k = 0
  codMode()
})
// No arrow keys on phones: tapping the settings fish 7 times works too
let taps = 0
$('fun-cod').onclick = () => { if (++taps % 7 === 0) codMode() }

function codMode() {
  for (let i = 0; i < 12; i++) {
    const f = el('div', 'fish', '🐟')
    f.style.top = `${5 + Math.random() * 85}vh`; f.style.animationDuration = `${3 + Math.random() * 4}s`
    f.style.animationDelay = `${Math.random() * 1.5}s`
    document.body.append(f); setTimeout(() => f.remove(), 9000)
  }
  sfx.cod()
  if (!s.cod) {
    const bonus = Math.max(100, rate * 120)
    s.cod = true; s.money += bonus; s.theme = 'deepsea'; save(); applyTheme()
    toast(t('toast.cod', { bonus: E.fmt(bonus) }))
  }
}

// ---------- loop ----------
function offline(seconds: number) {
  // ponytail: no offline compute/training, only automated income
  const gain = E.autoIncome(s.lv, s.users) * E.globalMult(s.lv, s.tier) * ngpMult() * Math.min(seconds, E.OFFLINE_CAP) * E.OFFLINE_RATE
  if (gain < 1) return
  s.money += gain
  if (seconds > 60) toast(t('toast.offline', { gain: E.fmt(gain) }))
}

let last = 0
function frame(now: number) {
  const dt = (now - last) / 1000; last = now
  if (dt > 5) offline(dt) // window was hidden/minimised
  else {
    s.played += dt
    if (s.lv.teams) tickTeams(dt); else tickSessions(dt)
    if (s.lv.dc) tickDc(dt)
  }
  rate += (stats.earned / Math.max(dt, 1e-3) - rate) * Math.min(1, dt / 4); stats.earned = 0
  $('money').textContent = '$' + E.fmt(s.money)
  requestAnimationFrame(frame)
}

let started = false
function start() {
  if (started) return
  started = true
  $('start').classList.add('gone')
  sessionStorage.setItem('clodcod-started', '1') // language reloads skip the start screen
  offline(away)
  refreshShop(); refreshHud()
  setInterval(() => { refreshShop(); refreshHud(); refreshTakeover() }, 200)
  setInterval(save, 5000)
  last = performance.now()
  requestAnimationFrame(frame)
}

if (s.lv.teams) { initTeams($('teams'), () => buy('team')); show('teams') }
else { initSessions($('grid'), () => buy('window')); show('grid') }
if (s.lv.dc) enterDc()
if (s.tier >= E.MODEL_COUNT) enterTakeover()
buildShop()
applyTheme()
addEventListener('beforeunload', save)
initStart(() => { if (!started) sfx.buy(); start() }, openSettings)
if (sessionStorage.getItem('clodcod-started')) start()
if (sessionStorage.getItem('clodcod-reopen-settings')) { sessionStorage.removeItem('clodcod-reopen-settings'); openSettings() }
