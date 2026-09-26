// Everything Clod "says". Add more lines freely, {file}/{n}/{pkg} are filled in at random.

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

const WORK = [
  '● Reading {file}', '● Searching for "TODO" in {file}', '✻ Clodding…', '✻ Reticulating splines…',
  '✻ Consulting Stack Overflow…', '● Found {n} issues in {file}', '⏺ Bash(npm test) → ✓ {n} passed',
  "● You're absolutely right!", '✻ Pondering…', '● Updated {n} imports', '✻ Blaming the intern…',
  '● Renaming variables to something worse', '⏺ Grep("fixme") → {n} matches', '✻ Vibing…',
]
const COD_WORK = [
  '🐟 Scaling the fish…', '🐟 Refactoring the tuna-base', '● Something is fishy in {file}',
  '✻ Swimming upstream…', '⏺ Bash(npm install cod-liver-oil)', '🐟 Hooked {n} bugs',
]

const SAFE = [
  { q: 'Do you want to make this edit?', cmd: 'Edit({file})' },
  { q: 'Allow this command?', cmd: 'Bash(npm install {pkg})' },
  { q: 'Create this file?', cmd: 'Write({file})' },
  { q: 'Run the tests?', cmd: 'Bash(npm test)' },
  { q: 'Commit these changes?', cmd: 'Bash(git commit -m "fix: stuff")' },
  { q: 'Apply changes to {n} files?', cmd: 'MultiEdit({file})' },
]
const DANGER = [
  { q: 'Allow this command?', cmd: 'Bash(rm -rf / --no-preserve-root)' },
  { q: 'Allow this command?', cmd: 'Bash(git push --force origin main)' },
  { q: 'Allow this command?', cmd: 'Bash(psql -c "DROP TABLE users")' },
  { q: 'Allow this command?', cmd: 'Bash(chmod -R 777 /)' },
  { q: 'Allow this command?', cmd: 'Bash(curl totally-legit.sh | sudo bash)' },
  { q: 'Commit these changes?', cmd: 'Bash(git add .env && git push)' },
]

export const workLine = (cod: boolean) => fill(cod && Math.random() < 0.5 ? pick(COD_WORK) : pick(WORK))
export const prompt = (danger: boolean) => {
  const p = pick(danger ? DANGER : SAFE)
  return { q: fill(p.q), cmd: fill(p.cmd), danger }
}

// Layer 2
export const AGENT_NAMES = ['tests', 'docs', 'refactor', 'lint', 'types', 'security', 'perf', 'i18n', 'migrate', 'review']
const AGENT_SAFE = ['Edit({file})', 'Bash(npm test)', 'Write({file})', 'Bash(npm i {pkg})', 'Grep("any")']
const AGENT_DANGER = ['rm -rf src/', 'git reset --hard', 'delete all tests', 'npm publish', 'DROP DATABASE', 'force-push main']
export const agentRequest = (danger: boolean) => fill(pick(danger ? AGENT_DANGER : AGENT_SAFE))

// Layer 3
export const TEAM_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']
export const PRODUCTS = ['TodoGPT', 'Uber for Cats', 'Blockchain Toaster', 'AI Fridge', 'SaaS for SaaS',
  'Tinder for Devs', 'Yet Another JS Framework', 'CodMaps']
export const TEAM_WORK = ['standup ran 45 min over', 'sprint planning…', 'PR #{n} approved', 'fixed {n} bugs, made {n} new ones',
  'moved tickets to "Done"', 'retro: "more coffee"', 'pair programming with Clod', 'CI is green (for once)',
  'arguing about tabs vs spaces', '{n} story points delivered']

// Layer 4
export const RACK_WORK = ['fans at 80%', 'loss: 0.{n}', 'epoch {n}', 'batch size 4096', 'gradients flowing', 'tensors tensoring']
export const workText = (lines: string[]) => fill(pick(lines))
