# Procurement flow

This is the reference for the pages, the buttons, and where each one goes.
The name is Sourcenight. Pages follow the production desk at `https://desk-swart.vercel.app/`: a white page, 12 px cards, a compact table, an ink primary button, and underlined page links. The UI face is Die Grotesk C. The wordmark is Lisa Terminal, with `source` in water blue. The wallet pill is the same sky blue as that desk. One primary action per page. A page description says what is public, what stays in the browser, and what the button does, in the same register as that desk’s explanations. Tables carry the offer fields: supplier, quantity, unit price, total, lead, delivery, and score.

Jev ranking is the existing search API. This flow does not add a second ranker.
The cap check is the existing `commitRange` / `commitVerify` mapper. In demo mode that mapper runs on the local prover.

## Why these pages exist

The time cost is searching each buy one by one and copying the rows into a sheet.
Jev does that sort in one pass. The mapper then checks that the row the buyer keeps fits the private cap.
The buyer should be able to finish one buy in about 30 seconds: one decision per page, then the next page.

## Information architecture

```
Sign in (Privy)
  └─ Onboard
       └─ Input
            └─ Sort          ← existing POST /v1/searches
                 └─ Verify   ← existing commitRange already stored, commitVerify on this page
                      └─ List
Past buys                    ← existing execution history, not a step in the buy
```

The shell shows five steps: Onboard, Input, Sort, Verify, List.
A later step is not a link until that page has data.
Past buys sits beside the account. It is not a sixth step.

| Page | Job | Primary button | Goes to |
| --- | --- | --- | --- |
| Sign in | The landing: how a buy runs, which fields leave the browser, what each column means, then Privy | Open Sourcenight | Onboard |
| Onboard | Say what the next three pages will do, and show the Midnight address | Continue | Input |
| Input | Public buy, plus a cap that stays in the browser | Sort offers | Sort, after the cap is locked and Jev returns |
| Sort | The ranked rows, already ordered by the existing search | Verify this row | Verify |
| Verify | Run the mapper on the selected row | Check the fit, then Open the list | List |
| List | The same order, with the checked row marked Kept | New buy | Input, cleared |
| Past buys | Existing order records, including retry | New buy | Input, cleared |

## What each control does

Sign in

- Continue with email or social calls Privy. There is no Lace button.
- If `VITE_PRIVY_APP_ID` is missing, the page says so and has no login button.

Onboard

- Continue is enabled once the demo prover is connected and `GET /v1/wallet` has returned an address.
- Sign out calls Privy logout.
- The address chip shows a short form of the server wallet. The full address is the tooltip. The seed is not on this page.

Input

- Fields: item, quantity, unit, destination country, keywords, needed-by date, maximum budget in KRW.
- Sort offers checks the public fields, checks the budget is a positive integer, locks the cap with the existing workflow (`commitRange`), then calls the existing search.
- The budget and the salt are not part of the search body.
- While that runs, the button reads Locking the cap, then Jev is sorting. The other fields stay as entered.
- After a lock, the public fields and the budget stay disabled until New buy. Sort offers can be pressed again to search the same lock.
- A failed search clears the lock and explains that the buyer can edit and try again.

Sort

- When the page opens, a dither plays once under the title rule. Boxes come off that line, flick through three orders, and the ones that stay drop into a stack. The table rows then settle in the API order. Reduced motion skips the play.
- Rows are `searchResult.offers` in the order the API returned. This page does not reorder them.
- A row fits when its converted total is within the cap and, if a needed-by date was set, its delivery date is on or before that date. That is the same rule the previous screen used. It is not a new score.
- Clicking a row, or pressing Enter or Space on it, selects it. The first fitting row is selected when the page opens.
- Verify this row is disabled until a fitting row is selected. An over-cap or undated row can be selected, and the button stays disabled with the reason in text.
- Edit the buy returns to Input and does not clear the lock.

Verify

- The page shows the selected supplier, the total, the private cap, and the `commitRange` id from the lock.
- The buyer checks a box that they accept this supplier, total, and date.
- Check the fit calls the existing `verifyOffer`, then stores the execution with the existing history API.
- On success the page shows `commitVerify` and the snapshot hash. Open the list goes to List.
- On failure the page stays here and offers the same button again.

List

- The window lists every returned row in the API order.
- The verified row is marked Kept. The others stay in the sort order so the buyer can see what Jev put above and below it.
- The elapsed time is the clock from Sort offers to the search response. It does not tick.
- New buy clears the form, the lock, and the selection, then opens Input.
- Past buys loads the existing history for this Privy account.

Past buys

- Rows come from the existing execution API. Status words are the existing statuses.
- A failed row has Try the order again, which calls the existing retry.
- Submitted and accepted rows keep the existing three-second sync.

## What this flow does not do

- It does not replace Jev, Reef, or the mock catalog.
- It does not submit a funded Midnight transaction from the server seed. A new wallet still has no Night or Dust. Demo mode still uses the local prover.
- It does not import a spreadsheet. One buy is one pass. A sheet of many lines is a later pass over this same flow.
