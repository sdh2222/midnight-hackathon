# Intent Compact Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four-circuit intent contract from [the Compact spec](../specs/2026-09-18-intent-compact.md) in Compact, with a TypeScript simulator test suite that proves every assert and every fixture in spec section 13, runnable locally and in CI.

**Architecture:** One Compact source file `contract/src/intent.compact` holds the ledger (`ranges`, `ownerItems`, `pairs`), a pure `pairIdOf` helper, and the circuits `commitRange`, `commitOffer`, `verifySellerSide`, `openOffer`. The compiler emits a TypeScript/CommonJS module under `contract/src/managed/intent/`. Tests drive that module through `@midnight-ntwrk/compact-runtime` with an in-memory `IntentSimulator` that can switch the calling wallet, so `ownPublicKey()` checks are testable. No deployment, no wallet, no proof server in this plan.

**Tech Stack:** Compact (`compact` developer tool, latest toolchain), `@midnight-ntwrk/compact-runtime` pinned to the compiler's reported runtime version, TypeScript 5, Vitest 3, Node 22 (`.nvmrc`), npm workspaces.

## Global Constraints

- Spec is the SSOT: [`docs/superpowers/specs/2026-09-18-intent-compact.md`](../specs/2026-09-18-intent-compact.md). Names, assert order, and messages below come from it. Do not rename circuits, ledger fields, or enum variants.
- Never write `buyerMax`, `sellerMin`, any salt, or `offer` before open to the ledger, to a circuit return value, or through `disclose`. The only `disclose` calls allowed on price data: `fillPrice: disclose(offer)` inside `openOffer`.
- Amounts are `Uint<64>` won integers. No division, no strings, no `Opaque` inside commitments.
- `@midnight-ntwrk/compact-runtime` is pinned to the exact string printed by `compact compile --runtime-version`. No `^` or `~`.
- `pragma language_version >= <X>` where `X` is what `compact compile --language-version` prints. Confirm in Task 1 before writing the pragma.
- Unit tests compile with `--skip-zk`. Do not generate proving keys in tests or CI.
- Generated output `contract/src/managed/` is gitignored. Nothing generated is committed.
- TypeScript: imports at the top of the file only. `strict: true`. Two-space indent, LF, final newline (`.editorconfig`).
- Branch rules (README): work on a feature branch from `origin/dev`, open a PR into `dev`. Never commit to `dev` or `main` directly.
- Commit after every green step. Commit messages: imperative, present tense, no trailer.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` (root) | npm workspaces root so CI's `npm ci && npm test` reaches the contract package |
| `contract/package.json` | contract package: compile, typecheck, test scripts; pinned runtime |
| `contract/tsconfig.json` | TS config for tests and simulator |
| `contract/vitest.config.ts` | Vitest include pattern |
| `contract/src/intent.compact` | the contract |
| `contract/src/managed/intent/` | generated, gitignored |
| `contract/src/test/simulator.ts` | `IntentSimulator`: wraps `Contract`, holds `CircuitContext`, switches caller |
| `contract/src/test/fixtures.ts` | wallet keys, ids, salts, and the spec 13 amounts |
| `contract/src/test/ledger.test.ts` | Task 1 smoke test: compiled contract loads, ledger starts empty |
| `contract/src/test/commitRange.test.ts` | Task 2 |
| `contract/src/test/commitOffer.test.ts` | Task 3 |
| `contract/src/test/verifySellerSide.test.ts` | Task 4 |
| `contract/src/test/openOffer.test.ts` | Task 5 |
| `contract/src/test/fixtures.test.ts` | Task 6: spec section 13 scenarios end to end, privacy check |
| `.github/workflows/ci.yml` | Task 7: install Compact toolchain before `npm ci` |
| `README.md` | Task 7: contract section |
| `.gitignore` | Task 1: add `managed/` |

---

### Task 0: Land the spec documents and start the feature branch

**Files:**
- Commit: `docs/superpowers/specs/2026-09-18-intent-compact.md`
- Commit: `docs/superpowers/specs/2026-09-19-junwoo-architecture-discussion-draft.md`
- Commit: `docs/superpowers/plans/2026-09-20-intent-contract.md`

- [ ] **Step 1: Commit the docs on the docs branch**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
git checkout docs/intent-compact-spec
git add docs/superpowers/specs/2026-09-18-intent-compact.md \
        docs/superpowers/specs/2026-09-19-junwoo-architecture-discussion-draft.md \
        docs/superpowers/plans/2026-09-20-intent-contract.md
git commit -m "Add intent contract spec, architecture proposal, and implementation plan"
git push -u origin docs/intent-compact-spec
```

- [ ] **Step 2: Open the docs PR into dev**

```bash
gh pr create --base dev --head docs/intent-compact-spec \
  --title "Intent contract spec and architecture proposal" \
  --body "$(cat <<'EOF'
## Summary

- Compact contract spec for the agreed design (Discussion #10): `commitRange`, `commitOffer`, `verifySellerSide`, `openOffer`.
- Architecture proposal that was discussed and agreed on 2026-09-20.
- Implementation plan for the contract package.

Design source: https://github.com/sdh2222/midnight-hackathon/discussions/10

## Test plan

- [x] Local `.env` is copied from an `*.example` file (no secrets in the diff)
- [ ] Compiles / type-checks if this PR touches code (docs only)
- [ ] Demo path still works if this PR touches the product (docs only)
EOF
)"
```

Expected: a PR URL is printed.

- [ ] **Step 3: Create the feature branch from origin/dev**

```bash
git fetch origin
git checkout -b feat/intent-contract origin/dev
```

Expected: `Switched to a new branch 'feat/intent-contract'`. The `docs/` files from Step 1 are not on this branch yet; that is fine. They merge through the docs PR.

---

### Task 1: Toolchain, package scaffold, skeleton contract, simulator, smoke test

