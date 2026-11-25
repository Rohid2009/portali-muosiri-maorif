# Ҷойгиркунӣ, бэкап ва гузариш

## ★ Тавсияшуда: Oracle Cloud Always Free (насби худкор)

Сервери пурра (2 OCPU ARM, 12 GB хотира, 200 GB диск), хоб намеравад, база дар худи сервер.
Скрипти `deploy/setup-oracle.sh` ҳама чизро худаш насб мекунад: Node.js, PostgreSQL, Nginx,
HTTPS-и ройгон, хидмат, firewall ва бэкапи ҳаррӯза.

**1. Ҳисоб.** cloud.oracle.com → «Sign up». Минтақаи асосӣ (home region)-ро бодиққат интихоб кунед
(масалан *Germany Central (Frankfurt)*) — баъд иваз намешавад. Корт танҳо барои тасдиқ аст.

**2. Token (агар репозиторий Private бошад).** GitHub → Settings → Developer settings →
Fine-grained tokens → Generate: Repository access → *Only select* → `portali-muosiri-maorif`,
Permissions → **Contents: Read-only**. Token-ро нусха гиред.

**3. Сервер.** Oracle → Compute → Instances → **Create instance**:
- Image: **Canonical Ubuntu 24.04**; Shape: **Ampere → VM.Standard.A1.Flex**, 2 OCPU, 12 GB.
- Networking: «Create new virtual cloud network», «Assign a public IPv4 address» — фаъол.
- SSH keys: «Generate a key pair» → ҳардуи калидро зеркашӣ кунед (барои ҳолати зарурӣ).
- «Show advanced options» → **Management → Paste cloud-init script** → инро гузоред:

```bash
#!/bin/bash
export GITHUB_TOKEN=""          # token аз қадами 2 (барои репозиторийи Public холӣ монед)
export DIRECTOR_PASSWORD=""     # пароли муваққатии мудир, камаш 8 аломат (масалан Maktab12345)
export DOMAIN=""                # холӣ → <IP>.sslip.io (ройгон); ё домени худ
export EMAIL=""                 # почта барои огоҳиҳои HTTPS (ихтиёрӣ)
H=(-H "Accept: application/vnd.github.raw")
[ -n "$GITHUB_TOKEN" ] && H+=(-H "Authorization: Bearer $GITHUB_TOKEN")
curl -fsSL "${H[@]}" -o /root/setup-oracle.sh \
  https://api.github.com/repos/Rohid2009/portali-muosiri-maorif/contents/deploy/setup-oracle.sh
bash /root/setup-oracle.sh
```

→ **Create**. Агар «Out of capacity» барояд — дигар *Availability domain*-ро интихоб кунед ё баъдтар кӯшиш кунед.

**4. Портҳо (дарҳол баъди Create).** Instance → Subnet → **Security List** → *Add Ingress Rules*:
Source `0.0.0.0/0`, TCP, Destination port **80** ва боз як қоида барои **443**.
(Скрипт то 15 дақиқа интизор мешавад, то HTTPS-ро гирад.)

**5. Тайёр (10–20 дақиқа).** *Public IP*-ро аз саҳифаи instance гиред, масалан `141.144.10.20` →
суроға: **https://141-144-10-20.sslip.io** → «Мутахассис» → логини `mudir` ва пароли қадами 3 →
паролро иваз кунед → мутахассисонро созед.

Агар чизе нашуд: SSH → `sudo tail -n 60 /var/log/maorif-setup.log`.
Пароли мудир (агар холӣ монда бошед): `sudo cat /root/maorif-credentials.txt`.

**Навсозӣ** баъд аз тағйири код дар GitHub: `sudo bash /opt/maorif/deploy/update.sh`.
**Бэкап:** ҳар рӯз дар `/var/backups/maorif` (14 рӯз). Ҳар чанд вақт як нусхаро ба компютер ё
Google Drive гиред: `scp -i калид.key ubuntu@IP:/var/backups/maorif/*.dump .` (аввал `sudo chmod o+r` ё
`sudo cp` ба `/home/ubuntu`).

> Oracle метавонад сервери «бекор»-ро (7 рӯз CPU, шабака ва хотира < 20%) баргардонад.
> Барои эҳтиёт бэкапро берун аз сервер нигоҳ доред.

## А. Оғоз бо хароҷоти сифр (Neon + Vercel)

> Шартҳои нақшаҳои ройгонро пеш аз оғоз худатон санҷед — онҳо тағйир меёбанд.
> Нақшаи ройгони Vercel (Hobby) барои истифодаи шахсӣ/ғайритиҷоратӣ аст; агар мактаб ё идора истифода барад, Render ё VPS-ро баррасӣ кунед.

1. **База — Neon** (neon.tech): лоиҳаи нав → минтақаи наздиктарин (масалан Frankfurt).
   Ду сатр гиред: *pooled* → `DATABASE_URL`, *direct* → `DIRECT_URL`.
2. **Код — GitHub**: репозиторийи **Private** созед ва лоиҳаро бор кунед. `.env` ҳеҷ гоҳ бор карда намешавад.
3. **Барнома — Vercel** (vercel.com): Import Project → репозиторий.
   - Environment Variables: `DATABASE_URL`, `DIRECT_URL` (ва ихтиёрӣ `STORAGE_*`).
   - Build Command: `npm run vercel-build` (миграцияҳо + муҳофизати audit log + build).
