# Clod Cod — economy design

## 1. How the classics do it

| Game | Cost curve | Production | Keeps it fresh with | Prestige formula |
|---|---|---|---|---|
| **Cookie Clicker** | `base × 1.15^owned` for every building | Each new building tier costs ~10–12× the previous and produces ~6–8× more, so every tier pays back a bit slower | ×2 upgrades at 1/5/25/50/100… owned; golden cookies (random click events); click = % of CpS late game | Heavenly chips = `∛(total baked / 1e12)`, each +1% CpS |
| **AdVenture Capitalist** | `base × r^owned`, with `r` from 1.07 (cheap businesses) to 1.15 | Time-based cycles per business (same as our "think time") | Milestones at 25/50/100/200… owned double speed or profit; managers = automation | Angels = `150 × √(lifetime / 1e15)`, each +2% |
| **Clicker Heroes** | Hero level cost `× 1.07` | DPS vs. monster HP `≈ 10 × 1.6^zone` | Boss zones every 5 levels = hard walls you break by upgrading | Hero souls from total hero levels; ancients = permanent upgrades |
| **Antimatter Dimensions** | Cost ×10 after every 10 bought, rising faster later | Each dimension produces the one below it (chained production) | Resetting layers (Dimension Boost → Galaxy → Infinity → Eternity) | Several nested prestige layers, each needing the one before |
| **Universal Paperclips** | Mostly linear/quadratic | Changes the whole game mode every stage | Each stage is a different game (clips → factories → space probes) | None, it's a story with an ending |

### Math they all share
- **Price of the next one:** `P(n) = base × r^n`
- **Price of the next k:** `base × r^n × (r^k − 1) / (r − 1)` (use this for a "buy ×10" button)
- **How many you can afford:** `floor( log(money × (r − 1) / (base × r^n) + 1) / log r )`
- **Payback time** = `price / income added`. This is the number to balance. Players stay engaged when the next purchase is **30 s – 2 min** away. Every multiplier upgrade resets payback times to short, which gives the classic **sawtooth** pattern: steady grind, then a big boost.
- **Prestige** is almost always a **root of lifetime earnings** (cube root or square root). Roots grow slowly, so each run takes longer but is still worth doing.

### What we take from them
1. Geometric prices for everything (Cookie Clicker).
2. Time-based cycles plus automation as the "manager" (AdVenture Capitalist). This matches Clod's think-then-ask loop exactly.
3. Random click events (golden cookies) → our **danger prompts**. The twist: here the right move is **No**, which punishes clicking without reading.
4. Layers that change what you do, not just the size of the numbers (Paperclips + Antimatter Dimensions). The grid filling up is the signal to move to the next layer.
5. A root-based prestige later (the "Acquisition").

## 2. Layer 1 — Sessions

All numbers are in `src/economy.ts`.

| Thing | Formula | Notes |
|---|---|---|
| Proceed pays | `1.75^context` | Main multiplier |
| Think time | `1.5 s × 0.85^model`, max Lv 10 | Bottoms out at ~0.3 s |
| New session | `10 × 1.5^owned` | Capped at 12, because a full grid means the next layer |
| Faster model | `20 × 2^lvl` | |
| Bigger context | `100 × 2.05^lvl`, max Lv 30 | Payback gets ~1.17× longer per level, a slow grind |
| Auto-accept | `25 × 1.45^n` | Clicks after 1.2 s, slower than a focused human (~0.5 s) |
| Permission allowlist | $1,500 once | Without it, auto-accept approves `rm -rf /` |
| Danger prompt | 7% of prompts once you have 3+ sessions | Yes = lose 10% of money, No = double pay |
| Offline | 50% of auto income, max 8 h | Only automated sessions earn while you're away |

**Why the grid fills slowly around 5–6 sessions:** a human can click only ~3 times per second. After about 5 sessions that you click yourself, one more window adds almost nothing until you buy Auto-accept. The simulation found this on its own, and it's exactly the theme: *you can't keep up, so automate.*

