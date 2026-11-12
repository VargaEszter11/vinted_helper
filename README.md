# Vinted Helper

**A full-stack stock, sales and buy-check app for second-hand clothing resellers.**

Track what you bought, listed and sold. See your profit per item. And when you are standing in a charity shop, photograph a piece and get an instant **BUY / MAYBE / SKIP** verdict based on real asking prices and your own sales history.

One TypeScript codebase runs on **iPhone, Android and the web**, talking to a small Node.js API backed by Postgres. Everything starts with a single `docker compose up`.

<p>
  <img alt="Expo" src="https://img.shields.io/badge/Expo-React%20Native-000020?logo=expo&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/NativeWind-Tailwind-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Fastify" src="https://img.shields.io/badge/Fastify-Node.js%2022-000000?logo=fastify&logoColor=white">
  <img alt="Postgres" src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
</p>

> Independent project, not affiliated with or endorsed by Vinted.

## Features

| | |
| --- | --- |
| **Inventory and profit** | Items move through *in stock → listed → sold*, with photos, cost, brand, size, measurements, flaws and condition. Profit per item and in total. |
| **Search, filter, sort** | Full-text search plus filters for brand, size, condition and Vinted category; sort by name, price or last status change. |
| **Bundles** | Bundle items you list together, or that one buyer buys together. The price is split automatically across the items. |
| **Buy check** | Identify an item from up to 3 photos using a vision model, look up live second-hand prices, and get a verdict computed in code. |
| **Themes and i18n** | Light and dark mode, an accent color (swatches or a full RGB picker), English and Hungarian, and country and currency settings. |
| **Admin tools** | One-file export and import of the whole database (accounts, items, history, photos) for moving between servers. |

## How Buy check works

1. **Identify.** A vision model reads the photos and fills in brand, item type, category, size, colour, material, condition and a search phrase. Anything you typed yourself is never overwritten.
2. **Find prices.** Web search runs for your country's Vinted site and local marketplace, ranking local results first. A model sorts the results into new-price shops and second-hand listings. The code then verifies that every link comes from the search results and every price appears in the result's own text, so the model cannot invent a listing or a number.
3. **Compare photos.** For the best second-hand listings, the vision model compares the listing photo with yours. Clearly different items are dropped, and the rest get a "Looks the same / similar" badge.
4. **Decide.** The verdict is plain code, not a model opinion. The resale estimate is the median of your own similar sales (3 or more), else the second-hand asking median minus 10%, else half the new price. Thin data shows **LOW CONFIDENCE**. All thresholds live in one config object ([`verdict.js`](backend/src/lib/verdict.js)).

Results are cached for 24 hours, requests are rate limited per user, and the API key never leaves the server. The second-hand figures are asking prices, not sold prices, and nothing is requested from Vinted directly.

## Architecture

```
┌──────────────┐     /api/*     ┌──────────────┐        ┌────────────┐
│  nginx       │ ─────────────▶ │  Fastify API │ ─────▶ │ PostgreSQL │
│  (web app)   │                │  (Node 22)   │        └────────────┘
└──────────────┘                │              │ ─────▶  photos volume
 Expo web / iOS / Android       └──────┬───────┘
                                       └────▶  DeepSeek (vision, search)
```

```
frontend/             Expo app (Expo Router, TypeScript, NativeWind/Tailwind)
backend/              Fastify API (auth, items, photos, buy check) and its Postgres schema
docker-compose.yaml   Runs nginx + web app, the API and Postgres together
```

- **Frontend:** Expo SDK 57, React Native 0.86, React 19 with the React Compiler, Expo Router file-based navigation, NativeWind for styling.
- **Backend:** Fastify 5 with JWT auth, rate limiting and a plain SQL schema applied automatically on start.
- **Photos:** resized on the device (max 1600 px, JPEG), stored on a volume and served through expiring signed links.

## Quick start