**Files:**
- Create: `package.json`
- Create: `contract/package.json`
- Create: `contract/tsconfig.json`
- Create: `contract/vitest.config.ts`
- Create: `contract/src/intent.compact` (types and ledger only)
- Create: `contract/src/test/simulator.ts`
- Create: `contract/src/test/fixtures.ts`
- Create: `contract/src/test/ledger.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `IntentSimulator` with `constructor(caller: string)`, `as(caller: string): this`, `ledger(): Ledger`. Later tasks add one method per circuit.
- Produces: fixtures `BUYER_KEY`, `SELLER_KEY`, `OTHER_KEY` (64-char hex), `ITEM`, `BUYER_INTENT`, `SELLER_INTENT`, `OTHER_INTENT` (`Uint8Array(32)`), `salt(n)`, `hexToBytes(hex)`, `id(s)`.

- [ ] **Step 1: Install the Compact developer tool and the latest toolchain**

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

Then open a new shell (the installer edits your shell rc), or `source ~/.zshrc`, and run:

```bash
which compact
compact update
compact compile --language-version
compact compile --runtime-version
```

Expected (versions will differ, record the actual ones):

```text
/Users/gjowehgqh/.compact/bin/compact
compact: aarch64-darwin -- 0.30.0 -- installed
compact: aarch64-darwin -- 0.30.0 -- default.
0.22.0
0.15.0
```

Write down three values: the `compact` binary directory (for CI in Task 7), the language version `L`, the runtime version `R`. Everything below uses `L` and `R` literally.

- [ ] **Step 2: Root workspace package.json**

Create `package.json`:

```json
{
  "name": "midnight-hackathon",
  "private": true,
  "workspaces": [
    "contract"
  ],
  "scripts": {
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

- [ ] **Step 3: Contract package.json**

Create `contract/package.json`. Replace `R` with the runtime version from Step 1 (for example `0.15.0`), no caret:

```json
{
  "name": "@midnight-hackathon/intent-contract",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "compact": "compact compile --skip-zk src/intent.compact src/managed/intent",
    "compact:zk": "compact compile src/intent.compact src/managed/intent",
    "typecheck": "npm run compact && tsc --noEmit",
    "test": "npm run compact && vitest run"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "R"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 4: tsconfig and vitest config**

Create `contract/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "vitest.config.ts"],
  "exclude": ["src/managed/**/*.ts"]
}
```

Create `contract/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Ignore generated output**

Append to `.gitignore` under the `# Midnight / Compact` block:

```gitignore
managed/
```

- [ ] **Step 6: Skeleton contract (types and ledger, no circuits yet)**

Create `contract/src/intent.compact`. Replace `L` with the language version from Step 1:

```compact
pragma language_version >= L;

import CompactStandardLibrary;

export enum Role { Buyer, Seller }
export enum Currency { KRW }
export enum PairStatus { Offered, Verified, Opened }

export struct RangeRecord {
  owner: Bytes<32>;
  role: Role;
  itemId: Bytes<32>;
  quantity: Uint<32>;
  currency: Currency;
  version: Uint<32>;
  commitment: Bytes<32>;
}

export struct PairRecord {
  buyerIntentId: Bytes<32>;
  sellerIntentId: Bytes<32>;
  offerCommit: Bytes<32>;
  status: PairStatus;
  fillPrice: Uint<64>;
}

export ledger ranges: Map<Bytes<32>, RangeRecord>;
export ledger ownerItems: Set<Bytes<32>>;
export ledger pairs: Map<Bytes<32>, PairRecord>;

export circuit pairIdOf(buyerIntentId: Bytes<32>, sellerIntentId: Bytes<32>): Bytes<32> {
  return disclose(persistentHash<Vector<2, Bytes<32>>>([buyerIntentId, sellerIntentId]));
}
```

- [ ] **Step 7: Install dependencies and compile**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
npm install
cd contract
npm run compact
ls src/managed/intent/contract
```

Expected: compile prints no errors, and the listing shows `index.cjs` and `index.d.cts`.

If the compiler rejects `;` between struct fields, change them to `,`. If it complains that `persistentHash` inside `disclose` is redundant, drop the `disclose(...)` wrapper. Do not change anything else.

- [ ] **Step 8: Confirm the runtime exports the simulator needs**

```bash
grep -oE "export declare (function|const|class) (constructorContext|emptyZswapLocalState|sampleContractAddress|QueryContext)\b" \
  node_modules/@midnight-ntwrk/compact-runtime/dist/index.d.ts | sort -u
grep -oE "export (declare )?(class|type|interface) (Contract|Ledger|CircuitContext)\b" \
  src/managed/intent/contract/index.d.cts | sort -u
```

Expected: the first command lists all four names; the second lists `Contract`, `Ledger`, and `CircuitContext` (the latter may be re-exported from the runtime instead).

If `constructorContext` is missing, this runtime is on the newer API: open `node_modules/@midnight-ntwrk/compact-runtime/dist/index.d.ts`, find the function that builds a `ConstructorContext` and the `createCircuitContext(contractAddress, coinPublicKey, contractState, privateState)` function, and use them inside the `IntentSimulator` constructor in Step 10. Keep the simulator's public method signatures unchanged.

- [ ] **Step 9: Fixtures**

Create `contract/src/test/fixtures.ts`:

```ts
import { createHash } from 'node:crypto';
import { Currency, Role } from '../managed/intent/contract/index.cjs';

// 64-char hex coin public keys. The simulator sets ownPublicKey() from these.
export const BUYER_KEY = 'aa'.repeat(32);
export const SELLER_KEY = 'bb'.repeat(32);
export const OTHER_KEY = 'cc'.repeat(32);

export const hexToBytes = (hex: string): Uint8Array => Uint8Array.from(Buffer.from(hex, 'hex'));

// SHA-256 of a JSON string id, as the backend will do it (spec section 5).
export const id = (s: string): Uint8Array =>
  Uint8Array.from(createHash('sha256').update(s, 'utf8').digest());

// Deterministic 32-byte salts for tests. Production uses random bytes.
export const salt = (n: number): Uint8Array => {
  const out = new Uint8Array(32);
  out[31] = n;
  return out;
};

export const ITEM = id('demo-item-1');
export const OTHER_ITEM = id('demo-item-2');
export const BUYER_INTENT = id('intent_buyer_1');
export const SELLER_INTENT = id('intent_seller_1');
export const OTHER_INTENT = id('intent_other_1');

export const KRW = Currency.KRW;

export const buyerRange = {
  intentId: BUYER_INTENT,
  role: Role.Buyer,
  itemId: ITEM,
  quantity: 1n,
  currency: KRW,
  version: 1n,
};

export const sellerRange = {
  intentId: SELLER_INTENT,
  role: Role.Seller,
  itemId: ITEM,
  quantity: 1n,
  currency: KRW,
  version: 1n,
};

// Spec section 13 amounts, in won.
export const BUYER_MAX = 1_000_000n;
export const SELLER_MIN = 800_000n;
export const OFFER_HIT = 900_000n;
export const OFFER_LOW = 750_000n;
export const BUYER_MAX_NO_OVERLAP = 700_000n;
export const OFFER_TOO_HIGH = 850_000n;

export const BUYER_SALT = salt(1);
export const SELLER_SALT = salt(2);
export const OFFER_SALT = salt(3);
```

- [ ] **Step 10: Simulator**

Create `contract/src/test/simulator.ts`:

```ts
import {
  type CircuitContext,
  QueryContext,
  constructorContext,
  emptyZswapLocalState,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Ledger, ledger } from '../managed/intent/contract/index.cjs';

// The contract declares no witnesses; every secret is a circuit argument.
export type IntentPrivateState = Record<string, never>;
export const witnesses = {};

export class IntentSimulator {
  private readonly contract: Contract<IntentPrivateState>;
  private ctx: CircuitContext<IntentPrivateState>;

