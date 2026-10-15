# Vinted Helper

A stock and sales tracker for resellers. Track what you bought, what you have listed and what you sold, with photos and profit per item.

It is an Expo (React Native) app that runs on iPhone, Android and the web from one codebase. Data lives in Supabase (Postgres, Auth and Storage).

> **Login:** the app has one built-in user, username `admin`, password `admin`. That password is easy to guess, so [change it](#change-the-admin-password) before putting the app online.

```
frontend/             Expo app (Expo Router, TypeScript, NativeWind/Tailwind)
supabase/schema.sql   Tables, the admin user, access policies and the photo bucket
```

## 1. Create the Supabase project

1. Sign in at [supabase.com](https://supabase.com/dashboard) and click **New project**. Pick a name, a database password and a region close to you (for example Central EU / Frankfurt).
2. When the project is ready, open **SQL Editor**, click **New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates:
   - the `admin` user (password `admin`),
   - the `items` and `item_photos` tables,
   - row level security policies, so only the signed-in user can see and change their items and photos,
   - a private Storage bucket called `item-photos`.

   The script is safe to run again. On a project set up with an earlier version, it updates the policies and gives any items without an owner to `admin`.
3. Recommended: in **Authentication > Sign In / Providers**, turn off **Allow new users to sign up**. The app has no sign-up screen, and this stops anyone from creating accounts in your project through the API.

## 2. Configure the app

```sh
cd frontend
cp .env.example .env
```

Fill in `.env` with values from the Supabase dashboard:

- `EXPO_PUBLIC_SUPABASE_URL`: **Project Settings > Data API**, the project URL (`https://<ref>.supabase.co`).
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: **Project Settings > API Keys**, the `anon` key (or the newer publishable key, `sb_publishable_...`; either works).

`.env` is git-ignored. Never put the `service_role` / secret key in the app: it bypasses row level security.

## 3. Run the app

You need Node.js 20 or newer.

```sh
cd frontend
npm install
npx expo start
```

- **Web:** press `w`, or open http://localhost:8081.
- **iPhone (Expo Go):** install [Expo Go](https://apps.apple.com/app/expo-go/id982107779) from the App Store. Make sure the phone and computer are on the same Wi-Fi, then scan the QR code in the terminal with the iPhone Camera app and tap the banner to open it in Expo Go. If the phone can't connect (e.g. on a guest or office network), run `npx expo start --tunnel` instead.
- **Android:** install Expo Go from Google Play and scan the QR code from inside Expo Go.

After changing `.env`, restart the dev server (`npx expo start --clear`).

Sign in with username `admin` and password `admin`.

## Change the admin password

Run this in the Supabase **SQL Editor**, with your own password in place of `new-password`:

```sql
update auth.users
set encrypted_password = extensions.crypt('new-password', extensions.gen_salt('bf'))
where email = 'admin@vinted-helper.local';
```

Devices that are already signed in stay signed in; use the new password next time you sign in.

## How it works

- **Items** tab: unsold items (in stock or listed) with a filter, an **Add item** button and a **Mark as sold** action per row. Tap a row to edit it.
- **Sold** tab: sold items with profit per item (`sold for − bought for`) and the total profit. Tap a row to edit it.
- **Bought for** is the total cost of the item, including fees and shipping.
- Photos are resized on the device (max 1600 px wide, JPEG) before upload. They are stored under `<item id>/` in the private `item-photos` bucket and shown with short-lived signed URLs.
- Prices are in Hungarian forint and shown like `4 500 Ft`. Dates use the `YYYY-MM-DD` format.

## Checks

```sh
cd frontend
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```