You need [Docker](https://docs.docker.com/get-docker/).

```sh
cp .env.example .env     # set DB_PASSWORD, JWT_SECRET and ADMIN_PASSWORD
docker compose up -d --build
```

Open http://localhost:8080 (change `WEB_PORT` in `.env` for another port), create an account on the sign-in screen and you are in. Set `ALLOW_REGISTRATION=false` once you have yours.

To enable Buy check, add a [DeepSeek API key](https://platform.deepseek.com) as `DEEPSEEK_API_KEY` in `.env` and run `docker compose up -d --force-recreate backend`.

## Development

You need Node.js 22 or newer, plus a running Postgres and backend (`cd backend && npm install && npm start`, with `DATABASE_URL` and `JWT_SECRET` set).

```sh
cd frontend
cp .env.example .env     # EXPO_PUBLIC_API_URL: the backend's address
npm install
npx expo start
```

- **Web:** press `w`, or open http://localhost:8081.
- **Phone (Expo Go):** same Wi-Fi, scan the QR code, and set `EXPO_PUBLIC_API_URL` to your computer's LAN address (for example `http://192.168.1.20:3000`), not `localhost`.

Checks: `npx tsc --noEmit` (typecheck) and `npx expo lint` (lint) in `frontend/`.

---

## More details

<details>
<summary><b>Using the app</b></summary>

- **Items** tab: unsold items with **All / In stock / Listed**, an **Add item** button and a **Mark as sold** action per row. Tap a row to edit it.
- **Sold** tab: sold items with profit per item (`sold for − bought for`) and the total.
- **Settings** tab: theme, accent color, language, country and currency. The country is the official Vinted country-site list; it decides which Vinted site Buy check searches and which local results rank first. Choices are saved on the device.
- **Bought for** is the total cost including fees and shipping. Brand, size, measurements, flaws, condition and category are optional. The form suggests a Vinted-style category from the name and photos.
- **Bundles you list:** tap **Bundle**, tick items and enter the bundle price. **Sold** on the group sells all of them and splits the price evenly. Setting a bundled item to In stock, or selling it alone, takes it out; a bundle left with one item is dissolved.
- **Buyer bundles:** in the **Mark as sold** popup, tick **Sold in a bundle with other items**, pick the others and enter the total paid.
- The category tree lives in [`backend/src/lib/vinted-categories.js`](backend/src/lib/vinted-categories.js). After editing it, run `node scripts/sync-vinted-categories.mjs` from the repo root.

</details>

<details>
<summary><b>Buy check: configuration and limits</b></summary>

- Each user can make 30 identifications and 20 real price lookups per hour (cache hits are free), with one lookup at a time.
- When an item has a brand, searches are for that brand only, and open-web results that do not name it are dropped. Spelling variants (Levi's / Levis, H&M) count as the same brand.
- Provider, model and prompt are constants in [`item-recognition.js`](backend/src/lib/item-recognition.js); photo comparison constants are in [`visual-match.js`](backend/src/lib/visual-match.js). Token usage of every check is logged.
- To try a list of items from the terminal: `APP_USER=you APP_PASSWORD=... node backend/scripts/try-prices.mjs items.txt` (format at the top of that file).

</details>

<details>
<summary><b>Backups and restore</b></summary>

Take a backup before updating, since the backend applies schema changes on start. Each command writes a dated file to the current folder.

```sh
# Database (items, bundles, users, status history)
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup-$(date +%F).sql

# Photos (stored separately, in the uploads_data volume)
docker run --rm -v vinted_helper_uploads_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/photos-$(date +%F).tar.gz -C /data .
```

The volume is named after the repo folder; check `docker volume ls` if yours differs. To restore, start from an empty database (`docker compose down -v`, then `docker compose up -d db`) and run:

```sh
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backup-2026-10-16.sql
docker run --rm -v vinted_helper_uploads_data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/photos-2026-10-16.tar.gz -C /data
docker compose up -d
```

Backup files contain your data and password hashes. `backup-*.sql` and `photos-*.tar.gz` are git-ignored; keep copies somewhere safe off the machine. Data lives in the `db_data` and `uploads_data` volumes: `docker compose down` keeps them, `down -v` deletes them.

</details>

<details>
<summary><b>Admin panel: moving your data to another server</b></summary>

The account named `ADMIN_USERNAME` (default `admin`) gets an **Admin** tab; nobody else sees it, and the server refuses its requests from anyone else. That name cannot be registered through the app: the account is created on start from `ADMIN_PASSWORD` if missing, or arrives with an import.

- **Export** downloads one `.ndjson` file with everything: accounts (password hashes included), items, bundles, status history and photos.
- **Import** (web only) replaces everything on the server with an export file. It is all or nothing: a damaged, cut-off or foreign file is rejected and nothing changes. You are signed out afterwards and sign in with the imported accounts' passwords. The file must contain the admin account.

To move from your computer to a hosted server: export locally, sign in to the hosted app as its admin and import the file. Back up the hosted data first if it holds anything you want to keep. Export files contain password hashes, so never commit them (`*.ndjson` is git-ignored).

</details>

<details>
<summary><b>Managing the database with pgAdmin</b></summary>

[docker-compose.override.yml](docker-compose.override.yml) is merged in automatically on your machine and publishes Postgres on `127.0.0.1:5434` only (not 5432, so it does not clash with a local Postgres).

| Field | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5434` |
| Database | your `DB_NAME` |
| Username / Password | your `DB_USER` / `DB_PASSWORD` |

On a server nothing is published. Run `docker compose -f docker-compose.yaml up -d --build` there to ignore the override, and use an SSH tunnel (`ssh -L 5434:localhost:5432 user@server`) rather than opening the port.

</details>

<details>
<summary><b>Deploying</b></summary>

Copy the repo to any server with Docker, create `.env` and run `docker compose up -d --build`. Put HTTPS in front of the `frontend` container (Caddy, Traefik or Cloudflare). Behind your own proxy, replace its `ports:` entry with `expose: ["80"]`.

For a native app build, set `EXPO_PUBLIC_API_URL` to the public address of the API (for example `https://vinted.example.com/api`).

</details>