4. **Админи аввал** — дар компютери худ (бо ҳамон `.env`):
   ```bash
   npm install
   npm run db:seed            # мактаби №12 ва мудир (SCHOOL_NAME, SEED_DIRECTOR_PASSWORD аз .env)
   ```
5. Сомонаро кушоед → «Мутахассис» → логини `mudir` → паролро иваз кунед → «Мутахассисон» → мутахассис созед.

**Render** (алтернатива): Web Service → Build `npm install && npm run vercel-build`, Start `npm start`.
Дар нақшаи ройгон сервер баъди бекорӣ хоб меравад — дархости аввал якчанд сония тӯл мекашад (саҳифаи «Боргирӣ…» ҳамин барои он аст).

### Файлҳои «сабабнок» (ихтиёрӣ)
Supabase → Storage → bucket-и **private** `excuses` → `STORAGE_URL`, `STORAGE_KEY` (service_role), `STORAGE_BUCKET`.
Бе ин тағйирёбандаҳо мутахассис танҳо тавзеҳи матнӣ менависад.

## Б. Бэкап (ҳатмӣ)

Файли `.github/workflows/backup.yml` ҳар рӯз соати 02:00:
1. `pg_dump` мекунад;
2. нусхаро ба базаи муваққатӣ **бармегардонад (restore)** ва месанҷад — яъне санҷиши бозгардонӣ ҳар рӯз, на танҳо ҳафтаина;
3. бо `BACKUP_PASSPHRASE` рамзгузорӣ (AES-256) мекунад;
4. дар GitHub 14 рӯз нигоҳ медорад (≥ 7 нусха), ва ихтиёрӣ тавассути `rclone` ба Google Drive / R2 мефиристад.

Танзим: GitHub → Settings → Secrets → Actions → `DATABASE_URL` (direct), `BACKUP_PASSPHRASE`, ихтиёрӣ `RCLONE_CONF`.
Санҷиш: Actions → backup → Run workflow.

**Бозгардонӣ аз нусха:**
```bash
gpg -d maorif-2026-11-25_2100.dump.gpg > maorif.dump
pg_restore -d "$NEW_DATABASE_URL" --no-owner --no-privileges --clean --if-exists maorif.dump
```

Илова бар ин, мутахассис ва мудир дар саҳифаи **Содирот** ҳамаи маълумотро ба Excel (CSV) гирифта метавонанд.

## В. Гузариш ба VPS ё сервери мактаб

Код тағйир намеёбад — танҳо `DATABASE_URL`/`DIRECT_URL`.

```bash
# 1) Сервер (Ubuntu 24.04)
sudo apt update && sudo apt install -y nginx postgresql certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

# 2) База — танҳо дар localhost (аз интернет дастнорас)
sudo -u postgres createuser maorif -P
sudo -u postgres createdb -O maorif maorif
#   /etc/postgresql/*/main/postgresql.conf → listen_addresses = 'localhost'

# 3) Интиқоли маълумот аз Neon
pg_dump "$OLD_DIRECT_URL" -Fc --no-owner --no-privileges -f maorif.dump
pg_restore -d "postgresql://maorif:ПАРОЛ@localhost/maorif" --no-owner --no-privileges maorif.dump

# 4) Барнома
sudo useradd -r -m -d /opt/maorif maorif
sudo -u maorif git clone <репозиторий> /opt/maorif
cd /opt/maorif && sudo -u maorif cp .env.example .env   # DATABASE_URL = DIRECT_URL = localhost
sudo -u maorif npm ci && sudo -u maorif npm run vercel-build

# 5) Хидмат ва HTTPS
sudo cp deploy/maorif.service /etc/systemd/system/ && sudo systemctl enable --now maorif
sudo cp deploy/nginx-maorif.conf /etc/nginx/sites-available/maorif   # доменро иваз кунед
sudo ln -s /etc/nginx/sites-available/maorif /etc/nginx/sites-enabled/
sudo certbot --nginx -d maktab.example.tj && sudo systemctl reload nginx

# 6) Firewall
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```
Баъд дар `backup.yml` `DATABASE_URL`-ро ба сервери нав иваз кунед (ё `pg_dump`-и ҳаррӯзаро бо cron дар худи сервер + нусха ба ҷои беруна).

## Г. Рӯйхати амният

- [ ] Репозиторий — **Private**; `.env` дар GitHub нест.
- [ ] Танҳо HTTPS (Vercel/Render худашон; VPS — certbot). HSTS дар `next.config.mjs` фаъол аст.
- [ ] База аз интернет дастнорас: VPS — `listen_addresses = 'localhost'`; Neon — пароли қавӣ + SSL, ва агар нақша иҷозат диҳад, IP Allow.
- [ ] Вуруд ба сервер (VPS) — танҳо бо калиди SSH, `PermitRootLogin no`, `PasswordAuthentication no`.
- [ ] `BACKUP_PASSPHRASE` дар ду ҷои бехатар навишта шудааст.
- [ ] Розигии волидон барои коркарди маълумоти шахсии кӯдакон (Қонуни ҶТ «Дар бораи ҳифзи маълумоти шахсӣ») — бо идораи маориф ҳамоҳанг шудааст.