  constructor(caller: string) {
    this.contract = new Contract<IntentPrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(constructorContext({}, caller));
    this.ctx = {
      currentPrivateState,
      currentZswapLocalState,
      originalState: currentContractState,
      transactionContext: new QueryContext(currentContractState.data, sampleContractAddress()),
    };
  }

  // Switch the wallet that signs the next circuit call. ownPublicKey() reads this.
  as(caller: string): this {
    this.ctx = { ...this.ctx, currentZswapLocalState: emptyZswapLocalState(caller) };
    return this;
  }

  ledger(): Ledger {
    return ledger(this.ctx.transactionContext.state);
  }

  pairIdOf(buyerIntentId: Uint8Array, sellerIntentId: Uint8Array): Uint8Array {
    return this.contract.circuits.pairIdOf(this.ctx, buyerIntentId, sellerIntentId).result;
  }
}
```

- [ ] **Step 11: Smoke test**

Create `contract/src/test/ledger.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IntentSimulator } from './simulator.js';
import { BUYER_INTENT, BUYER_KEY, SELLER_INTENT } from './fixtures.js';

describe('compiled contract', () => {
  it('starts with empty ledger maps', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    const l = sim.ledger();
    expect(l.ranges.isEmpty()).toBe(true);
    expect(l.ownerItems.isEmpty()).toBe(true);
    expect(l.pairs.isEmpty()).toBe(true);
  });

  it('pairIdOf is deterministic and order-sensitive', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    const a = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    const b = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    const c = sim.pairIdOf(SELLER_INTENT, BUYER_INTENT);
    expect(a).toHaveLength(32);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
```

- [ ] **Step 12: Run typecheck and tests**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon/contract
npm run typecheck
npm test
```

Expected: `tsc` exits 0. Vitest prints `2 passed`.

- [ ] **Step 13: Commit**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
git add package.json package-lock.json contract/package.json contract/tsconfig.json contract/vitest.config.ts \
        contract/src/intent.compact contract/src/test/simulator.ts contract/src/test/fixtures.ts \
        contract/src/test/ledger.test.ts .gitignore
git status --short
git commit -m "Scaffold intent contract package with ledger types and simulator"
```

Expected `git status --short` before commit shows only the listed files. If `contract/src/managed/` appears, the `.gitignore` edit in Step 5 is wrong; fix it before committing.

---

### Task 2: `commitRange`

**Files:**
- Modify: `contract/src/intent.compact`
- Modify: `contract/src/test/simulator.ts`
- Create: `contract/src/test/commitRange.test.ts`

**Interfaces:**
- Consumes: `IntentSimulator`, fixtures from Task 1.
- Produces: Compact `export circuit commitRange(intentId: Bytes<32>, role: Role, itemId: Bytes<32>, quantity: Uint<32>, currency: Currency, version: Uint<32>, limit: Uint<64>, salt: Bytes<32>): []`.
- Produces: `IntentSimulator.commitRange(p: RangeArgs): Ledger` where `RangeArgs = { intentId: Uint8Array; role: Role; itemId: Uint8Array; quantity: bigint; currency: Currency; version: bigint; limit: bigint; salt: Uint8Array }`.

- [ ] **Step 1: Write the failing tests**

Create `contract/src/test/commitRange.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Role } from '../managed/intent/contract/index.cjs';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_SALT,
  OTHER_INTENT,
  OTHER_ITEM,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  hexToBytes,
  sellerRange,
} from './fixtures.js';

