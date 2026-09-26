// Balance check: a greedy player that always buys the best-payback option.
// Human model: 0.5s reaction, 0.35s per click, one click at a time. Run: npm run sim
import * as E from '../src/economy.ts'

const REACT = E.HUMAN.react, CLICK = E.HUMAN.click, dt = 0.05
let money = 0, t = 0, humanFree = 0
const lv = Object.fromEntries(Object.keys(E.UPGRADES).map(k => [k, 0])) as E.Levels
lv.allow = 1
const wins = [{ ready: E.thinkTime(0) }]
const buys: number[] = []
const manual = () => Math.min((wins.length - lv.auto) / (E.thinkTime(lv.model) + REACT), 1 / CLICK) * E.clickValue(lv.context)
const income = () => manual() + E.autoIncome(lv)

while (t < 3600 && wins.length < E.MAX_WINDOWS) {
  t += dt
  wins.forEach((w, i) => {
    if (t < w.ready) return
    if (i < lv.auto) { if (t >= w.ready + E.AUTO_DELAY) { money += E.clickValue(lv.context); w.ready = t + E.thinkTime(lv.model) } }
    else if (t >= w.ready + REACT && t >= humanFree) { money += E.clickValue(lv.context); humanFree = t + CLICK; w.ready = t + E.thinkTime(lv.model) }
  })
  const base = income()
  const opts: [string, number, () => void][] = [['window', E.windowPrice(wins.length), () => { wins.push({ ready: t + E.thinkTime(lv.model) }) }]]
  for (const id of ['model', 'context', 'auto'] as const)
    if (lv[id] < E.UPGRADES[id].max && !(id === 'auto' && lv.auto >= wins.length)) opts.push([id, E.upgradePrice(id, lv[id]), () => { lv[id]++ }])
  const best = opts.map(([name, cost, apply]) => {
    const snap = { ...lv }, n = wins.length; apply(); const gain = income() - base; Object.assign(lv, snap); wins.length = n
    return { name, cost, apply, payback: cost / Math.max(gain, 1e-9) }
  }).sort((a, b) => a.payback - b.payback)[0]
  if (money >= best.cost) {
    money -= best.cost; best.apply(); buys.push(t)
    console.log(`${(t / 60).toFixed(1).padStart(5)}m  ${best.name.padEnd(7)} sessions=${wins.length} ctx=${lv.context} model=${lv.model} auto=${lv.auto}  $${E.fmt(income())}/s`)
  }
}
const report = (from: number, what: string) => {
  const b = buys.filter(x => x >= from), gap = Math.max(...b.map((x, i) => x - (b[i - 1] ?? from)))
  console.log(`\n${what} at ${(t / 60).toFixed(1)} min, ${b.length} purchases, longest wait ${(gap / 60).toFixed(1)} min\n`)
}
report(0, 'Layer 1 done (grid full)')

// Layer 2 uses the averaged model from economy.ts instead of simulating every click.
const l2 = t
while (t < 4 * 3600 && lv.slots < E.UPGRADES.slots.max) {
  t += 1; money += E.income(lv, wins.length)
  const base = E.income(lv, wins.length)
  const ids = lv.agents ? (['slots', 'aspeed', 'aauto', 'context', 'model'] as const) : (['agents'] as const)
  const opts = ids.filter(id => lv[id] < E.UPGRADES[id].max).map(id => {
    lv[id]++; const gain = E.income(lv, wins.length) - base; lv[id]--
    return { id, cost: E.upgradePrice(id, lv[id]), payback: id === 'agents' ? 0 : E.upgradePrice(id, lv[id]) / Math.max(gain, 1e-9) }
  }).sort((a, b) => a.payback - b.payback)
  const best = opts[0]
  if (best && money >= best.cost) {
    money -= best.cost; lv[best.id]++; buys.push(t)
    console.log(`${(t / 60).toFixed(1).padStart(5)}m  ${best.id.padEnd(7)} slots=${lv.slots} aspeed=${lv.aspeed} aauto=${lv.aauto} ctx=${lv.context}  $${E.fmt(E.income(lv, wins.length))}/s`)
  }
}
report(l2, 'Layer 2 done (max agent slots)')

// Layers 3 + 4: users and compute are state, so options are scored by their gain over a short horizon.
let users = 0, tier = 0, progress = 0
const teams = () => 1 + lv.team
function rates() {
  const R = E.releaseTime(lv.sprint), auto = Math.min(lv.cicd, teams()), manual = teams() - auto
  const ships = auto / (R + E.AUTO_DELAY) + manual / (R + E.HUMAN.react)
  return { money: ships * E.shipValue(lv, users) * E.modelMult(tier), users: ships * E.usersPerShip(lv.mkt),
           compute: lv.dc ? E.compute(1 + lv.rack, lv.gpu) * (lv.cooling ? 1 : 0.97) : 0 }
}
const value = () => { // $/s now plus what users/compute will add within a minute
  const r = rates(), H = 60
  const m = r.money * (E.userMult(users + r.users * H) / E.userMult(users))
  return m + (lv.dc ? r.money * (E.MODEL_MULT - 1) * r.compute * H / E.trainCost(tier) : 0)
}
const l3 = t; let l4 = 0
while (t < 8 * 3600 && tier < E.MODEL_COUNT) {
  t += 1
  const r = rates(); money += r.money; users += r.users; progress += r.compute
  if (progress >= E.trainCost(tier)) { progress = 0; tier++; buys.push(t); console.log(`${(t / 60).toFixed(1).padStart(5)}m  >>> deployed model #${tier} (×${E.modelMult(tier)})`) }
  const base = value()
  const ids = (['teams', 'dc', 'team', 'sprint', 'mkt', 'cicd', 'rack', 'gpu', 'context', 'model', 'aspeed'] as const)
    .filter(id => lv[id] < E.UPGRADES[id].max && !E.locked(id, lv, wins.length))
  const opts = ids.map(id => {
    lv[id]++; const gain = value() - base; lv[id]--
    const cost = E.upgradePrice(id, lv[id])
    return { id, cost, payback: id === 'teams' || id === 'dc' ? 0 : cost / Math.max(gain, 1e-9) }
  }).sort((a, b) => a.payback - b.payback)
  const best = opts[0]
  if (best && money >= best.cost) {
    money -= best.cost; lv[best.id]++; buys.push(t)
    if (best.id === 'teams') report(l2, 'Teams bought'), buys.push(t)
    if (best.id === 'dc') { report(l3, 'Layer 3 done (datacenter bought)'); l4 = t }
    console.log(`${(t / 60).toFixed(1).padStart(5)}m  ${best.id.padEnd(7)} teams=${teams()} sprint=${lv.sprint} mkt=${lv.mkt} cicd=${lv.cicd} racks=${1 + lv.rack} gpu=${lv.gpu} users=${E.fmt(users)}  $${E.fmt(rates().money)}/s`)
  }
}
report(l4, tier === E.MODEL_COUNT ? 'Layer 4 done (AGI)' : 'Ran out of time in layer 4')
