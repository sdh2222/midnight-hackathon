#!/usr/bin/env bash
# Long-running Midnight proof server (foreground, so its logs stay visible).
# Listens on http://127.0.0.1:6300 — the address the repo's .env files pin.
# Uses host networking because the nested-VM daemon runs with bridge/iptables off.
set -euo pipefail

PROOF_SERVER_IMAGE="midnightntwrk/proof-server:8.1.0"
PROOF_SERVER_NAME="midnight-proof-server"

# Wait for the Docker daemon that `start` brings up.
for _ in $(seq 1 60); do
  sudo docker info >/dev/null 2>&1 && break
  sleep 1
done

# Remove any stale container from a previous boot before taking the name.
sudo docker rm -f "$PROOF_SERVER_NAME" >/dev/null 2>&1 || true

exec sudo docker run --rm --name "$PROOF_SERVER_NAME" --network host \
  -e RUST_BACKTRACE=full \
  "$PROOF_SERVER_IMAGE" midnight-proof-server -v
