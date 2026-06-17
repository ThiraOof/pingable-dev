#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# enable-gns3.sh — turn on live labs on the dev VM (Ubuntu 24.04 on GCP).
#
# Runs the AUTOMATABLE on-VM steps to make GNS3 ready for the containerised
# app (install gns3server natively, bind it to 0.0.0.0, sanity-check KVM).
# The two steps that genuinely can't be scripted are called out at the end:
#   1) bumping the VM machine-type (needs the VM stopped; run from your laptop)
#   2) registering the VyOS appliance + grabbing its template_id (GNS3 GUI/API)
#
# Run ON THE VM, as your normal sudo user:
#   bash scripts/deploy/enable-gns3.sh
#
# After it finishes: set GNS3_VYOS_TEMPLATE + GNS3_HOST in .env.production,
# re-seed, and `up -d` (see docs/DEPLOY.md "เพิ่ม lab ทีหลัง").
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

say()  { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }

# ── 1. Verify nested virtualization / KVM ───────────────────────────────
# GNS3 runs VyOS as QEMU/KVM VMs. No /dev/kvm → labs won't start. This is
# the most common reason "the VM is up but labs hang".
say "Checking KVM (nested virtualization)"
sudo apt-get update -qq
sudo apt-get install -y -qq cpu-checker
if ! sudo kvm-ok; then
  warn "KVM is NOT available. The VM must be an N2/N1/C2 family created with"
  warn "--enable-nested-virtualization, and powered on after that change."
  warn "Fix the machine-type (see step A at the bottom) and re-run this script."
  exit 1
fi
[ -e /dev/kvm ] || { warn "/dev/kvm missing despite kvm-ok"; exit 1; }

# ── 2. Install GNS3 server (native — it needs /dev/kvm) ──────────────────
say "Installing gns3-server + qemu/ubridge"
sudo add-apt-repository -y ppa:gns3/ppa
sudo apt-get update -qq
# gns3-server (not the GUI), the dynamips/ubridge helpers, and qemu-kvm.
# DEBIAN_FRONTEND=noninteractive so the ubridge/wireshark setcap prompts
# don't block; we answer "yes" to giving non-root users raw packet caps.
echo "wireshark-common wireshark-common/install-setuid boolean true" | sudo debconf-set-selections
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  gns3-server qemu-kvm qemu-utils ubridge

# Let the current user (and the app, via the host) talk to KVM/ubridge.
sudo usermod -aG kvm,ubridge "$USER" || true

# ── 3. Bind GNS3 to 0.0.0.0 so the app CONTAINER can reach it ────────────
# The app runs in Docker; it reaches the host via host.docker.internal (the
# compose file maps it to the host gateway). A GNS3 bound to 127.0.0.1 is
# unreachable from the container — both the REST proxy AND the grader's
# telnet to node consoles would fail. Bind all interfaces; the GCP firewall
# (only 80/443 open) keeps GNS3 off the public internet regardless.
say "Configuring GNS3 to bind 0.0.0.0"
CONF_DIR="$HOME/.config/GNS3/2.2"
mkdir -p "$CONF_DIR"
CONF="$CONF_DIR/gns3_server.conf"
if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<'EOF'
[Server]
host = 0.0.0.0
port = 3080
; The grader runs in the app container and telnets node CONSOLE ports on the
; host (via host.docker.internal). Without this, GNS3 binds consoles to
; 127.0.0.1 and the container can't reach them → grading/boot-probe fail.
allow_console_from_anywhere = True
; Optional basic-auth (defense-in-depth — GNS3 is already private). If you set
; these, mirror them into .env.production as GNS3_USER / GNS3_PASS.
; auth = True
; user = pingable
; password = change-me
EOF
else
  warn "$CONF already exists — ensure [Server] has BOTH:"
  warn "    host = 0.0.0.0                       (not 127.0.0.1)"
  warn "    allow_console_from_anywhere = True   (so the container can telnet consoles)"
fi

# ── 4. Run GNS3 server as a systemd service (survives reboots) ───────────
say "Installing systemd unit gns3server.service"
sudo tee /etc/systemd/system/gns3server.service >/dev/null <<EOF
[Unit]
Description=GNS3 server
After=network.target

[Service]
User=$USER
ExecStart=$(command -v gns3server)
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now gns3server.service
sleep 2
sudo systemctl --no-pager --lines=10 status gns3server.service || true

# ── 5. Sanity-check the REST API answers on 0.0.0.0:3080 ─────────────────
say "Probing GNS3 REST API"
if curl -fsS "http://localhost:3080/v2/version"; then
  printf '\n'
  say "GNS3 is up."
else
  warn "GNS3 did not answer on :3080 — check 'journalctl -u gns3server'."
  exit 1
fi

cat <<'NEXT'

════════════════════════════════════════════════════════════════════════
GNS3 server is installed and bound to 0.0.0.0:3080. Remaining MANUAL steps:

A) Machine-type (only if KVM failed above) — run from your laptop:
     gcloud compute instances stop  pingable-dev --zone=asia-southeast1-b
     gcloud compute instances set-machine-type pingable-dev \
       --zone=asia-southeast1-b --machine-type=n2-standard-2
     gcloud compute instances start pingable-dev --zone=asia-southeast1-b
   (n2-standard-2 = 8GB; VyOS ≈512MB–1GB each → set LAB_MAX_CONCURRENT ~4–6)

B) Register the VyOS Universal Router appliance and grab its template_id:
   - Download the .gns3a from gns3.com/marketplace + the VyOS qcow2 image, OR
   - import via the GNS3 GUI pointed at this server, then:
       curl -s http://localhost:3080/v2/templates | \
         grep -i vyos        # copy the "template_id"

C) Wire it into the app and re-seed:
   In .env.production set:
       GNS3_HOST=http://host.docker.internal
       GNS3_PORT=3080
       GNS3_VYOS_TEMPLATE=<template_id from step B>
       LAB_MAX_CONCURRENT=5
   Then:
       docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
       docker compose -f docker-compose.prod.yml exec app npm run seed

D) Verify end-to-end: open a lab → wait for nodes to boot → grade once.
   Confirms both the REST proxy and the grader's telnet tunnel from the
   container through to the host's GNS3.
════════════════════════════════════════════════════════════════════════
NEXT
