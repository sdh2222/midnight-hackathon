import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  PublicRequirementSchema,
  offerSnapshotHash,
  sha256Hex,
  type ExecutionHistoryRecord,
  type RankedOffer,
  type SearchResponse,
} from "@midnight-hackathon/shared";
import {
  createExecutionHistory,
  listExecutionHistory,
  retryExecutionHistory,
  syncExecutionHistory,
} from "./api/executions";
import { buildSearchRequest, streamPipeline } from "./api/search";
import type { BuyFieldId } from "./flow/screens";
import { offerFit } from "./flow/fit";
import {
  HistoryPage,
  InputPage,
  ListPage,
  OnboardPage,
  Shell,
  SortPage,
  VerifyPage,
  type IntentForm,
  type PageId,
  type StepId,
} from "./flow/screens";
import {
  createProcurementContractWorkflow,
  type LockedIntent,
  type WalletConnection,
} from "./midnight";

type ChainPhase = "idle" | "commit-range" | "search" | "commit-verify";

type ApprovalState = {
  approvalId: string;
  offerSnapshotHash: string;
  approvedAt: string;
  commitVerifyTransactionId: string;
  rankedOffer: RankedOffer;
  persistenceError?: string;
  executionStatus?: string;
};

const initialForm: IntentForm = {
  item: "Industrial nitrile gloves",
  quantity: "10000",
  unit: "piece",
  destinationCountry: "KR",
  keywords: "nitrile gloves, industrial, powder-free",
  requiredBy: "",
  priceMaxKrw: "2700000",
};

