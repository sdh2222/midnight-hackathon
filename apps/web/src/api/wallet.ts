import { ServerWalletSchema, type ServerWallet } from "@midnight-hackathon/shared";

export async function fetchServerWallet(
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<ServerWallet> {
  const response = await fetchImplementation(
    `${import.meta.env.VITE_API_BASE_URL ?? ""}/v1/wallet`,
  );
  if (!response.ok) {
    throw new Error("Midnight 지갑을 준비하지 못했습니다.");
  }
  return ServerWalletSchema.parse(await response.json());
}
