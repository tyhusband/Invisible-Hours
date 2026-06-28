# Deploy Invisible Hours on tyhus.band

Your portfolio (`www.tyhus.band`) is hosted on **GitHub Pages** (`tyhusband.github.io`).  
This app is a separate Vite SPA — deploy it on **Vercel** at a **subdomain**.

**Recommended URL:** `https://hours.tyhus.band`

A subpath like `tyhus.band/hours` is possible but awkward with GitHub Pages (manual rebuilds, routing issues). Use a subdomain.

---

## 1. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import **`tyhusband/Invisible-Hours`** from GitHub
3. Framework: **Vite** (auto-detected)
   - Build command: `npm run build`
   - Output directory: `dist`
4. **Environment variables** (Production):

   | Name | Value |
   |------|--------|
   | `VITE_SUPABASE_URL` | `https://bxrrtxynkeawzjrmcxda.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your `sb_publishable_...` key |
   | `VITE_GOOGLE_CLIENT_ID` | your Google OAuth Client ID |

5. **Deploy**

`vercel.json` in the repo handles SPA routing (`/admin`, etc.).

---

## 2. Custom subdomain: `hours.tyhus.band`

### Vercel

Project → **Settings → Domains** → add **`hours.tyhus.band`**

Vercel shows the DNS record to create.

### DNS (domain registrar for `tyhus.band`)

Add:

| Type | Name | Value |
|------|------|--------|
| **CNAME** | `hours` | `cname.vercel-dns.com` |

Use the exact target Vercel shows if it differs.

Wait for DNS + SSL (usually a few minutes).

---

## 3. Supabase Auth

**Dashboard → Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| **Site URL** | `https://hours.tyhus.band` |
| **Redirect URLs** | `https://hours.tyhus.band`, `http://localhost:5173` |

---

## 4. Google Calendar OAuth

**Google Cloud Console → Credentials → OAuth client**

Add **Authorized redirect URI**:

```
https://hours.tyhus.band
```

Keep `http://localhost:5173` for local dev.

**OAuth consent screen → Authorized domains:** add `tyhus.band` if prompted.

---

## 5. Link from your portfolio

In your **`tyhusband/portfolio`** repo (powers tyhus.band), add a link:

```html
<a href="https://hours.tyhus.band">Invisible Hours</a>
```

Or add it to your site nav wherever you list projects/tools.

---

## Checklist

- [ ] Vercel project from `tyhusband/Invisible-Hours`
- [ ] Env vars set on Vercel
- [ ] CNAME `hours` → Vercel
- [ ] Supabase Site URL + redirect URLs
- [ ] Google redirect URI for production
- [ ] Link on tyhus.band (optional)

---

## Alternative subdomain names

Same steps; only change the subdomain:

- `time.tyhus.band`
- `invisible.tyhus.band`
- `app.tyhus.band`

---

## Subpath option (not recommended)

To serve at `tyhus.band/hours` you would need to:

1. Set `base: '/hours/'` in `vite.config.ts`
2. Copy `dist/` into the portfolio repo under `/hours/`
3. Add a `_redirects` or SPA fallback in GitHub Pages

Every app update requires rebuilding and copying into the portfolio repo. Subdomain is much simpler.
