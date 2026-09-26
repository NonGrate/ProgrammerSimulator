import { en, type Dict } from './locales/en.ts'
import { ru } from './locales/ru.ts'
import { cs } from './locales/cs.ts'
import { sk } from './locales/sk.ts'
import { de } from './locales/de.ts'

export const LANGS = { en: 'English', ru: 'Русский', cs: 'Čeština', sk: 'Slovenčina', de: 'Deutsch' }
export type Lang = keyof typeof LANGS
const DICTS: Record<Lang, Dict> = { en, ru, cs, sk, de }

type Key<V> = { [K in keyof Dict]: Dict[K] extends V ? K : never }[keyof Dict]
export type StrKey = Key<string>

let cur: Dict = en
export const setLang = (l: string) => { cur = DICTS[l as Lang] ?? en; document.documentElement.lang = l }
export const detectLang = (): Lang => {
  const l = navigator.language.slice(0, 2)
  return l in LANGS ? l as Lang : 'en'
}

// Unknown placeholders are left alone, so lines.ts can still fill {file}/{n}/{pkg} afterwards.
export const t = (k: StrKey, vars: Record<string, string | number> = {}) =>
  cur[k].replace(/\{(\w+)\}/g, (m, v) => v in vars ? String(vars[v]) : m)
export const tl = (k: Key<string[]>) => cur[k]

// Static text in index.html: <span data-i18n="settings.title">
export const applyStatic = () =>
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n as StrKey) })
