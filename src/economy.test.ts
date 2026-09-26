import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as E from './economy.ts'

const zero = () => Object.fromEntries(Object.keys(E.UPGRADES).map(k => [k, 0])) as E.Levels

test('prices follow the curve', () => {
  assert.equal(E.windowPrice(1), 15)
  assert.equal(E.windowPrice(2), 23)
  assert.equal(E.upgradePrice('allow', 0), 1500)
  assert.ok(E.windowPrice(12) > E.windowPrice(11))
})

test('upgrades scale output', () => {
  assert.equal(E.clickValue(0), 1)
  assert.ok(Math.abs(E.thinkTime(1) - 1.275) < 1e-9)
  assert.equal(E.autoIncome(zero()), 0)
  const lv = zero(); lv.auto = 1
  const before = E.income(lv, 1)
  lv.agents = 1; lv.slots = 1
  assert.ok(E.income(lv, 1) > before, 'an agent slot should pay off')
})

test('layers unlock in order', () => {
  const lv = zero()
  assert.ok(E.locked('agents', lv, 11))
  assert.equal(E.locked('agents', lv, 12), false)
  assert.ok(E.locked('slots', lv, 12))
  assert.ok(E.locked('teams', lv, 12))
  lv.slots = E.UPGRADES.slots.max
  assert.equal(E.locked('teams', lv, 12), false)
  assert.ok(E.locked('dc', lv, 12))
  lv.team = E.UPGRADES.team.max
  assert.equal(E.locked('dc', lv, 12), false)
})

test('teams and models', () => {
  const lv = zero(); lv.slots = 5
  assert.ok(E.shipValue(lv, E.USER_SCALE) === 2 * E.shipValue(lv, 0), 'USER_SCALE users double output')
  assert.equal(E.modelMult(2), E.MODEL_MULT ** 2)
  assert.ok(E.trainCost(1) > E.trainCost(0))
})

test('layer 5: only after AGI, with its own prices and multipliers', () => {
  const lv = zero()
  assert.equal(E.locked('acq', lv, 12, E.MODEL_COUNT - 1), 'agi')
  assert.equal(E.locked('acq', lv, 12, E.MODEL_COUNT), false)
  assert.equal(E.locked('internet', lv, 12, E.MODEL_COUNT), 'companies')
  lv.acq = E.COMPANY_COUNT
  assert.equal(E.locked('internet', lv, 12, E.MODEL_COUNT), false)
  lv.acq = 0
  // AGI raises the cap, and the extra levels are priced on the post-AGI scale, not the old curve
  assert.equal(E.maxLevel('gpu', E.MODEL_COUNT - 1), E.UPGRADES.gpu.max)
  assert.equal(E.maxLevel('gpu', E.MODEL_COUNT), E.UPGRADES.gpu.max + (E.AGI_BONUS.gpu ?? 0))
  assert.equal(E.upgradePrice('context', E.UPGRADES.context.max), E.BONUS_LEVEL.base)
  // fine-tunes continue past the last model; acquisitions and New Game+ multiply everything
  assert.equal(E.modelMult(E.MODEL_COUNT + 2), E.MODEL_MULT ** E.MODEL_COUNT * E.FINETUNE_MULT ** 2)
  lv.acq = 2
  assert.equal(E.globalMult(lv, 0, 1), E.ACQ_MULT ** 2 * E.NGP_MULT)
})

test('fmt', () => {
  assert.equal(E.fmt(0), '0')
  assert.equal(E.fmt(3.5), '3.50')
  assert.equal(E.fmt(999), '999')
  assert.equal(E.fmt(1234), '1.23K')
  assert.equal(E.fmt(2.5e9), '2.50B')
  assert.equal(E.fmt(1e35), '100.00Dc')
})
