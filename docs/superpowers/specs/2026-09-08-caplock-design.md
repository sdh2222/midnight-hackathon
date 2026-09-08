# Caplock — design (pre-build)

Date: 2026-09-08
Hackathon: Midnight Korea 2026 (submit by 2026-09-28 00:00 KST)
Working title: **Caplock**

**Superseded as product direction** by
[2026-09-08-caplock-prd.md](./2026-09-08-caplock-prd.md)
and the boards in
[`docs/superpowers/diagrams/caplock-architecture.excalidraw`](../diagrams/caplock-architecture.excalidraw).
Keep this file for K-ETS vocabulary only.

One sentence: a plant proves to a bank, buyer, or supplier that a **verifier-locked** measurement meets a public intensity cap, without putting production or emissions on the ledger.

This document is the information architecture and scope for pre-build. It is not an implementation plan.

## 1. Problem we are solving

K-ETS already sends a full emissions statement to the government and a third-party verifier: legal entity, site, equipment, activity, fuel and feedstock, **production volume**, emissions, capacity, counts, operating rates. The Ministry certifies it. NGMS then publishes company name, **total emissions**, verifier name, and energy use.

That is not our fight. The leak is the **second copy**: the same workbook (or a slice that still has tonnes out and tCO2e) going to a bank, a steel buyer, or a supplier so they can tick “this counterpart is inside the green clause.” Production and intensity are commercial secrets. They also let a counterpart reverse-engineer output. Files sit in email and vendor clouds.

Caplock is only that second copy. The ministry still gets the spreadsheet. The counterpart gets a Midnight public bit: `meetsCap = true`, bound to a commitment the verifier already posted.

## 2. What we are not (K-ETS map)

Keep these words straight. We do not implement the market.

| Real object | Meaning | In Caplock |
|---|---|---|
| KAU | Korean Allowance Unit — allocated / auctioned permit, 1 tCO2e | Out of scope |
| KOC | Offset credit from an external project | Out of scope |
| KCU | KOC converted for surrender (capped share of obligation) | Out of scope |
| ETRS / ORS / KRX | Registries and the exchange | Out of scope |
| Emissions statement | Site-level MRV pack to MoE | Off-chain, verifier’s desk |
| Certified emissions | MoE-accepted tCO2e | May exist as a **private** `E` the verifier locks |
| Public NGMS row | Name, emissions, energy, verifier | Not our ledger; we do not try to hide that from the state |

If the pitch says “we built a carbon-credit exchange,” the scope is wrong.

## 3. Actors

| Actor | Job | Sees raw `E`, `P`? |
|---|---|---|
| **Verifier** (stand-in for a K-ETS verification body) | Checks the period off-chain, posts commitment `C` from the verifier wallet | Yes, at the door |
| **Plant** (liable entity / supplier) | Holds the same `E`, `P`, `salt`. Later proves the locked pair meets `k` | Yes |
| **Counterpart** (bank / buyer / supplier) | Looks up `plantId + period`. Reads `meetsCap` only | No |
| Ministry / GIR | Real world only. Not a screen | Yes, outside this app |
| Midnight nodes | Run `Verify`. Store public fields | No |

MVP wallets: two keys (verifier, plant). Counterpart can be a read-only page with no wallet if the ledger fields are public.

## 4. Information objects

### 4.1 Private (witness — never `disclose`)

| Field | Type (logical) | Why private |
|---|---|---|
| `E` | Non-negative integer, tCO2e × 1000 | Reverse-engineers scale |
| `P` | Non-negative integer, output tonnes × 1000 | Trade secret |
| `salt` | Field / bytes | Stops rainbow-table on `C` |
| Optional line items | Fuel, equipment, activity | Not in v1 at all |

Use scaled integers. **No division in Compact.** Intensity `E/P ≤ k` is `E * K_DENOM <= k_numer * P` (e.g. `k` stored as millitonnes CO2e per tonne).

### 4.2 Public (ledger — only after `disclose` or as circuit args)

| Field | Meaning |
|---|---|
| `plantId` | Public handle (demo: string / bytes) |
| `period` | Compliance year or quarter, e.g. `2025` |
| `C` | Commitment to `(E, P, salt, plantId, period)` |
| `verifier` | Address or registered id that posted `C` |
| `kNumer`, `kDenom` | Public intensity cap |
| `meetsCap` | Boolean disclosed by the prove circuit |
| `status` | `empty` / `locked` / `proven` |
| `provenAt` | Optional public counter or period flag |

`C` is computed in-circuit as a hash of the private tuple plus the public ids so a lock for plant A / 2025 cannot be opened as plant B.

### 4.3 Explicitly not stored

KAU balances, trades, KOC projects, fuel mix, energy kWh, equipment lists, GPS, invoices, the PDF statement.

## 5. Circuits (units)

Each circuit has one job.

### `registerVerifier` (optional if we hardcode the first key)

- Input: admin.
- Effect: whitelist who may call `lock`.
- Public: verifier id.

### `setCap`

- Input: admin or verifier.
- Effect: write `kNumer`, `kDenom` (demo: one global cap).
- Public: the cap.

### `lock`

- Caller: verifier only.
- Private witness: `E`, `P`, `salt` (verifier typed the measured pair).
- Public args: `plantId`, `period`.
- Checks: `P > 0`; slot empty or same verifier rotating; `C = hash(E, P, salt, plantId, period)`.
- Effect: store `C`, `verifier`, `status = locked`. Does **not** write `E`, `P`, or `meetsCap`.
- Fail: non-verifier caller; `P = 0`; overwrite without a rule.

