import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { ExecutionHistoryRecord, RankedOffer, SearchResponse } from "@midnight-hackathon/shared";
import type { LockedIntent } from "../midnight";
import { offerFit, type Fit } from "./fit";
import { FIT_WORD, SORT_WORD, STATUS_WORD, compactHash, number, percent, seconds, won } from "./format";

export const STEPS = [
  { id: "onboard", label: "Onboard" },
  { id: "input", label: "Input" },
  { id: "sort", label: "Sort & verify" },
  { id: "list", label: "List" },
  { id: "history", label: "Histories" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
export type PageId = StepId;

export type BuyFieldId = "item" | "quantity" | "unit" | "destination" | "keywords" | "neededBy" | "budget";

const FIELD_LABEL: Record<BuyFieldId, string> = {
  item: "Item",
  quantity: "Quantity",
  unit: "Unit",
  destination: "Ship to",
  keywords: "Keywords",
  neededBy: "Needed by",
  budget: "Maximum budget",
};

const DEFAULT_PUBLIC: BuyFieldId[] = ["item", "quantity", "unit", "destination", "keywords", "neededBy"];
const DEFAULT_PRIVATE: BuyFieldId[] = ["budget"];

function placeField(
  columns: { publicIds: BuyFieldId[]; privateIds: BuyFieldId[] },
  id: BuyFieldId,
  side: "public" | "private",
  index: number,
) {
  const publicIds = columns.publicIds.filter((field) => field !== id);
  const privateIds = columns.privateIds.filter((field) => field !== id);
  const next = side === "public" ? publicIds : privateIds;
  next.splice(index, 0, id);
  return side === "public"
    ? { publicIds, privateIds }
    : { publicIds, privateIds };
}

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
      {hint ? <span className="v-hint">{hint}</span> : null}
    </div>
  );
}

export function Shell({
  page,
  canOpen,
  onStep,
  onHistory,
  onLogout,
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
  creatingWallet,
  jevKeyStored,
  reefKeyStored,
  error,
  onCreateWallet,
  onSaveJevKey,
  onSaveReefKey,
  onContinue,
}: {
  walletAddress: string | null;
  creatingWallet: boolean;
  jevKeyStored: boolean;
  reefKeyStored: boolean;
  error: string | null;
  onCreateWallet: () => void;
  onSaveJevKey: (apiKey: string) => void;
  onSaveReefKey: (apiKey: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <PageHead
        title="This toolkit"
        description="What this repo does, and what we will add."
      />
      <Card title="This repo">
        <ol className="v-list">
          <li>Runs on this machine. It is not a hosted site.</li>
          <li>Creates one Midnight wallet here and shows the address.</li>
          <li>Takes one buy. Item, quantity, unit, destination, keywords, and needed-by go to Jev. The budget stays here.</li>
          <li>Locks the budget with commitRange, then asks Jev, through TypeSafe, to choose a query and rank the rows.</li>
          <li>Checks the row you keep with commitVerify. The list marks that row kept. The check is not sent back to Jev.</li>
          <li>Does not run a local agent. The screen splits the fields. The API calls Jev. The prover checks the budget.</li>
        </ol>
      </Card>
      <Card title="We will">
        <ol className="v-list">
          <li>Create the wallet when you press the button.</li>
          <li>Take the Jev key and the Reef key once and keep them on this machine, not on screen.</li>
          <li>Let you drag the buy fields. Order is priority. One side is public, the other stays private.</li>
          <li>Send only the public side to Jev with one fixed prompt: make the search queries.</li>
          <li>Query with those terms. As each page arrives, Jev ranks it, the mapper maps it, and Midnight checks it against the private fields.</li>
          <li>Show that in two columns. Rows stack and reorder as they arrive. The right column is what Midnight accepted.</li>
        </ol>
      </Card>
      <Card
        title="Midnight wallet"
        footer={walletAddress ? (
          <button className="v-btn" type="button" disabled={!jevKeyStored || !reefKeyStored} onClick={onContinue}>Continue</button>
        ) : (
          <button className="v-btn" type="button" disabled={creatingWallet} onClick={onCreateWallet}>
            {creatingWallet ? "Creating the wallet" : "Create wallet"}
          </button>
        )}
      >
        {walletAddress ? (
          <p className="v-mono" title={walletAddress}>{walletAddress}</p>
        ) : (
          <p className="v-desc">No wallet yet. Create one on this machine before the buy.</p>
        )}
        {error ? <p className="v-note bad" role="alert">{error}</p> : null}
      </Card>
      {walletAddress ? (
        <>
          <JevKeyCard stored={jevKeyStored} onSave={onSaveJevKey} />
          <SecretKeyCard
            title="Reef key"
            label="ReefAPI key for the catalog"
            stored={reefKeyStored}
            onSave={onSaveReefKey}
          />
        </>
      ) : null}
    </>
  );
}

function FieldBoard({
  form,
  locked,
  columns,
  onChange,
  onPlace,
}: {
  form: IntentForm;
  locked: boolean;
  columns: { publicIds: BuyFieldId[]; privateIds: BuyFieldId[] };
  onChange: (field: keyof IntentForm, value: string) => void;
  onPlace: (id: BuyFieldId, side: "public" | "private", index: number) => void;
}) {
  const control = (id: BuyFieldId) => {
    if (id === "item") {
      return <input className="v-input" value={form.item} onChange={(event) => onChange("item", event.target.value)} disabled={locked} required />;
    }
    if (id === "quantity") {
      return <input className="v-input" type="number" min="1" value={form.quantity} onChange={(event) => onChange("quantity", event.target.value)} disabled={locked} required />;
    }
    if (id === "unit") {
      return (
        <select className="v-input" value={form.unit} onChange={(event) => onChange("unit", event.target.value)} disabled={locked}>
          <option value="piece">piece</option>
          <option value="pair">pair</option>
          <option value="box">box</option>
          <option value="kg">kg</option>
        </select>
      );
    }
    if (id === "destination") {
      return (
        <select className="v-input" value={form.destinationCountry} onChange={(event) => onChange("destinationCountry", event.target.value)} disabled={locked}>
          <option value="KR">Korea</option>
          <option value="US">United States</option>
          <option value="JP">Japan</option>
          <option value="SG">Singapore</option>
        </select>
      );
    }
    if (id === "keywords") {
      return <input className="v-input" value={form.keywords} onChange={(event) => onChange("keywords", event.target.value)} disabled={locked} required />;
    }
    if (id === "neededBy") {
      return <input className="v-input" type="date" value={form.requiredBy} onChange={(event) => onChange("requiredBy", event.target.value)} disabled={locked} />;
    }
    return (
      <input
        className="v-input"
        aria-label="Maximum budget in KRW"
        type="number"
        min="1"
        value={form.priceMaxKrw}
        onChange={(event) => onChange("priceMaxKrw", event.target.value)}
        disabled={locked}
      />
    );
  };
  const column = (side: "public" | "private", ids: BuyFieldId[]) => (
    <div
      className={side === "private" ? "field-column private" : "field-column"}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onPlace(event.dataTransfer.getData("text/plain") as BuyFieldId, side, ids.length);
      }}
    >
      <p className={side === "private" ? "v-kicker keep" : "v-kicker"}>{side === "public" ? "Public, sent to Jev" : "Private, stays here"}</p>
      {ids.map((id, index) => (
        <div
          key={id}
          className="field-card"
          draggable={!locked}
          onDragStart={(event) => event.dataTransfer.setData("text/plain", id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPlace(event.dataTransfer.getData("text/plain") as BuyFieldId, side, index);
          }}
        >
          <span className="field-index">{index + 1}</span>
          <label className="v-field">
            <span>{FIELD_LABEL[id]}</span>
            {control(id)}
          </label>
        </div>
      ))}
    </div>
  );
  return (
    <div className="field-board">
      {column("public", columns.publicIds)}
      {column("private", columns.privateIds)}
    </div>
  );
}

