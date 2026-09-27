export function won(value: string | number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(typeof value === "string" ? Number(value) : value);
}

export function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function compactHash(value: string): string {
  if (value.length <= 22) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export const FIT_WORD = {
  fits: "Within cap",
  "over-cap": "Over cap",
  date: "Date missing",
} as const;

export const SORT_WORD: Record<string, string> = {
  relevance: "Relevance",
  price_asc: "Lowest price",
  lead_time_asc: "Soonest delivery",
};

export const STATUS_WORD: Record<string, string> = {
  deal_approved: "Approved",
  verifying: "Verifying",
  verified: "Verified",
  executing: "Preparing order",
  retrying: "Retrying",
  order_submitted: "Order sent",
  counterparty_accepted: "Supplier accepted",
  settled: "Settled",
  failed: "Failed",
  cancelled: "Cancelled",
};
