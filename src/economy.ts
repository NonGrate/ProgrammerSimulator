// All balance numbers live here. Tuned with a greedy-player simulation, see ECONOMY.md.

export const MAX_WINDOWS = 12 // grid full -> next layer
export const THINK_BASE = 1.5 // seconds Clod "works" before asking
export const AUTO_DELAY = 1.2 // auto-accept is slower than a focused human
export const DANGER_CHANCE = 0.07
export const DANGER_PENALTY = 0.1 // share of money lost when a danger prompt is approved
export const OFFLINE_RATE = 0.5
export const OFFLINE_CAP = 8 * 3600

// Layer 2: before asking, Clod spawns one agent per slot. Agents run in parallel, sometimes ask for
// approval (small ⏎), and the merge pays value × (1 + AGENT_BONUS × agents finished).
export const AGENT_TIME = 4
export const AGENT_BONUS = 3
export const AGENT_ASK = 0.5 // chance an agent needs approval once during its run
export const AGENT_DANGER = 0.1 // share of agent requests that are dangerous
export const AGENT_PENALTY = 0.05
export const HUMAN = { react: 0.5, click: 0.35 } // used by the sim and the offline estimate

// Layer 3: the 12 sessions merge into team 1. A team builds a release (its sessions' output), you ship it,
// and each ship brings users. Users multiply every team's output.
export const MAX_TEAMS = 8
export const RELEASE_TIME = 12
export const USERS_PER_SHIP = 50
export const USER_SCALE = 1e4 // users for +100% output
export const FRIDAY_CHANCE = 0.07
export const FRIDAY_PENALTY = 0.15 // share of users lost on a Friday deploy

// Layer 4: racks make compute, compute trains models, each deployed model multiplies all income.
export const MAX_RACKS = 16
export const OVERHEAT_CHANCE = 1 / 60 // per rack per second
export const TRAIN_BASE = 200 // compute for the first model
export const TRAIN_GROWTH = 4
export const MODEL_MULT = 3
export const MODEL_COUNT = 10 // names live in the locales

export const WINDOW = { base: 10, growth: 1.5 }
export const UPGRADES = {
  model:   { base: 20,   growth: 2,    max: 10 },
  context: { base: 100,  growth: 2.05, max: 30 },
  auto:    { base: 25,   growth: 1.45, max: MAX_WINDOWS },
  allow:   { base: 1500, growth: 1,    max: 1 },
  agents:  { base: 1e5,  growth: 1,    max: 1 },
  slots:   { base: 3e5,  growth: 10,   max: 5 },
  aspeed:  { base: 3e5,  growth: 2.5,  max: 15 },
  aauto:   { base: 2e7,  growth: 1,    max: 1 },
  teams:   { base: 2e9,  growth: 1,    max: 1 },
  team:    { base: 5e9,  growth: 5,    max: MAX_TEAMS - 1 },
  sprint:  { base: 1e10, growth: 3,    max: 10 },
  mkt:     { base: 2e10, growth: 4,    max: 20 },
  cicd:    { base: 1.5e9, growth: 5,   max: MAX_TEAMS }, // ~1.5× the team it automates
  staging: { base: 5e11, growth: 1,    max: 1 },
  dc:      { base: 5e14, growth: 1,    max: 1 },
  rack:    { base: 2e15, growth: 1.6,  max: MAX_RACKS - 1 },
  gpu:     { base: 5e15, growth: 3,    max: 20 },
  cooling: { base: 1e17, growth: 1,    max: 1 },
} as const
export type UpgradeId = keyof typeof UPGRADES
export type Levels = Record<UpgradeId, number>

// Geometric price curve, same shape as Cookie Clicker (1.15) / AdVenture Capitalist (1.07-1.15)
export const price = (base: number, growth: number, owned: number) => Math.ceil(base * growth ** owned)
export const windowPrice = (owned: number) => price(WINDOW.base, WINDOW.growth, owned) // you start with one free session
export const upgradePrice = (id: UpgradeId, lvl: number) => price(UPGRADES[id].base, UPGRADES[id].growth, lvl)

export const thinkTime = (modelLvl: number) => THINK_BASE * 0.85 ** modelLvl
export const clickValue = (contextLvl: number) => 1.75 ** contextLvl
export const agentTime = (aspeedLvl: number) => AGENT_TIME * 0.85 ** aspeedLvl

