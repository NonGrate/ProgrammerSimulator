// Layer 5 (after AGI): buy the tech industry one parody company at a time, then buy the Internet.
import * as E from './economy.ts'
import { s, el, setHtml } from './game.ts'
import { t, tl } from './i18n.ts'
import { COMPANIES } from './lines.ts'

let goalFill: HTMLElement, goalLabel: HTMLElement, goalBtn: HTMLButtonElement, cards: HTMLElement[] = []

// Log scale from roughly AGI-level money to the goal, so the bar actually moves during the layer
const goalProgress = () => Math.min(1, Math.max(0, (Math.log10(Math.max(s.money, 1)) - 22) / (Math.log10(E.upgradePrice('internet', 0)) - 22)))

export function initTakeover(container: HTMLElement, buyAcq: () => void, buyInternet: () => void) {
  const goal = el('div', 'train goal'), bar = el('div', 'release')
  goalFill = el('i'); goalLabel = el('span')
  goalBtn = el('button', 'yes') as HTMLButtonElement
  goalBtn.onclick = buyInternet
  bar.append(goalFill, goalLabel)
  goal.append(bar, goalBtn)
  const grid = el('div', 'companies')
  cards = COMPANIES.map(([icon, name]) => {
    const card = el('div', 'win company')
    const head = el('div', 'bar')
    head.append(el('i', 'dot'), el('i', 'dot'), el('i', 'dot'), el('span', 'title', name))
    const body = el('div', 'body')
    body.append(el('div', 'product', `${icon} ${name}`), el('p', 'status'), el('div', 'action'))
    card.append(head, body)
    grid.append(card)
    return card
  })
  grid.addEventListener('click', e => { if ((e.target as HTMLElement).closest('.acquire')) buyAcq() })
  container.append(goal, grid)
  refreshTakeover()
}

export function refreshTakeover() {
  if (!goalFill) return
  const goalPrice = E.upgradePrice('internet', 0)
  goalFill.style.width = `${goalProgress() * 100}%`
  goalLabel.textContent = t('k.goal', { a: E.fmt(s.money), b: E.fmt(goalPrice) })
  goalBtn.textContent = t('k.buyInternet', { price: E.fmt(goalPrice) })
  goalBtn.hidden = !!s.lv.internet || s.money < goalPrice || s.lv.acq < E.COMPANY_COUNT // all 10 companies first
  cards.forEach((card, i) => {
    const owned = i < s.lv.acq, next = i === s.lv.acq
    card.classList.toggle('owned', owned)
    card.classList.toggle('future', !owned && !next)
    const status = card.querySelector<HTMLElement>('.status')!, action = card.querySelector<HTMLElement>('.action')!
    status.textContent = owned ? tl('companyLines')[i] : next ? '' : '🔒'
    status.className = owned ? 'status ok' : 'status'
    // setHtml only rewrites when the text changes, so a click in progress isn't lost
    if (owned) setHtml(action, `<p class="dim">${t('k.owned')}</p>`)
    else if (next) {
      setHtml(action, `<button class="yes acquire">${t('k.acquire', { price: E.fmt(E.upgradePrice('acq', i)) })}</button>`)
      action.querySelector('button')!.disabled = s.money < E.upgradePrice('acq', i)
    } else setHtml(action, '')
  })
}
