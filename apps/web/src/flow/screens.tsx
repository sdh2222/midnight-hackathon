import type { FormEvent, ReactNode } from "react";
import type { ExecutionHistoryRecord, RankedOffer, SearchResponse } from "@midnight-hackathon/shared";
import type { LockedIntent } from "../midnight";
import { offerFit, type Fit } from "./fit";
import { FIT_WORD, SORT_WORD, STATUS_WORD, compactHash, number, seconds, won } from "./format";

export const STEPS = [
  { id: "onboard", label: "Onboard" },
  { id: "input", label: "Input" },
  { id: "sort", label: "Sort" },
  { id: "verify", label: "Verify" },
  { id: "list", label: "List" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
export type PageId = StepId | "history";

export type IntentForm = {
  item: string;
  quantity: string;
  unit: string;
  destinationCountry: string;
  keywords: string;
  requiredBy: string;
  priceMaxKrw: string;
};

function Window({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="window">
      <div className="titlebar">{title}</div>
      <div className="window-body">{children}</div>
    </section>
  );
}

export function Shell({
  page,
  canOpen,
  onStep,
  onHistory,
  onLogout,
  userLabel,
  walletAddress,
  children,
}: {
  page: PageId;
  canOpen: Record<StepId, boolean>;
  onStep: (step: StepId) => void;
  onHistory: () => void;
  onLogout: () => void;
  userLabel: string;
  walletAddress: string | null;
  children: ReactNode;
}) {
  return (
    <div className="desk">
      <header className="bar">
        <a className="wordmark" href="#onboard" onClick={(event) => { event.preventDefault(); onStep("onboard"); }}>
          <span>buy</span><span>list</span>
        </a>
        <nav className="steps" aria-label="Buy">
          {STEPS.map((step) => {
            const current = page === step.id;
            if (!canOpen[step.id]) {
              return <span className="chip waiting" key={step.id}>{step.label}</span>;
            }
            return (
              <button
                key={step.id}
                className={current ? "chip current" : "chip"}
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => onStep(step.id)}
              >
                {step.label}
              </button>
            );
          })}
        </nav>
        <div className="account">
          <span className="chip" title={walletAddress ?? undefined}>
            {walletAddress ? compactHash(walletAddress) : "Wallet pending"}
          </span>
          <span className="chip">{userLabel}</span>
          <button className="text-link" type="button" onClick={onHistory}>Past buys</button>
          <button className="text-link" type="button" onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}

export function OnboardPage({
  walletAddress,
  walletReady,
  error,
  onContinue,
}: {
  walletAddress: string | null;
  walletReady: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  return (
    <>
      <p className="kicker">01 · Onboard</p>
      <h1>One list, instead of a spreadsheet.</h1>
      <p className="lede">
        Searching each supplier and pasting rows into a sheet is the slow part.
        You enter one buy. Jev sorts the offers. Midnight checks that the row you keep fits your cap.
      </p>
      <Window title="What happens next">
        <ol className="plain-list">
          <li>Input the buy. The cap stays in this browser.</li>
          <li>Jev turns that buy into a search and returns a sorted list.</li>
          <li>The mapper checks the row you keep.</li>
          <li>You leave with that same list, and one row marked kept.</li>
        </ol>
      </Window>
      <Window title="Midnight wallet">
        <p className="mono" title={walletAddress ?? undefined}>
          {walletAddress ?? "Preparing the wallet for this account."}
        </p>
        <p className="fine">This address is created for your login. You do not paste a seed.</p>
      </Window>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      <div className="actions">
        <button className="ink" type="button" disabled={!walletReady || !walletAddress} onClick={onContinue}>
          Continue
        </button>
      </div>
    </>
  );
}

export function InputPage({
  form,
  locked,
  searching,
  phase,
  error,
  onChange,
  onSubmit,
}: {
  form: IntentForm;
  locked: boolean;
  searching: boolean;
  phase: "idle" | "commit-range" | "search";
  error: string | null;
  onChange: (field: keyof IntentForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const button = searching
    ? (phase === "search" ? "Jev is sorting" : "Locking the cap")
    : "Sort offers";
  return (
    <>
      <p className="kicker">02 · Input</p>
      <h1>Enter the buy.</h1>
      <p className="lede">Public fields go to the search. The cap does not.</p>
      <form onSubmit={onSubmit}>
        <Window title="This buy">
          <div className="fields">
            <label>
              Item
              <input value={form.item} onChange={(event) => onChange("item", event.target.value)} disabled={locked} required />
            </label>
            <div className="split">
              <label>
                Quantity
                <input type="number" min="1" value={form.quantity} onChange={(event) => onChange("quantity", event.target.value)} disabled={locked} required />
              </label>
              <label>
                Unit
                <select value={form.unit} onChange={(event) => onChange("unit", event.target.value)} disabled={locked}>
                  <option value="piece">piece</option>
                  <option value="pair">pair</option>
                  <option value="box">box</option>
                  <option value="kg">kg</option>
                </select>
              </label>
              <label>
                Ship to
                <select value={form.destinationCountry} onChange={(event) => onChange("destinationCountry", event.target.value)} disabled={locked}>
                  <option value="KR">Korea</option>
                  <option value="US">United States</option>
                  <option value="JP">Japan</option>
                  <option value="SG">Singapore</option>
                </select>
              </label>
            </div>
            <div className="split">
              <label>
                Keywords
                <input value={form.keywords} onChange={(event) => onChange("keywords", event.target.value)} disabled={locked} required />
              </label>
              <label>
                Needed by
                <input type="date" value={form.requiredBy} onChange={(event) => onChange("requiredBy", event.target.value)} disabled={locked} />
              </label>
            </div>
          </div>
        </Window>
        <Window title="Cap">
          <label>
            Maximum budget, KRW
            <input
              aria-label="Maximum budget in KRW"
              type="number"
              min="1"
              value={form.priceMaxKrw}
              onChange={(event) => onChange("priceMaxKrw", event.target.value)}
              disabled={locked}
            />
          </label>
          <p className="fine">Stays in this browser. Jev does not receive it.</p>
        </Window>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <div className="actions">
          <button className="ink" type="submit" disabled={searching}>{button}</button>
        </div>
      </form>
    </>
  );
}

function OfferRows({
  offers,
  capKrw,
  requiredBy,
  selectedId,
  keptId,
  onSelect,
}: {
  offers: readonly RankedOffer[];
  capKrw: number;
  requiredBy: string;
  selectedId: string | null;
  keptId?: string;
  onSelect?: (offerId: string) => void;
}) {
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Offer</th>
          <th>Total</th>
          <th>Lead</th>
          <th>Fit</th>
        </tr>
      </thead>
      <tbody>
        {offers.map((ranked, index) => {
          const fit = offerFit(ranked.offer, capKrw, requiredBy);
          const selected = selectedId === ranked.offer.offerId;
          const kept = keptId === ranked.offer.offerId;
          return (
            <tr
              key={ranked.offer.offerId}
              className={selected ? "selected pick" : onSelect ? "pick" : undefined}
              role={onSelect ? "button" : undefined}
              aria-pressed={onSelect ? selected : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={onSelect ? () => onSelect(ranked.offer.offerId) : undefined}
              onKeyDown={onSelect ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(ranked.offer.offerId);
                }
              } : undefined}
            >
              <td>{index + 1}</td>
              <td>
                <strong>{ranked.offer.title}</strong>
                <span className="fine">
                  {ranked.offer.supplierName ?? ranked.offer.supplierId}
                  {kept ? " · Kept" : ""}
                </span>
              </td>
              <td className="num">{won(ranked.offer.convertedTotalKrw)}</td>
              <td className="num">{ranked.offer.leadTimeDays === undefined ? "—" : `${ranked.offer.leadTimeDays}d`}</td>
              <td>{kept ? "Kept" : FIT_WORD[fit]}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function SortPage({
  result,
  capKrw,
  requiredBy,
  selectedId,
  elapsedMs,
  locked,
  onSelect,
  onEdit,
  onVerify,
}: {
  result: SearchResponse;
  capKrw: number;
  requiredBy: string;
  selectedId: string | null;
  elapsedMs: number | null;
  locked: LockedIntent | null;
  onSelect: (offerId: string) => void;
  onEdit: () => void;
  onVerify: () => void;
}) {
  const fits = result.offers.filter((ranked) => offerFit(ranked.offer, capKrw, requiredBy) === "fits").length;
  const selected = result.offers.find((ranked) => ranked.offer.offerId === selectedId) ?? null;
  const selectedFit: Fit | null = selected ? offerFit(selected.offer, capKrw, requiredBy) : null;
  return (
    <>
      <p className="kicker">03 · Sort</p>
      <h1>Jev sorted this buy.</h1>
      <p className="lede">{result.plan.query} · {SORT_WORD[result.plan.sort] ?? result.plan.sort}</p>
      <div className="stats">
        <div><span>Offers</span><strong>{result.offers.length}</strong></div>
        <div><span>Within cap</span><strong>{fits}</strong></div>
        <div><span>Sort time</span><strong>{elapsedMs == null ? "—" : seconds(elapsedMs)}</strong></div>
      </div>
      <Window title="Jev">
        {result.offers.length === 0 ? (
          <p>No offers came back. Edit the buy and sort again.</p>
        ) : (
          <OfferRows
            offers={result.offers}
            capKrw={capKrw}
            requiredBy={requiredBy}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
      </Window>
      {locked ? <p className="fine">Cap locked · {compactHash(locked.commitRangeTransactionId)}</p> : null}
      {selectedFit && selectedFit !== "fits" ? (
        <p className="alert">{FIT_WORD[selectedFit]}. Pick a row that fits before verifying.</p>
      ) : null}
      <div className="actions">
        <button className="text-link" type="button" onClick={onEdit}>Edit the buy</button>
        <button className="ink" type="button" disabled={selectedFit !== "fits"} onClick={onVerify}>
          Verify this row
        </button>
      </div>
    </>
  );
}

export function VerifyPage({
  ranked,
  capKrw,
  requiredBy,
  rangeId,
  confirmed,
  running,
  error,
  verifiedId,
  onConfirm,
  onCheck,
  onOpenList,
}: {
  ranked: RankedOffer;
  capKrw: number;
  requiredBy: string;
  rangeId: string;
  confirmed: boolean;
  running: boolean;
  error: string | null;
  verifiedId: string | null;
  onConfirm: (value: boolean) => void;
  onCheck: () => void;
  onOpenList: () => void;
}) {
  const fit = offerFit(ranked.offer, capKrw, requiredBy);
  return (
    <>
      <p className="kicker">04 · Verify</p>
      <h1>Check that this row fits.</h1>
      <p className="lede">The mapper compares the offer with the cap locked on the previous pages. The cap is not sent to Jev.</p>
      <Window title="Mapper">
        <dl className="pairs">
          <div><dt>Offer</dt><dd>{ranked.offer.title}</dd></div>
          <div><dt>Supplier</dt><dd>{ranked.offer.supplierName ?? ranked.offer.supplierId}</dd></div>
          <div><dt>Total</dt><dd>{won(ranked.offer.convertedTotalKrw)}</dd></div>
          <div><dt>Cap</dt><dd>{won(capKrw)}</dd></div>
          <div><dt>Local fit</dt><dd>{FIT_WORD[fit]}{requiredBy ? ` · needed by ${requiredBy}` : ""}</dd></div>
          <div><dt>commitRange</dt><dd className="mono" title={rangeId}>{compactHash(rangeId)}</dd></div>
          {verifiedId ? <div><dt>commitVerify</dt><dd className="mono" title={verifiedId}>{compactHash(verifiedId)}</dd></div> : null}
        </dl>
      </Window>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      <div className="actions">
        {verifiedId ? (
          <button className="ink" type="button" onClick={onOpenList}>Open the list</button>
        ) : (
          <>
            <label className="check">
              <input type="checkbox" checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} />
              <span>I accept this supplier, total, and date.</span>
            </label>
            <button className="ink" type="button" disabled={!confirmed || running || fit !== "fits"} onClick={onCheck}>
              {running ? "Checking the fit" : "Check the fit"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

export function ListPage({
  result,
  capKrw,
  requiredBy,
  keptId,
  elapsedMs,
  orderNote,
  onNew,
  onHistory,
}: {
  result: SearchResponse;
  capKrw: number;
  requiredBy: string;
  keptId: string;
  elapsedMs: number | null;
  orderNote: string;
  onNew: () => void;
  onHistory: () => void;
}) {
  const fits = result.offers.filter((ranked) => offerFit(ranked.offer, capKrw, requiredBy) === "fits").length;
  return (
    <>
      <p className="kicker">05 · List</p>
      <h1>The sorted list, with one row kept.</h1>
      <p className="lede">{orderNote}</p>
      <div className="stats">
        <div><span>Offers</span><strong>{result.offers.length}</strong></div>
        <div><span>Within cap</span><strong>{fits}</strong></div>
        <div><span>Sort time</span><strong>{elapsedMs == null ? "—" : seconds(elapsedMs)}</strong></div>
      </div>
      <Window title="Final">
        <OfferRows
          offers={result.offers}
          capKrw={capKrw}
          requiredBy={requiredBy}
          selectedId={keptId}
          keptId={keptId}
        />
      </Window>
      <div className="actions">
        <button className="text-link" type="button" onClick={onHistory}>Past buys</button>
        <button className="ink" type="button" onClick={onNew}>New buy</button>
      </div>
    </>
  );
}

export function HistoryPage({
  loading,
  error,
  actionError,
  records,
  retryingId,
  onRetryLoad,
  onRetryOrder,
  onNew,
}: {
  loading: boolean;
  error: string | null;
  actionError: string | null;
  records: readonly ExecutionHistoryRecord[];
  retryingId: string | null;
  onRetryLoad: () => void;
  onRetryOrder: (record: ExecutionHistoryRecord) => void;
  onNew: () => void;
}) {
  return (
    <>
      <p className="kicker">Past buys</p>
      <h1>Orders from checked rows.</h1>
      <p className="lede">These are the existing order records. A new buy starts the five pages again.</p>
      {loading ? <p>Loading past buys.</p> : null}
      {error ? (
        <p className="alert" role="alert">
          {error} <button className="text-link" type="button" onClick={onRetryLoad}>Try again</button>
        </p>
      ) : null}
      {actionError ? <p className="alert" role="alert">{actionError}</p> : null}
      {!loading && !error && records.length === 0 ? <p>No checked buy has been saved yet.</p> : null}
      {records.map((record) => (
        <Window title={record.offer.title} key={record.executionId}>
          <dl className="pairs">
            <div><dt>Status</dt><dd>{STATUS_WORD[record.status] ?? record.status}</dd></div>
            <div><dt>Total</dt><dd>{won(record.offer.convertedTotalKrw)}</dd></div>
            <div><dt>Quantity</dt><dd>{number(record.offer.quantity)} {record.offer.unit}</dd></div>
            <div><dt>commitVerify</dt><dd className="mono" title={record.commitVerifyTransactionId}>{compactHash(record.commitVerifyTransactionId)}</dd></div>
          </dl>
          {record.status === "failed" ? (
            <button className="text-link" type="button" disabled={retryingId === record.executionId} onClick={() => onRetryOrder(record)}>
              {retryingId === record.executionId ? "Trying again" : "Try the order again"}
            </button>
          ) : null}
        </Window>
      ))}
      <div className="actions">
        <button className="ink" type="button" onClick={onNew}>New buy</button>
      </div>
    </>
  );
}