**Simulated greedy player** (`npm run sim`): the grid is full at **~12.6 min**, after 40 purchases, and the longest wait between purchases is **1.2 min**. Real players are less efficient than the simulated player, so expect roughly 15–20 min.

## 3. Layers 2–4 (implemented)

| Layer | Unlock | What you click | Main formulas | Automation / protection |
|---|---|---|---|---|
| **2 · Subagents** | 12 sessions → $100K | Small ⏎ when an agent asks (50% of agents, once each); the merge prompt | Merge pays `value × (1 + 3 × agents finished)`; each agent approval pays `value`. Agent slot `3e5 × 10^n` (max 5), agent speed `3e5 × 2.5^n` | "Agents approve each other" $20M. The allowlist also protects agents; 10% of agent requests are dangerous (`rm -rf src/`) and cost 5% of money |
| **3 · Teams** | Max agent slots → $2B | 🚀 Ship when a release is built (12 s × 0.85^sprint) | Ship pays `12 sessions' output × release time × (1 + users / 10K)`, +`50 × 2^marketing` users. New team `5e9 × 5^n` (max 8) | CI/CD per team (`5e10 × 2^n`). 7% of releases are Friday deploys: shipping loses 15% of users. Staging environment ($500B) makes CI/CD refuse them |
| **4 · Datacenter** | 8 teams → $500T | ❄ Cool down on overheated racks (1/60 chance per rack per second); 🐟 Deploy when a model finishes training | Compute = `racks × 2^gpu` per second. Model n costs `200 × 4^n` compute. Each deployed model: **all income ×3**. Rack `2e15 × 1.6^n` (max 16), GPUs `5e15 × 3^n` | Liquid cooling ($100Qa) auto-cools |
| **Ending · AGI** | Deploy model 10 (Clod Leviathan) | | | Congratulations, you are unemployed |

Model names: Minnow → Sardine → Mackerel → Tuna → Swordfish → Shark → Orca → Whale → Kraken → Leviathan.

**Simulated greedy player** (`npm run sim`):

| | Ends at | Takes | Longest wait between purchases |
|---|---|---|---|
| Layer 1 | 12.6 min | 12.6 min | 1.2 min |
| Layer 2 | 39.5 min | 27 min | 2.6 min |
| Layer 3 | 59 min | 20 min | 3.0 min |
| Layer 4 → AGI | 90 min | 31 min | 2.2 min |

Real players will probably take 2–3 hours. Layers 3–4 are simulated with averages from `economy.ts` (`session()`, `income()`, `shipValue()`), not click by click.

## 4. Layer 5 — Takeover (after AGI)

| Thing | Formula | Notes |
|---|---|---|
| Fine-tunes | training continues past model 10; each costs `200 × 4^tier` compute and gives **all income ×1.5** | keeps racks and GPUs useful after AGI |
| Acquisitions | 10 parody companies, `1e25 × 12^n`, each **all income ×3** | Stack Underflow → Cloudflair (~$52 Dc) |
| Extra upgrade levels | AGI raises caps: Bigger context +10, Marketing +10, GPUs +20, Shorter sprints +5 | priced `1e23 × 6^k` on the post-AGI scale, the old curves would make them pocket change |
| Final goal | **Buy the Internet** for `3e35` ($300 Dc), **requires all 10 companies** | second ending |
| New Game+ | restart keeping settings; **all income ×2** per finished run | applied to every $ via `earn()` |

**Simulated greedy player:** Internet bought **21 min after AGI**, about 3 min after the last company, longest wait **1.8 min**. GPUs go to 40 so fine-tunes don't stall once the other caps are reached. Longer variants either left the player with nothing to buy for 5–10 minutes or had 3+ hour tails, because the post-AGI economy compounds fast (fine-tunes × acquisitions × users). Real players need roughly 1.5–2× the simulated time, so ~35–45 min.

## 5. Not built yet
- Offline progress for training (currently only automated income counts while you're away).
