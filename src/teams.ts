// Layer 3: teams build releases from their 12 sessions; shipping pays out and brings users.
import * as E from './economy.ts'
import { s, el, sfx, earn, hurt, floatText, ghostTile } from './game.ts'
import { TEAM_NAMES, PRODUCTS, TEAM_WORK, workText } from './lines.ts'

type Team = { root: HTMLElement; fill: HTMLElement; label: HTMLElement; log: HTMLElement; action: HTMLElement; tag: HTMLElement; pays: HTMLElement
              phase: 'build' | 'ship'; t: number; dur: number; next: number; version: number; friday: boolean }
const teams: Team[] = []
let grid: HTMLElement, ghost: ReturnType<typeof ghostTile>

const count = () => 1 + s.lv.team
const isAuto = (i: number) => i < s.lv.cicd

function log(tm: Team, text: string, cls = '') {
  tm.log.append(el('p', cls, text))
  while (tm.log.children.length > 4) tm.log.firstElementChild!.remove()
}

function build(tm: Team) {
  tm.phase = 'build'; tm.t = 0; tm.next = 1; tm.dur = E.releaseTime(s.lv.sprint); tm.version++
  tm.friday = Math.random() < E.FRIDAY_CHANCE
  tm.action.innerHTML = ''
  tm.root.classList.remove('waiting')
}

const ver = (tm: Team) => `v${1 + Math.floor(tm.version / 10)}.${tm.version % 10}`

function ready(tm: Team) {
  tm.phase = 'ship'; tm.t = 0
  const box = el('div', tm.friday ? 'ask danger' : 'ask')
  if (tm.friday) {
    const yes = el('button', 'yes', '🚀 Ship it'), no = el('button', 'no', 'Wait till Monday')
    yes.onclick = () => ship(tm, true, yes); no.onclick = () => ship(tm, false, no)
    box.append(el('div', 'q', `⚠ Deploy ${ver(tm)} to prod on Friday 17:00?`), yes, no)
  } else {
    const yes = el('button', 'yes', `🚀 Ship ${ver(tm)}`)
    yes.onclick = () => ship(tm, true, yes)
    box.append(yes)
  }
  tm.action.append(box)
  tm.root.classList.add('waiting')
}

function ship(tm: Team, yes: boolean, at: HTMLElement) {
  if (tm.phase !== 'ship') return
  if (tm.friday && yes) {
    const lost = Math.floor(s.users * E.FRIDAY_PENALTY)
    s.users -= lost
    log(tm, `🔥 Outage! ${E.fmt(lost)} users left`, 'err')
    floatText(`-${E.fmt(lost)} users`, at, true); sfx.bad(); hurt(tm.root)
  } else {
    const users = E.usersPerShip(s.lv.mkt)
    earn(E.shipValue(s.lv, s.users) * E.modelMult(s.tier), at, ` · +${E.fmt(users)} users`)
    s.users += users
    log(tm, tm.friday ? '✓ Shipped on Monday. Nobody got paged.' : `✓ ${ver(tm)} shipped`, 'ok')
    sfx.ship()
  }
  build(tm)
}

export function addTeam(i: number) {
  const root = el('div', 'win team'), head = el('div', 'bar'), body = el('div', 'body')
  const tag = el('span', 'tag', 'CI/CD')
  head.append(el('i', 'dot'), el('i', 'dot'), el('i', 'dot'), el('span', 'title', `team-${TEAM_NAMES[i].toLowerCase()} · ${PRODUCTS[i]}`), tag)
  const sessions = el('div', 'mini-sessions')
  for (let j = 0; j < E.MAX_WINDOWS; j++) { const d = el('i'); d.style.animationDelay = `${Math.random() * 2}s`; sessions.append(d) }
  const logBox = el('div', 'log'), prog = el('div', 'release'), fill = el('i'), label = el('span'), action = el('div')
  const pays = el('p', 'pays')
  prog.append(fill, label)
  body.append(sessions, el('div', 'product', PRODUCTS[i]), logBox, pays, prog, action)
  root.append(head, body)
  grid.insertBefore(root, ghost.el)
  const tm: Team = { root, fill, label, log: logBox, action, tag, pays, phase: 'build', t: 0, dur: 1, next: 1, version: 0, friday: false }
  log(tm, `12 sessions · ${s.lv.slots} agents each`, 'hi')
  teams.push(tm); build(tm); layoutTeams()
  tm.t = Math.random() * tm.dur * 0.8 // don't let every team ship in sync
}

export function layoutTeams() {
  const n = count() + (count() < E.MAX_TEAMS ? 1 : 0)
  grid.style.gridTemplateColumns = `repeat(${n <= 4 ? 2 : 4}, 1fr)`
  teams.forEach((tm, i) => { tm.tag.hidden = !isAuto(i) })
  updateTeamGhost()
}
export const updateTeamGhost = () => ghost.update(E.upgradePrice('team', s.lv.team), count() >= E.MAX_TEAMS)

export const teamsWaiting = () => teams.filter(tm => tm.phase === 'ship').length

export function initTeams(container: HTMLElement, buyTeam: () => void) {
  grid = container
  ghost = ghostTile('hire team', buyTeam)
  grid.append(ghost.el)
  for (let i = 0; i < count(); i++) addTeam(i)
}

export function tickTeams(dt: number) {
  teams.forEach((tm, i) => {
    tm.t += dt
    if (tm.phase === 'build') {
      const p = Math.min(1, tm.t / tm.dur)
      tm.fill.style.width = `${p * 100}%`
      tm.label.textContent = `building ${ver(tm)} · ${Math.floor(p * 100)}%`
      tm.pays.textContent = `release pays $${E.fmt(E.shipValue(s.lv, s.users) * E.modelMult(s.tier))} · +${E.fmt(E.usersPerShip(s.lv.mkt))} users`
      if (tm.t >= tm.next) { tm.next += 2 + Math.random() * 2; log(tm, workText(TEAM_WORK)) }
      if (tm.t >= tm.dur) ready(tm)
    } else if (isAuto(i) && tm.t >= E.AUTO_DELAY) {
      // CI/CD ships blindly unless there's a staging environment
      ship(tm, !(tm.friday && s.lv.staging), tm.action.querySelector<HTMLElement>('.yes') ?? tm.root)
    }
  })
}