### `proveUnderCap`

- Caller: plant (anyone who knows the opening is enough for the demo).
- Private witness: `E`, `P`, `salt`.
- Public args: `plantId`, `period`.
- Checks: slot is `locked`; `hash(...) == C`; `E * kDenom <= kNumer * P`.
- Effect: `meetsCap = disclose(true)`, `status = proven`.
- Fail: wrong opening (fake pair); ratio over cap; no lock.

A failed prove **does not** write `meetsCap = true`. The counterpart sees either nothing proven, or an explicit fail state if we add `proveResult` later. For the 4-week demo, wallet error on the over-cap plant is enough.

### `readClaim` (off-chain)

Not a circuit. UI reads ledger: `{ plantId, period, verifier, k, status, meetsCap }`.

## 6. Flows

### Happy path (Plant A)

1. Verifier and plant already agree off-chain on `E=120`, `P=1000`, `salt` for `plantId=A`, `period=2025`.
2. Admin/verifier sets `k` so 120/1000 is under (e.g. 0.15).
3. Verifier calls `lock`. Ledger shows `locked`, public `C`.
4. Plant calls `proveUnderCap` with the same witnesses. Ledger shows `proven`, `meetsCap=true`.
5. Counterpart opens the claim page. Sees pass. Does not see 120 or 1000.

### Lie path (typed fakes)

1. Same lock `C` for the real pair.
2. Plant (or attacker) proves with `E=1`, `P=10000`.
3. Hash mismatches `C`. Circuit fails. RPC/node rejects. No public pass.

### Over-cap path (Plant B)

1. Verifier locks a pair that is over `k`.
2. `proveUnderCap` fails the inequality. No pass bit.
3. Demo script: show the error next to Plant A’s green claim.

### Binding path (why the counterpart trusts the bit)

They trust **this sentence**: “the pair the **whitelisted verifier** committed as `C` satisfies `k`.” They do not trust “some numbers exist.” If the verifier lied in the real world, that is the same fraud as a false K-ETS verification report. Midnight does not replace that liability.

## 7. Screens (pre-build IA)

Three pages. No marketplace.

| Route | Actor | Shows | Actions |
|---|---|---|---|
| `/verifier` | Verifier | Cap, plant, period, E, P (local form, never posted as plaintext) | Set cap, lock |
| `/plant` | Plant | Plant, period, E, P, salt (local) | Prove under cap |
| `/claim/:plantId/:period` | Counterpart | Plant, period, verifier, k, status, meetsCap | None |

Copy on `/claim` must say what is **not** shown (emissions, production).

## 8. Scope

### In (must ship)

- One Compact contract with `setCap`, `lock`, `proveUnderCap`.
- Three screens above.
- Two fixture plants: A under, B over.
- README: one-line problem, how to run, which fields are private, how Midnight is used.
- Compiles on local undeployed (Docker + proof server). Preprod deploy is nice, not required for the first green.

### Out (do not start)

- KAU/KCU/KOC trading, KRX, ETRS, ORS.
- Replacing NGMS or MoE certification.
- Line-level inventory, CBAM full report, multi-year banking.
- A2A agents, OpenRouter, dataset market, zk-rollup.
- In-circuit ECDSA if Compact address-gating is enough.
- `meetsCap` as a range/band (v2).
- Real verifier APIs.

### Open (only if the core prove is done)

- Preprod deploy + hosted claim URL.
- Midnight Academy certificates attached to the submission.
- One extra disclosed field: `scheme = intensity` (still no `E`/`P`).

## 9. Trust and abuse (for the README)

| Attack | Result |
|---|---|
| Forge a proof with no valid pair | Verify fails |
| Open someone else’s `C` with invented under-cap numbers | Hash fail |
| Call `lock` as a random wallet | Caller check fail |
| Verifier posts a fake `C` | Crypto accepts; same as a crooked verification body — legal / off-chain |
| Steal plant wallet and prove a lock you know | You can prove a lock you were given; you cannot invent a new pass |

## 10. Pre-build checklist

Do these before writing product Compact beyond a spike.

1. Midnight Academy stages (bonus points on submit).
2. Local env from repo README: Node 22, Docker, `.env` from `.env.example`, proof server on `127.0.0.1:6300` (it sees witnesses — keep local).
3. Run official Compact counter / hello-world once so `lock`/`prove` is not the first compile.
4. Freeze fixtures: Plant A `E=120000`, `P=1000000`, `kNumer=150`, `kDenom=1000`; Plant B over that ratio.
5. Draw the three screens on paper; no extra routes.
6. Write the claim-page sentence in Korean and English before UI chrome.

## 11. Success for judges

They clone, compile, and can run: lock A → prove A → claim page green; prove A with fake numbers fails; lock B → prove B fails. README states government still gets the statement; counterparts do not.

## 12. Sources (domain)

- K-ETS MRV: statement by corporation, site, equipment, activity; third-party verify; MoE certify ([IEEJ overview](https://eneken.ieej.or.jp/data/11487.pdf), [ICAP K-ETS](https://icapcarbonaction.com/en/ets/korea-emissions-trading-system-k-ets)).
- Statement contents include production volume and energy ([IEEJ](https://eneken.ieej.or.jp/data/11487.pdf)).
- Public NGMS disclosure: names, emissions, verifier, energy — not our target audience.
- Compact: private by default; `disclose` only for ledger/public outputs ([Midnight docs](https://docs.midnight.network/)).