describe('commitRange', () => {
  it('stores a buyer row with public fields, owner, and a commitment but no limit', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    const l = sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });

    expect(l.ranges.member(BUYER_INTENT)).toBe(true);
    const row = l.ranges.lookup(BUYER_INTENT);
    expect(row.owner).toEqual(hexToBytes(BUYER_KEY));
    expect(row.role).toBe(Role.Buyer);
    expect(row.itemId).toEqual(buyerRange.itemId);
    expect(row.quantity).toBe(1n);
    expect(row.version).toBe(1n);
    expect(row.commitment).toHaveLength(32);
    expect(Object.keys(row).sort()).toEqual(
      ['commitment', 'currency', 'itemId', 'owner', 'quantity', 'role', 'version'],
    );
    expect(l.ownerItems.size()).toBe(1n);
  });

  it('lets a different wallet commit the other side of the same item', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    const l = sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });

    expect(l.ranges.size()).toBe(2n);
    expect(l.ranges.lookup(SELLER_INTENT).role).toBe(Role.Seller);
    expect(l.ownerItems.size()).toBe(2n);
  });

  it('different commitments for the same limit with different salts', () => {
    const a = new IntentSimulator(BUYER_KEY).commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    const b = new IntentSimulator(BUYER_KEY).commitRange({ ...buyerRange, limit: BUYER_MAX, salt: SELLER_SALT });
    expect(a.ranges.lookup(BUYER_INTENT).commitment).not.toEqual(b.ranges.lookup(BUYER_INTENT).commitment);
  });

  it('rejects quantity 0', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    expect(() => sim.commitRange({ ...buyerRange, quantity: 0n, limit: BUYER_MAX, salt: BUYER_SALT }))
      .toThrow(/quantity must be positive/);
  });

  it('rejects limit 0', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    expect(() => sim.commitRange({ ...buyerRange, limit: 0n, salt: BUYER_SALT }))
      .toThrow(/limit must be positive/);
  });

  it('rejects a second commit for the same intentId', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    expect(() => sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT }))
      .toThrow(/intent already committed/);
  });

  it('rejects the same wallet committing a second range for the same item', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    expect(() => sim.commitRange({ ...buyerRange, intentId: OTHER_INTENT, limit: 900_000n, salt: SELLER_SALT }))
      .toThrow(/owner already has a range for this item/);
  });

  it('allows the same wallet to commit a range for a different item', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    const l = sim.commitRange({ ...buyerRange, intentId: OTHER_INTENT, itemId: OTHER_ITEM, limit: BUYER_MAX, salt: BUYER_SALT });
    expect(l.ranges.size()).toBe(2n);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon/contract
npm test -- commitRange
```

Expected: FAIL. TypeScript or Vitest reports `commitRange` is not a function on `IntentSimulator`.

- [ ] **Step 3: Add the circuit to the contract**

Append to `contract/src/intent.compact`, after `pairIdOf`:

```compact
circuit ownerItemKey(owner: Bytes<32>, itemId: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([owner, itemId]);
}

export circuit commitRange(
  intentId: Bytes<32>,
  role: Role,
  itemId: Bytes<32>,
  quantity: Uint<32>,
  currency: Currency,
  version: Uint<32>,
  limit: Uint<64>,
  salt: Bytes<32>
): [] {
  assert(quantity > 0, "quantity must be positive");
  assert(limit > 0, "limit must be positive");

  const id = disclose(intentId);
  assert(!ranges.member(id), "intent already committed");

  const owner = ownPublicKey().bytes;
  const ownerKey = disclose(ownerItemKey(owner, itemId));
  assert(!ownerItems.member(ownerKey), "owner already has a range for this item");

  ranges.insert(id, RangeRecord {
    owner: disclose(owner),
    role: disclose(role),
    itemId: disclose(itemId),
    quantity: disclose(quantity),
    currency: disclose(currency),
    version: disclose(version),
    commitment: persistentCommit<Uint<64>>(limit, salt)
  });
  ownerItems.insert(ownerKey);
}
```

If the compiler reports a potential witness disclosure on the `commitment` field, wrap it: `commitment: disclose(persistentCommit<Uint<64>>(limit, salt))`. That discloses only the hash, never `limit` or `salt`.

- [ ] **Step 4: Add the simulator method**

In `contract/src/test/simulator.ts`, add the import of `Currency` and `Role` types and the `RangeArgs` type after the existing imports, and the method inside the class after `pairIdOf`:

```ts
import type { Currency, Role } from '../managed/intent/contract/index.cjs';

export type RangeArgs = {
  intentId: Uint8Array;
  role: Role;
  itemId: Uint8Array;
  quantity: bigint;
  currency: Currency;
  version: bigint;
  limit: bigint;
  salt: Uint8Array;
};
```

```ts
  commitRange(p: RangeArgs): Ledger {
    this.ctx = this.contract.impureCircuits.commitRange(
      this.ctx,
      p.intentId,
      p.role,
      p.itemId,
      p.quantity,
      p.currency,
      p.version,
      p.limit,
      p.salt,
    ).context;
    return this.ledger();
  }
```

Merge the type-only import into the existing `import { Contract, type Ledger, ledger } from '../managed/intent/contract/index.cjs';` line as `import { Contract, type Currency, type Ledger, type Role, ledger } from ...` so there is one import per module.

- [ ] **Step 5: Run to verify it passes**

```bash
npm test -- commitRange
```

Expected: `8 passed`.

- [ ] **Step 6: Commit**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
git add contract/src/intent.compact contract/src/test/simulator.ts contract/src/test/commitRange.test.ts
git commit -m "Add commitRange circuit with owner and per-item uniqueness checks"
```

---

### Task 3: `commitOffer` (buyer half proof)

**Files:**
- Modify: `contract/src/intent.compact`
- Modify: `contract/src/test/simulator.ts`
- Create: `contract/src/test/commitOffer.test.ts`

**Interfaces:**
- Consumes: `IntentSimulator.commitRange`, `IntentSimulator.pairIdOf`, `PairStatus` enum.
- Produces: Compact `export circuit commitOffer(buyerIntentId: Bytes<32>, sellerIntentId: Bytes<32>, buyerMax: Uint<64>, buyerSalt: Bytes<32>, offer: Uint<64>, offerSalt: Bytes<32>): []`.
- Produces: `IntentSimulator.commitOffer(p: OfferArgs): Ledger` where `OfferArgs = { buyerIntentId: Uint8Array; sellerIntentId: Uint8Array; buyerMax: bigint; buyerSalt: Uint8Array; offer: bigint; offerSalt: Uint8Array }`.
- Test helpers such as `setup()` stay inside the test file that uses them. `fixtures.ts` holds only constants.

- [ ] **Step 1: Write the failing tests**

Create `contract/src/test/commitOffer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PairStatus, Role } from '../managed/intent/contract/index.cjs';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_SALT,
  OTHER_INTENT,
  OTHER_ITEM,
  OTHER_KEY,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  sellerRange,
} from './fixtures.js';

const setup = (): IntentSimulator => {
  const sim = new IntentSimulator(BUYER_KEY);
  sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
  sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
  return sim.as(BUYER_KEY);
};

const offer = {
  buyerIntentId: BUYER_INTENT,
  sellerIntentId: SELLER_INTENT,
  buyerMax: BUYER_MAX,
  buyerSalt: BUYER_SALT,
  offer: OFFER_HIT,
  offerSalt: OFFER_SALT,
};

describe('commitOffer', () => {
  it('creates an Offered pair with a commitment and fillPrice 0', () => {
    const sim = setup();
    const l = sim.commitOffer(offer);
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);

    expect(l.pairs.member(pairId)).toBe(true);
    const pair = l.pairs.lookup(pairId);
    expect(pair.buyerIntentId).toEqual(BUYER_INTENT);
    expect(pair.sellerIntentId).toEqual(SELLER_INTENT);
    expect(pair.status).toBe(PairStatus.Offered);
    expect(pair.fillPrice).toBe(0n);
    expect(pair.offerCommit).toHaveLength(32);
    expect(Object.keys(pair).sort()).toEqual(
      ['buyerIntentId', 'fillPrice', 'offerCommit', 'sellerIntentId', 'status'],
    );
  });

  it('accepts an offer equal to buyerMax', () => {
    const sim = setup();
    const l = sim.commitOffer({ ...offer, offer: BUYER_MAX });
    expect(l.pairs.size()).toBe(1n);
  });

  it('rejects when the seller range is missing', () => {
    const sim = new IntentSimulator(BUYER_KEY);
    sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    expect(() => sim.commitOffer(offer)).toThrow(/seller range missing/);
  });

  it('rejects when the buyer range is missing', () => {
    const sim = new IntentSimulator(SELLER_KEY);
    sim.commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
    expect(() => sim.as(BUYER_KEY).commitOffer(offer)).toThrow(/buyer range missing/);
  });

  it('rejects when the two intents have the wrong roles', () => {
    const sim = setup();
    expect(() => sim.as(SELLER_KEY).commitOffer({
      ...offer,
      buyerIntentId: SELLER_INTENT,
      sellerIntentId: BUYER_INTENT,
      buyerMax: SELLER_MIN,
      buyerSalt: SELLER_SALT,
    })).toThrow(/buyer intent is not a buyer/);
  });

  it('rejects when items differ', () => {
    const sim = setup();
    sim.as(OTHER_KEY).commitRange({
      ...sellerRange,
      intentId: OTHER_INTENT,
      itemId: OTHER_ITEM,
      limit: SELLER_MIN,
      salt: SELLER_SALT,
    });
    expect(() => sim.as(BUYER_KEY).commitOffer({ ...offer, sellerIntentId: OTHER_INTENT }))
      .toThrow(/item mismatch/);
  });

  it('rejects a caller that does not own the buyer intent', () => {
    const sim = setup();
    expect(() => sim.as(OTHER_KEY).commitOffer(offer)).toThrow(/caller is not the buyer/);
  });

  it('rejects when buyerMax or buyerSalt does not open the buyer commitment', () => {
    const sim = setup();
    expect(() => sim.commitOffer({ ...offer, buyerMax: BUYER_MAX + 1n })).toThrow(/buyer range does not open/);
    expect(() => sim.commitOffer({ ...offer, buyerSalt: SELLER_SALT })).toThrow(/buyer range does not open/);
  });

  it('rejects offer 0', () => {
    const sim = setup();
    expect(() => sim.commitOffer({ ...offer, offer: 0n })).toThrow(/offer must be positive/);
  });

  it('rejects an offer above buyerMax', () => {
    const sim = setup();
    expect(() => sim.commitOffer({ ...offer, offer: BUYER_MAX + 1n })).toThrow(/offer above buyer limit/);
  });

  it('rejects a second offer for the same pair', () => {
    const sim = setup();
    sim.commitOffer(offer);
    expect(() => sim.commitOffer({ ...offer, offer: OFFER_HIT + 1n })).toThrow(/pair already has an offer/);
  });

  it('roles stay as committed', () => {
    const l = setup().ledger();
    expect(l.ranges.lookup(BUYER_INTENT).role).toBe(Role.Buyer);
    expect(l.ranges.lookup(SELLER_INTENT).role).toBe(Role.Seller);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon/contract
npm test -- commitOffer
```

Expected: FAIL, `commitOffer` is not a function.

- [ ] **Step 3: Add the circuit**

Append to `contract/src/intent.compact`:

```compact
export circuit commitOffer(
  buyerIntentId: Bytes<32>,
  sellerIntentId: Bytes<32>,
  buyerMax: Uint<64>,
  buyerSalt: Bytes<32>,
  offer: Uint<64>,
  offerSalt: Bytes<32>
): [] {
  const buyerId = disclose(buyerIntentId);
  const sellerId = disclose(sellerIntentId);
  assert(ranges.member(buyerId), "buyer range missing");
  assert(ranges.member(sellerId), "seller range missing");

  const buyer = ranges.lookup(buyerId);
  const seller = ranges.lookup(sellerId);
  assert(buyer.role == Role.Buyer, "buyer intent is not a buyer");
  assert(seller.role == Role.Seller, "seller intent is not a seller");
  assert(buyer.itemId == seller.itemId, "item mismatch");
  assert(buyer.quantity == seller.quantity, "quantity mismatch");
  assert(buyer.currency == seller.currency, "currency mismatch");
  assert(ownPublicKey().bytes == buyer.owner, "caller is not the buyer");

  assert(persistentCommit<Uint<64>>(buyerMax, buyerSalt) == buyer.commitment, "buyer range does not open");
  assert(offer > 0, "offer must be positive");
  assert(offer <= buyerMax, "offer above buyer limit");

  const pairId = pairIdOf(buyerId, sellerId);
  assert(!pairs.member(pairId), "pair already has an offer");

  pairs.insert(pairId, PairRecord {
    buyerIntentId: buyerId,
    sellerIntentId: sellerId,
    offerCommit: persistentCommit<Uint<64>>(offer, offerSalt),
    status: PairStatus.Offered,
    fillPrice: 0
  });
}
```

Same fallback as Task 2 if the compiler asks for `disclose` around `offerCommit`.

- [ ] **Step 4: Add the simulator method**

In `contract/src/test/simulator.ts`, add the type next to `RangeArgs` and the method after `commitRange`:

```ts
export type OfferArgs = {
  buyerIntentId: Uint8Array;
  sellerIntentId: Uint8Array;
  buyerMax: bigint;
  buyerSalt: Uint8Array;
  offer: bigint;
  offerSalt: Uint8Array;
};
```

```ts
  commitOffer(p: OfferArgs): Ledger {
    this.ctx = this.contract.impureCircuits.commitOffer(
      this.ctx,
      p.buyerIntentId,
      p.sellerIntentId,
      p.buyerMax,
      p.buyerSalt,
      p.offer,
      p.offerSalt,
    ).context;
    return this.ledger();
  }
```

- [ ] **Step 5: Run to verify it passes**

```bash
npm test -- commitOffer
```

Expected: `12 passed`.

- [ ] **Step 6: Commit**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
git add contract/src/intent.compact contract/src/test/simulator.ts contract/src/test/commitOffer.test.ts
git commit -m "Add commitOffer circuit with buyer half proof and one offer per pair"
```

---

### Task 4: `verifySellerSide`

**Files:**
- Modify: `contract/src/intent.compact`
- Modify: `contract/src/test/simulator.ts`
- Create: `contract/src/test/verifySellerSide.test.ts`

**Interfaces:**
- Consumes: `IntentSimulator.commitRange`, `commitOffer`, `pairIdOf`.
- Produces: Compact `export circuit verifySellerSide(pairId: Bytes<32>, sellerMin: Uint<64>, sellerSalt: Bytes<32>, offer: Uint<64>, offerSalt: Bytes<32>): []`.
- Produces: `IntentSimulator.verifySellerSide(p: SellerArgs): Ledger` where `SellerArgs = { pairId: Uint8Array; sellerMin: bigint; sellerSalt: Uint8Array; offer: bigint; offerSalt: Uint8Array }`.

- [ ] **Step 1: Write the failing tests**

Create `contract/src/test/verifySellerSide.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PairStatus } from '../managed/intent/contract/index.cjs';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_LOW,
  OFFER_SALT,
  OTHER_KEY,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  sellerRange,
} from './fixtures.js';