function JevKeyCard({ stored, onSave }: { stored: boolean; onSave: (apiKey: string) => void }) {
  return (
    <SecretKeyCard title="Jev key" label="TypeSafe key for Jev" stored={stored} onSave={onSave} />
  );
}

function SecretKeyCard({
  title,
  label,
  stored,
  onSave,
}: {
  title: string;
  label: string;
  stored: boolean;
  onSave: (apiKey: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [replacing, setReplacing] = useState(false);
  const showForm = !stored || replacing;
  return (
    <Card title={title}>
      {stored && !replacing ? (
        <div className="v-fields">
          <p className="v-desc">Stored on this machine. It is not shown.</p>
          <button className="v-btn" type="button" onClick={() => setReplacing(true)}>Enter the key again</button>
        </div>
      ) : null}
      {showForm ? (
        <form className="v-fields" onSubmit={(event) => {
          event.preventDefault();
          const apiKey = draft.trim();
          if (!apiKey) return;
          onSave(apiKey);
          setDraft("");
          setReplacing(false);
        }}>
          <label className="v-field">
            <span>{label}</span>
            <input className="v-input" type="password" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button className="v-btn" type="submit" disabled={draft.trim().length === 0}>
            {stored ? "Replace the key" : "Store the key"}
          </button>
        </form>
      ) : null}
    </Card>
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
  onSubmit: (event: FormEvent<HTMLFormElement>, publicIds: BuyFieldId[]) => void;
}) {
  const [columns, setColumns] = useState({ publicIds: DEFAULT_PUBLIC, privateIds: DEFAULT_PRIVATE });
  const button = searching
    ? (phase === "search" ? "Jev is sorting" : "Locking the cap")
    : "Sort offers";
  return (
    <>
      <PageHead
        title="What are you buying?"
        description="Drag a field to the other side, or up and down. Public goes to Jev. Private stays here. The number is the priority."
      />
      <form onSubmit={(event) => onSubmit(event, columns.publicIds)}>
        <FieldBoard
          form={form}
          locked={locked}
          columns={columns}
          onChange={onChange}
          onPlace={(id, side, index) => setColumns((current) => placeField(current, id, side, index))}
        />
        {error ? <p className="v-note bad" role="alert">{error}</p> : null}
        <div className="hero-actions">
          <button className="v-btn" type="submit" disabled={searching}>{button}</button>
        </div>
      </form>
    </>
  );
}

function RankColumn({
  title,
  offers,
  selectedId,
  onSelect,
  mark,
}: {
  title: string;
  offers: readonly RankedOffer[];
  selectedId: string | null;
  onSelect: (offerId: string) => void;
  mark: (ranked: RankedOffer) => string;
}) {
  return (
    <section className="rank-column">
      <h2>{title}</h2>
      {offers.length === 0 ? <p className="v-desc">Waiting for the next row.</p> : (
        <ol className="rank-list">
          {offers.map((ranked, index) => {
            const selected = selectedId === ranked.offer.offerId;
            return (
              <li key={ranked.offer.offerId}>
                <button
                  className={selected ? "rank-row selected" : "rank-row"}
                  type="button"
                  onClick={() => onSelect(ranked.offer.offerId)}
                >
                  <span>{index + 1}</span>
                  <strong>{ranked.offer.title}</strong>
                  <span>{won(ranked.offer.convertedTotalKrw)} · {mark(ranked)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
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
  acceptedIds,
  onSelect,
  onEdit,
  onVerify,
}: {
  result: SearchResponse;
  capKrw: number;
  requiredBy: string;
  selectedId: string | null;
  elapsedMs: number | null;
  acceptedIds: readonly string[];
  locked: LockedIntent | null;
  onSelect: (offerId: string) => void;
  onEdit: () => void;
  onVerify: () => void;
}) {
  const accepted = result.offers.filter((ranked) => acceptedIds.includes(ranked.offer.offerId));
  const fits = accepted.length;
  const selectedAccepted = selectedId !== null && acceptedIds.includes(selectedId);
  return (
    <>
      <PageHead
        title="Jev sorted this buy."
        description={`Jev searched “${result.plan.query}”. Pick a row within the cap.`}
      />
      <div className="rank-board">
        <RankColumn
          title="Jev rank"
          offers={result.offers}
          selectedId={selectedId}
          onSelect={onSelect}
          mark={(ranked) => `${percent(ranked.relevanceScore)} rank`}
        />
        <RankColumn
          title="Midnight"
          offers={accepted}
          selectedId={selectedId}
          onSelect={onSelect}
          mark={() => "Checked"}
        />
      </div>
      <div>
        <Card flush>
          <div className="v-metrics">
            <Metric label="Offers" value={String(result.offers.length)} hint="" />
            <Metric label="Within cap" value={String(fits)} hint="" />
            <Metric label="Cap" value={won(capKrw)} hint="" />
            <Metric label="Sort time" value={elapsedMs == null ? "—" : seconds(elapsedMs)} hint="" />
          </div>
        </Card>
        <div className="hero-actions">
          <button className="v-link" type="button" onClick={onEdit}>Edit the buy</button>
          <button className="v-btn" type="button" disabled={!selectedAccepted} onClick={onVerify}>Open the list</button>
        </div>
        {result.offers.length > 0 && fits === 0 ? (
          <p className="v-note bad">Each row was ranked, then checked against the private fields. None passed, so the right side stays empty.</p>
        ) : null}
        {selectedId && !selectedAccepted ? (
          <p className="v-note bad">Midnight did not accept this row. Pick one on the right.</p>
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
        description="Midnight checks this row against the cap. The cap is not sent to Jev."
      />
      <div className="pair">
        <Card title="This row">
          <dl className="v-dl">
            <dt>Offer</dt><dd>{ranked.offer.title}</dd>
            <dt>Supplier</dt><dd>{ranked.offer.supplierName ?? ranked.offer.supplierId}</dd>
            <dt>Total</dt><dd>{won(ranked.offer.convertedTotalKrw)}</dd>
            <dt>Arrives</dt><dd>{ranked.offer.deliveryDate ?? "—"}{requiredBy ? ` · needed by ${requiredBy}` : ""}</dd>
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

function exportOffers(result: SearchResponse, keptId: string) {
  const lines = [
    "rank,title,supplier,totalKrw,kept",
    ...result.offers.map((ranked, index) => {
      const cells = [
        String(index + 1),
        ranked.offer.title,
        ranked.offer.supplierName ?? ranked.offer.supplierId,
        ranked.offer.convertedTotalKrw,
        ranked.offer.offerId === keptId ? "kept" : "",
      ];
      return cells.map((cell) => `"${cell.replaceAll("\"", "\"\"")}"`).join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sourcenight-list.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ListPage({
  result,
  capKrw,
  requiredBy,
  keptId,
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
  return (
    <>
      <PageHead
        title="List"
        description={orderNote}
      />
      <Card
        title="Export"
        flush
        footer={(
          <>
            <button className="v-link" type="button" onClick={() => exportOffers(result, keptId)}>Export</button>
            <button className="v-btn" type="button" onClick={onHistory}>Histories</button>
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
        title="Histories"
        description="This is the end of the buy. The record keeps the offer and the check. It does not keep the private fields."
      />
      <Card
        title="Saved buys"
        flush={records.length > 0}
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
