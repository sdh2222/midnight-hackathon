#!/usr/bin/env bash
# Per-boot reconciliation for the Midnight dev environment.
# There is no systemd in the Cloud Agent VM, so start the Docker daemon here.
# Idempotent: safe to run repeatedly; returns once Docker is ready.
set -euo pipefail

PROOF_SERVER_IMAGE="midnightntwrk/proof-server:8.1.0"

echo "[start] ensuring the Docker daemon is running"
if ! sudo docker info >/dev/null 2>&1; then
  sudo dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 30); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! sudo docker info >/dev/null 2>&1; then
  echo "[start] Docker daemon failed to start; see /tmp/dockerd.log" >&2
  exit 1
fi

echo "[start] making the docker socket usable without sudo for this boot"
sudo chown root:docker /var/run/docker.sock 2>/dev/null || true
sudo chmod 660 /var/run/docker.sock 2>/dev/null || true

echo "[start] ensuring the proof server image is present"
if ! sudo docker image inspect "$PROOF_SERVER_IMAGE" >/dev/null 2>&1; then
  sudo docker pull "$PROOF_SERVER_IMAGE"
fi

echo "[start] Docker ready. The proof server runs in the 'proof-server' terminal."
