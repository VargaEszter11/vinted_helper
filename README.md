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
cp .env.example .env     # then set DB_PASSWORD and JWT_SECRET
docker compose up -d --build
```

Open http://localhost:8080 (change `WEB_PORT` in `.env` to use another port). Three containers start:

- `db`: Postgres. The schema is applied automatically by the backend on start.
- `backend`: the API. Photos are stored on the `uploads_data` volume.
- `frontend`: nginx serving the web app and forwarding `/api/*` to the backend.

Data lives in the `db_data` and `uploads_data` volumes; `docker compose down` keeps them, `down -v` deletes them.

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

## How it works

- **Items** tab: unsold items (in stock or listed) with a filter, an **Add item** button and a **Mark as sold** action per row. Tap a row to edit it. Each row shows the date its status last changed.
- **Sold** tab: sold items with profit per item (`sold for − bought for`) and the total profit. Tap a row to edit it.
- **Bought for** is the total cost of the item, including fees and shipping.
- **Brand**, **Size**, **Measurements** and **Flaws** are optional and only shown in the item popup.
- Photos are resized on the device (max 1600 px wide, JPEG) before upload and stored on the API's `photos` volume. They are served through signed links that expire.
- Prices are in Hungarian forint and shown like `4 500 Ft`. Dates use the `YYYY-MM-DD` format.

## Checks

```sh
cd frontend
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```
