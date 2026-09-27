import { WalletSeeds } from "@midnight-ntwrk/testkit-js";
import { createKeystore } from "@midnight-ntwrk/wallet-sdk";

export async function deriveMidnightAddress(
  seedHex: string,
  networkId = "undeployed",
): Promise<string> {
  const seeds = WalletSeeds.fromMasterSeed(seedHex);
  return createKeystore(seeds.unshielded, networkId).getBech32Address().asString();
}
