# Deploy Tracklane on Oracle Cloud (Always Free), step by step

This guide takes you from a new Oracle Cloud account to Tracklane running at
`https://your-domain`, with HTTPS, email, and optional Google/GitHub sign-in. Every command is
meant to be copied and pasted. Run the "laptop" commands in your GitHub Codespace terminal (or
any terminal), and the "server" commands on the Oracle VM after you SSH in.

Allow about an hour the first time. Most of it is waiting for Oracle and for the first build.

**What you'll end up with:** one Arm VM running Postgres, the Tracklane web app, the realtime
server, the background worker and Caddy (which gets free HTTPS certificates from Let's Encrypt).
See [DEPLOYMENT.md](DEPLOYMENT.md) for what each environment variable does.

---

## Part 1 — Oracle Cloud account

1. Go to **oracle.com/cloud/free** and click **Start for free**.
2. Fill in the form. Oracle asks for a credit or debit card to verify your identity; Always Free
   resources aren't charged.
3. **Choose your home region carefully.** You can't change it later, and Always Free compute
   only runs there. Pick the region closest to your users (for India: _India West (Mumbai)_ or
   _India South (Hyderabad)_).
4. Wait for the "Your account is ready" email, then sign in at **cloud.oracle.com**.

> **Free limits (as of 2026):** Oracle's Always Free Arm allowance is now **2 OCPUs and 12 GB of
> memory in total** (it used to be 4 OCPUs / 24 GB). Stay within 2 OCPUs and 12 GB, or the VM
> can be charged or shut down. That is plenty for Tracklane.
>
> **Optional but recommended:** upgrading the account to **Pay As You Go** (Billing → Upgrade)
> keeps the Always Free resources free, and reduces two common problems on free-only accounts:
> "Out of host capacity" when creating Arm VMs, and Oracle reclaiming VMs it considers idle.
> You're only billed if you create resources beyond the free limits. Set a budget alert
> (Billing → Budgets) at a small amount like ₹100 / $1 if you upgrade.

---

## Part 2 — An SSH key

You need a key pair to log in to the VM. Create it in your Codespace terminal (laptop):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/oracle_tracklane -C "tracklane-oracle" -N ""
cat ~/.ssh/oracle_tracklane.pub
```

Copy the line that starts with `ssh-ed25519` — you'll paste it into Oracle in Part 3.

> **Keep a backup of the private key.** A Codespace can be deleted, and the key goes with it.
> In VS Code's file explorer, right-click `~/.ssh/oracle_tracklane` → **Download**, and store it
> somewhere safe (a password manager works). Without it you can't SSH in. (If you lose it, you
> can still use the instance's **Console connection** in the Oracle console to add a new key.)

---

## Part 3 — Create the VM

1. In the Oracle console, open the menu (☰) → **Compute** → **Instances** → **Create instance**.
2. **Name:** `tracklane`.
3. **Placement:** leave the default availability domain. (If you later get "Out of host
   capacity", come back and try another one.)
4. **Image and shape** → **Edit**:
   - **Image:** click **Change image** → **Ubuntu** → **Canonical Ubuntu 24.04** (the normal
     one, not _Minimal_). Make sure it's the **aarch64** build.
   - **Shape:** click **Change shape** → **Virtual machine** → **Ampere** →
     **VM.Standard.A1.Flex**. Set **OCPUs = 2** and **Memory = 12 GB**. The "Always Free
     eligible" label should show.
   - Don't pick the AMD _VM.Standard.E2.1.Micro_: with 1 GB of memory it can't build the app.
5. **Networking:**
   - **Primary network:** _Create new virtual cloud network_ (defaults are fine).
   - **Subnet:** _Create new public subnet_.
   - **Public IPv4 address:** _Automatically assign_ — make sure this is on.
6. **Add SSH keys:** choose **Paste public keys** and paste the `ssh-ed25519 …` line from Part 2.
7. **Boot volume:** leave the default size (about 47–50 GB is free and enough).
8. Click **Create**. After a minute or two the state turns **Running**.
9. On the instance page, copy the **Public IP address**. This guide calls it `SERVER_IP`.

**"Out of capacity for shape VM.Standard.A1.Flex"?** Free Arm capacity is popular. Try another
availability domain, try again a few hours later, or upgrade to Pay As You Go (see Part 1).

### Make the public IP permanent (recommended)

By default the IP is _ephemeral_ and can change if the VM is stopped. To keep it:

1. Instance page → **Attached VNICs** → click the VNIC → **IPv4 Addresses**.
2. On the primary IP, ⋯ → **Edit** → **No public IP** → **Update** (this releases the ephemeral
   one).
3. ⋯ → **Edit** again → **Reserved public IP** → **Create a new reserved IP** → **Update**.

Note the new address; it's your `SERVER_IP` from now on. (Check under **Billing → Cost
Analysis** after a day that nothing is being charged.)

---

## Part 4 — Open ports 80 and 443 in Oracle's network

Oracle blocks web traffic in two places: the VCN's security list (here) and the VM's own
firewall (Part 6). Both must allow ports 80 and 443.

1. Instance page → under **Primary VNIC**, click the **Subnet** link.
2. **Security** (or **Security Lists**) → **Default Security List for …**.
3. **Add Ingress Rules** and add three rules:

   | Source CIDR | IP Protocol | Destination port range | Description |
   | ----------- | ----------- | ---------------------- | ----------- |
   | `0.0.0.0/0` | TCP         | `80`                   | HTTP        |
   | `0.0.0.0/0` | TCP         | `443`                  | HTTPS       |
   | `0.0.0.0/0` | UDP         | `443`                  | HTTP/3      |

   Leave _Stateless_ unchecked and _Source port range_ empty. Port 22 (SSH) is already open.

---

## Part 5 — A domain name

HTTPS certificates need a domain pointing at `SERVER_IP`.

**If you own a domain** (any registrar, or Cloudflare): add a DNS record

| Type | Name                              | Value       |
| ---- | --------------------------------- | ----------- |
| A    | `tracklane` (or `@` for the root) | `SERVER_IP` |

If you use Cloudflare, set the record to **DNS only** (grey cloud) at first, so Caddy can get
its certificate directly.

**If you don't have a domain:** DuckDNS gives free subdomains. Sign in at **duckdns.org**
(e.g. with GitHub), create a subdomain such as `mytracklane`, and set its IP to `SERVER_IP`.
Your domain is then `mytracklane.duckdns.org`.

Check it from your laptop (DNS can take a few minutes to update):

```bash
dig +short tracklane.your-domain.com    # must print SERVER_IP
```

This guide calls the domain `DOMAIN` (for example `tracklane.your-domain.com`).

---

## Part 6 — Log in and prepare the server

From your laptop:

```bash
ssh -i ~/.ssh/oracle_tracklane ubuntu@SERVER_IP
```

Type `yes` the first time. Everything in this part runs **on the server**.

### 6.1 Updates

```bash
sudo apt update && sudo apt -y upgrade
sudo reboot
```

Wait 30 seconds, then SSH in again.

### 6.2 Open ports 80 and 443 in the VM's firewall

Oracle's Ubuntu images ship with an iptables firewall that only allows SSH. Insert the web ports
**above** its final "reject" rule and save:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
sudo iptables -L INPUT -n --line-numbers
```

In the list, the three `ACCEPT … dpt:80/443` lines must appear **before** the line that says
`REJECT … reject-with icmp-host-prohibited`.

### 6.3 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```

SSH in again (so the `docker` group applies) and check:

```bash
docker run --rm hello-world
docker compose version
```

---

## Part 7 — Get Tracklane and configure it

On the server:

```bash
git clone https://github.com/Chaitanya-NK/tracklane.git
cd tracklane
cp deploy/.env.example deploy/.env
```

Fill in the required values. Replace `tracklane.your-domain.com` with your `DOMAIN` and run:

```bash
DOMAIN=tracklane.your-domain.com
sed -i "s#^DOMAIN=.*#DOMAIN=$DOMAIN#" deploy/.env
sed -i "s#^NEXT_PUBLIC_APP_URL=.*#NEXT_PUBLIC_APP_URL=https://$DOMAIN#" deploy/.env
sed -i "s#^BETTER_AUTH_SECRET=.*#BETTER_AUTH_SECRET=$(openssl rand -hex 32)#" deploy/.env
sed -i "s#^POSTGRES_PASSWORD=.*#POSTGRES_PASSWORD=$(openssl rand -hex 24)#" deploy/.env
sed -i "s#^VAPID_SUBJECT=.*#VAPID_SUBJECT=mailto:you@example.com#" deploy/.env
grep -E "^(DOMAIN|NEXT_PUBLIC_APP_URL|BETTER_AUTH_SECRET|POSTGRES_PASSWORD)=" deploy/.env
```

The four lines printed at the end should all have values.

### 7.1 Email (recommended; you can also add it later — see Part 10)

Open the file and fill in the SMTP section:

```bash
nano deploy/.env
```

```ini
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM="Tracklane <no-reply@your-domain.com>"
```

Use port **587** (or 465). Oracle blocks outgoing port 25. Free options include Brevo, Resend,
or a Gmail account with an
[app password](https://myaccount.google.com/apppasswords) (`smtp.gmail.com`, port 587; `MAIL_FROM`
must then be that Gmail address). Save with `Ctrl+O`, `Enter`, exit with `Ctrl+X`.

### 7.2 Push notifications (optional)

```bash
docker run --rm node:22-alpine npx -y web-push generate-vapid-keys
```

Put the two keys in `deploy/.env` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
Do this **before** the first build — the public key is compiled into the app.

---

## Part 8 — Start it

On the server, in `~/tracklane`:

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

The first build takes roughly 5–15 minutes on 2 Arm cores. When it finishes:

```bash
docker compose -f deploy/docker-compose.yml ps
```

You should see `postgres` and `web` as **healthy**, `realtime`, `worker` and `caddy` as
**running**, and `migrate` as **exited (0)** (it applies database migrations and stops — that's
expected).

Check it from the server, then open it in your browser:

```bash
curl -s https://tracklane.your-domain.com/api/health     # use your DOMAIN; prints {"ok":true,...}
```

Open **https://DOMAIN**, click **Sign up**, create your account, then create your workspace.
The onboarding wizard walks you through inviting teammates and the first project.

> Don't run `pnpm db:seed` on the server — that loads demo data for development.

---

## Part 9 — Google and GitHub sign-in (any time after deploying)

No rebuild is needed for these.

1. **GitHub:** github.com/settings/developers → **OAuth Apps** → **New OAuth App**
   - Homepage URL: `https://DOMAIN`
   - Authorization callback URL: `https://DOMAIN/api/auth/callback/github`
   - **Register**, then **Generate a new client secret** and copy it immediately.
2. **Google:** console.cloud.google.com → create a project →
   **APIs & Services → OAuth consent screen**: app name, support email, audience **External** →
   **Credentials → Create credentials → OAuth client ID** → **Web application**
   - Authorized JavaScript origins: `https://DOMAIN`
   - Authorized redirect URIs: `https://DOMAIN/api/auth/callback/google`
   - Then **Publish app** on the consent screen so anyone (not just test users) can sign in.
3. On the server:
   ```bash
   cd ~/tracklane && nano deploy/.env
   ```
   Fill in `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, save, then apply:
   ```bash
   docker compose -f deploy/docker-compose.yml up -d
   ```
4. Open `https://DOMAIN/sign-in` and try both buttons. Existing users can connect Google/GitHub
   to their account under **Settings → My account**.

---

## Part 10 — Changing settings later

| What you changed in `deploy/.env`                                                         | Then run                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| SMTP, OAuth keys, `REQUIRE_EMAIL_VERIFICATION`, `MAX_UPLOAD_MB`, `LOG_LEVEL`              | `docker compose -f deploy/docker-compose.yml up -d`         |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_LOCALE`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `DOMAIN` | `docker compose -f deploy/docker-compose.yml up -d --build` |

Never change `POSTGRES_PASSWORD` after the first start — the database was created with it.
Changing `BETTER_AUTH_SECRET` signs everyone out.

---

## Part 11 — Updating to a new version

```bash
ssh -i ~/.ssh/oracle_tracklane ubuntu@SERVER_IP
cd ~/tracklane
git pull
docker compose -f deploy/docker-compose.yml up -d --build
docker image prune -f        # remove the old image to save disk
```

Database migrations run automatically before the new version starts.

---

## Part 12 — Backups

Create a backup script on the server:

```bash
mkdir -p ~/backups
cat > ~/backup-tracklane.sh <<'EOF'
#!/bin/sh
set -e
cd ~/tracklane/deploy
STAMP=$(date +%F)
docker compose exec -T postgres pg_dump -U tracklane -Fc tracklane > ~/backups/db-$STAMP.dump
docker run --rm -v tracklane_uploads:/data -v ~/backups:/out alpine \
  tar czf /out/uploads-$STAMP.tgz -C /data .
# keep 14 days
find ~/backups -type f -mtime +14 -delete
EOF
chmod +x ~/backup-tracklane.sh
~/backup-tracklane.sh && ls -lh ~/backups
```

Run it every night at 02:30:

```bash
(crontab -l 2>/dev/null; echo "30 2 * * * $HOME/backup-tracklane.sh >> $HOME/backups/backup.log 2>&1") | crontab -
```

These backups live on the same VM, so also copy them elsewhere now and then, e.g. from your
laptop:

```bash
scp -i ~/.ssh/oracle_tracklane "ubuntu@SERVER_IP:backups/*" ./tracklane-backups/
```

**Restore** (on the server):

```bash
cd ~/tracklane/deploy
docker compose exec -T postgres pg_restore -U tracklane -d tracklane --clean --if-exists \
  < ~/backups/db-YYYY-MM-DD.dump
docker run --rm -v tracklane_uploads:/data -v ~/backups:/in alpine \
  sh -c "cd /data && tar xzf /in/uploads-YYYY-MM-DD.tgz"
docker compose restart web realtime worker
```

---

## Part 13 — Day-to-day

```bash
cd ~/tracklane
docker compose -f deploy/docker-compose.yml ps                  # status
docker compose -f deploy/docker-compose.yml logs -f web         # live logs (Ctrl+C to stop)
docker compose -f deploy/docker-compose.yml logs --tail 100 worker realtime caddy
docker compose -f deploy/docker-compose.yml restart web         # restart one service
df -h /                                                         # disk space
```

- The stack starts by itself after a VM reboot (`restart: unless-stopped`).
- Ubuntu installs security updates automatically; reboot now and then with `sudo reboot`.
- Point a free uptime monitor (e.g. UptimeRobot) at `https://DOMAIN/api/health`.

---

## Troubleshooting

**The site doesn't load at all / times out**

- Security list rules from Part 4 missing, or the iptables rules from 6.2 are below the
  `REJECT` line. Check with `sudo iptables -L INPUT -n --line-numbers`.
- From the server, `curl -I http://localhost` should answer. If it does but your browser can't
  connect, it's one of the two firewalls.

**Certificate error, or Caddy logs say it couldn't get a certificate**

- `dig +short DOMAIN` must return `SERVER_IP`. Fix DNS, wait a few minutes, then
  `docker compose -f deploy/docker-compose.yml restart caddy`.
- Port 80 must be reachable from the internet — Let's Encrypt checks it.
- Cloudflare proxy (orange cloud) on: switch to DNS only, or set SSL mode to _Full (strict)_.

**`web` stays "unhealthy" or keeps restarting**

- `docker compose -f deploy/docker-compose.yml logs --tail 100 web migrate`.
- `migrate` failed: usually a wrong `DATABASE_URL`/`POSTGRES_PASSWORD`. If you changed the
  password after the first start, set it back.

**Sign-in works but you're logged out immediately / "invalid origin"**

- `NEXT_PUBLIC_APP_URL` must be exactly `https://DOMAIN` (no trailing slash), and you must
  rebuild (`--build`) after changing it.

**Emails don't arrive**

- `docker compose -f deploy/docker-compose.yml logs --tail 100 web worker | grep -i mail`.
- Use port 587 or 465 (25 is blocked on Oracle). Check spam; verify your sending domain with the
  email provider.

**Live updates (boards, presence) don't work**

- `curl -s "https://DOMAIN/api/realtime/?EIO=4&transport=polling"` should return text containing
  `"sid"`. If not, check `docker compose -f deploy/docker-compose.yml logs realtime`.

**Build fails with "out of memory" / killed**

- You're probably on the 1 GB _E2.1.Micro_ shape. Use _VM.Standard.A1.Flex_ with 12 GB.

**SSH: "Permission denied (publickey)"**

- Use `-i ~/.ssh/oracle_tracklane` and the user `ubuntu`. If you lost the key, use the
  instance's **Console connection** in the Oracle console to add a new public key to
  `/home/ubuntu/.ssh/authorized_keys`.

---

## Checklist

- [ ] Oracle account in the right home region
- [ ] SSH key created and private key backed up
- [ ] VM: Ubuntu 24.04 aarch64, VM.Standard.A1.Flex, 2 OCPU / 12 GB, public IP (reserved)
- [ ] Security list: TCP 80, TCP 443, UDP 443 from 0.0.0.0/0
- [ ] DNS A record → `SERVER_IP` (`dig` confirms)
- [ ] iptables: 80/443 accepted above the REJECT rule, saved
- [ ] Docker installed, `ubuntu` in the docker group
- [ ] `deploy/.env`: DOMAIN, NEXT_PUBLIC_APP_URL, BETTER_AUTH_SECRET, POSTGRES_PASSWORD (+ SMTP)
- [ ] `docker compose … up -d --build`; web healthy; `/api/health` OK
- [ ] Signed up, workspace created
- [ ] (Optional) Google/GitHub OAuth keys added
- [ ] Nightly backups scheduled, and copied off the server
