#!/usr/bin/env bash
# Idempotent dev-environment bootstrap for the Midnight hackathon repo.
# - Installs Docker (needed for the local Midnight proof server / node / indexer).
# - Prepares the local .env from the template.
# - Installs npm dependencies once the hackathon adds a package.json.
# - Pre-pulls the proof server image so `start` is fast and offline-tolerant.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

PROOF_SERVER_IMAGE="midnightntwrk/proof-server:8.1.0"

echo "[install] system dependencies (docker + nested-container helpers)"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq \
    -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold \
    docker.io fuse-overlayfs iptables uidmap
fi

echo "[install] docker daemon config for the Cloud Agent nested VM"
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "storage-driver": "fuse-overlayfs",
  "iptables": false,
  "bridge": "none"
}
JSON

echo "[install] allow the agent user to use Docker without sudo"
sudo groupadd -f docker
sudo usermod -aG docker "$(id -un)" || true

echo "[install] local env file (gitignored; never overwrite an existing one)"
if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "[install] node dependencies (only once app code with a package.json exists)"
if [ -f package.json ]; then
  npm ci
fi

echo "[install] pre-pull Midnight proof server image ($PROOF_SERVER_IMAGE)"
if ! sudo docker image inspect "$PROOF_SERVER_IMAGE" >/dev/null 2>&1; then
  # Run dockerd briefly to pull, then stop it: nothing from install should keep running.
  sudo dockerd >/tmp/dockerd-install.log 2>&1 &
  dockerd_pid=$!
  for _ in $(seq 1 30); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
  sudo docker pull "$PROOF_SERVER_IMAGE" || true
  sudo kill "$dockerd_pid" >/dev/null 2>&1 || true
  wait "$dockerd_pid" 2>/dev/null || true
fi

echo "[install] done"
