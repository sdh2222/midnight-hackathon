import { WebSocket } from "ws";
import * as Rx from "rxjs";
import { fileURLToPath } from "node:url";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import { FluentWalletBuilder, type DustWalletOptions } from "@midnight-ntwrk/testkit-js";
import type { WalletFacade } from "@midnight-ntwrk/wallet-sdk";
import {
  CompiledIntentContract,
  IntentContract,
  type IntentCircuitKeys,
} from "../index.js";

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
setNetworkId("undeployed");

const GENESIS_SEED = "0".repeat(63) + "1";
const config = {
  walletNetworkId: "undeployed",
  networkId: "undeployed",
  indexer: "http://127.0.0.1:8088/api/v4/graphql",
  indexerWS: "ws://127.0.0.1:8088/api/v4/graphql/ws",
  node: "http://127.0.0.1:9944",
  nodeWS: "ws://127.0.0.1:9944",
  proofServer: process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
  faucet: "",
} as const;

const dustOptions: DustWalletOptions = {
  ledgerParams: LedgerParameters.initialParameters(),
  additionalFeeOverhead: 300_000_000_000_000n,
  feeBlocksMargin: 5,
};

const waitForNextBlock = () => new Promise<void>((resolve) => setTimeout(resolve, 6_000));

function complete(progress: unknown): boolean {
  if (!progress || typeof progress !== "object") return false;
  const fn = (progress as { isStrictlyComplete?: unknown }).isStrictlyComplete;
  return typeof fn === "function" && (fn as () => boolean).call(progress);
}

async function waitForSync(wallet: WalletFacade): Promise<void> {
  await Rx.firstValueFrom(wallet.state().pipe(
    Rx.filter((state) =>
      complete(state.shielded.state.progress) &&
      complete(state.unshielded.progress) &&
      complete(state.dust.state.progress)),
    Rx.timeout({ first: 300_000 }),
  ));
}

async function waitForDust(wallet: WalletFacade): Promise<void> {
  await Rx.firstValueFrom(wallet.state().pipe(
    Rx.filter((state) => (state.dust?.availableCoins.length ?? 0) > 0),
    Rx.timeout({ first: 300_000 }),
  ));
}

async function main(): Promise<void> {
  const built = await FluentWalletBuilder.forEnvironment(config)
    .withDustOptions(dustOptions)
    .withSeed(GENESIS_SEED)
    .buildWithoutStarting();
  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(built.seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(built.seeds.dust);
  await built.wallet.start(shieldedSecretKeys, dustSecretKey);

  try {
    console.log("Waiting for the local genesis wallet to sync...");
    await waitForSync(built.wallet);
    const state = await Rx.firstValueFrom(built.wallet.state());
    const unregistered = state.unshielded?.availableCoins.filter(
      (coin) => coin.meta.registeredForDustGeneration === false,
    ) ?? [];
    if (unregistered.length > 0) {
      console.log(`Registering ${unregistered.length} NIGHT UTXO(s) for DUST...`);
      const recipe = await built.wallet.registerNightUtxosForDustGeneration(
        unregistered,
        built.keystore.getPublicKey(),
        (payload) => built.keystore.signData(payload),
      );
      await built.wallet.submitTransaction(await built.wallet.finalizeRecipe(recipe));
    }
    await waitForDust(built.wallet);

    const zkConfigProvider = new NodeZkConfigProvider<IntentCircuitKeys>(
      fileURLToPath(new URL("../managed/intent", import.meta.url)),
    );
    const walletProvider = {
      getCoinPublicKey: () => shieldedSecretKeys.coinPublicKey,
      getEncryptionPublicKey: () => shieldedSecretKeys.encryptionPublicKey,
      balanceTx: async (tx: Parameters<typeof built.wallet.balanceUnboundTransaction>[0]) => {
        const recipe = await built.wallet.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys, dustSecretKey },
          { ttl: ttlOneHour() },
        );
        return await built.wallet.finalizeRecipe(recipe);
      },
      submitTx: (tx: Parameters<typeof built.wallet.submitTransaction>[0]) => built.wallet.submitTransaction(tx),
    };
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: "intent-local-private-state",
        signingKeyStoreName: "intent-local-signing-keys",
        privateStoragePasswordProvider: () => "Local-Intent-2026!",
        accountId: built.keystore.getBech32Address().asString(),
      }),
      publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    };

    console.log("Deploying intent contract...");
    const deployed = await deployContract(providers, {
      compiledContract: CompiledIntentContract,
    });
    const contractAddress = deployed.deployTxData.public.contractAddress;
    console.log(`CONTRACT_ADDRESS=${contractAddress}`);
    await waitForNextBlock();
    await waitForSync(built.wallet);
    await waitForDust(built.wallet);
    const bytes = (value: number) => new Uint8Array(32).fill(value);

    console.log("Submitting commitRange...");
    const range = await deployed.callTx.commitRange(
      bytes(1),
      bytes(2),
      10n,
      1n,
      IntentContract.pureCircuits.rangeCommitment(
        1_000_000n,
        new Uint8Array(32),
        25_000n,
        bytes(3),
      ),
    );
    console.log(`COMMIT_RANGE_TX=${range.public.txId}`);
    await waitForNextBlock();
    await waitForSync(built.wallet);
    await waitForDust(built.wallet);

    const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
    if (!contractState) throw new Error("Contract state was not indexed after commitRange");
    const publicLedger = IntentContract.ledger(contractState.data);
    const expectedRangeCommitment = IntentContract.pureCircuits.rangeCommitment(
      1_000_000n,
      new Uint8Array(32),
      25_000n,
      bytes(3),
    );
    console.log(`INDEXED_HAS_RANGE=${publicLedger.hasRange}`);
    console.log(`INDEXED_RANGE_COMMITMENT=${Buffer.from(publicLedger.rangeCommitmentValue).toString("hex")}`);
    console.log(`EXPECTED_RANGE_COMMITMENT=${Buffer.from(expectedRangeCommitment).toString("hex")}`);

    console.log("Submitting commitVerify...");
    const verify = await deployed.callTx.commitVerify(
      bytes(1),
      1_000_000n,
      bytes(3),
      900_000n,
      IntentContract.pureCircuits.offerCommitment(900_000n, bytes(4), 24_999n, bytes(5)),
    );
    console.log(`COMMIT_VERIFY_TX=${verify.public.txId}`);
  } finally {
    await built.wallet.stop();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
