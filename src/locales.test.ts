import { test } from 'node:test'
import assert from 'node:assert/strict'
import { en } from './locales/en.ts'
import { ru } from './locales/ru.ts'
import { cs } from './locales/cs.ts'
import { sk } from './locales/sk.ts'
import { de } from './locales/de.ts'
import { MODEL_COUNT, COMPANY_COUNT } from './economy.ts'

const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()

// TypeScript checks the keys; this checks that no translation drops a {placeholder} the game fills in
test('every translation keeps the placeholders of the English text', () => {
  for (const [name, d] of Object.entries({ ru, cs, sk, de })) {
    for (const [k, v] of Object.entries(en)) {
      const tr = d[k as keyof typeof en]
      if (typeof v === 'string') { assert.equal(vars(tr as string), vars(v), `${name} ${k}`); continue }
      // pools: every variant must carry the placeholders that all English variants share (e.g. {loss})
      const shared = v.map(vars).reduce((a, b) => a.split(',').filter(x => b.split(',').includes(x)).join())
      for (const line of tr as string[]) for (const p of shared.split(',').filter(Boolean)) assert.ok(line.includes(p), `${name} ${k}: "${line}" lacks ${p}`)
    }
    assert.equal(d.models.length, MODEL_COUNT, `${name} models`)
    assert.equal(d.modelLines.length, MODEL_COUNT - 1, `${name} modelLines`) // the last model gets the AGI ending instead
    assert.equal(d.companyLines.length, COMPANY_COUNT, `${name} companyLines`)
  }
})
