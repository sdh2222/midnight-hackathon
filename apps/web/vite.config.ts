import type { IncomingMessage } from "node:http";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createKeystore } from "@midnight-ntwrk/wallet-sdk";
import { WalletSeeds } from "@midnight-ntwrk/testkit-js";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";

const walletFile = resolve(dirname(fileURLToPath(import.meta.url)), ".local/midnight-wallet.json");

const jevKeyFile = resolve(dirname(fileURLToPath(import.meta.url)), ".local/jev-key");
const reefKeyFile = resolve(dirname(fileURLToPath(import.meta.url)), ".local/reef-key");

function localWallet(): Plugin {
  return {
    name: "local-midnight-wallet",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path === "/local-wallet" && req.method === "GET") {
          const existing = readLocalWallet();
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ midnightAddress: existing?.midnightAddress ?? null }));
          return;
        }
        if (path === "/local-wallet" && req.method === "POST") {
          const record = ensureLocalWallet();
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ midnightAddress: record.midnightAddress }));
          return;
        }
        if ((path === "/local-jev-key" || path === "/local-reef-key") && req.method === "GET") {
          const file = path === "/local-jev-key" ? jevKeyFile : reefKeyFile;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ stored: existsSync(file) && readFileSync(file, "utf8").trim().length > 0 }));
          return;
        }
        if ((path === "/local-jev-key" || path === "/local-reef-key") && req.method === "POST") {
          const file = path === "/local-jev-key" ? jevKeyFile : reefKeyFile;
          void readRequestBody(req).then((raw) => {
            const parsed = JSON.parse(raw) as { apiKey?: string };
            const apiKey = parsed.apiKey?.trim() ?? "";
            if (!apiKey) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "missing_key" }));
              return;
            }
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, apiKey, { mode: 0o600 });
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ stored: true }));
          }).catch(() => {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "bad_key" }));
          });
          return;
        }
        next();
      });
    },
  };
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function readLocalWallet(): { midnightAddress: string } | undefined {
  if (!existsSync(walletFile)) return undefined;
  const stored = JSON.parse(readFileSync(walletFile, "utf8")) as { midnightAddress?: string };
  if (!stored.midnightAddress) return undefined;
  return { midnightAddress: stored.midnightAddress };
}

function ensureLocalWallet(): { midnightAddress: string } {
  const existing = readLocalWallet();
  if (existing) return existing;
  const seedHex = randomBytes(32).toString("hex");
  const seeds = WalletSeeds.fromMasterSeed(seedHex);
  const midnightAddress = createKeystore(seeds.unshielded, "undeployed").getBech32Address().asString();
  mkdirSync(dirname(walletFile), { recursive: true });
  writeFileSync(walletFile, `${JSON.stringify({ seedHex, midnightAddress }, null, 2)}\n`, { mode: 0o600 });
  return { midnightAddress };
}

export default defineConfig({
  envDir: "../..",
  build: {
    target: "esnext",
  },
  plugins: [react(), wasm(), localWallet()],
  optimizeDeps: {
    exclude: ["@midnight-ntwrk/onchain-runtime-v3"],
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