type Setup = { sim: IntentSimulator; pairId: Uint8Array };

const setup = (offerAmount: bigint = OFFER_HIT): Setup => {
  const sim = new IntentSimulator(BUYER_KEY);
  sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
  sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
  sim.as(BUYER_KEY).commitOffer({
    buyerIntentId: BUYER_INTENT,
    sellerIntentId: SELLER_INTENT,
    buyerMax: BUYER_MAX,
    buyerSalt: BUYER_SALT,
    offer: offerAmount,
    offerSalt: OFFER_SALT,
  });
  return { sim: sim.as(SELLER_KEY), pairId: sim.pairIdOf(BUYER_INTENT, SELLER_INTENT) };
};

const sellerArgs = (pairId: Uint8Array, offerAmount: bigint = OFFER_HIT) => ({
  pairId,
  sellerMin: SELLER_MIN,
  sellerSalt: SELLER_SALT,
  offer: offerAmount,
  offerSalt: OFFER_SALT,
});

describe('verifySellerSide', () => {
  it('moves the pair to Verified and keeps fillPrice 0', () => {
    const { sim, pairId } = setup();
    const l = sim.verifySellerSide(sellerArgs(pairId));
    const pair = l.pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Verified);
    expect(pair.fillPrice).toBe(0n);
  });

  it('accepts an offer equal to sellerMin', () => {
    const { sim, pairId } = setup(SELLER_MIN);
    const l = sim.verifySellerSide(sellerArgs(pairId, SELLER_MIN));
    expect(l.pairs.lookup(pairId).status).toBe(PairStatus.Verified);
  });

  it('rejects an unknown pair', () => {
    const { sim } = setup();
    expect(() => sim.verifySellerSide(sellerArgs(new Uint8Array(32)))).toThrow(/pair missing/);
  });

  it('rejects a pair that is already Verified', () => {
    const { sim, pairId } = setup();
    sim.verifySellerSide(sellerArgs(pairId));
    expect(() => sim.verifySellerSide(sellerArgs(pairId))).toThrow(/pair is not in Offered state/);
  });

  it('rejects a caller that does not own the seller intent', () => {
    const { sim, pairId } = setup();
    expect(() => sim.as(OTHER_KEY).verifySellerSide(sellerArgs(pairId))).toThrow(/caller is not the seller/);
    expect(() => sim.as(BUYER_KEY).verifySellerSide(sellerArgs(pairId))).toThrow(/caller is not the seller/);
  });

  it('rejects when sellerMin or sellerSalt does not open the seller commitment', () => {
    const { sim, pairId } = setup();
    expect(() => sim.verifySellerSide({ ...sellerArgs(pairId), sellerMin: SELLER_MIN - 1n }))
      .toThrow(/seller range does not open/);
    expect(() => sim.verifySellerSide({ ...sellerArgs(pairId), sellerSalt: BUYER_SALT }))
      .toThrow(/seller range does not open/);
  });

  it('rejects when the offer or offerSalt does not open the offer commitment', () => {
    const { sim, pairId } = setup();
    expect(() => sim.verifySellerSide({ ...sellerArgs(pairId), offer: OFFER_HIT + 1n }))
      .toThrow(/offer does not open/);
    expect(() => sim.verifySellerSide({ ...sellerArgs(pairId), offerSalt: BUYER_SALT }))
      .toThrow(/offer does not open/);
  });

  it('cannot be proven when the offer is below sellerMin, and the ledger stays Offered', () => {
    const { sim, pairId } = setup(OFFER_LOW);
    expect(() => sim.verifySellerSide(sellerArgs(pairId, OFFER_LOW))).toThrow(/offer below seller limit/);
    const pair = sim.ledger().pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Offered);
    expect(pair.fillPrice).toBe(0n);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon/contract
npm test -- verifySellerSide
```

Expected: FAIL, `verifySellerSide` is not a function.

- [ ] **Step 3: Add the circuit**

Append to `contract/src/intent.compact`:

```compact
export circuit verifySellerSide(
  pairId: Bytes<32>,
  sellerMin: Uint<64>,
  sellerSalt: Bytes<32>,
  offer: Uint<64>,
  offerSalt: Bytes<32>
): [] {
  const id = disclose(pairId);
  assert(pairs.member(id), "pair missing");
  const pair = pairs.lookup(id);
  assert(pair.status == PairStatus.Offered, "pair is not in Offered state");

  const seller = ranges.lookup(pair.sellerIntentId);
  assert(ownPublicKey().bytes == seller.owner, "caller is not the seller");
  assert(persistentCommit<Uint<64>>(sellerMin, sellerSalt) == seller.commitment, "seller range does not open");
  assert(persistentCommit<Uint<64>>(offer, offerSalt) == pair.offerCommit, "offer does not open");
  assert(offer >= sellerMin, "offer below seller limit");

  pairs.insert(id, PairRecord {
    buyerIntentId: pair.buyerIntentId,
    sellerIntentId: pair.sellerIntentId,
    offerCommit: pair.offerCommit,
    status: PairStatus.Verified,
    fillPrice: 0
  });
}
```

- [ ] **Step 4: Add the simulator method**

In `contract/src/test/simulator.ts`, add next to `OfferArgs` and after `commitOffer`:

```ts
export type SellerArgs = {
  pairId: Uint8Array;
  sellerMin: bigint;
  sellerSalt: Uint8Array;
  offer: bigint;
  offerSalt: Uint8Array;
};
```

```ts
  verifySellerSide(p: SellerArgs): Ledger {
    this.ctx = this.contract.impureCircuits.verifySellerSide(
      this.ctx,
      p.pairId,
      p.sellerMin,
      p.sellerSalt,
      p.offer,
      p.offerSalt,
    ).context;
    return this.ledger();
  }
```

- [ ] **Step 5: Run to verify it passes**

```bash
npm test -- verifySellerSide
```

Expected: `8 passed`.

- [ ] **Step 6: Commit**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
git add contract/src/intent.compact contract/src/test/simulator.ts contract/src/test/verifySellerSide.test.ts
git commit -m "Add verifySellerSide circuit for the seller half proof"
```

---

### Task 5: `openOffer`

**Files:**
- Modify: `contract/src/intent.compact`
- Modify: `contract/src/test/simulator.ts`
- Create: `contract/src/test/openOffer.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: Compact `export circuit openOffer(pairId: Bytes<32>, offer: Uint<64>, offerSalt: Bytes<32>): []`.
- Produces: `IntentSimulator.openOffer(p: OpenArgs): Ledger` where `OpenArgs = { pairId: Uint8Array; offer: bigint; offerSalt: Uint8Array }`.

- [ ] **Step 1: Write the failing tests**

Create `contract/src/test/openOffer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PairStatus } from '../managed/intent/contract/index.cjs';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_SALT,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  sellerRange,
} from './fixtures.js';

