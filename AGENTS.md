# Sourcenight — agent prompt

Midnight Korea Hackathon 2026. Submission deadline: 2026-09-28 00:00 KST.

You are a coding agent on this repo. Read this file before any other spec.

## Product

**Sourcenight** is a private B2B buy desk for Korean SMEs (소상공인).

One sentence: the buyer types what they need and a private KRW cap. The cap never leaves the browser. AI searches suppliers on public fields only. Midnight proves `offer ≤ cap`. The purchase order stores the public quote and the Verified tx hash — not the budget, not the salt, not the wallet seed.

## Repo map (do not get this wrong)

| Ref | What it is | Use it? |
|---|---|---|
| `dev` | Real product: Compact + API + web + order machine | **Always branch from here. PR base is `dev`.** |
| `main` | Frozen 2026-09-08 **Caplock** carbon-intensity docs | **Not the product. Do not implement. Do not cite as current.** |
| `docs/superpowers/specs/2026-09-08-caplock-*.md` | History | Ignore for implementation |
| `docs/superpowers/specs/2026-09-21-marketplace-local-verify.md` | Flow SSOT | Yes |
| `docs/superpowers/specs/2026-09-18-intent-compact.md` | Compact interface (marketplace amend) | Yes |
| `contract/src/intent.compact` | Implementation. Wins if it disagrees with the spec | Yes |
| `packages/shared/src/schemas/intent.ts` | Public / private split | Yes |
| `docs/product/hackathon-prompt.md` | Judge blurb + `main` merge checklist | Yes |
| `docs/product/procurement-flow.md` | Page order (may live on newer UI branches) | Yes if present |

Open PRs that may be ahead of `dev`: Privy/Reef search, server wallets, pink-buy-flow (Sourcenight desk UI). Circuits and schemas: trust `dev`. Newest desk copy: those branches.

## Forbidden

- Treat `main` or Caplock (`E`, `P`, `band_id`, K-ETS, NGMS, plant/bank ladder) as the current product.
- Implement the old A2A four-circuit pair: `commitOffer`, `verifySellerSide`, `openOffer`, seller `commitRange`.
- Put `priceMax`, salt, original wallet address, or Midnight seed in an API body, search request, `executions.json`, or the UI as plaintext.
- Send a real order to Alibaba. `OrderAdapter` is mock.
- Submit a funded Midnight tx from the server seed. New wallets have no Night/Dust. Demo / local prover only.
- Build a second Jev ranker. Use the existing `POST /v1/searches`.
- Division, strings, or `Opaque` inside Compact commitments. Amounts are KRW integers.

## Midnight (two circuits only)

1. `commitRange` — seal the envelope **before** search.
   `C = hash(tag=1, priceMax, sourceId, dateMax, salt)`
2. `commitVerify` — re-hash the same preimage, assert the chosen offer fits, write `C_offer`, `status = Verified`.

A failed check is an `assert`: tx reverts, `C` unchanged. First success binds that `intentId`. T0 is not a search key. The search agent never sees the preimage. Do not rewrite the cap after quotes are visible.

String IDs: SHA-256 → `Bytes<32>` before every circuit call. Commitments: `pureCircuits.rangeCommitment` / `pureCircuits.offerCommitment` only.

## Purchase order — public vs private

**Public** (search, ledger, saved 발주서 OK)

- `item`, `quantity`, `unit`, `destinationCountry`, `keywords`, `requiredBy`
- `intentId` / `itemId` hashes, `currency = KRW`, `version`, `owner` public key
- `C`, `C_offer`, `Verified`
- Public quote: supplier, qty, unit price, total, lead time, delivery
- `commitRange` / `commitVerify` tx hashes, mock `providerOrderId`

**Private** (browser / local verifier only)

- `priceMax` / `priceMaxKrw`
- `sourceId`, `dateMax` (zero = unconstrained)
- `salt`, `offerSalt`
- `offerPrice`, `offerSource`, `offerDate` as circuit witness (not ledger plaintext)
- Original wallet address, Midnight seed

The 발주서 does **not** disclose fill price. It stamps the Verified tx hash.

## Pages (one decision per page)

`Sign in (Privy)` → `Onboard` → `Input` → `Sort` → `Verify` → `List`

Past buys is a side list, not a sixth step. Input's "Sort offers" locks `commitRange` then searches. Budget and salt are not in the search body.

## Demo fixtures (KRW)

- Hit: lock `1,500,000`, offer `1,200,000` → Verified + `C_offer`
- Over cap: same lock, `1,800,000` → revert, `C` stays
- Wrong preimage / other wallet / second verify → revert
- A ledger read must never contain `priceMax`, salts, or offer plaintext

## Judge sentence

What we reveal: item, qty, destination, public quote, Verified hash.  
What we hide: max budget, source/date constraints, salt, seed.  
Midnight is why the search hub is allowed to exist without holding the cap.

## How to work

```bash
git fetch origin dev
git checkout -b <branch> origin/dev
# PR base = dev, not main
npm test
npm run build
```

Copy env from `*.example`. Do not commit secrets.