// Expected steady-state output of one session. Agent durations are random in [0.7, 1.3] × agentTime,
// so the slowest of k is ~0.7 + 0.6·k/(k+1). ponytail: averages, not a queueing model; the sim uses it too.
export function session(lv: Levels, auto: boolean) {
  const k = lv.slots, v = clickValue(lv.context)
  const approve = lv.aauto ? AUTO_DELAY : HUMAN.react
  const agents = k ? agentTime(lv.aspeed) * (0.7 + 0.6 * k / (k + 1)) + (1 - (1 - AGENT_ASK) ** k) * approve : 0
  const cycle = thinkTime(lv.model) + agents + (auto ? AUTO_DELAY : HUMAN.react)
  const clicks = (auto ? 0 : 1) + (lv.aauto ? 0 : AGENT_ASK * k) // manual clicks per cycle
  return { cycle, pay: v * (1 + AGENT_BONUS * k) + v * AGENT_ASK * k, clicks }
}

// Total $/s for `windows` sessions, the first `lv.auto` automated. A human clicks at most 1/HUMAN.click per sec.
export function income(lv: Levels, windows: number, human = true) {
  const a = session(lv, true), m = session(lv, false)
  const autos = Math.min(lv.auto, windows), manual = windows - autos
  const demand = (autos * a.clicks / a.cycle + manual * m.clicks / m.cycle) || 1
  const f = human ? Math.min(1, 1 / HUMAN.click / demand) : 0 // share of manual clicks the human keeps up with
  const autoPart = autos * a.pay / a.cycle * (a.clicks ? f : 1)
  return autoPart + manual * m.pay / m.cycle * f
}

// Things you can't buy yet (not the same as maxed out). Returns a lock reason key for the locales.
export type LockReason = 'sessions' | 'slots' | 'teams' | 'moreSessions' | 'moreTeams' | 'locked'
export function locked(id: UpgradeId, lv: Levels, windows: number): LockReason | false {
  const need: Partial<Record<UpgradeId, [boolean, LockReason]>> = {
    agents: [windows < MAX_WINDOWS, 'sessions'],
    teams: [lv.slots < UPGRADES.slots.max, 'slots'],
    dc: [lv.team < UPGRADES.team.max, 'teams'],
    auto: [lv.auto >= windows, 'moreSessions'],
    cicd: [lv.cicd >= 1 + lv.team, 'moreTeams'],
  }
  const n = need[id]
  if (n) return n[0] && n[1]
  const layer: Partial<Record<UpgradeId, UpgradeId>> = { slots: 'agents', aspeed: 'agents', aauto: 'agents',
    team: 'teams', sprint: 'teams', mkt: 'teams', staging: 'teams', rack: 'dc', gpu: 'dc', cooling: 'dc' }
  const l = layer[id]
  return l && !lv[l] ? 'locked' : false
}

// Layer 3
export const releaseTime = (sprintLvl: number) => RELEASE_TIME * 0.85 ** sprintLvl
export const usersPerShip = (mktLvl: number) => USERS_PER_SHIP * 2 ** mktLvl
export const userMult = (users: number) => 1 + users / USER_SCALE
// What one team makes per second before users: its 12 sessions, fully automated.
export const teamPower = (lv: Levels) => { const a = session({ ...lv, aauto: 1 }, true); return MAX_WINDOWS * a.pay / a.cycle }
export const shipValue = (lv: Levels, users: number) => teamPower(lv) * releaseTime(lv.sprint) * userMult(users)

// Layer 4
export const compute = (racks: number, gpuLvl: number) => racks * 2 ** gpuLvl // per second, all racks running
export const trainCost = (tier: number) => TRAIN_BASE * TRAIN_GROWTH ** tier
export const modelMult = (tier: number) => MODEL_MULT ** tier

// Offline: only fully automated work counts.
export function autoIncome(lv: Levels, users = 0) {
  if (!lv.teams) return income(lv, lv.auto, false)
  const cycle = releaseTime(lv.sprint) + AUTO_DELAY
  return Math.min(lv.cicd, 1 + lv.team) * shipValue(lv, users) / cycle
}

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']
export function fmt(n: number): string {
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(2) : Math.floor(n).toString()
  const i = Math.min(Math.floor(Math.log10(n) / 3), SUFFIX.length - 1)
  return (n / 1000 ** i).toFixed(2) + SUFFIX[i]
}
