#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Насби худкори «Портали муосири маориф» дар сервери Ubuntu
# (Oracle Cloud Always Free — Ampere A1 ARM ё x86; Ubuntu 22.04 / 24.04).
#
# Чӣ мекунад: Node.js 22, PostgreSQL (танҳо localhost), Nginx, HTTPS-и ройгон
# (Let's Encrypt), хидмати systemd, firewall ва бэкапи ҳаррӯзаи база.
# Такрор иҷро кардан бехатар аст (idempotent): маълумот нест намешавад.
#
# Истифода (ҳамчун root):
#   GITHUB_TOKEN=... DOMAIN=... EMAIL=... bash setup-oracle.sh
#   ё дар Oracle → Create instance → «Show advanced options» → Management →
#   «Paste cloud-init script» (намуна дар docs/DEPLOY.md, қисми «Д»).
#
# Тағйирёбандаҳо (ҳама ихтиёрӣ):
#   REPO_URL      — суроғаи репозиторий (пешфарз: Rohid2009/portali-muosiri-maorif)
#   GITHUB_TOKEN  — барои репозиторийи private: fine-grained token, «Contents: Read-only»
#   BRANCH        — шоха (пешфарз: main)
#   DOMAIN        — домени шумо (масалан maktab12.tj). Холӣ → <IP>.sslip.io (ройгон)
#   EMAIL         — почта барои огоҳиҳои Let's Encrypt
#   DIRECTOR_PASSWORD — пароли муваққатии мудир (камаш 8 аломат). Холӣ → тасодуфӣ
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/Rohid2009/portali-muosiri-maorif.git}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
DIRECTOR_PASSWORD="${DIRECTOR_PASSWORD:-}"
APP_DIR=/opt/maorif
APP_USER=maorif
DB_NAME=maorif
DB_USER=maorif
CRED_FILE=/root/maorif-credentials.txt
LOG=/var/log/maorif-setup.log

mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
trap 'echo; echo "ХАТО дар сатри $LINENO. Логи пурра: $LOG"; exit 1' ERR

[ "$(id -u)" -eq 0 ] || { echo "Ин скриптро бо sudo иҷро кунед."; exit 1; }
export DEBIAN_FRONTEND=noninteractive
APT="apt-get -y -q -o DPkg::Lock::Timeout=900"

# ── 1. Бастаҳо ──────────────────────────────────────────────────────────────
step "1/9 Насби бастаҳо (git, nginx, postgresql, certbot)"
$APT update
$APT install git curl ca-certificates openssl nginx postgresql postgresql-contrib \
  certbot python3-certbot-nginx iptables-persistent

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  step "Насби Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  $APT install nodejs
fi
node -v && npm -v

# Сервери хурд (≤3 GB, масалан VM.Standard.E2.1.Micro): swap, то next build хотираро тамом накунад
if [ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 3000 ] && ! swapon --show | grep -q /swapfile; then
  step "Сохтани swap (2 GB)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── 2. Firewall: дар Oracle Ubuntu ғайр аз SSH ҳама бандаанд ───────────────
step "2/9 Кушодани портҳои 80 ва 443"
if ! iptables -C INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null; then
  iptables -I INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j ACCEPT
fi
netfilter-persistent save >/dev/null 2>&1 || iptables-save > /etc/iptables/rules.v4

# ── 3. Корбари системавӣ ва код ─────────────────────────────────────────────
step "3/9 Гирифтани код аз GitHub"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/$APP_USER --shell /usr/sbin/nologin "$APP_USER"

CLONE_URL="$REPO_URL"
if [ -n "$GITHUB_TOKEN" ]; then
  CLONE_URL="${REPO_URL/https:\/\//https://x-access-token:${GITHUB_TOKEN}@}"
fi
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" remote set-url origin "$CLONE_URL"
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch -q origin "$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" reset -q --hard "origin/$BRANCH"
else
  install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$APP_DIR"
  sudo -u "$APP_USER" git clone -q --branch "$BRANCH" "$CLONE_URL" "$APP_DIR"
