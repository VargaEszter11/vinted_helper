# Vinted Helper

A stock and sales tracker for resellers. Track what you bought, what you have listed and what you sold, with photos and profit per item.

It is an Expo (React Native) app that runs on iPhone, Android and the web from one codebase, talking to a small Node.js API backed by Postgres.

```
frontend/             Expo app (Expo Router, TypeScript, NativeWind/Tailwind)
backend/              Fastify API (accounts, items, photos) and its Postgres schema
docker-compose.yml    Runs the API and Postgres together
```

## 1. Run everything with Docker

You need [Docker](https://docs.docker.com/get-docker/).

```sh
cp .env.example .env     # then set DB_PASSWORD, JWT_SECRET and ADMIN_PASSWORD
docker compose up -d --build
```

Open http://localhost:8080 (change `WEB_PORT` in `.env` to use another port). Three containers start:

- `db`: Postgres. The schema is applied automatically by the backend on start.
- `backend`: the API. Photos are stored on the `uploads_data` volume.
- `frontend`: nginx serving the web app and forwarding `/api/*` to the backend.

Data lives in the `db_data` and `uploads_data` volumes; `docker compose down` keeps them, `down -v` deletes them.

## Backups

Take a backup before updating the app, since the backend applies schema changes on start. Run these in the repo folder while the app is running; each writes a dated file to the current folder.

```sh
# Database (items, bundles, users, status history)
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup-$(date +%F).sql

# Photos (stored separately, in the uploads_data volume)
docker run --rm -v vinted_helper_uploads_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/photos-$(date +%F).tar.gz -C /data .
```

The volume is named after the repo folder (`vinted_helper_uploads_data` here); check with `docker volume ls` if yours differs.

To restore, start from an empty database (`docker compose down -v`, then `docker compose up -d db`) and run:

```sh
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backup-2026-10-16.sql
docker run --rm -v vinted_helper_uploads_data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/photos-2026-10-16.tar.gz -C /data
docker compose up -d
```

Backup files contain your data and password hashes. Files named like the ones above (`backup-*.sql`, `photos-*.tar.gz`) are git-ignored so they can't be committed by accident; keep copies somewhere safe off the machine.

## Admin panel: moving your data to another server

The account named `ADMIN_USERNAME` (default `admin`) gets an **Admin** tab; nobody else sees it, and the server refuses its requests from anyone else. That name cannot be registered through the app: the account is created on start from `ADMIN_PASSWORD` if it does not exist yet (an existing admin is never changed), or it arrives with an import.

- **Export** downloads one `.ndjson` file with everything: accounts (password hashes included), items, bundles, status history and photos.
- **Import** (web only) replaces everything on the server with the contents of an export file. It is all or nothing: a damaged, cut-off or foreign file is rejected and nothing changes. Because accounts come from the file, you are signed out afterwards and sign in with the imported accounts' passwords, including the `admin` password from the exported server. The file must contain the admin account.

To move from your computer to the hosted server: export on the local app, open the hosted app, sign in as its admin (the `ADMIN_PASSWORD` from the server's `.env`), and import the file. Take a [backup](#backups) of the hosted data first if it holds anything you want to keep. Export files contain password hashes, so treat them like backups and don't commit them (`*.ndjson` is git-ignored).

## Managing the database with pgAdmin

[docker-compose.override.yml](docker-compose.override.yml) is merged in automatically on your machine and publishes Postgres on `127.0.0.1:5434` only. In pgAdmin, register a server with:

| Field | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5434` |
| Database | your `DB_NAME` |
| Username / Password | your `DB_USER` / `DB_PASSWORD` |

(5434, not 5432, so it doesn't clash with a Postgres installed on your computer.)

On the server nothing is published: the database is reachable only by the backend inside Docker's network. For a strict setup run `docker compose -f docker-compose.yml up -d --build` there, which ignores the override. To manage the hosted database from pgAdmin, use an SSH tunnel (`ssh -L 5434:localhost:5432 user@server`, with the port published on the server's loopback) rather than opening the port.

## Developing without Docker

Run Postgres and the backend yourself (`cd backend && npm install && npm start`, with `DATABASE_URL` and `JWT_SECRET` set), then:

You need Node.js 22 or newer.

```sh
cd frontend
cp .env.example .env     # EXPO_PUBLIC_API_URL: the backend's address
npm install
npx expo start
```

- **Web:** press `w`, or open http://localhost:8081.
- **Phone (Expo Go):** phone and computer on the same Wi-Fi, scan the QR code. Set `EXPO_PUBLIC_API_URL` to your computer's LAN address (e.g. `http://192.168.1.20:3000`), not `localhost`.

After changing `.env`, restart the dev server (`npx expo start --clear`).

Create an account on the sign-in screen. Set `ALLOW_REGISTRATION=false` in `.env` (and restart the API) to stop new sign-ups once you have yours.

## Deploying

Copy the repo to any server with Docker, create `.env`, and run `docker compose up -d --build`. Put HTTPS in front of the `frontend` container (Caddy, Traefik or Cloudflare). Behind your own proxy, replace its `ports:` entry with `expose: ["80"]`.

For a native app build, set `EXPO_PUBLIC_API_URL` to the public address of the API (e.g. `https://vinted.example.com/api`).

## Buy check

The **Buy check** tab identifies an item from up to 3 photos while you are in a shop. It is separate from the Items and Sold tabs and saves nothing: the last result lives in the app until you tap **Clear / new check**.

Add photos and the price you would pay, optionally fill in what you already know (brand, colour, condition, size), and tap **Check item**. The result shows brand, item type, category, size, colour, material, condition, a suggested name, a search phrase and a confidence level, all editable. Details you typed are kept as yours; the AI only fills in the empty ones.

It needs a DeepSeek API key (https://platform.deepseek.com) in `.env` as `DEEPSEEK_API_KEY`; then run `docker compose up -d --force-recreate backend`. The key stays on the server. Each user can make 30 checks per hour (failed checks do not count). The provider, model and prompt are constants at the top of [`backend/src/lib/item-recognition.js`](backend/src/lib/item-recognition.js). The server logs the token usage of every check.

### Prices and the buy/skip verdict

Right after an item is identified, the app looks up prices by itself (no extra tap); **Search again** repeats it after you correct a detail. It searches the web through DeepSeek's Search API with two plain searches (one for the price, one for used items for sale), not limited to any site. A model then reads only those search results, sorts them into new-price shops and second-hand listings (Vinted, Jófogás, eBay and so on, whatever turns up) and picks out prices; the code checks that every link comes from the results and every price appears in the result's own text. The second-hand figures are **asking prices, not sold prices**. Nothing is requested from Vinted or any other site directly.

Your own sold items (matched by guessing a category from the item name) and the web results give a **BUY / MAYBE / SKIP** verdict, computed in code. All thresholds are in one object, `VERDICT_CONFIG` in [`backend/src/lib/verdict.js`](backend/src/lib/verdict.js). The resale estimate is your own sales median (with 3 or more similar sales), else the second-hand asking median minus 10%, else half the new price. Fewer than 3 data points, or only a new price, shows **LOW CONFIDENCE**. You can type a typical resale price to recalculate on the spot.

Web results are cached for 24 hours per search phrase, each user gets 20 real lookups per hour (cache hits are free), and only one lookup runs per user at a time. To try a list of items from the terminal: `APP_USER=you APP_PASSWORD=... node backend/scripts/try-prices.mjs items.txt` (format at the top of that file).

## How it works

- **Items** tab: unsold items (in stock or listed) with a filter, an **Add item** button and a **Mark as sold** action per row. Tap a row to edit it. Each row shows the date its status last changed.
- **Sold** tab: sold items with profit per item (`sold for − bought for`) and the total profit. Tap a row to edit it.
- **Bought for** is the total cost of the item, including fees and shipping.
- **Brand**, **Size**, **Measurements** and **Flaws** are optional and only shown in the item popup.
- **Bundles:** tap **Bundle** on the Items tab, tick the items you listed together and enter the bundle price. The items become listed and show as one group. Tap the group to change the price or unbundle; its **Sold** button sells all of them, splitting the sold price evenly (in whole forints) between the items. Setting a bundled item to In stock, or selling it on its own, takes it out of the bundle. A bundle left with a single item is dissolved; that item stays listed.
- **Buyer bundles:** when a buyer buys several items together, tick **Sold in a bundle with other items** in the **Mark as sold** popup, tick the other items and enter the total they paid. All of them are marked sold and the price is split evenly, like a bundle you listed.
- Photos are resized on the device (max 1600 px wide, JPEG) before upload and stored on the API's `photos` volume. They are served through signed links that expire.
- Prices are in Hungarian forint and shown like `4 500 Ft`. Dates use the `YYYY-MM-DD` format.

## Checks

```sh
cd frontend
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```
