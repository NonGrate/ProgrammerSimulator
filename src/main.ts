import * as E from './economy.ts'
import { s, save, fresh, $, el, sfx, toast, stats } from './game.ts'
import { initSessions, addSession, layoutSessions, updateGhost, tickSessions } from './sessions.ts'
import { initTeams, addTeam, layoutTeams, tickTeams, teamsWaiting, updateTeamGhost } from './teams.ts'
import { initDc, addRack, tickDc, dcAlert, updateRackGhost } from './datacenter.ts'

let rate = 0 // smoothed $/sec for the HUD

// ---------- views ----------
type View = 'grid' | 'teams' | 'dc'
let view: View = 'grid'
function show(v: View) {
  view = v
  for (const id of ['grid', 'teams', 'dc'] as const) $(id).hidden = id !== v
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
function agi() {
  if (s.agi) return
  s.agi = true; save()
  $('agi-time').textContent = `${Math.floor(s.played / 3600)}h ${Math.floor((s.played % 3600) / 60)}m`
  $<HTMLDialogElement>('agi').showModal()
}
$('agi-close').onclick = () => $<HTMLDialogElement>('agi').close()

// ---------- shop ----------
type Item = { name: string; desc: () => string; price: () => number; maxed: () => boolean; locked: () => string | false
              buy: () => void; btn?: HTMLButtonElement }
const AFTER: Partial<Record<E.UpgradeId, () => void>> = {
  auto: layoutSessions,
  agents: () => toast('Layer 2 unlocked: buy agent slots and Clod starts delegating.'),
  teams: () => { enterTeams(); toast(`Your ${E.MAX_WINDOWS} sessions merged into Team Alpha. Ship releases to get users.`) },
  team: () => addTeam(s.lv.team),
  cicd: layoutTeams,
  dc: () => { enterDc(); toast('Layer 4: train your own models. Every deployed model multiplies all income.') },
  rack: () => addRack(s.lv.rack),
}
const items: Record<string, Item> = {
  window: { name: 'New session', desc: () => `+1 Clod window · ${s.windows}/${E.MAX_WINDOWS}`,
            price: () => E.windowPrice(s.windows), maxed: () => s.windows >= E.MAX_WINDOWS, locked: () => false,
            buy: () => { s.windows++; addSession(s.windows - 1) } },
}
for (const id of Object.keys(E.UPGRADES) as E.UpgradeId[]) {
  const u = E.UPGRADES[id]
  items[id] = { name: u.name, desc: () => `${u.desc}${u.max > 1 ? ` · Lv ${s.lv[id]}` : ''}`,
                price: () => E.upgradePrice(id, s.lv[id]), maxed: () => s.lv[id] >= u.max,
                locked: () => E.locked(id, s.lv, s.windows), buy: () => { s.lv[id]++; AFTER[id]?.() } }
}

const UNLOCKS = ['agents', 'teams', 'dc'] as const
const SECTIONS: [string, string[], () => boolean][] = [
  ['DATACENTER', ['rack', 'gpu', 'cooling'], () => !!s.lv.dc],
  ['TEAMS', ['team', 'sprint', 'mkt', 'cicd', 'staging'], () => !!s.lv.teams],
  ['SUBAGENTS', ['slots', 'aspeed', 'aauto'], () => !!s.lv.agents],
  ['SESSIONS', ['window', 'model', 'context', 'auto', 'allow'], () => true],
]
const OBSOLETE_IN_TEAMS = ['window', 'auto', 'allow', 'slots', 'aauto'] // sessions are fully automated inside teams

function buy(id: string) {
  const it = items[id], p = it.price()
  if (it.maxed() || it.locked() || s.money < p) return
  s.money -= p; it.buy(); sfx.buy(); save()
  if ((UNLOCKS as readonly string[]).includes(id)) buildShop()
  refreshShop()
}

function buildShop() {
  const shop = $('shop'); shop.innerHTML = ''
  const add = (id: string) => { const b = el('button', 'item') as HTMLButtonElement; b.onclick = () => buy(id); items[id].btn = b; shop.append(b) }
  for (const it of Object.values(items)) it.btn = undefined
  for (const [title, ids, visible] of SECTIONS) {
    const shown = ids.filter(id => !(s.lv.teams && OBSOLETE_IN_TEAMS.includes(id)))
    if (!visible() || !shown.length) continue
    shop.append(el('h3', '', title)); shown.forEach(add)
  }
  shop.append(el('h3', '', 'NEXT LAYER'))
  const next = UNLOCKS.find(id => !s.lv[id])
  if (next) add(next)
  else shop.append(Object.assign(el('div', 'item locked'), { innerHTML: `<div>AGI<small>deploy Clod ${E.MODELS.at(-1)}</small></div><span class="price">🐟</span>` }))
}

function refreshShop() {
  for (const it of Object.values(items)) {
    const b = it.btn; if (!b) continue
    const p = it.price(), maxed = it.maxed(), locked = !maxed && it.locked()
    b.innerHTML = `<div>${it.name}<small>${locked ? '🔒 ' + locked : it.desc()}</small></div><span class="price">${maxed ? '—' : '$' + E.fmt(p)}</span>`
    b.disabled = maxed || !!locked || s.money < p
    b.classList.toggle('can', !b.disabled)
    b.classList.toggle('locked', !!locked && locked !== 'open more sessions' && locked !== 'hire more teams')
  }
  if (!s.lv.teams) updateGhost(); else updateTeamGhost()
  if (s.lv.dc) updateRackGhost()
}

function refreshHud() {
  const parts = [`per sec <span>$${E.fmt(rate)}</span>`]
  if (!s.lv.teams) parts.push(`per proceed <span>$${E.fmt(E.clickValue(s.lv.context))}</span>`, `sessions <span>${s.windows}/${E.MAX_WINDOWS}</span>`)
  else parts.push(`users <span>${E.fmt(s.users)}</span>`, `teams <span>${1 + s.lv.team}/${E.MAX_TEAMS}</span>`)
  if (s.lv.dc) parts.push(`model <span>${s.tier ? `Clod ${E.MODELS[s.tier - 1]} ×${E.fmt(E.modelMult(s.tier))}` : 'none yet'}</span>`)
  $('stats').innerHTML = parts.map(p => `<div class="stat">${p}</div>`).join('')
  // tabs blink when the hidden view needs a click
  document.querySelector('#tabs [data-v="teams"]')!.classList.toggle('alert', view !== 'teams' && teamsWaiting() > 0)
  document.querySelector('#tabs [data-v="dc"]')!.classList.toggle('alert', view !== 'dc' && dcAlert())
}

// ---------- settings ----------
const THEMES = [['green', '#3dff8b'], ['amber', '#ffb547'], ['cyan', '#3de0ff'], ['synth', '#ff5fd2'], ['frost', '#dfe9ff'], ['deepsea', '#4fa8ff']]
function applyTheme() {
  document.documentElement.dataset.theme = s.theme
  document.querySelector('.logo')!.textContent = s.theme === 'deepsea' ? '🐟 Clod Cod' : '✻ Clod Cod'
  const box = $('themes'); box.innerHTML = ''
  for (const [name, c] of THEMES) {
    const b = el('button', 'swatch' + (s.theme === name ? ' on' : '')) as HTMLButtonElement
    const locked = name === 'deepsea' && !s.cod
    b.style.setProperty('--c', c); b.disabled = locked
    b.title = locked ? 'Secret. Real devs know the code.' : name
    b.onclick = () => { s.theme = name; save(); applyTheme() }
    box.append(b)
  }
}
const dialog = $<HTMLDialogElement>('settings')
$('open-settings').onclick = () => { $<HTMLInputElement>('sound').checked = s.sound; dialog.showModal() }
$('close-settings').onclick = () => dialog.close()
$<HTMLInputElement>('sound').onchange = e => { s.sound = (e.target as HTMLInputElement).checked; save() }
$('reset').onclick = () => {
  if (!confirm('Delete all progress?')) return
  Object.assign(s, fresh()); save(); location.reload()
}

// ---------- easter egg: Konami code -> Cod mode ----------
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
let k = 0
addEventListener('keydown', e => {
  k = e.key === KONAMI[k] ? k + 1 : e.key === KONAMI[0] ? 1 : 0
  if (k < KONAMI.length) return
  k = 0
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
    toast(`🐟 COD MODE: +$${E.fmt(bonus)} and a secret theme unlocked`)
  }
})

// ---------- loop ----------
function offline(seconds: number) {
  // ponytail: no offline compute/training, only automated income
  const gain = E.autoIncome(s.lv, s.users) * E.modelMult(s.tier) * Math.min(seconds, E.OFFLINE_CAP) * E.OFFLINE_RATE
  if (gain < 1) return
  s.money += gain
  if (seconds > 60) toast(`While you were away, automation earned $${E.fmt(gain)}`)
}

let last = performance.now()
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

if (s.lv.teams) { initTeams($('teams'), () => buy('team')); show('teams') }
else { initSessions($('grid'), () => buy('window')); show('grid') }
if (s.lv.dc) enterDc()
buildShop()
applyTheme()
offline((Date.now() - s.savedAt) / 1000)
setInterval(() => { refreshShop(); refreshHud() }, 200)
setInterval(save, 5000)
addEventListener('beforeunload', save)
requestAnimationFrame(frame)
