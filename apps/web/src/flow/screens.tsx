import type { CSSProperties, FormEvent, ReactNode } from "react";
import type { ExecutionHistoryRecord, RankedOffer, SearchResponse } from "@midnight-hackathon/shared";
import type { LockedIntent } from "../midnight";
import { offerFit, type Fit } from "./fit";
import { FIT_WORD, SORT_WORD, STATUS_WORD, compactHash, number, percent, seconds, won } from "./format";
import { SortMotion } from "./sort-motion";

export const STEPS = [
  { id: "onboard", label: "Onboard" },
  { id: "input", label: "Input" },
  { id: "sort", label: "Sort" },
  { id: "verify", label: "Verify" },
  { id: "list", label: "List" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
export type PageId = StepId | "history";

const COUNTRY: Record<string, string> = {
  KR: "Korea",
  US: "United States",
  JP: "Japan",
  SG: "Singapore",
};

export type IntentForm = {
  item: string;
  quantity: string;
  unit: string;
  destinationCountry: string;
  keywords: string;
  requiredBy: string;
  priceMaxKrw: string;
};

function Card({ title, flush, footer, children }: {
  title?: string;
  flush?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="v-card">
      {title ? <div className="v-card-head"><h2 className="v-card-title">{title}</h2></div> : null}
      <div className={flush ? "v-card-body-flush" : "v-card-body"}>{children}</div>
      {footer ? <div className="v-card-foot">{footer}</div> : null}
    </section>
  );
}

function PageHead({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <header className="v-header">
      <div className="v-header-text">
        <h1 className="v-title">{title}</h1>
        <p className="v-desc">{description}</p>
      </div>
      {children}
    </header>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="v-metric">
      <span className="v-label">{label}</span>
      <span className="v-figure">{value}</span>
      <span className="v-hint">{hint}</span>
    </div>
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
    <div className="app">
      <header className="desk-head">
        <div className="desk-top">
          <button className="mark" type="button" onClick={() => onStep("onboard")}>
            <span className="mark-water">source</span>night
          </button>
          <div className="desk-end">
            <span className="wallet-pill" title={walletAddress ?? undefined}>
              {walletAddress ? compactHash(walletAddress) : "Wallet pending"}
            </span>
          </div>
        </div>
        <nav className="desk-pages" aria-label="Sourcenight">
          {STEPS.map((step) => (
            <button
              key={step.id}
              className="nav-link"
              type="button"
              aria-current={page === step.id ? "page" : undefined}
              disabled={!canOpen[step.id]}
              onClick={() => onStep(step.id)}
            >
              {step.label}
            </button>
          ))}
          <div className="desk-end">
            <span className="v-muted">{userLabel}</span>
            <button className="nav-link" type="button" aria-current={page === "history" ? "page" : undefined} onClick={onHistory}>Past buys</button>
            <button className="nav-link" type="button" onClick={onLogout}>Sign out</button>
          </div>
        </nav>
      </header>
      <main className="frame">
        <div className="v-page">{children}</div>
      </main>
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
      <PageHead
        title="Sourcenight"
        description="This login already has a Midnight address. Sourcenight creates it for the account and keeps the seed on the server. You do not paste a seed, and this page does not ask for one. Continue opens the buy. Nothing is searched until the next page locks the cap and sends only the public fields to Jev."
      />
      <div className="pair">
        <Card
          title="This login"
          footer={(
            <button className="v-btn" type="button" disabled={!walletReady || !walletAddress} onClick={onContinue}>
              Continue
            </button>
          )}
        >
          <dl className="v-dl">
            <dt>Account</dt><dd>Privy, by email or a social account</dd>
            <dt>Midnight address</dt>
            <dd className="v-mono" title={walletAddress ?? undefined}>{walletAddress ?? "Preparing the wallet for this account."}</dd>
            <dt>Seed</dt><dd>Created for this login. You do not paste a seed.</dd>
            <dt>Continue</dt><dd>Opens the buy. The search has not started.</dd>
          </dl>
          {error ? <p className="v-note bad" role="alert">{error}</p> : null}
        </Card>
        <Card title="In plain English">
          <ol className="v-list">
            <li>You sign in. Sourcenight creates one Midnight address for that login.</li>
            <li>You enter the buy. Jev receives the item, the quantity, the unit, the country, and the keywords.</li>
            <li>The cap is locked with commitRange before the search. Jev does not receive it.</li>
            <li>You keep one row. commitVerify checks that it fits, and the list marks that row.</li>
          </ol>
        </Card>
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
      <PageHead
        title="What are you buying?"
        description="Jev receives the item, the quantity, the unit, the destination country, and the keywords. It does not receive the cap. Sort offers locks that cap with commitRange first, then runs the search. After a lock, the public fields stay as entered until New buy. A failed search clears the lock so you can edit and try again."
      />
      <form onSubmit={onSubmit}>
        <div className="wizard">
        <Card title="Steps">
          <ol className="step-list">
            <li data-state="current"><span className="step-no">1</span><span className="step-copy"><strong>Buy</strong><span>Public fields go to Jev. The cap stays in this browser.</span></span></li>
            <li><span className="step-no">2</span><span className="step-copy"><strong>Sort</strong><span>commitRange locks the cap, then Jev returns the rows in order.</span></span></li>
            <li><span className="step-no">3</span><span className="step-copy"><strong>Verify</strong><span>You pick one row. commitVerify checks that it fits.</span></span></li>
            <li><span className="step-no">4</span><span className="step-copy"><strong>List</strong><span>The same order, with that row marked kept.</span></span></li>
          </ol>
        </Card>
        <Card
          title="This buy"
          footer={<button className="v-btn" type="submit" disabled={searching}>{button}</button>}
        >
          <div className="v-fields">
            <label className="v-field">
              <span>Item</span>
              <input className="v-input" value={form.item} onChange={(event) => onChange("item", event.target.value)} disabled={locked} required />
            </label>
            <div className="v-split">
              <label className="v-field">
                <span>Quantity</span>
                <input className="v-input" type="number" min="1" value={form.quantity} onChange={(event) => onChange("quantity", event.target.value)} disabled={locked} required />
              </label>
              <label className="v-field">
                <span>Unit</span>
                <select className="v-input" value={form.unit} onChange={(event) => onChange("unit", event.target.value)} disabled={locked}>
                  <option value="piece">piece</option>
                  <option value="pair">pair</option>
                  <option value="box">box</option>
                  <option value="kg">kg</option>
                </select>
              </label>
              <label className="v-field">
                <span>Ship to</span>
                <select className="v-input" value={form.destinationCountry} onChange={(event) => onChange("destinationCountry", event.target.value)} disabled={locked}>
                  <option value="KR">Korea</option>
                  <option value="US">United States</option>
                  <option value="JP">Japan</option>
                  <option value="SG">Singapore</option>
                </select>
              </label>
            </div>
            <div className="v-split two">
              <label className="v-field">
                <span>Keywords</span>
                <input className="v-input" value={form.keywords} onChange={(event) => onChange("keywords", event.target.value)} disabled={locked} required />
              </label>
              <label className="v-field">
                <span>Needed by</span>
                <input className="v-input" type="date" value={form.requiredBy} onChange={(event) => onChange("requiredBy", event.target.value)} disabled={locked} />
              </label>
            </div>
            <label className="v-field">
              <span>Maximum budget, KRW</span>
              <input
                className="v-input"
                aria-label="Maximum budget in KRW"
                type="number"
                min="1"
                value={form.priceMaxKrw}
                onChange={(event) => onChange("priceMaxKrw", event.target.value)}
                disabled={locked}
              />
            </label>
            <p className="v-desc">Stays in this browser. Jev does not receive it. The salt that hides it is created here and is not shown.</p>
            {error ? <p className="v-note bad" role="alert">{error}</p> : null}
          </div>
        </Card>
        <Card title="What leaves this browser">
          <dl className="v-dl">
            <dt>Item</dt><dd>{form.item || "—"}</dd>
            <dt>Quantity</dt><dd>{form.quantity ? `${number(Number(form.quantity))} ${form.unit}` : "—"}</dd>
            <dt>Ship to</dt><dd>{COUNTRY[form.destinationCountry] ?? form.destinationCountry}</dd>
            <dt>Keywords</dt><dd>{form.keywords || "—"}</dd>
            <dt>Needed by</dt><dd>{form.requiredBy || "No date set"}</dd>
            <dt>Cap</dt><dd>{form.priceMaxKrw ? `${won(form.priceMaxKrw)} · stays here` : "—"}</dd>
          </dl>
        </Card>
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
  settle = false,
}: {
  offers: readonly RankedOffer[];
  capKrw: number;
  requiredBy: string;
  selectedId: string | null;
  keptId?: string;
  onSelect?: (offerId: string) => void;
  settle?: boolean;
}) {
  return (
    <div className={settle ? "v-table-wrap sort-rows" : "v-table-wrap"}>
      <table className="v-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Offer</th>
            <th>Supplier</th>
            <th className="v-right">Qty</th>
            <th className="v-right">Unit price</th>
            <th className="v-right">Total</th>
            <th className="v-right">Lead</th>
            <th>Arrives</th>
            <th className="v-right">Score</th>
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
                style={settle ? { "--i": String(index) } as CSSProperties : undefined}
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
                  <span className="v-offer">
                    <strong>{ranked.offer.title}</strong>
                    <span>{ranked.offer.variant ?? ranked.offer.provider}{kept ? " · Kept" : ""}</span>
                  </span>
                </td>
                <td>{ranked.offer.supplierName ?? ranked.offer.supplierId}</td>
                <td className="v-right">{number(ranked.offer.quantity)} {ranked.offer.unit}</td>
                <td className="v-right">{ranked.offer.originalCurrency} {ranked.offer.originalUnitPrice}</td>
                <td className="v-right">{won(ranked.offer.convertedTotalKrw)}</td>
                <td className="v-right">{ranked.offer.leadTimeDays === undefined ? "—" : `${ranked.offer.leadTimeDays}d`}</td>
                <td>{ranked.offer.deliveryDate ?? "—"}</td>
                <td className="v-right">
                  <span className="v-offer">
                    <strong>{percent(ranked.relevanceScore)}</strong>
                    <span>{percent(ranked.confidence)} sure{ranked.needsReview ? " · review" : ""}</span>
                  </span>
                </td>
                <td><span className={fit === "fits" || kept ? "v-badge" : "v-badge over"}>{kept ? "Kept" : FIT_WORD[fit]}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
      <PageHead
        title="Jev sorted this buy."
        description={`Jev searched “${result.plan.query}” in ${result.plan.country} and returned these rows by ${SORT_WORD[result.plan.sort] ?? result.plan.sort}. The cap was not in that request. A row is within cap when its converted total is at or under the cap you locked, and, if you set a needed-by date, its delivery is on or before that date. The motion under the title is that sort: offers come off the rule, flick through order, and the ones that stay drop into a stack. Verify this row sends the selected offer to the mapper. The mapper checks the fit and does not reveal the cap.`}
      />
      {result.offers.length > 0 ? <SortMotion total={result.offers.length} fits={fits} /> : null}
      <div className={result.offers.length > 0 ? "sort-settle" : undefined}>
        <Card flush>
          <div className="v-metrics">
            <Metric label="Offers" value={String(result.offers.length)} hint="Rows Jev returned for this search" />
            <Metric label="Within cap" value={String(fits)} hint="Converted total at or under the locked cap" />
            <Metric label="Cap" value={won(capKrw)} hint="Locked with commitRange. Not sent to Jev." />
            <Metric label="Sort time" value={elapsedMs == null ? "—" : seconds(elapsedMs)} hint="From the search request to this list" />
          </div>
        </Card>
        <Card
          title="Jev"
          flush
          footer={(
            <>
              <button className="v-link" type="button" onClick={onEdit}>Edit the buy</button>
              <button className="v-btn" type="button" disabled={selectedFit !== "fits"} onClick={onVerify}>Verify this row</button>
            </>
          )}
        >
          {result.offers.length === 0 ? (
            <div className="v-card-body"><p>No offers came back. Edit the buy and sort again.</p></div>
          ) : (
            <OfferRows
              offers={result.offers}
              capKrw={capKrw}
              requiredBy={requiredBy}
              selectedId={selectedId}
              onSelect={onSelect}
              settle
            />
          )}
        </Card>
        {locked ? <p className="v-muted">Cap locked · {compactHash(locked.commitRangeTransactionId)}</p> : null}
        {selectedFit && selectedFit !== "fits" ? (
          <p className="v-note bad">{FIT_WORD[selectedFit]}. Pick a row that fits before verifying.</p>
        ) : null}
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
      <PageHead
        title="Check that this row fits."
        description="The mapper compares this offer with the cap locked by commitRange. The check is commitVerify. It says whether the row fits. It does not reveal the cap, and it does not send the cap to Jev. The local fit on the right uses the same rule as the sort page: the converted total is at or under the cap, and the delivery is on or before the needed-by date when you set one. Check the fit only after you accept the supplier, the total, and the date."
      />
      <div className="pair">
        <Card title="This row">
          <dl className="v-dl">
            <dt>Offer</dt><dd>{ranked.offer.title}</dd>
            <dt>Variant</dt><dd>{ranked.offer.variant ?? "—"}</dd>
            <dt>Supplier</dt><dd>{ranked.offer.supplierName ?? ranked.offer.supplierId}</dd>
            <dt>Quantity</dt><dd>{number(ranked.offer.quantity)} {ranked.offer.unit}</dd>
            <dt>Unit price</dt><dd>{ranked.offer.originalCurrency} {ranked.offer.originalUnitPrice}</dd>
            <dt>Total</dt><dd>{won(ranked.offer.convertedTotalKrw)}</dd>
            <dt>Lead</dt><dd>{ranked.offer.leadTimeDays === undefined ? "—" : `${ranked.offer.leadTimeDays} days`}</dd>
            <dt>Arrives</dt><dd>{ranked.offer.deliveryDate ?? "—"}{requiredBy ? ` · needed by ${requiredBy}` : ""}</dd>
            <dt>Score</dt><dd>{percent(ranked.relevanceScore)} relevant · {percent(ranked.confidence)} sure{ranked.needsReview ? " · needs review" : ""}</dd>
            <dt>Source</dt><dd className="v-mono" title={ranked.offer.sourceId}>{ranked.offer.provider} · {compactHash(ranked.offer.sourceId)}</dd>
          </dl>
        </Card>
        <Card
          title="Mapper"
          footer={verifiedId ? (
            <button className="v-btn" type="button" onClick={onOpenList}>Open the list</button>
          ) : (
            <>
              <label className="v-check">
                <input type="checkbox" checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} />
                <span>I accept this supplier, total, and date.</span>
              </label>
              <button className="v-btn" type="button" disabled={!confirmed || running || fit !== "fits"} onClick={onCheck}>
                {running ? "Checking the fit" : "Check the fit"}
              </button>
            </>
          )}
        >
          <dl className="v-dl">
            <dt>Total</dt><dd>{won(ranked.offer.convertedTotalKrw)}</dd>
            <dt>Cap</dt><dd>{won(capKrw)}</dd>
            <dt>Local fit</dt><dd>{FIT_WORD[fit]}</dd>
            <dt>commitRange</dt><dd className="v-mono" title={rangeId}>{compactHash(rangeId)}</dd>
            {verifiedId ? <><dt>commitVerify</dt><dd className="v-mono" title={verifiedId}>{compactHash(verifiedId)}</dd></> : null}
          </dl>
          {error ? <p className="v-note bad" role="alert">{error}</p> : null}
        </Card>
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
      <PageHead
        title="The sorted list, with one row kept."
        description={`${orderNote} This is the same order Jev returned. The kept row is the one commitVerify accepted. The cap is still only in this browser, and this page does not search again.`}
      />
      <Card flush>
        <div className="v-metrics">
          <Metric label="Offers" value={String(result.offers.length)} hint="Rows in the search result, unchanged" />
          <Metric label="Within cap" value={String(fits)} hint="Converted total at or under the locked cap" />
          <Metric label="Cap" value={won(capKrw)} hint="Still only in this browser" />
          <Metric label="Sort time" value={elapsedMs == null ? "—" : seconds(elapsedMs)} hint="From the search request to the list" />
        </div>
      </Card>
      <Card
        title="Final"
        flush
        footer={(
          <>
            <button className="v-link" type="button" onClick={onHistory}>Past buys</button>
            <button className="v-btn" type="button" onClick={onNew}>New buy</button>
          </>
        )}
      >
        <OfferRows
          offers={result.offers}
          capKrw={capKrw}
          requiredBy={requiredBy}
          selectedId={keptId}
          keptId={keptId}
        />
      </Card>
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
      <PageHead
        title="Orders from checked rows."
        description="Each row is a buy whose fit was already checked. The record stores the offer, the commitVerify id, and the order status. It does not store the cap. Try the order again appears only when that attempt failed. New buy starts the pages over with an empty form."
      />
      <Card
        title="Past buys"
        flush={records.length > 0}
        footer={<button className="v-btn" type="button" onClick={onNew}>New buy</button>}
      >
        {loading ? <p>Loading past buys.</p> : null}
        {error ? (
          <p className="v-note bad" role="alert">
            {error} <button className="v-link" type="button" onClick={onRetryLoad}>Try again</button>
          </p>
        ) : null}
        {actionError ? <p className="v-note bad" role="alert">{actionError}</p> : null}
        {!loading && !error && records.length === 0 ? <p>No checked buy has been saved yet.</p> : null}
        {records.length > 0 ? (
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Offer</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th className="v-right">Total</th>
                  <th>commitVerify</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.executionId}>
                    <td className="v-muted">{new Date(record.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td>
                      <span className="v-offer">
                        <strong>{record.offer.title}</strong>
                        <span>{number(record.offer.quantity)} {record.offer.unit}</span>
                      </span>
                    </td>
                    <td>{record.offer.supplierName ?? record.offer.supplierId}</td>
                    <td>{STATUS_WORD[record.status] ?? record.status}</td>
                    <td className="v-right">{won(record.offer.convertedTotalKrw)}</td>
                    <td className="v-mono" title={record.commitVerifyTransactionId}>{compactHash(record.commitVerifyTransactionId)}</td>
                    <td>
                      {record.status === "failed" ? (
                        <button className="v-link" type="button" disabled={retryingId === record.executionId} onClick={() => onRetryOrder(record)}>
                          {retryingId === record.executionId ? "Trying again" : "Try the order again"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </>
  );
}
