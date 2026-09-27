# Hackathon prompt and submit checklist

Copy the short blurb into the Midnight Korea form. Use `AGENTS.md` for coding agents. Merge `dev` → `main` only when you are ready to freeze the submission.

Deadline: **2026-09-28 00:00 KST**.

## Judge / form (paste)

```text
Sourcenight — private B2B buy desk for Korean SMEs.

A shopkeeper types what they need and a private KRW cap. The cap never leaves the browser: Midnight locks C = hash(priceMax, source, date, salt) before search. Jev/Reef sees only item, qty, destination, keywords. The buyer picks a row. commitVerify re-opens the same C and proves offer ≤ cap. The purchase order stores the public quote and the Verified tx hash — not the budget, not the salt, not the wallet seed.

Repo: github.com/sdh2222/midnight-hackathon
Branch to review: `dev` (not `main` until the freeze merge)
Circuits: commitRange, commitVerify
Demo: 1.5M lock / 1.2M hit / 1.8M revert
```

한국어 한 줄:

```text
소상공인이 최대 예산을 숨긴 채 발주하고, AI는 공개 품목만으로 공급처를 찾고, Midnight는 견적≤예산만 증명한다. 발주서에는 공개 견적과 Verified 트랜잭션 해시만 남는다.
```

## What is public / private on the 발주서

Public: item, quantity, unit, destination, keywords, needed-by, public quote (supplier / price / lead / delivery), `C`, `C_offer`, Verified, tx hashes.

Private: max budget (`priceMax`), source/date constraints, salt, circuit offer witness, wallet seed / original address.

## `main` is the wrong product until you merge

`main` still has **Caplock** (2026-09-08 carbon lock). The live product is **Sourcenight** on `dev` (17 commits ahead). Open draft: PR #8 (`dev` → `main`).

Do not send judges or agents to `main` before that merge.

### Freeze `main` before submit

1. Land any must-have UI/wallet PRs onto `dev` (pink-buy-flow, Privy wallet) or decide they stay out.
2. On `dev`: `npm test`, `npm run build`, one hit / over-cap demo.
3. Confirm a ledger read has no `priceMax`, salt, or offer plaintext.
4. Mark PR #8 ready, retarget if needed, merge `dev` → `main`. No force-push on `main`.
5. Submission links `main` (or the merge commit) plus this blurb.
6. After merge, new work still branches from `dev` unless you say otherwise.

## Agent one-liner

Work on `dev`. Product is Sourcenight, not Caplock. Full rules: [`AGENTS.md`](../../AGENTS.md).
