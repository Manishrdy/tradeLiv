#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OCI VM — First-time server bootstrap
# Tested on: Ubuntu 22.04 LTS / Oracle Linux 9 (Ampere A1 or any Compute shape)
#
# Run once as the default user (ubuntu / opc):
#   bash scripts/server-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-tradeliv.design}"
APP_DIR="/opt/tradeliv"

echo "──────────────────────────────────────────"
echo "  tradeLiv — OCI Server Bootstrap"
echo "  Domain: $DOMAIN"
echo "──────────────────────────────────────────"

# ── Detect OS ────────────────────────────────────────────────────────────────
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  echo "Cannot detect OS. Exiting."; exit 1
fi

# ── System packages ──────────────────────────────────────────────────────────
echo "[1/6] Installing system packages..."
if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
  sudo apt-get update -qq
  sudo apt-get install -y curl git ufw snapd
elif [[ "$OS" == "ol" || "$OS" == "rhel" || "$OS" == "centos" ]]; then
  sudo yum install -y curl git firewalld
fi

# ── Docker ───────────────────────────────────────────────────────────────────
echo "[2/6] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. NOTE: You may need to re-login for group changes."
else
  echo "Docker already installed — skipping."
fi

# Docker Compose v2 (plugin)
if ! docker compose version &>/dev/null; then
  echo "Installing Docker Compose plugin..."
  if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    sudo apt-get install -y docker-compose-plugin
  else
    sudo yum install -y docker-compose-plugin
  fi
fi

sudo systemctl enable --now docker

# ── App directory ────────────────────────────────────────────────────────────
echo "[3/6] Creating app directory at $APP_DIR..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

echo ""
echo "  Copy these files to $APP_DIR on this server:"
echo "    docker-compose.prod.yml"
echo "    docker/nginx.prod.conf  →  $APP_DIR/docker/nginx.prod.conf"
echo "    .env.prod.example       →  $APP_DIR/.env.prod  (fill in secrets)"
echo ""

# ── Firewall ─────────────────────────────────────────────────────────────────
echo "[4/6] Configuring firewall..."
if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
  echo "UFW rules set: SSH, 80, 443"
else
  sudo systemctl enable --now firewalld
  sudo firewall-cmd --permanent --add-service=ssh
  sudo firewall-cmd --permanent --add-service=http
  sudo firewall-cmd --permanent --add-service=https
  sudo firewall-cmd --reload
  echo "firewalld rules set: SSH, HTTP, HTTPS"
fi

# Also open ports in OCI's VCN Security List (must be done via OCI Console):
echo ""
echo "  IMPORTANT — also open ports in OCI Console:"
echo "    VCN → Security List → Add Ingress Rules:"
echo "      TCP  22   (SSH)"
echo "      TCP  80   (HTTP)"
echo "      TCP  443  (HTTPS)"
echo ""

# ── Certbot (Let's Encrypt SSL) ──────────────────────────────────────────────
echo "[5/6] Installing Certbot..."
if ! command -v certbot &>/dev/null; then
  if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    sudo snap install --classic certbot
    sudo ln -sf /snap/bin/certbot /usr/bin/certbot
  else
    sudo yum install -y certbot
  fi
else
  echo "Certbot already installed — skipping."
fi

echo ""
echo "  After DNS is pointed to this server, obtain your SSL cert:"
echo "    sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
echo "  Then set up auto-renewal:"
echo "    sudo systemctl enable --now certbot.timer"
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "[6/6] Done!"
echo ""
echo "═══════════════════════════════════════════"
echo "  Next steps"
echo "═══════════════════════════════════════════"
echo ""
echo "  1. Point DNS A record for $DOMAIN → $(curl -s ifconfig.me)"
echo ""
echo "  2. Copy deployment files to $APP_DIR:"
echo "       scp docker-compose.prod.yml ubuntu@SERVER:$APP_DIR/"
echo "       scp -r docker/ ubuntu@SERVER:$APP_DIR/docker/"
echo ""
echo "  3. Create $APP_DIR/.env.prod with production secrets"
echo "     (see .env.prod.example for all required vars)"
echo ""
echo "  4. Issue SSL certificate:"
echo "       sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "  5. Edit $APP_DIR/docker/nginx.prod.conf — replace 'yourdomain.com'"
echo "     with your actual domain."
echo ""
echo "  6. Add GitHub Actions secrets (Settings → Secrets → Actions):"
echo "       OCIR_REGISTRY   — e.g. iad.ocir.io/<tenancy-namespace>"
echo "       OCIR_USERNAME   — <tenancy-namespace>/oracleidentitycloudservice/<user>"
echo "       OCIR_TOKEN      — OCI auth token (OCI Console → Profile → Auth Tokens)"
echo "       OCI_HOST        — this server's public IP"
echo "       OCI_USER        — ubuntu (or opc on Oracle Linux)"
echo "       OCI_SSH_KEY     — your private SSH key"
echo "       TEST_DATABASE_URL     — PostgreSQL DSN for CI tests"
echo "       NEXT_PUBLIC_API_URL   — https://$DOMAIN/api"
echo "       NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
echo "       NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
echo ""
echo "  7. Push to main — GitHub Actions will build, push, and deploy automatically."
echo ""
echo "═══════════════════════════════════════════"