type Setup = { sim: IntentSimulator; pairId: Uint8Array };

const offered = (): Setup => {
  const sim = new IntentSimulator(BUYER_KEY);
  sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
  sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
  sim.as(BUYER_KEY).commitOffer({
    buyerIntentId: BUYER_INTENT,
    sellerIntentId: SELLER_INTENT,
    buyerMax: BUYER_MAX,
    buyerSalt: BUYER_SALT,
    offer: OFFER_HIT,
    offerSalt: OFFER_SALT,
  });
  return { sim, pairId: sim.pairIdOf(BUYER_INTENT, SELLER_INTENT) };
};

const verified = (): Setup => {
  const s = offered();
  s.sim.as(SELLER_KEY).verifySellerSide({
    pairId: s.pairId,
    sellerMin: SELLER_MIN,
    sellerSalt: SELLER_SALT,
    offer: OFFER_HIT,
    offerSalt: OFFER_SALT,
  });
  return s;
};

describe('openOffer', () => {
  it('buyer opens a Verified pair and the fill price becomes public', () => {
    const { sim, pairId } = verified();
    const l = sim.as(BUYER_KEY).openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });
    const pair = l.pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Opened);
    expect(pair.fillPrice).toBe(OFFER_HIT);
  });

  it('seller can open too', () => {
    const { sim, pairId } = verified();
    const l = sim.as(SELLER_KEY).openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });
    expect(l.pairs.lookup(pairId).fillPrice).toBe(OFFER_HIT);
  });

  it('rejects an unknown pair', () => {
    const { sim } = verified();
    expect(() => sim.openOffer({ pairId: new Uint8Array(32), offer: OFFER_HIT, offerSalt: OFFER_SALT }))
      .toThrow(/pair missing/);
  });

  it('rejects opening a pair that is only Offered', () => {
    const { sim, pairId } = offered();
    expect(() => sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT }))
      .toThrow(/pair is not verified/);
  });

  it('rejects opening twice', () => {
    const { sim, pairId } = verified();
    sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });
    expect(() => sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT }))
      .toThrow(/pair is not verified/);
  });

  it('rejects a price that does not open the offer commitment', () => {
    const { sim, pairId } = verified();
    expect(() => sim.openOffer({ pairId, offer: 950_000n, offerSalt: OFFER_SALT })).toThrow(/offer does not open/);
    expect(() => sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: BUYER_SALT })).toThrow(/offer does not open/);
    expect(sim.ledger().pairs.lookup(pairId).fillPrice).toBe(0n);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon/contract