export function App({ userId, userLabel, apiFetch, onLogout }: {
  userId: string;
  userLabel: string;
  apiFetch: typeof globalThis.fetch;
  onLogout: () => void;
}) {
  const workflowRef = useRef(createProcurementContractWorkflow());
  const [page, setPage] = useState<PageId>("onboard");
  const [form, setForm] = useState<IntentForm>(initialForm);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [walletReady, setWalletReady] = useState(false);
  const [lockedIntent, setLockedIntent] = useState<LockedIntent | null>(null);
  const [chainPhase, setChainPhase] = useState<ChainPhase>("idle");
  const [historyRecords, setHistoryRecords] = useState<ExecutionHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyActionError, setHistoryActionError] = useState<string | null>(null);
  const [retryingExecutionId, setRetryingExecutionId] = useState<string | null>(null);
  const [serverWalletAddress, setServerWalletAddress] = useState<string | null>(null);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [jevKeyStored, setJevKeyStored] = useState(false);
  const [sortMs, setSortMs] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (workflowRef.current.mode !== "demo") {
      setWalletReady(false);
      setError("This build sorts and checks on the demo prover. A funded Midnight submit is a later step.");
      return () => { active = false; };
    }
    void workflowRef.current.connectWallet().then((connection) => {
      if (!active) return;
      setWallet(connection);
      setWalletReady(true);
    }).catch((failure) => {
      if (!active) return;
      setError(failure instanceof Error ? failure.message : "The prover is not ready.");
      setWalletReady(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/local-wallet").then(async (response) => {
      if (!response.ok) return;
      const linked = await response.json() as { midnightAddress?: string | null };
      if (active && linked.midnightAddress) setServerWalletAddress(linked.midnightAddress);
    }).catch(() => undefined);
    void fetch("/local-jev-key").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { stored?: boolean };
      if (active && body.stored) setJevKeyStored(true);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function createLocalWallet() {
    setCreatingWallet(true);
    setError(null);
    try {
      const response = await fetch("/local-wallet", { method: "POST" });
      if (!response.ok) throw new Error("The wallet could not be created.");
      const linked = await response.json() as { midnightAddress?: string };
      if (!linked.midnightAddress) throw new Error("The wallet could not be created.");
      setServerWalletAddress(linked.midnightAddress);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The wallet could not be created.");
    } finally {
      setCreatingWallet(false);
    }
  }

  async function saveJevKey(apiKey: string) {
    setError(null);
    const response = await fetch("/local-jev-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!response.ok) {
      setError("The Jev key could not be stored.");
      return;
    }
    setJevKeyStored(true);
  }

  const synchronizableExecutionIds = historyRecords
    .filter(({ status }) => status === "order_submitted" || status === "counterparty_accepted")
    .map(({ executionId }) => executionId)
    .join(",");

  useEffect(() => {
    if (page !== "history" || !synchronizableExecutionIds) return;
    let active = true;
    let synchronizing = false;
    const synchronize = async () => {
      if (synchronizing) return;
      synchronizing = true;
      try {
        const accountIdHash = await sha256Hex(`privy:${userId}`);
        const ids = synchronizableExecutionIds.split(",");
        const updates = await Promise.all(ids.map(async (executionId) => {
          try {
            return await syncExecutionHistory(executionId, accountIdHash, apiFetch);
          } catch {
            return null;
          }
        }));
        if (!active) return;
        const byId = new Map(
          updates.filter((record): record is ExecutionHistoryRecord => record !== null)
            .map((record) => [record.executionId, record]),
        );
        setHistoryRecords((records) => records.map((record) => byId.get(record.executionId) ?? record));
      } finally {
        synchronizing = false;
      }
    };
    void synchronize();
    const interval = window.setInterval(() => void synchronize(), 3_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [page, synchronizableExecutionIds, userId, apiFetch]);

  const maxBudget = Number(form.priceMaxKrw);
  const selectedOffer = useMemo(
    () => searchResult?.offers.find(({ offer }) => offer.offerId === selectedOfferId) ?? null,
    [searchResult, selectedOfferId],
  );

  function updateField(field: keyof IntentForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function recoverFromFailedSearch(): Promise<string> {
    const previousMode = workflowRef.current.mode;
    const replacement = createProcurementContractWorkflow();
    workflowRef.current = replacement;
    setLockedIntent(null);
    setSearchResult(null);
    setSelectedOfferId(null);
    if (previousMode === "demo" && wallet) {
      const connection = await replacement.connectWallet();
      setWallet(connection);
      setWalletReady(true);
      return "The lock was cleared. Edit the buy and sort again.";
    }
    setWallet(null);
    setWalletReady(false);
    return "The lock was cleared.";
  }

  async function openHistory() {
    setPage("history");
    setHistoryError(null);
    setHistoryActionError(null);
    setIsLoadingHistory(true);
    try {
      setHistoryRecords(await listExecutionHistory(await sha256Hex(`privy:${userId}`), apiFetch));
    } catch (historyFailure) {
      setHistoryError(historyFailure instanceof Error ? historyFailure.message : "Past buys could not be loaded.");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function retryOrder(record: ExecutionHistoryRecord) {
    if (retryingExecutionId) return;
    setHistoryActionError(null);
    setRetryingExecutionId(record.executionId);
    try {
      const updated = await retryExecutionHistory(
        record.executionId,
        await sha256Hex(`privy:${userId}`),
        apiFetch,
      );
      setHistoryRecords((records) => records.map((candidate) => (
        candidate.executionId === updated.executionId ? updated : candidate
      )));
    } catch (retryError) {
      setHistoryActionError(retryError instanceof Error ? retryError.message : "The order could not be tried again.");
    } finally {
      setRetryingExecutionId(null);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>, publicIds: BuyFieldId[]) {
    event.preventDefault();
    setError(null);
    const parsed = PublicRequirementSchema.safeParse({
      item: form.item,
      quantity: Number(form.quantity),
      unit: form.unit,
      destinationCountry: form.destinationCountry.toUpperCase(),
      keywords: form.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
      ...(publicIds.includes("neededBy") && form.requiredBy ? { requiredBy: form.requiredBy } : {}),
    });
    if (!parsed.success) {
      setError("Check the item, quantity, country, and keywords.");
      return;
    }
    const requiredPublic: BuyFieldId[] = ["item", "quantity", "unit", "destination", "keywords"];
    if (requiredPublic.some((field) => !publicIds.includes(field))) {
      setError("Item, quantity, unit, ship to, and keywords stay public so Jev can search.");
      return;
    }
    if (!Number.isSafeInteger(maxBudget) || maxBudget <= 0) {
      setError("Enter a maximum budget greater than zero.");
      return;
    }
    if (!wallet) {
      setError("The prover is still starting. Try again in a moment.");
      return;
    }

    const started = performance.now();
    setIsSearching(true);
    try {
      let lock = lockedIntent;
      if (!lock) {
        setChainPhase("commit-range");
        lock = await workflowRef.current.lockIntent({
          intentId: `intent-${crypto.randomUUID()}`,
          publicRequirement: parsed.data,
          priceMaxKrw: BigInt(maxBudget),
        });
        setLockedIntent(lock);
      }
      setChainPhase("search");
      const empty = {
        searchId: crypto.randomUUID(),
        intentId: lock.intentId,
        plan: { query: "…", country: "ALL" as const, sort: "relevance" as const },
        offers: [] as RankedOffer[],
        searchedAt: new Date().toISOString(),
      };
      setSearchResult(empty);
      setPage("sort");
      let latestOffers = empty.offers;
      await streamPipeline(
        {
          ...buildSearchRequest(lock.intentId, parsed.data),
          ...(publicIds.includes("budget") ? { disclosedBudgetKrw: String(maxBudget) } : {}),
        },
        (pipelineEvent) => {
          if (pipelineEvent.type === "queries") {
            setSearchResult((current) => {
              if (!current) return current;
              return { ...current, plan: { ...current.plan, query: pipelineEvent.queries.join(" · ") } };
            });
          }
          if (pipelineEvent.type === "page") {
            setSearchResult((current) => {
              if (!current) return current;
              const byId = new Map(current.offers.map((ranked) => [ranked.offer.offerId, ranked]));
              for (const ranked of pipelineEvent.offers) byId.set(ranked.offer.offerId, ranked);
              const offers = [...byId.values()].sort((left, right) =>
                right.relevanceScore - left.relevanceScore
                || left.offer.offerId.localeCompare(right.offer.offerId));
              latestOffers = offers;
              return {
                ...current,
                offers,
                plan: { ...current.plan, query: pipelineEvent.query },
              };
            });
          }
        },
        apiFetch,
      );
      setSortMs(performance.now() - started);
      const firstFit = latestOffers.find(
        ({ offer }) => offerFit(offer, maxBudget, form.requiredBy) === "fits",
      );
      setSelectedOfferId(firstFit?.offer.offerId ?? latestOffers[0]?.offer.offerId ?? null);
      setConfirmed(false);
      setApproval(null);
      setPage("sort");
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : "The sort did not finish.";
      try {
        const recovery = await recoverFromFailedSearch();
        setError(`${message} ${recovery}`);
      } catch {
        setLockedIntent(null);
        setWallet(null);
        setWalletReady(false);
        setError(`${message} The lock was cleared.`);
      }
    } finally {
      setIsSearching(false);
      setChainPhase("idle");
    }
  }

  async function confirmApproval() {
    if (!selectedOffer || !searchResult || !lockedIntent || !wallet) return;
    setIsApproving(true);
    setApprovalError(null);
    setChainPhase("commit-verify");
    try {
      const verified = await workflowRef.current.verifyOffer(searchResult.intentId, selectedOffer.offer);
      const hash = await offerSnapshotHash(selectedOffer.offer);
      const approvalId = crypto.randomUUID();
      const nextApproval: ApprovalState = {
        approvalId,
        offerSnapshotHash: hash,
        approvedAt: verified.verifiedAt,
        commitVerifyTransactionId: verified.commitVerifyTransactionId,
        rankedOffer: selectedOffer,
      };
      try {
        const persisted = await createExecutionHistory({
          approvalId,
          accountIdHash: await sha256Hex(`privy:${userId}`),
          intentId: searchResult.intentId,
          publicRequirement: lockedIntent.publicRequirement,
          offer: selectedOffer.offer,
          offerSnapshotHash: hash,
          commitRangeTransactionId: lockedIntent.commitRangeTransactionId,
          commitVerifyTransactionId: verified.commitVerifyTransactionId,
          approvedAt: verified.verifiedAt,
        }, apiFetch);
        nextApproval.executionStatus = persisted.status;
      } catch (persistenceFailure) {
        nextApproval.persistenceError = persistenceFailure instanceof Error
          ? persistenceFailure.message
          : "The order record could not be saved.";
      }
      setApproval(nextApproval);
    } catch (approvalFailure) {
      setApprovalError(approvalFailure instanceof Error ? approvalFailure.message : "The mapper check failed.");
    } finally {
      setIsApproving(false);
      setChainPhase("idle");
    }
  }

  async function startOver() {
    const previousMode = workflowRef.current.mode;
    const replacement = createProcurementContractWorkflow();
    workflowRef.current = replacement;
    setPage("input");
    setSearchResult(null);
    setSelectedOfferId(null);
    setApproval(null);
    setLockedIntent(null);
    setSortMs(null);
    setForm({ ...initialForm, item: "", keywords: "" });
    setConfirmed(false);
    setError(null);
    setApprovalError(null);
    if (previousMode === "demo" && wallet) {
      setWallet(await replacement.connectWallet());
      setWalletReady(true);
    } else {
      setWallet(null);
      setWalletReady(false);
    }
  }

  const canOpen: Record<StepId, boolean> = {
    onboard: true,
    input: true,
    sort: searchResult !== null,
    verify: selectedOffer !== null && lockedIntent !== null,
    list: approval !== null && searchResult !== null,
  };

  function openStep(step: StepId) {
    if (canOpen[step]) setPage(step);
  }

  const orderNote = approval?.persistenceError
    ? approval.persistenceError
    : approval?.executionStatus === "failed"
      ? "The fit was checked. The demo order did not go through. Past buys can try it again."
      : "The fit was checked. The demo order was recorded. No live marketplace order was sent.";

  return (
    <Shell
      page={page}
      canOpen={canOpen}
      onStep={openStep}
      onHistory={() => void openHistory()}
      onLogout={onLogout}
      userLabel={userLabel}
      walletAddress={serverWalletAddress}
    >
      {page === "onboard" && (
        <OnboardPage
          walletAddress={serverWalletAddress}
          creatingWallet={creatingWallet}
          jevKeyStored={jevKeyStored}
          error={error}
          onCreateWallet={() => void createLocalWallet()}
          onSaveJevKey={(apiKey) => void saveJevKey(apiKey)}
          onContinue={() => { setError(null); setPage("input"); }}
        />
      )}
      {page === "input" && (
        <InputPage
          form={form}
          locked={Boolean(lockedIntent)}
          searching={isSearching}
          phase={chainPhase === "search" ? "search" : chainPhase === "commit-range" ? "commit-range" : "idle"}
          error={error}
          onChange={updateField}
          onSubmit={(event, publicIds) => void handleSearch(event, publicIds)}
        />
      )}
      {page === "sort" && searchResult && (
        <SortPage
          result={searchResult}
          capKrw={maxBudget}
          requiredBy={form.requiredBy}
          selectedId={selectedOfferId}
          elapsedMs={sortMs}
          locked={lockedIntent}
          onSelect={setSelectedOfferId}
          onEdit={() => setPage("input")}
          onVerify={() => { setApprovalError(null); setPage("verify"); }}
        />
      )}
      {page === "verify" && selectedOffer && lockedIntent && (
        <VerifyPage
          ranked={selectedOffer}
          capKrw={maxBudget}
          requiredBy={form.requiredBy}
          rangeId={lockedIntent.commitRangeTransactionId}
          confirmed={confirmed}
          running={isApproving}
          error={approvalError}
          verifiedId={approval?.commitVerifyTransactionId ?? null}
          onConfirm={setConfirmed}
          onCheck={() => void confirmApproval()}
          onOpenList={() => setPage("list")}
        />
      )}
      {page === "list" && searchResult && approval && (
        <ListPage
          result={searchResult}
          capKrw={maxBudget}
          requiredBy={form.requiredBy}
          keptId={approval.rankedOffer.offer.offerId}
          elapsedMs={sortMs}
          orderNote={orderNote}
          onNew={() => void startOver()}
          onHistory={() => void openHistory()}
        />
      )}
      {page === "history" && (
        <HistoryPage
          loading={isLoadingHistory}
          error={historyError}
          actionError={historyActionError}
          records={historyRecords}
          retryingId={retryingExecutionId}
          onRetryLoad={() => void openHistory()}
          onRetryOrder={(record) => void retryOrder(record)}
          onNew={() => void startOver()}
        />
      )}
    </Shell>
  );
}
