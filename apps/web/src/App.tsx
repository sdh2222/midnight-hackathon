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
import { buildSearchRequest, searchOffers } from "./api/search";
import { fetchServerWallet } from "./api/wallet";
import {
  createProcurementContractWorkflow,
  type LockedIntent,
  type WalletConnection,
} from "./midnight";
import {
  ArrowIcon,
  BoxIcon,
  CheckIcon,
  ClockIcon,
  ExternalIcon,
  LockIcon,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
} from "./components/Icons";

type Stage = "intent" | "compare" | "approved" | "history";
type WalletStatus = "detecting" | "ready" | "connecting" | "connected" | "missing";
type ChainPhase = "idle" | "commit-range" | "search" | "commit-verify";

type IntentForm = {
  item: string;
  quantity: string;
  unit: string;
  destinationCountry: string;
  keywords: string;
  requiredBy: string;
  priceMaxKrw: string;
};

type ApprovalState = {
  approvalId: string;
  offerSnapshotHash: string;
  approvedAt: string;
  commitVerifyTransactionId: string;
  rankedOffer: RankedOffer;
  executionRecord?: ExecutionHistoryRecord;
  persistenceError?: string;
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

const steps = [
  { id: "intent", label: "요청 입력", helper: "구매 조건 설정" },
  { id: "compare", label: "후보 비교", helper: "AI 검색 결과" },
  { id: "approved", label: "승인 완료", helper: "검증 기록" },
] as const;

const sortLabels: Record<string, string> = {
  relevance: "적합도순",
  price_asc: "가격순",
  lead_time_asc: "빠른 납기순",
};

const statusLabels: Record<string, string> = {
  deal_approved: "승인됨",
  verifying: "검증 중",
  verified: "검증 완료",
  executing: "주문 준비 중",
  retrying: "재시도 중",
  order_submitted: "주문 요청됨",
  counterparty_accepted: "공급자 접수",
  settled: "거래 완료",
  failed: "처리 실패",
  cancelled: "취소됨",
};

function won(value: string | number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(typeof value === "string" ? Number(value) : value);
}

function number(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function compactHash(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function stageIndex(stage: Stage): number {
  return steps.findIndex((step) => (step.id as string) === stage);
}

export function App({ userId, userLabel, apiFetch, onLogout }: {
  userId: string;
  userLabel: string;
  apiFetch: typeof globalThis.fetch;
  onLogout: () => void;
}) {
  const workflowRef = useRef(createProcurementContractWorkflow());
  const [stage, setStage] = useState<Stage>("intent");
  const [form, setForm] = useState<IntentForm>(initialForm);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("detecting");
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [lockedIntent, setLockedIntent] = useState<LockedIntent | null>(null);
  const [chainPhase, setChainPhase] = useState<ChainPhase>("idle");
  const [historyRecords, setHistoryRecords] = useState<ExecutionHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyActionError, setHistoryActionError] = useState<string | null>(null);
  const [retryingExecutionId, setRetryingExecutionId] = useState<string | null>(null);
  const [serverWalletAddress, setServerWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (workflowRef.current.mode !== "demo") {
      setWalletStatus("missing");
      return () => { active = false; };
    }
    void workflowRef.current.connectWallet().then((connection) => {
      if (!active) return;
      setWallet(connection);
      setWalletStatus("connected");
    }).catch((failure) => {
      if (!active) return;
      setError(failure instanceof Error ? failure.message : "거래 준비에 실패했습니다.");
      setWalletStatus("missing");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchServerWallet(apiFetch).then((wallet) => {
      if (active) setServerWalletAddress(wallet.midnightAddress);
    }).catch((failure) => {
      if (!active) return;
      setError(failure instanceof Error ? failure.message : "Midnight 지갑을 준비하지 못했습니다.");
    });
    return () => {
      active = false;
    };
  }, [apiFetch]);

  const synchronizableExecutionIds = historyRecords
    .filter(({ status }) => status === "order_submitted" || status === "counterparty_accepted")
    .map(({ executionId }) => executionId)
    .join(",");

  useEffect(() => {
    if (stage !== "history" || !synchronizableExecutionIds) return;
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
  }, [stage, synchronizableExecutionIds, userId, apiFetch]);

  const maxBudget = Number(form.priceMaxKrw);
  const selectedOffer = useMemo(
    () => searchResult?.offers.find(({ offer }) => offer.offerId === selectedOfferId) ?? null,
    [searchResult, selectedOfferId],
  );
  const selectedEligible = selectedOffer
    ? Number(selectedOffer.offer.convertedTotalKrw) <= maxBudget
      && (!form.requiredBy || Boolean(selectedOffer.offer.deliveryDate
        && selectedOffer.offer.deliveryDate <= form.requiredBy))
    : false;
  const eligibleCount = searchResult?.offers.filter(
    ({ offer }) => Number(offer.convertedTotalKrw) <= maxBudget
      && (!form.requiredBy || Boolean(offer.deliveryDate && offer.deliveryDate <= form.requiredBy)),
  ).length ?? 0;

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
      setWalletStatus("connected");
      return "입력 잠금을 해제했어요. 조건을 수정한 뒤 다시 검색해 주세요.";
    }

    setWallet(null);
    setWalletStatus(await replacement.detectWallet() ? "ready" : "missing");
    return "입력 잠금을 해제했어요. 실제 체인에서는 새 요청용 컨트랙트 주소가 필요할 수 있습니다.";
  }

  async function openHistory() {
    setStage("history");
    setHistoryError(null);
    setHistoryActionError(null);
    setIsLoadingHistory(true);
    try {
      setHistoryRecords(await listExecutionHistory(await sha256Hex(`privy:${userId}`), apiFetch));
    } catch (historyFailure) {
      setHistoryError(
        historyFailure instanceof Error
          ? historyFailure.message
          : "거래 내역을 불러오지 못했습니다.",
      );
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
      setHistoryActionError(
        retryError instanceof Error ? retryError.message : "주문을 다시 요청하지 못했습니다.",
      );
    } finally {
      setRetryingExecutionId(null);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = PublicRequirementSchema.safeParse({
      item: form.item,
      quantity: Number(form.quantity),
      unit: form.unit,
      destinationCountry: form.destinationCountry.toUpperCase(),
      keywords: form.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
      ...(form.requiredBy ? { requiredBy: form.requiredBy } : {}),
    });

    if (!parsed.success) {
      setError("품목, 수량, 배송 국가와 검색어를 다시 확인해 주세요.");
      return;
    }
    if (!Number.isSafeInteger(maxBudget) || maxBudget <= 0) {
      setError("최대 예산을 0보다 큰 원화 금액으로 입력해 주세요.");
      return;
    }
    if (!wallet) {
      setError("거래 기능을 준비하는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

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
      const result = await searchOffers(buildSearchRequest(lock.intentId, parsed.data), apiFetch);
      setSearchResult(result);
      const firstEligible = result.offers.find(
        ({ offer }) => Number(offer.convertedTotalKrw) <= maxBudget
          && (!form.requiredBy || Boolean(offer.deliveryDate && offer.deliveryDate <= form.requiredBy)),
      );
      setSelectedOfferId(firstEligible?.offer.offerId ?? result.offers[0]?.offer.offerId ?? null);
      setStage("compare");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (searchError) {
      const message = searchError instanceof Error
        ? searchError.message
        : "검색을 완료하지 못했습니다.";
      try {
        const recoveryMessage = await recoverFromFailedSearch();
        setError(`${message} ${recoveryMessage}`);
      } catch {
        setLockedIntent(null);
        setWallet(null);
        setWalletStatus("ready");
        setError(`${message} 입력 잠금을 해제했어요. 지갑을 다시 연결해 주세요.`);
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
      const verified = await workflowRef.current.verifyOffer(
        searchResult.intentId,
        selectedOffer.offer,
      );
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
        nextApproval.executionRecord = persisted;
      } catch (persistenceFailure) {
        nextApproval.persistenceError = persistenceFailure instanceof Error
          ? persistenceFailure.message
          : "거래 내역을 저장하지 못했습니다.";
      }

      setApproval(nextApproval);
      setShowApproval(false);
      setStage("approved");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (approvalFailure) {
      setApprovalError(
        approvalFailure instanceof Error
          ? approvalFailure.message
          : "Midnight 검증에 실패했습니다.",
      );
    } finally {
      setIsApproving(false);
      setChainPhase("idle");
    }
  }

  async function startOver() {
    const previousMode = workflowRef.current.mode;
    const replacement = createProcurementContractWorkflow();
    workflowRef.current = replacement;
    setStage("intent");
    setSearchResult(null);
    setSelectedOfferId(null);
    setApproval(null);
    setLockedIntent(null);
    setForm({ ...initialForm, item: "", keywords: "" });
    setConfirmed(false);
    setError(null);
    setApprovalError(null);
    if (previousMode === "demo" && wallet) {
      setWallet(await replacement.connectWallet());
      setWalletStatus("connected");
    } else if (previousMode === "lace") {
      setWallet(null);
      setWalletStatus(await replacement.detectWallet() ? "ready" : "missing");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Midnight Buy 홈">
          <span className="brand-mark"><ShieldIcon /></span>
          <strong>Midnight Buy</strong>
        </a>
        <div className="topbar-actions">
          <button
            className={`nav-button ${stage === "history" ? "active" : ""}`}
            type="button"
            onClick={() => void openHistory()}
          >
            <ClockIcon />
            거래 내역
          </button>
          <span className="network-pill" title={serverWalletAddress ?? undefined}>
            <i />
            {serverWalletAddress ? compactHash(serverWalletAddress) : "Midnight 지갑 준비 중"}
          </span>
          <span className="account-pill">{userLabel}</span>
          <button className="nav-button" type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main>
        {stage !== "history" && <section className="hero">
          <span className="hero-chip"><SparkIcon /> AI 공급처 탐색 · 프라이버시 데모</span>
          <h1>기업 구매를 더 빠르고<br /><em>안전하게.</em></h1>
          <p>필요한 품목만 알려주세요. AI가 공급처를 비교하고<br className="desktop-break" /> 민감한 예산은 외부 검색 서비스에 보내지 않아요.</p>
        </section>}

        {stage !== "history" && <nav className="stepper" aria-label="구매 진행 단계">
          {steps.map((step, index) => {
            const activeIndex = stageIndex(stage);
            const isDone = index < activeIndex;
            const isActive = index === activeIndex;
            return (
              <div className={`step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`} key={step.id}>
                <span className="step-number">{isDone ? <CheckIcon /> : index + 1}</span>
                <span className="step-copy">
                  <strong>{step.label}</strong>
                  <small>{step.helper}</small>
                </span>
                {index < steps.length - 1 && <span className="step-line" />}
              </div>
            );
          })}
        </nav>}

        {stage === "intent" && (
          <section className="workspace intent-layout">
            <form className="card intent-card" onSubmit={handleSearch}>
              <div className="card-heading">
                <div>
                  <span className="section-kicker">구매 요청</span>
                  <h2>무엇을 찾고 계신가요?</h2>
                  <p>공개해도 되는 구매 조건을 입력해 주세요.</p>
                </div>
                <span className="ai-badge"><SparkIcon /> AI 검색</span>
              </div>

              <div className="field">
                <label htmlFor="item">구매 품목</label>
                <input
                  id="item"
                  value={form.item}
                  onChange={(event) => updateField("item", event.target.value)}
                  placeholder="예: Industrial nitrile gloves"
                  disabled={Boolean(lockedIntent)}
                  required
                />
              </div>

              <div className="field-grid three">
                <div className="field">
                  <label htmlFor="quantity">수량</label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(event) => updateField("quantity", event.target.value)}
                    disabled={Boolean(lockedIntent)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="unit">단위</label>
                  <select
                    id="unit"
                    value={form.unit}
                    onChange={(event) => updateField("unit", event.target.value)}
                    disabled={Boolean(lockedIntent)}
                  >
                    <option value="piece">개 (piece)</option>
                    <option value="pair">쌍 (pair)</option>
                    <option value="box">박스 (box)</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="country">배송 국가</label>
                  <select
                    id="country"
                    value={form.destinationCountry}
                    onChange={(event) => updateField("destinationCountry", event.target.value)}
                    disabled={Boolean(lockedIntent)}
                  >
                    <option value="KR">대한민국 (KR)</option>
                    <option value="US">미국 (US)</option>
                    <option value="JP">일본 (JP)</option>
                    <option value="SG">싱가포르 (SG)</option>
                  </select>
                </div>
              </div>

              <div className="field-grid two">
                <div className="field">
                  <label htmlFor="keywords">검색 키워드 <small>쉼표로 구분</small></label>
                  <input
                    id="keywords"
                    value={form.keywords}
                    onChange={(event) => updateField("keywords", event.target.value)}
                    placeholder="powder-free, industrial"
                    disabled={Boolean(lockedIntent)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="requiredBy">희망 납기일</label>
                  <input
                    id="requiredBy"
                    type="date"
                    value={form.requiredBy}
                    onChange={(event) => updateField("requiredBy", event.target.value)}
                    disabled={Boolean(lockedIntent)}
                  />
                </div>
              </div>

              <div className={`private-field ${lockedIntent ? "locked" : ""}`}>
                <div className="private-icon"><LockIcon /></div>
                <div className="private-copy">
                  <strong>{lockedIntent ? "예산 범위 잠금 완료" : "최대 예산"}</strong>
                  <span>
                    {lockedIntent
                      ? `commitRange · ${compactHash(lockedIntent.commitRangeTransactionId)}`
                      : "AI와 공급처에 공개되지 않아요"}
                  </span>
                </div>
                <div className="money-input">
                  <span>₩</span>
                  <input
                    aria-label="최대 예산"
                    type="number"
                    min="1"
                    value={form.priceMaxKrw}
                    onChange={(event) => updateField("priceMaxKrw", event.target.value)}
                    disabled={Boolean(lockedIntent)}
                  />
                </div>
              </div>

              {error && <div className="error-banner" role="alert">{error}</div>}

              <button className="primary-button search-button" type="submit" disabled={isSearching}>
                {isSearching && chainPhase === "commit-range" && (
                  <><span className="spinner" /> 예산 조건을 안전하게 잠그는 중</>
                )}
                {isSearching && chainPhase === "search" && (
                  <><span className="spinner" /> Jev가 가장 좋은 후보를 찾는 중</>
                )}
                {!isSearching && (
                  <><SearchIcon /> {lockedIntent ? "후보 다시 검색하기" : "AI로 공급처 찾기"} <ArrowIcon /></>
                )}
              </button>
            </form>

            <aside className="privacy-card">
              <div className="privacy-visual">
                <span className="privacy-shield"><ShieldIcon /></span>
                <span className="orbit one" />
                <span className="orbit two" />
              </div>
              <span className="section-kicker blue">Privacy by design</span>
              <h3>예산은 숨기고,<br />조건 충족만 증명해요.</h3>
              <p>민감한 구매 한도는 브라우저에 보관돼요. 현재 데모에서는 로컬로 조건을 확인하며, 실제 영지식 증명과 체인 기록은 후속 연동 단계입니다.</p>
              <div className="privacy-list">
                <div><SearchIcon /><span><strong>AI가 보는 정보</strong>품목 · 수량 · 납기 · 키워드</span></div>
                <div><LockIcon /><span><strong>비공개 정보</strong>최대 예산 · salt · 검증 원문</span></div>
                <div><CheckIcon /><span><strong>데모 검증 결과</strong>예산 조건 충족 · 선택 내역</span></div>
              </div>
            </aside>
          </section>
        )}

        {stage === "compare" && searchResult && (
          <section className="workspace compare-workspace">
            <div className="compare-header">
              <div>
                <span className="section-kicker">AI 추천 결과</span>
                <h2>조건에 맞는 후보를 찾았어요</h2>
                <p>총 {searchResult.offers.length}개 중 상품금액 예상치가 예산 이내인 후보는 <strong>{eligibleCount}개</strong>예요.</p>
              </div>
              <button className="text-button" type="button" onClick={() => setStage("intent")}>
                검색 조건 보기
              </button>
            </div>

            <div className="search-summary">
              <span className="query"><SearchIcon /> {searchResult.plan.query}</span>
              <span>공급 국가 {searchResult.plan.country}</span>
              <span>{sortLabels[searchResult.plan.sort] ?? searchResult.plan.sort}</span>
              <span className="private-chip"><LockIcon /> 예산은 로컬에서 비교</span>
              {lockedIntent && (
                <span className="chain-chip"><ShieldIcon /> {compactHash(lockedIntent.commitRangeTransactionId)}</span>
              )}
            </div>

            <div className="offer-list">
              {searchResult.offers.map((rankedOffer, index) => {
                const { offer } = rankedOffer;
                const eligible = Number(offer.convertedTotalKrw) <= maxBudget
                  && (!form.requiredBy || Boolean(offer.deliveryDate && offer.deliveryDate <= form.requiredBy));
                const selected = selectedOfferId === offer.offerId;
                return (
                  <article
                    className={`offer-card ${selected ? "selected" : ""} ${eligible ? "" : "disabled"}`}
                    key={offer.offerId}
                  >
                    <button
                      className="offer-select"
                      type="button"
                      onClick={() => setSelectedOfferId(offer.offerId)}
                      aria-label={`${offer.title} 선택`}
                    >
                      <span className="radio">{selected && <CheckIcon />}</span>
                    </button>
                    <div className="offer-main">
                      <div className="offer-title-row">
                        <div>
                          <div className="offer-badges">
                            <span className="rank-badge">추천 {index + 1}</span>
                            {offer.pricingBasis === "catalog_estimate" && <span className="rank-badge">Alibaba 실시간 상품</span>}
                            <span className={`fit-badge ${eligible ? "fit" : "over"}`}>
                              {eligible ? "예상 금액 이내" : Number(offer.convertedTotalKrw) > maxBudget ? "예산 초과 예상" : "납기 미확인"}
                            </span>
                          </div>
                          <h3>{offer.title}</h3>
                          <p>{offer.supplierName ?? offer.supplierId} · {offer.variant ?? "표준 사양"}</p>
                        </div>
                        <div className="score">
                          <strong>{Math.round(rankedOffer.relevanceScore * 100)}</strong>
                          <span>AI 적합도</span>
                        </div>
                      </div>
                      <div className="offer-metrics">
                        <div className="price-metric">
                          <span>{offer.pricingBasis === "catalog_estimate" ? "상품금액 예상 상한" : "총 예상 금액"}</span>
                          <strong>{won(offer.convertedTotalKrw)}</strong>
                          <small>{offer.pricingBasis === "catalog_estimate" ? "배송비·관세 제외 · 환율은 데모 기준" : "수량 및 배송비 반영"}</small>
                        </div>
                        <div>
                          <span>주문 수량</span>
                          <strong>{number(offer.quantity)} {offer.unit}</strong>
                          <small>MOQ {number(offer.minimumOrderQuantity ?? 0)}</small>
                        </div>
                        <div>
                          <span>예상 납기</span>
                          <strong>{offer.leadTimeDays === undefined ? "미확인" : `${offer.leadTimeDays}일`}</strong>
                          <small>{offer.deliveryDate ?? "일정 미정"}</small>
                        </div>
                        <div>
                          <span>거래 조건</span>
                          <strong>{offer.incoterm ?? "협의"}</strong>
                          <small>{offer.originalCurrency} {offer.originalUnitPrice} / {offer.unit}</small>
                        </div>
                      </div>
                    </div>
                    <a className="source-link" href={offer.sourceUrl} target="_blank" rel="noreferrer">
                      상품 원문 <ExternalIcon />
                    </a>
                  </article>
                );
              })}
            </div>

            <div className="approval-bar">
              <div className="approval-selection">
                <span className="selection-icon"><BoxIcon /></span>
                <span>
                  <small>{selectedOffer?.offer.pricingBasis === "catalog_estimate" ? "선택한 상품 예상금액" : "선택한 견적"}</small>
                  <strong>{selectedOffer?.offer.title ?? "후보를 선택해 주세요"}</strong>
                </span>
              </div>
              {selectedOffer && <b>{won(selectedOffer.offer.convertedTotalKrw)}</b>}
              <button
                className="primary-button"
                type="button"
                disabled={!selectedOffer || !selectedEligible}
                onClick={() => {
                  setConfirmed(false);
                  setApprovalError(null);
                  setShowApproval(true);
                }}
              >
                이 견적 승인하기 <ArrowIcon />
              </button>
            </div>
          </section>
        )}

        {stage === "history" && (
          <section className="workspace history-workspace">
            <div className="history-header">
              <div>
                <span className="section-kicker">Purchase history</span>
                <h1>거래 내역</h1>
                <p>승인한 상품과 데모 검증 기록을 한곳에서 확인하세요.</p>
              </div>
              <button className="primary-button" type="button" onClick={() => void startOver()}>
                새 구매 요청 <ArrowIcon />
              </button>
            </div>

            {isLoadingHistory && (
              <div className="history-state"><span className="spinner blue-spinner" /> 거래 내역을 불러오는 중</div>
            )}
            {historyError && (
              <div className="history-state error-state">
                <strong>{historyError}</strong>
                <button className="text-button" type="button" onClick={() => void openHistory()}>다시 불러오기</button>
              </div>
            )}
            {historyActionError && (
              <div className="history-action-error" role="alert">{historyActionError}</div>
            )}
            {!isLoadingHistory && !historyError && historyRecords.length === 0 && (
              <div className="history-empty">
                <span><BoxIcon /></span>
                <h2>아직 승인한 거래가 없어요</h2>
                <p>첫 번째 구매 요청을 만들고 견적을 승인하면 여기에 기록됩니다.</p>
                <button className="secondary-button" type="button" onClick={() => void startOver()}>
                  구매 요청 시작하기
                </button>
              </div>
            )}
            {!isLoadingHistory && !historyError && historyRecords.length > 0 && (
              <div className="history-list">
                {historyRecords.map((record) => (
                  <article className="history-card" key={record.executionId}>
                    <div className="history-card-top">
                      <div>
                        <span className="history-date">{new Date(record.approvedAt).toLocaleString("ko-KR")}</span>
                        <h2>{record.offer.title}</h2>
                        <p>{record.offer.supplierName ?? record.offer.supplierId} · {record.offer.variant ?? "표준 사양"}</p>
                      </div>
                      <span className={`status-badge status-${record.status}`}>
                        <CheckIcon /> {statusLabels[record.status] ?? record.status}
                      </span>
                    </div>
                    <div className="history-summary">
                      <div><span>{record.offer.pricingBasis === "catalog_estimate" ? "상품 예상금액" : "승인 금액"}</span><strong>{won(record.offer.convertedTotalKrw)}</strong></div>
                      <div><span>수량</span><strong>{number(record.offer.quantity)} {record.offer.unit}</strong></div>
                      <div><span>납기</span><strong>{record.offer.deliveryDate ?? "미정"}</strong></div>
                      <div><span>거래 조건</span><strong>{record.offer.incoterm ?? "협의"}</strong></div>
                    </div>
                    <div className="history-ledger">
                      <span><ShieldIcon /> commitRange <code title={record.commitRangeTransactionId}>{compactHash(record.commitRangeTransactionId)}</code></span>
                      <span><CheckIcon /> commitVerify <code title={record.commitVerifyTransactionId}>{compactHash(record.commitVerifyTransactionId)}</code></span>
                      {record.providerOrderId && (
                        <span title={record.providerOrderId}><BoxIcon /> Mock 주문 <code>{compactHash(record.providerOrderId)}</code></span>
                      )}
                      <span>시도 {record.attemptCount}회</span>
                      <a href={record.offer.sourceUrl} target="_blank" rel="noreferrer">상품 원문 <ExternalIcon /></a>
                    </div>
                    {record.status === "failed" && (
                      <div className="history-retry">
                        <span>주문 처리 실패 · {record.failureCode ?? "UNKNOWN_ERROR"}</span>
                        <button
                          className="text-button"
                          type="button"
                          disabled={retryingExecutionId === record.executionId}
                          onClick={() => void retryOrder(record)}
                        >
                          {retryingExecutionId === record.executionId ? "재시도 중" : "주문 다시 시도"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {stage === "approved" && approval && (
          <section className="workspace approved-workspace">
            <span className="success-mark"><CheckIcon /></span>
            <span className="section-kicker">Approval complete</span>
            <h2>견적 승인이 완료됐어요</h2>
            <p>선택한 상품금액 예상치가 예산 이내인지 데모에서 확인하고 승인 내역을 저장했습니다. 실제 Midnight 트랜잭션은 전송하지 않았습니다.</p>

            <div className="approved-card">
              <div className="approved-offer">
                <div>
                  <small>{approval.rankedOffer.offer.supplierName ?? approval.rankedOffer.offer.supplierId}</small>
                  <h3>{approval.rankedOffer.offer.title}</h3>
                  <span>{approval.rankedOffer.offer.variant ?? "표준 사양"}</span>
                </div>
                <strong>{won(approval.rankedOffer.offer.convertedTotalKrw)}</strong>
              </div>
              <dl>
                <div>
                  <dt>검증 상태</dt>
                  <dd className="verified-status"><CheckIcon /> 데모 검증 완료</dd>
                </div>
                <div>
                  <dt>승인 시각</dt>
                  <dd>{new Date(approval.approvedAt).toLocaleString("ko-KR")}</dd>
                </div>
                <div>
                  <dt>commitVerify</dt>
                  <dd title={approval.commitVerifyTransactionId}>{compactHash(approval.commitVerifyTransactionId)}</dd>
                </div>
                <div>
                  <dt>견적 스냅샷</dt>
                  <dd title={approval.offerSnapshotHash}>{compactHash(approval.offerSnapshotHash)}</dd>
                </div>
              </dl>
            </div>

            <div className="next-step-note">
              {approval.persistenceError ? <ExternalIcon /> : <ClockIcon />}
              <span>
                <strong>
                  {approval.persistenceError
                    ? "데모 검증은 완료됐지만 내역 저장에 실패했어요"
                    : approval.executionRecord?.status === "failed"
                      ? "검증은 완료됐지만 Mock 주문 요청에 실패했어요"
                      : "Mock Alibaba 주문 요청이 접수됐어요"}
                </strong>
                <small>
                  {approval.persistenceError
                    ? approval.persistenceError
                    : approval.executionRecord?.status === "failed"
                      ? `${approval.executionRecord.failureCode ?? "UNKNOWN_ERROR"} · 거래 내역에서 다시 시도할 수 있어요.`
                      : `Mock 주문 ID ${approval.executionRecord?.providerOrderId ?? "-"} · 실제 Alibaba 주문은 아직 전송되지 않습니다.`}
                </small>
              </span>
            </div>
            <div className="approved-actions">
              <button className="secondary-button" type="button" onClick={() => void startOver()}>새 구매 요청 만들기</button>
              <button className="primary-button" type="button" onClick={() => void openHistory()}>거래 내역 보기</button>
            </div>
          </section>
        )}
      </main>

      <footer>
        <span><ShieldIcon /> Midnight ZK 연동을 준비 중인 데모</span>
        <span>민감한 구매 조건은 공개되지 않습니다.</span>
      </footer>

      {showApproval && selectedOffer && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !isApproving && setShowApproval(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="modal-icon"><ShieldIcon /></span>
            <h2 id="approval-title">이 견적을 승인할까요?</h2>
            <p>{selectedOffer.offer.pricingBasis === "catalog_estimate"
              ? "Alibaba 상품 가격은 확정 견적이 아닙니다. 배송비·관세·실제 납기는 공급자 확인이 필요하며, 이 승인은 데모 주문 요청으로 기록됩니다."
              : "승인하면 데모에서 예산 조건을 확인하고 견적 스냅샷을 저장합니다."}</p>
            <div className="modal-offer">
              <span>
                <small>{selectedOffer.offer.supplierName ?? selectedOffer.offer.supplierId}</small>
                <strong>{selectedOffer.offer.title}</strong>
              </span>
              <b>{won(selectedOffer.offer.convertedTotalKrw)}</b>
            </div>
            <div className="budget-check">
              <CheckIcon />
              상품금액 예상치가 비공개 예산 이내예요
              <strong>데모 확인</strong>
            </div>
            <label className="confirm-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>선택한 공급처, 금액, 납기 조건을 확인했으며 이 견적의 승인을 요청합니다.</span>
            </label>
            {approvalError && <div className="error-banner" role="alert">{approvalError}</div>}
            <div className="modal-actions">
              <button className="secondary-button" type="button" disabled={isApproving} onClick={() => setShowApproval(false)}>
                다시 보기
              </button>
              <button className="primary-button" type="button" disabled={!confirmed || isApproving} onClick={confirmApproval}>
                {isApproving && chainPhase === "commit-verify"
                  ? <><span className="spinner" /> 데모 검증 중</>
                  : <><ShieldIcon /> 승인하고 검증하기</>}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
