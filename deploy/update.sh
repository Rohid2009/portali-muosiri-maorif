#!/usr/bin/env bash
# Навсозии портал баъд аз тағйирот дар GitHub:  sudo bash /opt/maorif/deploy/update.sh
# Маълумот ва .env дахл намешаванд. Пеш аз навсозӣ нусхаи база гирифта мешавад.
set -Eeuo pipefail
APP_DIR=/opt/maorif; APP_USER=maorif; BRANCH="${BRANCH:-main}"
trap 'echo "ХАТО дар сатри $LINENO — барномаи пешина ҳанӯз кор мекунад, агар build нашуда бошад."; exit 1' ERR
[ "$(id -u)" -eq 0 ] || { echo "Бо sudo иҷро кунед."; exit 1; }
as_app() { sudo -u "$APP_USER" -H env NEXT_TELEMETRY_DISABLED=1 bash -c "cd '$APP_DIR' && $*"; }

echo "==> Нусхаи база"
/etc/cron.daily/maorif-backup
echo "==> Гирифтани код"
as_app "git fetch -q origin $BRANCH && git reset -q --hard origin/$BRANCH"
echo "==> npm install"
as_app "npm install --no-audit --no-fund --loglevel=error"
echo "==> База"
as_app "npx prisma generate"
if ls "$APP_DIR"/prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  as_app "npx prisma migrate deploy"
else
  # бе --accept-data-loss: агар тағйирот маълумотро нест кунад, қатъ мешавад
  as_app "npx prisma db push --skip-generate"
fi
as_app "npm run db:harden"
echo "==> next build"
as_app "npx next build"
install -m 644 "$APP_DIR/deploy/maorif.service" /etc/systemd/system/maorif.service
systemctl daemon-reload
systemctl restart maorif
sleep 3
systemctl is-active --quiet maorif && echo "Тайёр: барномаи нав кор мекунад." || { echo "Барнома сар нашуд: journalctl -u maorif -n 50"; exit 1; }