fi
# token танҳо барои корбари maorif хонда мешавад
chmod 600 "$APP_DIR/.git/config"

# ── 4. PostgreSQL ───────────────────────────────────────────────────────────
step "4/9 Танзими PostgreSQL (танҳо аз дохили сервер дастрас)"
PG_CONF_DIR=$(ls -d /etc/postgresql/*/main | sort -V | tail -1)
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
cat > "$PG_CONF_DIR/conf.d/maorif.conf" <<EOF
# Портали маориф — танзим аз рӯи хотираи сервер (${MEM_MB} MB)
listen_addresses = 'localhost'
shared_buffers = $((MEM_MB / 4))MB
effective_cache_size = $((MEM_MB / 2))MB
work_mem = 8MB
maintenance_work_mem = 256MB
EOF
systemctl restart postgresql
systemctl enable postgresql >/dev/null

if [ -f "$APP_DIR/.env" ] && grep -q '^DATABASE_URL=' "$APP_DIR/.env"; then
  echo ".env аллакай ҳаст — пароли база иваз намешавад."
else
  DB_PASS=$(openssl rand -hex 24)
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    sudo -u postgres psql -q -c "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS'"
  else
    sudo -u postgres psql -q -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS'"
  fi
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

  case "$DIRECTOR_PASSWORD" in *'"'*|*'$'*|*'`'*|*\\*) warn "DIRECTOR_PASSWORD аломатҳои \" \$ \` \\ надошта бошад — пароли тасодуфӣ сохта мешавад."; DIRECTOR_PASSWORD="";; esac
  if [ ${#DIRECTOR_PASSWORD} -ge 8 ]; then
    DIRECTOR_PASS="$DIRECTOR_PASSWORD"
  else
    DIRECTOR_PASS=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 12)
    DIRECTOR_PASS="${DIRECTOR_PASS}a7K"   # ҳарфи хурд, калон ва рақам ҳатман бошад
  fi
  umask 077
  cat > "$APP_DIR/.env" <<EOF
# Сохта шуд: $(date -Iseconds). Ба GitHub намеравад.
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
DIRECT_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
SCHOOL_NAME="МТМУ №12"
SCHOOL_DISTRICT="Зафаробод"
SEED_DIRECTOR_LOGIN="mudir"
SEED_DIRECTOR_NAME="Мудири мактаб"
SEED_DIRECTOR_PASSWORD="$DIRECTOR_PASS"
SEED_SPECIALIST="0"
STORAGE_URL=""
STORAGE_KEY=""
STORAGE_BUCKET="excuses"
EOF
  umask 022
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  NEW_DIRECTOR=1
fi

# ── 5. Насб ва сохтани барнома ──────────────────────────────────────────────
step "5/9 npm install (якчанд дақиқа)"
as_app() { sudo -u "$APP_USER" -H env NEXT_TELEMETRY_DISABLED=1 bash -c "cd '$APP_DIR' && $*"; }
as_app "npm install --no-audit --no-fund --loglevel=error"

step "6/9 Сохтани ҷадвалҳои база"
as_app "npx prisma generate"
if ls "$APP_DIR"/prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  as_app "npx prisma migrate deploy"
else
  as_app "npx prisma db push --skip-generate"
fi
as_app "npm run db:harden"
as_app "npm run db:seed"

step "7/9 next build (3–10 дақиқа)"
as_app "npx next build"

# ── 6. Хидмати systemd ──────────────────────────────────────────────────────
step "8/9 Хидмат, Nginx ва HTTPS"
install -m 644 "$APP_DIR/deploy/maorif.service" /etc/systemd/system/maorif.service
systemctl daemon-reload
systemctl enable maorif >/dev/null
systemctl restart maorif

# ── 7. Nginx + HTTPS ────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -4 -fsS --max-time 10 https://api.ipify.org || curl -4 -fsS --max-time 10 https://ifconfig.me || true)
if [ -z "$DOMAIN" ]; then
  if [ -n "$PUBLIC_IP" ]; then DOMAIN="${PUBLIC_IP//./-}.sslip.io"; else DOMAIN="_"; fi
fi

cat > /etc/nginx/sites-available/maorif <<EOF
# Сохтаи setup-oracle.sh. certbot қисми HTTPS-ро худаш илова мекунад.
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 4m;
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
# агар certbot пештар HTTPS илова карда бошад, конфигро иваз намекунем
if [ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
  ln -sf /etc/nginx/sites-available/maorif /etc/nginx/sites-enabled/maorif
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx

  HTTPS_OK=0
  if [ "$DOMAIN" != "_" ]; then
    MAIL_OPT="--register-unsafely-without-email"; [ -n "$EMAIL" ] && MAIL_OPT="-m $EMAIL"
    # Портҳо бояд дар Oracle Security List кушода бошанд (дастур дар DEPLOY.md)
    # то 15 дақиқа интизор мешавем, то шумо портҳоро кушоед
    for i in $(seq 1 15); do
      if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos $MAIL_OPT --redirect; then HTTPS_OK=1; break; fi
      warn "HTTPS ҳоло нашуд (кӯшиши $i/15). Портҳои 80/443-ро дар Oracle Security List кушоед. 60 сония интизорӣ…"; sleep 60
    done
  fi
else
  HTTPS_OK=1
fi

# ── 8. Бэкапи ҳаррӯза ───────────────────────────────────────────────────────
step "9/9 Бэкапи ҳаррӯзаи база"
install -d -o postgres -g postgres -m 700 /var/backups/maorif
cat > /etc/cron.daily/maorif-backup <<'EOF'
#!/bin/sh
# Нусхаи ҳаррӯзаи база; 14 рӯзи охир нигоҳ дошта мешавад.
set -e
F=/var/backups/maorif/maorif-$(date +%F).dump
sudo -u postgres pg_dump -Fc maorif > "$F.tmp" && mv "$F.tmp" "$F"
chown postgres:postgres "$F"; chmod 600 "$F"
find /var/backups/maorif -name 'maorif-*.dump' -mtime +14 -delete
EOF
chmod 755 /etc/cron.daily/maorif-backup
/etc/cron.daily/maorif-backup || warn "Бэкапи аввал нашуд — баъдтар тафтиш кунед."

# ── Натиҷа ──────────────────────────────────────────────────────────────────
sleep 3
systemctl is-active --quiet maorif && APP_STATE="кор мекунад" || APP_STATE="КОР НАМЕКУНАД — journalctl -u maorif -n 50"
URL="https://$DOMAIN"; [ "$HTTPS_OK" = 1 ] || URL="http://${PUBLIC_IP:-$DOMAIN}"

{
  echo "Портали муосири маориф — $(date -Iseconds)"
  echo "Суроға: $URL"
  if [ "${NEW_DIRECTOR:-0}" = 1 ]; then
    echo "Ҳисоби мудир (тугмаи «Мутахассис»): логин mudir, пароли муваққатӣ: $DIRECTOR_PASS"
    echo "Дар воридшавии аввал парол иваз карда мешавад."
  fi
} >> "$CRED_FILE"
chmod 600 "$CRED_FILE"

echo
echo "════════════════════════════════════════════════════════════"
echo " Тайёр. Барнома: $APP_STATE"
echo " Суроға: $URL"
[ "${NEW_DIRECTOR:-0}" = 1 ] && echo " Мудир: логин mudir, парол: $DIRECTOR_PASS   (дар $CRED_FILE ҳам ҳаст)"
if [ "$HTTPS_OK" != 1 ]; then
  echo
  warn "HTTPS насб нашуд. Бе HTTPS воридшавӣ кор намекунад (cookie-и бехатар)."
  echo " 1) Дар Oracle: Networking → VCN → Security List → Ingress: портҳои 80 ва 443 (0.0.0.0/0) илова кунед."
  echo " 2) Баъд дар сервер: sudo certbot --nginx -d $DOMAIN --redirect"
fi
echo " Навсозӣ баъдтар: sudo bash $APP_DIR/deploy/update.sh"
echo "════════════════════════════════════════════════════════════"