npm test -- openOffer
```

Expected: FAIL, `openOffer` is not a function.

- [ ] **Step 3: Add the circuit**

Append to `contract/src/intent.compact`:

```compact
export circuit openOffer(
  pairId: Bytes<32>,
  offer: Uint<64>,
  offerSalt: Bytes<32>
): [] {
  const id = disclose(pairId);
  assert(pairs.member(id), "pair missing");
  const pair = pairs.lookup(id);
  assert(pair.status == PairStatus.Verified, "pair is not verified");
  assert(persistentCommit<Uint<64>>(offer, offerSalt) == pair.offerCommit, "offer does not open");

  pairs.insert(id, PairRecord {
    buyerIntentId: pair.buyerIntentId,
    sellerIntentId: pair.sellerIntentId,
    offerCommit: pair.offerCommit,
    status: PairStatus.Opened,
    fillPrice: disclose(offer)
  });
}
```

This is the only `disclose` of a price in the file.

- [ ] **Step 4: Add the simulator method**

In `contract/src/test/simulator.ts`, add next to `SellerArgs` and after `verifySellerSide`:

```ts
export type OpenArgs = {
  pairId: Uint8Array;
  offer: bigint;
  offerSalt: Uint8Array;
};
```

```ts
  openOffer(p: OpenArgs): Ledger {
    this.ctx = this.contract.impureCircuits.openOffer(
      this.ctx,
      p.pairId,
      p.offer,
      p.offerSalt,
    ).context;
    return this.ledger();
  }
