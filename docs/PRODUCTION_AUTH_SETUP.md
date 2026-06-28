# Production auth setup — hours.tyhus.band

Copy-paste values for Supabase and Google Cloud. Do this after Vercel is deployed and DNS is live.

---

## Part A: Vercel env vars (do this first)

Vercel → your **Invisible-Hours** project → **Settings → Environment Variables**

Add for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://bxrrtxynkeawzjrmcxda.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_5rF_Vc2VtTE7ry6YObI8UQ_KX0CZZhL` |
| `VITE_GOOGLE_CLIENT_ID` | `146747011197-qvo8ms5s0hc5rqprjqec9g2fspugt8lk.apps.googleusercontent.com` |

Then **Deployments → … → Redeploy** so the build picks them up.

---

## Part B: Supabase Auth URLs

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/bxrrtxynkeawzjrmcxda)
2. **Authentication** → **URL Configuration**

### Site URL

```
https://hours.tyhus.band
```

### Redirect URLs

Click **Add URL** for each (keep localhost for local dev):

```
https://hours.tyhus.band
http://localhost:5173
```

3. **Save**

### What this fixes

- Sign-in / sign-up on the live site
- Auth session on `hours.tyhus.band` instead of localhost-only

---

## Part C: Google OAuth (Calendar connect)

The app sends `redirect_uri` as `window.location.origin` — **no trailing slash**.

### C1. Authorized redirect URIs

1. [Google Cloud Console](https://console.cloud.google.com/) → your project
2. **APIs & Services** → **Credentials**
3. Open OAuth client **Invisible Hours Web** (or whatever you named it)
4. Under **Authorized redirect URIs**, ensure you have **both**:

```
http://localhost:5173
https://hours.tyhus.band
```

5. **Save**

Do **not** use `https://hours.tyhus.band/` (with slash) unless you also change the app code.

### C2. Authorized domains (OAuth consent screen)

1. **APIs & Services** → **OAuth consent screen**
2. **Branding** → **Authorized domains**
3. Add if missing:

```
tyhus.band
```

(Google uses the root domain, not the `hours.` subdomain.)

### C3. Test users (if app is still in Testing)

**OAuth consent screen** → **Audience** / **Test users** → add every Google account you’ll use to connect Calendar.

### C4. Supabase Edge Function secrets (should already be set)

Supabase → **Project Settings** → **Edge Functions** → **Secrets**:

| Secret | Value |
|--------|--------|
| `GOOGLE_CLIENT_ID` | same Client ID as above |
| `GOOGLE_CLIENT_SECRET` | your Google client secret |

If Calendar connect fails with 404, redeploy functions:

```bash
npx supabase functions deploy google-calendar-auth
npx supabase functions deploy google-calendar-events
npx supabase functions deploy google-calendar-disconnect
```

---

## Verify

1. Open **https://hours.tyhus.band** (wait until Vercel shows domain valid + SSL)
2. Sign in with email/password → should work
3. Account menu → **Connect Google Calendar** → should redirect to Google and back without `redirect_uri_mismatch`

### Common errors

| Error | Fix |
|-------|-----|
| Auth works locally but not on live site | Vercel env vars + redeploy; Supabase Site URL |
| `redirect_uri_mismatch` | Add exact `https://hours.tyhus.band` in Google (no trailing slash) |
| Google “not completed verification” | Add your Google account as Test user |
| Calendar connect 404 | Deploy Google Calendar Edge Functions |
