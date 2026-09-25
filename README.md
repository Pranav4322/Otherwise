# Otherwise

A site where readers rewrite the chapters that stayed with them. Pick a book,
pick a chapter, write your own version of it, and see everyone else's
versions of the same chapter — filterable by mood, sortable by newest or
most loved. Readers can also add new public-domain books, follow each
other, and see anyone's profile: what they've written, what they've added,
who follows them.

This is a **real full-stack app** — a Node.js/Express API with its own
database and its own email/password accounts, plus a plain HTML/CSS/JS
frontend that talks to it over a REST API. It does not depend on Claude,
or on any third-party platform, to run.

The project is split into two independent pieces, `frontend/` and
`backend/`, so each can be deployed on its own (e.g. a static host for the
frontend, a Node host for the backend) — see [DEPLOY.md](DEPLOY.md).

## Quick start (local dev)

Run the backend and frontend in two terminals:

```bash
# terminal 1 — backend (API on http://localhost:3000)
cd backend
npm install
npm start
```

```bash
# terminal 2 — frontend (static server on http://localhost:5173)
cd frontend
npm start
```

Then open **http://localhost:5173** in a browser. `frontend/config.js`
already defaults to `window.API_BASE = ""`, which works for local dev via
the same steps above only if you serve the frontend from the backend's
origin — for the two-terminal setup shown here, point it at the backend
instead:

```js
// frontend/config.js
window.API_BASE = "http://localhost:3000";
```

The first time the backend runs, it creates `backend/data/data.json`
seeded with six public-domain books (Alice's Adventures in Wonderland,
Pride and Prejudice, Frankenstein, A Study in Scarlet, Moby-Dick,
Dracula). Sign up for an account from the button in the header, then open
a book, pick a chapter, and write a version.

## Deploying it

See **[DEPLOY.md](DEPLOY.md)** for step-by-step instructions covering
deploying the frontend and backend separately (Render/Railway/Docker/VPS
for the backend; Vercel/Netlify/GitHub Pages/S3 for the frontend), plus
how to run them combined on one host if you'd rather not split them. The
short version: set a real `JWT_SECRET` and `CORS_ORIGIN` on the backend
(never use the built-in dev default), point `frontend/config.js` at the
backend's URL, and make sure `backend/data/` is on persistent storage so
your data survives redeploys.

## Project layout

```
otherwise/
├── backend/                 Node/Express API + JSON-file database
│   ├── server.js            App entry point — wires routes (API only)
│   ├── store.js             Tiny JSON-file datastore + seed books
│   ├── auth.js              Password hashing, JWT issuing/verifying
│   ├── routes/
│   │   ├── auth.js          POST /register, /login, GET /me
│   │   ├── users.js         GET /:id and batch lookup by ids
│   │   ├── books.js         GET list/detail, POST add a book
│   │   ├── versions.js      GET/POST versions, like, report
│   │   └── follows.js       GET/POST/DELETE follow relationships
│   ├── data/                data.json lives here once the server has run
│   ├── package.json
│   ├── Dockerfile
│   ├── Procfile
│   └── .env.example         Copy to .env and set JWT_SECRET / CORS_ORIGIN
├── frontend/                 Frontend — static files, no build step
│   ├── index.html            Markup for every screen (home/book/chapter/profile)
│   ├── styles.css            All styling — the literary paper/ink design system
│   ├── app.js                All frontend logic: API calls, rendering, state
│   ├── config.js             Sets window.API_BASE — point this at your backend
│   └── package.json          Just a `start` script for local static preview
├── docs/                     Project spec and copyright-model notes
├── DEPLOY.md
└── README.md
```

## How accounts work

Real email/password accounts, stored server-side:

- Passwords are hashed with bcrypt (`backend/auth.js`) — never stored in
  plain text.
- Logging in returns a JWT, which the frontend keeps in `localStorage` and
  sends as `Authorization: Bearer <token>` on every request that needs to
  know who you are.
- Browsing books, chapters, and versions works for anyone, logged in or
  not. Writing a version, liking, reporting, adding a book, and following
  another reader all require an account — the frontend prompts you to log
  in or sign up the moment you try one of those.

**Before deploying this for real:** set `JWT_SECRET` in `backend/.env` to
a long random string, and `CORS_ORIGIN` to your deployed frontend's URL
(see `backend/.env.example`). The server falls back to an insecure
default secret so it's easy to try out locally, but that default must
never be used in production.

## The data model

Everything lives in `backend/data/data.json`, structured as:

- **`users`** — `{ id, name, email, passwordHash, avatarColor, createdAt }`
- **`books`** — `{ id, title, author, year, blurb, chapters: [{ id, num,
  title, scene }], addedBy, createdAt }`
- **`versions`** — `{ id, bookId, chapterId, title, tag, body, authorId,
  createdAt, likedBy: [userIds], reportedBy: [userIds] }`
- **`follows`** — `{ followerId, followeeId, createdAt }`, one entry per
  follow relationship

This is intentionally a simple, dependency-free JSON file rather than a
full database engine, so the project runs anywhere Node runs with nothing
else to install. Every route talks to `store.js` only — if you outgrow a
single JSON file (many concurrent writers, need real backups/transactions),
swap `store.js` for Postgres/SQLite/etc. and nothing else has to change.

## The copyright model (read this before adding books)

The app never stores or displays a book's actual text — anywhere. A
chapter is represented only by:

- the book's **title, author, and year** — facts, not copyrightable
- a **chapter number and title** — facts
- **one original sentence** describing the scene, written by whoever adds
  the chapter — never a quote from the book

This is why "Add a book" requires checking a box confirming the book is
public domain and the chapter descriptions are original wording. See
`docs/copyright-model.md` for the full reasoning — read it again before
opening the catalog to anything that isn't public domain.

## Known limits, honestly stated

- **No moderation queue.** Any signed-in user can add a book immediately;
  there's no approval step before it's visible to everyone. A version gets
  auto-hidden once 3 people report it, but there's no admin review screen.
- **No "feed of people you follow."** You see a followed reader's work by
  opening their profile directly — there's no aggregated activity feed yet.
- **Single JSON file as the datastore.** Fine for a small community; not
  built for high write concurrency. See "swap `store.js`" above.
- **No password reset / email verification.** Registration just takes an
  email and password; there's no email-sending set up to verify addresses
  or handle "forgot password."
- **No file uploads.** Avatars are auto-generated colored initials, not
  photos, to keep the project dependency-free.

## Extending it

- Add a moderation dashboard: a new `/api/admin/*` route group, gated by a
  `role` field on the user record.
- Add a home-page "for you" feed: query `versions` for the ids you follow
  (via the `follows` table) and merge by `createdAt`.
- Move to a real database: replace the functions in `store.js` — every
  route file only calls `store.load()`, `store.save()`, `store.id()`, and
  `store.slugify()`, so that's the one file to change.