```

- [ ] **Step 5: Run to verify it passes**

```bash
npm test -- openOffer
```

Expected: `6 passed`.

- [ ] **Step 6: Audit disclose calls**

```bash
grep -n "disclose(" src/intent.compact
```

Expected: hits only on `pairIdOf` return, `intentId`, `ownerKey`, `owner`, `role`, `itemId`, `quantity`, `currency`, `version`, `buyerIntentId`, `sellerIntentId`, `pairId`, and `fillPrice: disclose(offer)` in `openOffer`. Any `disclose(limit`, `disclose(buyerMax`, `disclose(sellerMin`, `disclose(salt`, `disclose(offerSalt`, or `disclose(offer)` outside `openOffer` is a bug. Fix before committing.

- [ ] **Step 7: Commit**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
git add contract/src/intent.compact contract/src/test/simulator.ts contract/src/test/openOffer.test.ts
git commit -m "Add openOffer circuit that publishes the fill price after verification"
```

---

### Task 6: Spec section 13 fixtures end to end, privacy check

**Files:**
- Create: `contract/src/test/fixtures.test.ts`

**Interfaces:**
- Consumes: the full `IntentSimulator`.

- [ ] **Step 1: Write the tests**

Create `contract/src/test/fixtures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { type Ledger, PairStatus } from '../managed/intent/contract/index.cjs';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_MAX_NO_OVERLAP,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_LOW,
  OFFER_SALT,
  OFFER_TOO_HIGH,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  sellerRange,
} from './fixtures.js';

// Flatten every ledger row into one string so a price can be searched for.
const ledgerText = (l: Ledger): string => {
  const rows: unknown[] = [];
  for (const [k, v] of l.ranges) rows.push([k, v]);
  for (const k of l.ownerItems) rows.push(k);
  for (const [k, v] of l.pairs) rows.push([k, v]);
  return JSON.stringify(rows, (_key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
    return value;
  });
};

const withRanges = (buyerMax: bigint): IntentSimulator => {
  const sim = new IntentSimulator(BUYER_KEY);
  sim.commitRange({ ...buyerRange, limit: buyerMax, salt: BUYER_SALT });
  sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
  return sim.as(BUYER_KEY);
};

const buyerOffer = (offer: bigint, buyerMax: bigint = BUYER_MAX) => ({
  buyerIntentId: BUYER_INTENT,
  sellerIntentId: SELLER_INTENT,
  buyerMax,
  buyerSalt: BUYER_SALT,
  offer,
  offerSalt: OFFER_SALT,
});

const sellerProof = (pairId: Uint8Array, offer: bigint) => ({
  pairId,
  sellerMin: SELLER_MIN,
  sellerSalt: SELLER_SALT,
  offer,
  offerSalt: OFFER_SALT,
});

describe('spec section 13 fixtures', () => {
  it('Hit: 1,000,000 / 800,000 / 900,000 opens at 900,000', () => {
    const sim = withRanges(BUYER_MAX);
    sim.commitOffer(buyerOffer(OFFER_HIT));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_HIT));
    const l = sim.as(BUYER_KEY).openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });

    const pair = l.pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Opened);
    expect(pair.fillPrice).toBe(OFFER_HIT);
  });

  it('Low offer: 750,000 stays Offered and never reaches the ledger as a number', () => {
    const sim = withRanges(BUYER_MAX);
    sim.commitOffer(buyerOffer(OFFER_LOW));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    expect(() => sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_LOW)))
      .toThrow(/offer below seller limit/);

    const l = sim.ledger();
    expect(l.pairs.lookup(pairId).status).toBe(PairStatus.Offered);
    expect(ledgerText(l)).not.toContain(OFFER_LOW.toString());
  });

  it('No overlap: 700,000 / 800,000 cannot produce a Verified pair', () => {
    const sim = withRanges(BUYER_MAX_NO_OVERLAP);

    expect(() => sim.commitOffer(buyerOffer(OFFER_TOO_HIGH, BUYER_MAX_NO_OVERLAP)))
      .toThrow(/offer above buyer limit/);

    sim.commitOffer(buyerOffer(BUYER_MAX_NO_OVERLAP, BUYER_MAX_NO_OVERLAP));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    expect(() => sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, BUYER_MAX_NO_OVERLAP)))
      .toThrow(/offer below seller limit/);
    expect(sim.ledger().pairs.lookup(pairId).status).toBe(PairStatus.Offered);
  });

  it('Re-offer: a second commitOffer for the same pair is refused', () => {
    const sim = withRanges(BUYER_MAX);
    sim.commitOffer(buyerOffer(OFFER_LOW));
    expect(() => sim.commitOffer(buyerOffer(OFFER_HIT))).toThrow(/pair already has an offer/);
  });

  it('Tamper: a limit that does not open C_seller, or a price that does not open C_offer, is refused', () => {
    const sim = withRanges(BUYER_MAX);
    sim.commitOffer(buyerOffer(OFFER_HIT));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);

    expect(() => sim.as(SELLER_KEY).verifySellerSide({ ...sellerProof(pairId, OFFER_HIT), sellerMin: 700_000n }))
      .toThrow(/seller range does not open/);

    sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_HIT));
    expect(() => sim.openOffer({ pairId, offer: 950_000n, offerSalt: OFFER_SALT })).toThrow(/offer does not open/);
    expect(sim.ledger().pairs.lookup(pairId).fillPrice).toBe(0n);
  });

  it('Privacy: limits never appear on the ledger, the offer only after open', () => {
    const sim = withRanges(BUYER_MAX);
    const afterRanges = ledgerText(sim.ledger());
    expect(afterRanges).not.toContain(BUYER_MAX.toString());
    expect(afterRanges).not.toContain(SELLER_MIN.toString());

    sim.commitOffer(buyerOffer(OFFER_HIT));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_HIT));
    const beforeOpen = ledgerText(sim.ledger());
    expect(beforeOpen).not.toContain(OFFER_HIT.toString());
    expect(beforeOpen).not.toContain(BUYER_MAX.toString());
    expect(beforeOpen).not.toContain(SELLER_MIN.toString());

    sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });
    const afterOpen = ledgerText(sim.ledger());
    expect(afterOpen).toContain(OFFER_HIT.toString());
    expect(afterOpen).not.toContain(BUYER_MAX.toString());
    expect(afterOpen).not.toContain(SELLER_MIN.toString());
  });
});
```

- [ ] **Step 2: Run the whole suite**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon/contract
npm test
```

Expected: all files pass. Count: 2 + 8 + 12 + 8 + 6 + 6 = `42 passed`.

If the `Privacy` test fails because `ledgerText` cannot iterate a map, check the generated `index.d.cts` for the iterator on `ranges` and `pairs`. The Ledger ADT docs say `[Symbol.iterator]` is callable from TypeScript. If it is exposed under a different name (for example `entries()`), use that name in `ledgerText` only.

- [ ] **Step 3: Commit**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
git add contract/src/test/fixtures.test.ts
git commit -m "Cover spec fixtures end to end including ledger privacy check"
```

---

### Task 7: CI, README, pull request

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Install the Compact toolchain in CI**

In `.github/workflows/ci.yml`, inside the `check` job, insert two steps between `uses: actions/setup-node@v7` and `name: Env templates present`. Replace `COMPACT_BIN_DIR` with the directory recorded in Task 1 Step 1, expressed relative to `$HOME` (for example `$HOME/.compact/bin`):

```yaml
      - name: Install Compact toolchain
        run: |
          curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
          echo "COMPACT_BIN_DIR" >> "$GITHUB_PATH"
      - name: Compact update
        run: |
          compact update
          compact compile --language-version
          compact compile --runtime-version
```

The `check` job then reads, in order: checkout, setup-node, Install Compact toolchain, Compact update, Env templates present, Install and test. Nothing else in the file changes.

- [ ] **Step 2: Add the contract section to README**

Append to `README.md` after the `## Branch rules` section and before `## Docs`:

````markdown
## Contract

The Compact contract lives in `contract/`. Spec: `docs/superpowers/specs/2026-09-18-intent-compact.md`.

```bash
# once: Compact developer tool, then the latest toolchain
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update

npm install
npm test            # compiles with --skip-zk and runs the simulator tests
```

`contract/src/managed/` is generated and gitignored. Run `npm run compact:zk --workspace contract` only when you need proving keys for a deployment.
````

- [ ] **Step 3: Run the full check locally the way CI does**

```bash
cd /Users/gjowehgqh/Documents/GitHub/midnight_hackathon
rm -rf node_modules contract/node_modules contract/src/managed
npm ci
npm test
```

Expected: `42 passed`.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "Run contract tests in CI and document the contract package"
git push -u origin feat/intent-contract
```

- [ ] **Step 5: Open the PR into dev**

```bash
gh pr create --base dev --head feat/intent-contract \
  --title "Intent contract: commitRange, commitOffer, verifySellerSide, openOffer" \
  --body "$(cat <<'EOF'
## Summary

Compact implementation of `docs/superpowers/specs/2026-09-18-intent-compact.md` (agreed in Discussion #10).

- `commitRange`: per-user range commitment, one per wallet per item.
- `commitOffer`: buyer commits one offer and proves `offer <= buyerMax`. One offer per pair.
- `verifySellerSide`: seller proves `offer >= sellerMin` against the same offer commitment.
- `openOffer`: publishes the fill price only after both halves passed.
- `pairIdOf`: pure helper for deriving `pairId` off-chain.

Simulator tests cover every assert and the spec section 13 fixtures, including a check that no limit and no pre-open offer ever appears in ledger data.

CI installs the Compact toolchain and runs the suite with `--skip-zk`.

## Test plan

- [x] Local `.env` is copied from an `*.example` file (no secrets in the diff)
- [x] Compiles / type-checks if this PR touches code (`npm test`, `npm run typecheck`)
- [ ] Demo path still works if this PR touches the product (no product path yet)
EOF
)"
```

- [ ] **Step 6: Watch CI**

```bash
gh pr checks --watch
```

Expected: `check` and `branch-policy` pass. If `Install Compact toolchain` fails on the PATH line, read the installer output in the job log for the actual install directory and fix `COMPACT_BIN_DIR` in Step 1.

---

## Out of this plan (next plans)

- Deploy to the local `undeployed` network and to `preview` with Midnight.js providers, wallet seed from `.env`, `compact:zk` keys.
- Backend indexer that reads `ranges` and `pairs` and maps them to the API statuses in spec section 12.
- Phase 2 items from spec section 15: deposit, on-chain `release`, band discovery, seller-initiated offers.

## Self-review against the spec

- Section 2 (agreed points): Tasks 2 to 6. Privacy: Task 5 Step 6 audit and Task 6 privacy test.
- Section 3 (four circuits, buyer half inside `commitOffer`): Task 3.
- Section 5 (types): Task 1 Step 6. `owner` as `Bytes<32>`, `pairIdOf` helper.
- Section 6 (ledger): Task 1 Step 6.
- Section 7 `commitRange`: Task 2. All four asserts and both writes.
- Section 8 `commitOffer`: Task 3. All asserts in spec order.
- Section 9 `verifySellerSide`: Task 4.
- Section 10 `openOffer`: Task 5.
- Section 11 rules: rows 1 to 4 tested in Tasks 2, 3, 6. Row 5 (deposit) is Phase 2, listed out of plan.
- Section 12 status mapping: ledger conditions are observable through `Ledger`; the mapping itself is backend work, out of plan.
- Section 13 fixtures: Task 6, one test per bullet.
- Section 14 notes: toolchain pin in Task 1, `disclose` audit in Task 5.
