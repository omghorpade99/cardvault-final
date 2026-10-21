# CardVault

A responsive React + TypeScript business-card notebook. It supports live camera capture on desktop/mobile, private per-browser collections without a login screen, and downloading one or multiple notes (text + original images) as a ZIP archive.

## Features

- No password or sign-in form: the app creates a persistent Supabase anonymous session in the browser.
- Every anonymous user has a separate collection, enforced by the server using the verified Supabase user ID.
- Create, edit, search, select, and delete notes with multiple business-card images.
- Take a photo using the laptop webcam or a phone camera, or upload existing images.
- Download a single note or selected notes as a ZIP. Each note folder contains `note.txt` and the original image files.
- Private Supabase Storage bucket; the service key is used only by the Express server.

## Requirements

- Node.js 20.19+ or 22.12+ recommended.
- A Supabase project.

## 1. Configure Supabase

1. Create or select your Supabase project.
2. In **Authentication settings**, enable **Anonymous Sign-Ins**. This is required because CardVault intentionally has no login screen.
3. Open **SQL Editor → New query**, paste `supabase/schema.sql`, and run it.
4. In **Project Settings → API Keys**, copy:
   - Project URL
   - Publishable key (starts with `sb_publishable_`; browser-safe)
   - Secret key (starts with `sb_secret_`; server-only). The legacy `service_role` key can also be used if that's what your project provides.
5. In the project root, copy `.env.example` to `.env` and fill the values:

```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SECRET_KEY
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
PORT=8000
NODE_ENV=development
```

`SUPABASE_URL` and `VITE_SUPABASE_URL` should be the same URL. The publishable key is not a secret, but the `SUPABASE_SERVICE_ROLE_KEY` is highly privileged: never put it in a `VITE_` variable, frontend source, or public repository. Do not commit `.env`.

The SQL creates a private `business-card-images` bucket with a 10 MB per-image limit and JPEG, PNG, and WebP allowlist. Keep the bucket private.

### Existing CardVault database

If you previously ran the older shared-workspace schema, this schema adds `user_id`. Existing notes without a user ID are not displayed to anonymous users. Export/back up any old notes before changing schemas if you need to keep them.

## 2. Install and run locally

From the project root:

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal, usually `http://localhost:5173`.

The app automatically creates a Supabase anonymous user on first visit. There is no password screen. Notes are tied to that browser's anonymous session. If you clear browser storage, use a private/incognito window, or move to another device/browser, you may get a different anonymous user and won't automatically see the original collection. Add account linking/authentication later if cross-device recovery is needed.

## 3. Camera support

- On the same laptop, `http://localhost:5173` can access a webcam after browser permission is granted.
- On a deployed site, use HTTPS. Browsers generally block camera access on ordinary HTTP origins other than localhost.
- The app prefers the rear-facing camera on phones when available and provides a switch-camera control.
- If permission was denied, allow camera access in the browser's site settings.

## 4. Download notes

Open a note and choose **Download**, use the note's three-dot menu to download one note, or select multiple note cards and click **Download (N)**. The app downloads a ZIP containing each note's `note.txt` and original image files.

## 5. Deploy

Deploy the app as a Node service that can run both Vite's built frontend and the Express API:

1. Set all five environment values shown above in the hosting provider's environment settings.
2. Set `NODE_ENV=production`.
3. Build with `npm run build`.
4. Start with `npm start`.
5. Configure HTTPS on the public URL.

Do not expose the Supabase secret key to the browser. The Express API validates each Supabase access token and scopes reads, updates, deletes, and exports to that user ID. Keep the server and dependencies updated. Anonymous accounts are convenient but do not prove a person's real identity; for sensitive data, add a real sign-in/recovery option and rate limiting.

## Troubleshooting

- **Anonymous sign-in fails:** confirm Anonymous Sign-Ins are enabled in Supabase Authentication settings.
- **Storage/database setup error:** confirm SQL ran successfully, the bucket exists and is private, and the server secret key is correct.
- **`sb_publishable_...` used as server key:** replace it with the actual server-side secret key (`sb_secret_...`) or legacy `service_role` key. A publishable key cannot replace the server secret.
- **Camera won't open on phone:** open the deployed site using HTTPS and grant camera permission.
- **A different browser shows an empty collection:** anonymous data is associated with the browser session; it does not sync between anonymous devices automatically.
