import {
  CompiledIntentContract,
  IntentContract,
  type IntentCircuitKeys,
} from "@midnight-hackathon/intent-contract";
import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { setNetworkId, type NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import {
  Binding,
  type FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { MidnightProviders, UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import type {
  CommitRangeInput,
  CommitVerifyInput,
  ContractTransaction,
  IntentContractAdapter,
  WalletConnection,
} from "./types";

type IntentProviders = MidnightProviders<IntentCircuitKeys, string, undefined>;

type DeployedIntentContract = {
  callTx: {
    commitRange(...args: unknown[]): Promise<{ public: { txId: string } }>;
    commitVerify(...args: unknown[]): Promise<{ public: { txId: string } }>;
  };
};

function compatibleWallets(): InitialAPI[] {
  return Object.values(window.midnight ?? {}).filter((candidate): candidate is InitialAPI => {
    if (!candidate || typeof candidate !== "object") return false;
    const wallet = candidate as Partial<InitialAPI>;
    return (
      typeof wallet.apiVersion === "string"
      && wallet.apiVersion.split(".")[0] === "4"
      && typeof wallet.name === "string"
      && typeof wallet.connect === "function"
    );
  });
}

function privateStatePassword(address: string): string {
  const storageKey = `midnight-intent-storage-key:${address}`;
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const created = `Mi!${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  localStorage.setItem(storageKey, created);
  return created;
}

export class LaceIntentContractAdapter implements IntentContractAdapter {
  readonly mode = "lace" as const;
  private readonly networkId: NetworkId;
  private readonly contractAddress: string;
  private connection: WalletConnection | undefined;
  private contract: DeployedIntentContract | undefined;

  constructor(
    networkId = (import.meta.env.VITE_NETWORK_ID ?? "undeployed") as NetworkId,
    contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS ?? "",
  ) {
    this.networkId = networkId;
    this.contractAddress = contractAddress.trim();
  }

  async detectWallet(): Promise<boolean> {
    return compatibleWallets().length > 0;
  }

  async connectWallet(): Promise<WalletConnection> {
    const wallet = compatibleWallets()[0];
    if (!wallet) {
      throw new Error("호환되는 Midnight Lace 지갑을 찾지 못했습니다. Connector API 4.x가 필요합니다.");
    }
    if (!/^[0-9a-fA-F]{64}$/.test(this.contractAddress)) {
      throw new Error("VITE_CONTRACT_ADDRESS에 배포된 64자리 컨트랙트 주소를 설정해 주세요.");
    }

    setNetworkId(this.networkId);
    const connected = await wallet.connect(this.networkId);
    const { unshieldedAddress } = await connected.getUnshieldedAddress();
    this.contract = await this.findContract(connected, unshieldedAddress);
    this.connection = {
      walletName: wallet.name,
      address: unshieldedAddress,
      networkId: this.networkId,
      mode: "lace",
    };
    return this.connection;
  }

  async commitRange(input: CommitRangeInput): Promise<ContractTransaction> {
    const result = await this.requireContract().callTx.commitRange(
      input.intentId,
      input.itemId,
      input.quantity,
      input.version,
      IntentContract.pureCircuits.rangeCommitment(
        input.priceMax,
        input.sourceId,
        input.dateMax,
        input.salt,
      ),
    );
    return { transactionId: result.public.txId, submittedAt: new Date().toISOString() };
  }

  async commitVerify(input: CommitVerifyInput): Promise<ContractTransaction> {
    const result = await this.requireContract().callTx.commitVerify(
      input.intentId,
      input.priceMax,
      input.salt,
      input.offerPrice,
      IntentContract.pureCircuits.offerCommitment(
        input.offerPrice,
        input.offerSource,
        input.offerDate,
        input.offerSalt,
      ),
    );
    return { transactionId: result.public.txId, submittedAt: new Date().toISOString() };
  }

  private async findContract(
    connected: ConnectedAPI,
    address: string,
  ): Promise<DeployedIntentContract> {
    const config = await connected.getConfiguration();
    if (!config.proverServerUri) {
      throw new Error("Lace 지갑에 로컬 proof server가 설정되어 있지 않습니다.");
    }

    const shielded = await connected.getShieldedAddresses();
    const zkConfigProvider = new FetchZkConfigProvider<IntentCircuitKeys>(
      window.location.origin,
      fetch.bind(window),
    );
    const providers: IntentProviders = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: "intent-private-state",
        signingKeyStoreName: "intent-signing-keys",
        privateStoragePasswordProvider: () => privateStatePassword(address),
        accountId: address,
      }),
      publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(config.proverServerUri, zkConfigProvider),
      walletProvider: {
        getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
        getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
        balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
          const balanced = await connected.balanceUnsealedTransaction(toHex(tx.serialize()));
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            "signature",
            "proof",
            "binding",
            fromHex(balanced.tx),
          );
        },
      },
      midnightProvider: {
        submitTx: async (tx: FinalizedTransaction) => {
          await connected.submitTransaction(toHex(tx.serialize()));
          return tx.identifiers()[0];
        },
      },
    };

    return await findDeployedContract(providers, {
      contractAddress: this.contractAddress,
      compiledContract: CompiledIntentContract,
    }) as unknown as DeployedIntentContract;
  }

  private requireContract(): DeployedIntentContract {
    if (!this.connection || !this.contract) {
      throw new Error("먼저 Midnight 지갑을 연결해 주세요.");
    }
    return this.contract;
  }
}
