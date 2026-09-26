// Layers 1 + 2: Clod sessions, and the subagents they spawn.
import * as E from './economy.ts'
import { s, el, sfx, earn, lose, hurt, ghostTile } from './game.ts'
import { PROJECTS, AGENT_NAMES, agentRequest, prompt, workLine } from './lines.ts'
import { t } from './i18n.ts'

type Agent = { name: string; t: number; dur: number; askAt: number; wt: number; danger: boolean; cmd: string
               state: 'run' | 'wait' | 'done' | 'dead'; row: HTMLElement; last: string }
type Win = { root: HTMLElement; body: HTMLElement; bar: HTMLElement; tag: HTMLElement
             phase: 'think' | 'agents' | 'ask'; t: number; dur: number; script: string[]; shown: number
             prompt: ReturnType<typeof prompt>; agents: Agent[]; tree?: HTMLElement; done: number }
const wins: Win[] = []
let grid: HTMLElement, ghost: ReturnType<typeof ghostTile>

const isAuto = (i: number) => i < s.lv.auto
export const codMode = () => s.theme === 'deepsea'

function line(w: Win, text: string, cls = '') {
  w.body.insertBefore(el('p', cls, text), w.body.querySelector('.ask'))
  while (w.body.children.length > 14) w.body.firstElementChild!.remove()
}

function think(w: Win) {
  w.phase = 'think'; w.t = 0; w.dur = E.thinkTime(s.lv.model); w.shown = 0; w.done = 0
  w.script = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => workLine(codMode()))
  // no danger in the first minutes, and only once there's something to lose
  w.prompt = prompt(s.windows >= 3 && Math.random() < E.DANGER_CHANCE)
  w.root.classList.remove('waiting')
}

// ---------- agents (layer 2) ----------
function spawn(w: Win) {
  w.phase = 'agents'
  const k = s.lv.slots, names = [...AGENT_NAMES].sort(() => Math.random() - 0.5)
  line(w, `⏺ ${t('s.delegate', { k })}`, 'tool')
  w.tree = el('div', 'agents')
  w.body.append(w.tree)
  w.agents = names.slice(0, k).map(name => {
    const dur = E.agentTime(s.lv.aspeed) * (0.7 + Math.random() * 0.6)
    const danger = Math.random() < E.AGENT_DANGER
    const a: Agent = { name, t: 0, dur, askAt: Math.random() < E.AGENT_ASK ? dur * (0.2 + Math.random() * 0.6) : -1,
                       wt: 0, danger, cmd: agentRequest(danger), state: 'run', row: el('p'), last: '' }
    w.tree!.append(a.row)
    return a
  })
  w.agents.forEach(a => drawAgent(w, a))
}

function drawAgent(w: Win, a: Agent) {
  const branch = a === w.agents.at(-1) ? '└─' : '├─'
  const filled = Math.round((a.t / a.dur) * 8)
  const text = a.state === 'run' ? `${branch} ${a.name} ${'▓'.repeat(filled)}${'░'.repeat(8 - filled)}`
    : a.state === 'wait' ? `${branch} ${a.name} ${a.danger ? '⚠' : '⏸'} ${a.cmd}`
    : a.state === 'done' ? `${branch} ${a.name} ${t('s.agentDone')}` : `${branch} ${a.name} ${t('s.agentKilled')}`
  if (text === a.last) return
  a.last = text
  a.row.className = a.state === 'wait' ? (a.danger ? 'err' : 'hi') : a.state === 'done' ? 'ok' : a.state === 'dead' ? 'err' : ''
  a.row.replaceChildren(el('span', '', text))
  if (a.state !== 'wait') return
  const yes = el('button', 'mini', '⏎'); yes.onclick = () => approve(w, a, true, yes)
  a.row.append(yes)
  if (a.danger) { const no = el('button', 'mini no', '✗'); no.onclick = () => approve(w, a, false, no); a.row.append(no) }
}

function approve(w: Win, a: Agent, yes: boolean, at: HTMLElement) {
  if (a.state !== 'wait') return
  if (a.danger && yes) { lose(E.AGENT_PENALTY, at); a.state = 'dead'; hurt(w.root) }
  else { earn(E.clickValue(s.lv.context), at); a.state = 'run'; a.danger ? sfx.good() : sfx.mini() }
  drawAgent(w, a)
}

