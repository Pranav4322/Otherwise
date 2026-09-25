const express = require("express");
const cors = require("cors");
const { attachUser } = require("./auth");

const { router: authRouter } = require("./routes/auth");
const usersRouter = require("./routes/users");
const booksRouter = require("./routes/books");
const { router: versionsRouter } = require("./routes/versions");
const followsRouter = require("./routes/follows");

const app = express();
const PORT = process.env.PORT || 3000;

// The frontend is now deployed separately (see frontend/), so CORS needs to
// allow that origin explicitly. Set CORS_ORIGIN to your deployed frontend's
// URL (e.g. https://otherwise.vercel.app); comma-separate multiple origins.
// Falls back to "*" (any origin) if unset, which is fine for local dev.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : "*";
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(attachUser); // sets req.userId when a valid token is present, on every request

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/books", booksRouter);
app.use("/api/versions", versionsRouter);
app.use("/api/follows", followsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// This backend is API-only now — the frontend/ folder is a separate static
// deployment (Vercel, Netlify, S3, GitHub Pages, etc). If you'd rather run
// both from one process/host, see "Combined deployment" in DEPLOY.md — it
// shows the couple of lines to add back here.

app.listen(PORT, () => {
  console.log(`Otherwise is running at http://localhost:${PORT}`);
});
