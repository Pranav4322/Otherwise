# Deploying Otherwise

The project is now two independent pieces:

- **`backend/`** — a Node/Express API (no frontend files in it at all).
- **`frontend/`** — plain HTML/CSS/JS, no build step. Talks to the backend
  over HTTP using the URL set in `frontend/config.js`.

Deploy them separately: the frontend to any static host, the backend to
any Node host. This is the easiest split for free-tier hosting (e.g.
Vercel/Netlify for the frontend + Render/Railway for the backend).

## 1. Deploy the backend first

### Before deploying anywhere: set a real JWT_SECRET

`backend/auth.js` falls back to an insecure default secret if `JWT_SECRET`
isn't set, so the app runs easily on your laptop with zero config. **Never
deploy with that default** — anyone who reads the source could forge login
tokens. Generate a real one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Option A — Render or Railway (easiest)

1. Push this project to a git repository.
2. Create a new Web Service (Render) or Project (Railway), point it at
   the repo.
3. Set the **root directory** to `backend`.
4. Build command: `npm install`. Start command: `npm start`.
5. Environment variables:
   - `JWT_SECRET` — the value you generated above.
   - `CORS_ORIGIN` — your deployed frontend's URL, once you know it (you
     can add this after step 2 below and redeploy). Comma-separate
     multiple origins.
   - `PORT` — usually set automatically by the platform; the app already
     reads `process.env.PORT`.
6. **Add a persistent disk/volume mounted at `data`** (i.e. `backend/data`
   relative to the repo root). Otherwise your `data.json` (all users,
   books, versions) gets wiped on every redeploy. Render calls this a
   "Disk"; Railway calls it a "Volume."
7. Note the URL the platform gives you (e.g.
   `https://otherwise-api.onrender.com`) — you'll need it for the frontend.

### Option B — Docker (any host that runs containers)

```bash
cd backend
docker build -t otherwise-backend .
docker run -d \
  -p 3000:3000 \
  -e JWT_SECRET="paste-your-generated-secret-here" \
  -e CORS_ORIGIN="https://your-frontend-url" \
  -v otherwise-data:/app/data \
  --name otherwise-backend \
  otherwise-backend
```

The `-v otherwise-data:/app/data` volume is what makes your data survive
container restarts and redeploys — without it, every new container starts
from the seed data again.

To update after a code change: `docker build -t otherwise-backend .`
again, then `docker stop otherwise-backend && docker rm otherwise-backend`
and re-run the `docker run` command above (the named volume keeps your
data).

### Option C — A plain VPS (Ubuntu/Debian, DigitalOcean droplet, etc.)

```bash
# on the server, one-time setup
git clone <your-repo-url> otherwise
cd otherwise/backend
npm install
cp .env.example .env
nano .env   # set JWT_SECRET and CORS_ORIGIN

# run it with pm2 so it restarts on crash/reboot
npm install -g pm2
pm2 start server.js --name otherwise-backend
pm2 save
pm2 startup   # follow the printed instructions to enable on-boot start
```

Put a reverse proxy (nginx or Caddy) in front of it for HTTPS and a real
domain — the app itself just listens on plain HTTP on `PORT` (default
3000).

Minimal nginx example:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then use `certbot --nginx` to add HTTPS for free.

## 2. Point the frontend at the backend

Edit `frontend/config.js`:

```js
window.API_BASE = "https://otherwise-api.onrender.com"; // your backend's URL
```

## 3. Deploy the frontend

Since it's static files with no build step, almost any static host works:

- **Vercel / Netlify**: point a new project at the repo with the root
  directory set to `frontend`, no build command needed, output directory
  `.` (or just `frontend` if deploying from repo root).
- **GitHub Pages**: push the contents of `frontend/` to a `gh-pages`
  branch, or use the repo's Pages settings with `frontend` as the source
  folder.
- **S3 + CloudFront, Cloudflare Pages, Surge, etc.**: upload the contents
  of `frontend/` as-is.

Once deployed, go back to your backend's environment variables and set
`CORS_ORIGIN` to this frontend URL (if you hadn't already), then redeploy
the backend so it accepts requests from it.

## Combined deployment (one host instead of two)

If you'd rather run both from a single process (e.g. one small VPS),
add this to `backend/server.js`, above `app.listen(...)`:

```js
const path = require("path");
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});
```

Then leave `frontend/config.js` with `window.API_BASE = "";` (same
origin) and you're back to the original single-service setup.

## Backing up your data

Everything lives in one file: `backend/data/data.json`. Back it up
however you'd back up any file — a cron job copying it to S3/another disk
is enough for a small site:

```bash
cp backend/data/data.json backups/data-$(date +%F).json
```

## When you outgrow the JSON file

If you start seeing write conflicts or the file grows large, swap
`backend/store.js` for a real database (Postgres, SQLite, etc.). Every
route file only calls the four functions that module exports
(`load`, `save`, `id`, `slugify`), so that's the only file you need to
change — no route logic depends on the storage format.