function tickAgents(w: Win, dt: number) {
  for (const a of w.agents) {
    if (a.state === 'run') {
      a.t += dt
      if (a.askAt >= 0 && a.t >= a.askAt) { a.askAt = -1; a.state = 'wait'; a.wt = 0 }
      else if (a.t >= a.dur) a.state = 'done'
    } else if (a.state === 'wait' && s.lv.aauto && (a.wt += dt) >= E.AUTO_DELAY) {
      approve(w, a, !(a.danger && s.lv.allow), a.row)
    }
    drawAgent(w, a)
  }
  if (w.agents.some(a => a.state === 'run' || a.state === 'wait')) return
  w.done = w.agents.filter(a => a.state === 'done').length
  w.tree!.remove()
  line(w, t('s.agentsFinished', { done: w.done, k: w.agents.length }), 'ok')
  if (!w.prompt.danger) w.prompt.q = t('s.merge', { n: w.done })
  ask(w)
}

// ---------- asking ----------
function ask(w: Win) {
  w.phase = 'ask'; w.t = 0
  line(w, `⏺ ${w.prompt.cmd}`, 'tool')
  const box = el('div', w.prompt.danger ? 'ask danger' : 'ask')
  const yes = el('button', 'yes', t('s.yes')), no = el('button', 'no', t('s.no'))
  yes.onclick = () => resolve(w, true, yes)
  no.onclick = () => resolve(w, false, no)
  box.append(el('div', 'q', (w.prompt.danger ? '⚠ ' : '') + w.prompt.q), yes, no)
  w.body.append(box)
  w.root.classList.add('waiting')
}

function resolve(w: Win, yes: boolean, at: HTMLElement) {
  if (w.phase !== 'ask') return
  const v = E.clickValue(s.lv.context) * (1 + E.AGENT_BONUS * w.done)
  w.body.querySelector('.ask')?.remove()
  if (w.prompt.danger && yes) {
    const loss = lose(E.DANGER_PENALTY, at)
    line(w, t('s.oops', { loss: E.fmt(loss) }), 'err')
    hurt(w.root)
  } else if (w.prompt.danger) {
    line(w, t('s.goodCatch'), 'ok')
    earn(v * 2, at); sfx.good()
  } else if (yes) {
    earn(v, at); sfx.click()
  } else {
    line(w, t('s.rejected'), 'err')
  }
  think(w)
}

// ---------- grid ----------
export function addSession(i: number) {
  const root = el('div', 'win'), bar = el('div', 'progress'), body = el('div', 'body'), tag = el('span', 'tag', t('s.auto'))
  const head = el('div', 'bar')
  head.append(el('i', 'dot'), el('i', 'dot'), el('i', 'dot'), el('span', 'title', `session-${i + 1} · ${PROJECTS[i]}`), tag)
  bar.append(el('i'))
  root.append(head, bar, body)
  grid.insertBefore(root, ghost.el)
  const w: Win = { root, body, bar, tag, phase: 'think', t: 0, dur: 1, script: [], shown: 0, prompt: prompt(false), agents: [], done: 0 }
  if (i === 0) [t('s.welcome1'), t('s.welcome2'), t('s.welcome3'), ''].forEach(text => line(w, text, 'hi'))
  wins.push(w); think(w); layoutSessions()
}

export function layoutSessions() {
  const n = s.windows + (s.windows < E.MAX_WINDOWS ? 1 : 0)
  grid.style.gridTemplateColumns = `repeat(${n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4}, 1fr)`
  wins.forEach((w, i) => { w.tag.hidden = !isAuto(i) })
  updateGhost()
}

export const updateGhost = () => ghost.update(E.windowPrice(s.windows), s.windows >= E.MAX_WINDOWS)

export function initSessions(container: HTMLElement, buyWindow: () => void) {
  grid = container
  ghost = ghostTile(t('ghost.session'), buyWindow)
  grid.append(ghost.el)
  for (let i = 0; i < s.windows; i++) addSession(i)
}

export function tickSessions(dt: number) {
  wins.forEach((w, i) => {
    w.t += dt
    if (w.phase === 'think') {
      ;(w.bar.firstElementChild as HTMLElement).style.width = `${Math.min(100, (w.t / w.dur) * 100)}%`
      while (w.shown < w.script.length && w.t >= ((w.shown + 1) * w.dur) / (w.script.length + 1)) line(w, w.script[w.shown++])
      if (w.t >= w.dur) s.lv.agents && s.lv.slots ? spawn(w) : ask(w)
    } else if (w.phase === 'agents') {
      tickAgents(w, dt)
    } else if (isAuto(i) && w.t >= E.AUTO_DELAY) {
      // auto-accept approves blindly unless the allowlist is bought
      resolve(w, !(w.prompt.danger && s.lv.allow), w.body.querySelector<HTMLElement>('.ask .yes') ?? w.root)
    }
  })
}
