/* ---------- tiny API client ---------- */
const API_BASE = window.API_BASE || ""; // set in config.js

function getToken() { return localStorage.getItem("otherwise_token") || null; }
function setToken(t) { if (t) localStorage.setItem("otherwise_token", t); else localStorage.removeItem("otherwise_token"); }

async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/* ---------- state ---------- */
let currentUser = null; // { id, name, avatarColor } | null
const TAGS = ["dark", "comedic", "romantic", "villain wins", "grounded/realistic", "poetic"];
let allBooksCache = [];
let currentBookObj = null;
let activeChapterId = null, activeFilter = "all", activeSort = "newest";
let currentDocs = [];
let viewedUserId = null;
let viewedUserName = null;

/* ---------- helpers ---------- */
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  return ((parts[0] || "")[0] || "?").toUpperCase() + ((parts[1] || "")[0] || "").toUpperCase();
}

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

function timeAgo(ms) {
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
  const months = Math.floor(days / 30);
  return months + (months === 1 ? " month ago" : " months ago");
}

function readingTime(text) {
  const words = (text.trim().match(/\S+/g) || []).length;
  const mins = Math.max(1, Math.round(words / 200));
  return mins + (mins === 1 ? " min read" : " min read");
}

const USER_BOOK_PALETTE = ["#33473a", "#7a3030", "#22301f", "#a9823f", "#243b4a", "#4a1f2b", "#5c4a2e", "#3b2f4a"];
function colorForTitle(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return USER_BOOK_PALETTE[hash % USER_BOOK_PALETTE.length];
}

function findBook(bookId) { return allBooksCache.find((b) => b.id === bookId); }

function requireLogin(actionLabel) {
  if (currentUser) return true;
  showToast("Log in to " + actionLabel + ".");
  openAuth("login");
  return false;
}

/* ---------- auth ---------- */
async function boot() {
  const token = getToken();
  if (token) {
    try {
      const { user } = await api("/api/auth/me");
      currentUser = user;
    } catch (e) {
      setToken(null);
      currentUser = null;
    }
  }
  renderHeaderAuth();
  await loadBooks();
  renderHome();
}

function renderHeaderAuth() {
  const el = document.getElementById("header-auth");
  if (currentUser) {
    el.innerHTML = `
      <button class="whoami" onclick="openProfile()">
        <span class="avatar-circle" style="background:${currentUser.avatarColor}">${initials(currentUser.name)}</span>
        <span>${escapeHtml(currentUser.name)}</span>
      </button>
    `;
  } else {
    el.innerHTML = `
      <div class="auth-buttons">
        <button class="btn btn-ghost btn-sm" onclick="openAuth('login')">Log in</button>
        <button class="btn btn-primary btn-sm" onclick="openAuth('register')">Sign up</button>
      </div>
    `;
  }
}

let authMode = "login";
function openAuth(mode) {
  setAuthTab(mode || "login");
  document.getElementById("auth-name").value = "";
  document.getElementById("auth-email").value = "";
  document.getElementById("auth-password").value = "";
  document.getElementById("auth-error").style.display = "none";
  document.getElementById("auth-overlay").classList.add("active");
  document.getElementById("auth-email").focus();
}
function closeAuth() {
  document.getElementById("auth-overlay").classList.remove("active");
}
function setAuthTab(mode) {
  authMode = mode;
  document.getElementById("auth-tab-login").classList.toggle("active", mode === "login");
  document.getElementById("auth-tab-register").classList.toggle("active", mode === "register");
  document.getElementById("auth-name-field").style.display = mode === "register" ? "block" : "none";
  document.getElementById("auth-submit").textContent = mode === "register" ? "Create account" : "Log in";
  document.getElementById("auth-error").style.display = "none";
}
async function submitAuth() {
  const name = document.getElementById("auth-name").value.trim();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const errEl = document.getElementById("auth-error");
  if (!email || !password || (authMode === "register" && !name)) {
    errEl.textContent = "Please fill in every field.";
    errEl.style.display = "block";
    return;
  }
  const btn = document.getElementById("auth-submit");
  btn.disabled = true;
  try {
    const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    const body = authMode === "register" ? { name, email, password } : { email, password };
    const data = await api(path, { method: "POST", body });
    setToken(data.token);
    currentUser = data.user;
    renderHeaderAuth();
    closeAuth();
    showToast(authMode === "register" ? "Welcome — account created." : "Welcome back.");
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
  }
}
function logout() {
  setToken(null);
  currentUser = null;
  renderHeaderAuth();
  showHome();
  showToast("Logged out.");
}

/* ---------- navigation ---------- */
function switchView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

function showHome() {
  switchView("view-home");
  loadBooks().then(renderHome);
}

async function loadBooks() {
  try {
    const { books } = await api("/api/books");
    allBooksCache = books;
  } catch (e) {
    showToast("Couldn't load the book list.");
  }
}

/* ---------- home ---------- */
function bookCoverSvg(book, w, h) {
  const words = book.title.split(" ");
  let lines = [];
  let line = "";
  words.forEach((w2) => {
    if ((line + " " + w2).trim().length > 14) { lines.push(line.trim()); line = w2; }
    else { line = (line + " " + w2).trim(); }
  });
  if (line) lines.push(line);
  lines = lines.slice(0, 4);
  const startY = h / 2 - (lines.length - 1) * 10;
  const color = book.color || colorForTitle(book.title);
  const textEls = lines
    .map((l, i) => `<text x="${w / 2}" y="${startY + i * 20}" text-anchor="middle" font-family="Fraunces, serif" font-style="italic" font-size="13" fill="#f3ede0">${escapeHtml(l)}</text>`)
    .join("");
  return `<rect width="${w}" height="${h}" fill="${color}"/><rect x="8" y="8" width="${w - 16}" height="${h - 16}" fill="none" stroke="#a9823f" stroke-width="1"/>${textEls}`;
}

function renderHome() {
  const grid = document.getElementById("book-grid");
  grid.innerHTML = "";
  allBooksCache.forEach((book) => {
    const card = document.createElement("button");
    card.className = "book-card";
    card.setAttribute("aria-label", "Open " + book.title + " by " + book.author);
    card.onclick = () => openBook(book.id);
    card.innerHTML = `
      <svg class="cover-svg" viewBox="0 0 128 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${bookCoverSvg(book, 128, 190)}</svg>
      <div class="bt">${escapeHtml(book.title)}</div>
      <div class="ba">${escapeHtml(book.author)}</div>
      <div class="bc">${book.chapters.length} chapter${book.chapters.length === 1 ? "" : "s"} open for rewriting</div>
    `;
    grid.appendChild(card);
  });
  const addCard = document.createElement("button");
  addCard.className = "book-card add-book-card";
  addCard.setAttribute("aria-label", "Add a new book");
  addCard.onclick = () => openAddBook();
  addCard.innerHTML = `
    <div class="add-book-tile"><span class="add-book-plus" aria-hidden="true">+</span><span>Add a book</span></div>
    <div class="bc">Bring a public-domain title people can rewrite</div>
  `;
  grid.appendChild(addCard);
}

/* ---------- book page ---------- */
async function openBook(bookId) {
  let book = findBook(bookId);
  let chapterCounts = {};
  try {
    const data = await api("/api/books/" + encodeURIComponent(bookId));
    book = data.book;
    chapterCounts = data.chapterCounts;
  } catch (e) {
    if (!book) { showToast("Couldn't open that book."); showHome(); return; }
  }
  currentBookObj = book;

  const color = book.color || colorForTitle(book.title);
  document.getElementById("bv-cover").innerHTML = bookCoverSvg({ title: book.title, color }, 128, 190);
  document.getElementById("bv-title").textContent = book.title;
  document.getElementById("bv-byline").textContent = "By " + book.author;
  document.getElementById("bv-provenance").textContent = "First published in " + book.year + ". Now in the public domain, free for anyone to rewrite.";
  document.getElementById("bv-blurb").textContent = book.blurb;

  const list = document.getElementById("chapter-list");
  list.innerHTML = "";
  book.chapters.forEach((ch) => {
    const row = document.createElement("button");
    row.className = "chapter-row";
    row.onclick = () => openChapter(ch.id);
    const n = chapterCounts[ch.id] || 0;
    row.innerHTML = `<span class="num">${escapeHtml(ch.num)}</span><span class="title">${escapeHtml(ch.title)}</span><span class="count">${n === 0 ? "no versions yet" : n + " version" + (n === 1 ? "" : "s")}</span>`;
    list.appendChild(row);
  });
  switchView("view-book");
}

/* ---------- chapter page ---------- */
function openChapter(chapterId) {
  activeChapterId = chapterId;
  activeFilter = "all";
  activeSort = "newest";
  const book = currentBookObj;
  const idx = book.chapters.findIndex((c) => c.id === chapterId);
  const raw = book.chapters[idx];
  const ch = { ...raw, bookId: book.id, bookTitle: book.title, position: idx + 1, total: book.chapters.length };

  document.getElementById("cv-title").textContent = ch.title;
  document.getElementById("cv-sub").textContent = "From " + ch.bookTitle + ", chapter " + ch.position + " of " + ch.total + ".";
  document.getElementById("cv-excerpt").innerHTML =
    "Referencing <b>Chapter " + escapeHtml(ch.num) + ": " + escapeHtml(ch.title) + "</b> of <i>" + escapeHtml(ch.bookTitle) + "</i> — " + escapeHtml(ch.scene) + "." +
    '<span class="ref-note">Fact plus a one-line original description only. No text from the book is stored here.</span>';
  document.getElementById("editor-chapter-name").textContent = ch.title;
  document.getElementById("cv-back").onclick = () => openBook(ch.bookId);
  document.getElementById("cv-versions").innerHTML = '<div class="loading-note">Loading versions…</div>';
  document.getElementById("cv-filters").innerHTML = "";
  renderSortToggle();
  switchView("view-chapter");
  loadVersionsForChapter(chapterId);
}

async function loadVersionsForChapter(chapterId) {
  try {
    const { versions } = await api("/api/versions?chapterId=" + encodeURIComponent(chapterId));
    currentDocs = versions;
    renderFilters();
    renderVersions();
  } catch (e) {
    document.getElementById("cv-versions").innerHTML = '<div class="empty-state"><p>Versions couldn\'t be loaded right now.</p></div>';
  }
}

function renderSortToggle() {
  const el = document.getElementById("cv-sort");
  el.innerHTML = "";
  [["newest", "Newest"], ["loved", "Most loved"]].forEach(([key, label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = activeSort === key ? "active" : "";
    b.setAttribute("aria-pressed", activeSort === key ? "true" : "false");
    b.onclick = () => { activeSort = key; renderSortToggle(); renderVersions(); };
    el.appendChild(b);
  });
}

function renderFilters() {
  const el = document.getElementById("cv-filters");
  const tagsUsed = ["all", ...new Set(currentDocs.map((v) => v.tag))];
  el.innerHTML = "";
  tagsUsed.forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (tag === activeFilter ? " active" : "");
    chip.textContent = tag;
    chip.setAttribute("aria-pressed", tag === activeFilter ? "true" : "false");
    chip.onclick = () => { activeFilter = tag; renderFilters(); renderVersions(); };
    el.appendChild(chip);
  });
}

async function renderVersions() {
  const el = document.getElementById("cv-versions");
  let shown = activeFilter === "all" ? currentDocs : currentDocs.filter((v) => v.tag === activeFilter);
  if (activeSort === "loved") shown = [...shown].sort((a, b) => (b.likedBy || []).length - (a.likedBy || []).length);

  if (shown.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <p>${currentDocs.length === 0 ? "No versions here yet. Be the first to rewrite this chapter." : "No versions match that filter yet."}</p>
      ${currentDocs.length === 0 ? '<button class="btn btn-primary" onclick="openEditor()">Write the first version</button>' : ""}
    </div>`;
    return;
  }

  const authorIds = [...new Set(shown.map((v) => v.authorId).filter(Boolean))];
  let users = {};
  if (authorIds.length) {
    try { const data = await api("/api/users?ids=" + authorIds.join(",")); users = data.users; } catch (e) { users = {}; }
  }

  el.innerHTML = "";
  shown.forEach((v, i) => {
    const bodyId = "vb-" + i;
    const liked = currentUser && (v.likedBy || []).includes(currentUser.id);
    const reported = currentUser && (v.reportedBy || []).includes(currentUser.id);
    const author = users[v.authorId];
    const authorName = author ? author.name : "a reader";
    const card = document.createElement("div");
    card.className = "version-card";
    card.innerHTML = `
      <div class="version-head">
        <span class="version-title">${escapeHtml(v.title)}</span>
        <span class="version-by">
          <button class="version-author" onclick="openProfile('${v.authorId}')">${escapeHtml(authorName)}</button>
          <div class="version-time">${v.createdAt ? timeAgo(v.createdAt) : ""}</div>
        </span>
      </div>
      <div class="version-tags">
        <span class="version-tag">${escapeHtml(v.tag)}</span>
        <span class="version-readtime">${readingTime(v.body)}</span>
      </div>
      <div class="version-body collapsed" id="${bodyId}">${escapeHtml(v.body)}</div>
      <div class="version-actions">
        <button class="link-btn" data-action="expand">Read full version</button>
        <button class="icon-btn${liked ? " liked" : ""}" data-action="like" aria-pressed="${!!liked}" aria-label="Like this version">&#9825; ${(v.likedBy || []).length}</button>
        <button class="icon-btn${reported ? " reported" : ""}" data-action="report" ${reported ? "disabled" : ""} aria-label="Report this version">${reported ? "Reported" : "&#9873; Report"}</button>
      </div>
    `;
    card.querySelector('[data-action="expand"]').onclick = (e) => {
      const bodyEl = document.getElementById(bodyId);
      const collapsed = bodyEl.classList.toggle("collapsed");
      e.target.textContent = collapsed ? "Read full version" : "Show less";
    };
    card.querySelector('[data-action="like"]').onclick = () => toggleLike(v);
    card.querySelector('[data-action="report"]').onclick = () => reportVersion(v);
    el.appendChild(card);
  });
}

async function toggleLike(v) {
  if (!requireLogin("like a version")) return;
  try {
    const { version } = await api("/api/versions/" + v.id + "/like", { method: "POST" });
    const idx = currentDocs.findIndex((d) => d.id === v.id);
    if (idx !== -1) currentDocs[idx] = version;
    renderVersions();
  } catch (e) {
    showToast(e.message);
  }
}

async function reportVersion(v) {
  if (!requireLogin("report a version")) return;
  try {
    const { version } = await api("/api/versions/" + v.id + "/report", { method: "POST" });
    const idx = currentDocs.findIndex((d) => d.id === v.id);
    if (idx !== -1) currentDocs[idx] = version;
    renderVersions();
    showToast("This version has been flagged for review.");
  } catch (e) {
    showToast(e.message);
  }
}

/* ---------- write a version ---------- */
let selectedTag = TAGS[0];
function openEditor() {
  if (!requireLogin("write a version")) return;
  document.getElementById("editor-title").value = "";
  document.getElementById("editor-body").value = "";
  document.getElementById("editor-count").textContent = "0 / 4000";
  document.getElementById("editor-error").style.display = "none";
  selectedTag = TAGS[0];
  const tagWrap = document.getElementById("editor-tags");
  tagWrap.innerHTML = "";
  TAGS.forEach((tag) => {
    const b = document.createElement("button");
    b.className = "tag-pick" + (tag === selectedTag ? " active" : "");
    b.textContent = tag;
    b.onclick = () => {
      selectedTag = tag;
      [...tagWrap.children].forEach((c) => c.classList.remove("active"));
      b.classList.add("active");
    };
    tagWrap.appendChild(b);
  });
  document.getElementById("editor-overlay").classList.add("active");
  document.getElementById("editor-title").focus();
}
function closeEditor() { document.getElementById("editor-overlay").classList.remove("active"); }
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("editor-body").addEventListener("input", (e) => {
    document.getElementById("editor-count").textContent = e.target.value.length + " / 4000";
  });
  document.getElementById("editor-overlay").addEventListener("click", (e) => { if (e.target.id === "editor-overlay") closeEditor(); });
  document.getElementById("addbook-overlay").addEventListener("click", (e) => { if (e.target.id === "addbook-overlay") closeAddBook(); });
  document.getElementById("auth-overlay").addEventListener("click", (e) => { if (e.target.id === "auth-overlay") closeAuth(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.getElementById("editor-overlay").classList.contains("active")) closeEditor();
    if (document.getElementById("addbook-overlay").classList.contains("active")) closeAddBook();
    if (document.getElementById("auth-overlay").classList.contains("active")) closeAuth();
  });
  boot();
});

async function publishVersion() {
  const title = document.getElementById("editor-title").value.trim();
  const body = document.getElementById("editor-body").value.trim();
  const errEl = document.getElementById("editor-error");
  if (!title || !body) {
    errEl.textContent = "Add both a title and your rewrite before publishing.";
    errEl.style.display = "block";
    return;
  }
  const submitBtn = document.getElementById("editor-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Publishing…";
  try {
    await api("/api/versions", {
      method: "POST",
      body: { bookId: currentBookObj.id, chapterId: activeChapterId, title, tag: selectedTag, body },
    });
    closeEditor();
    showToast("Your version is live.");
    loadVersionsForChapter(activeChapterId);
    openBook(currentBookObj.id); // refresh chapter counts in the background list too
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish version";
  }
}

/* ---------- add a book ---------- */
let chapterRowCount = 0;
function chapterRowTemplate(n) {
  const wrap = document.createElement("div");
  wrap.className = "chapter-row-fields";
  wrap.dataset.row = n;
  wrap.innerHTML = `
    <button type="button" class="remove-chapter" onclick="removeChapterRow(this)" aria-label="Remove this chapter">Remove</button>
    <div class="crf-grid">
      <input type="text" class="crf-num" maxlength="10" placeholder="No.">
      <input type="text" class="crf-title" maxlength="80" placeholder="Chapter title">
    </div>
    <textarea class="crf-scene" maxlength="160" placeholder="One original sentence describing what happens (not a quote from the book)"></textarea>
  `;
  return wrap;
}
function addChapterRow() {
  chapterRowCount += 1;
  document.getElementById("ab-chapters").appendChild(chapterRowTemplate(chapterRowCount));
}
function removeChapterRow(btn) {
  const rows = document.getElementById("ab-chapters");
  if (rows.children.length <= 1) return;
  btn.closest(".chapter-row-fields").remove();
}
function openAddBook() {
  if (!requireLogin("add a book")) return;
  document.getElementById("ab-title").value = "";
  document.getElementById("ab-author").value = "";
  document.getElementById("ab-year").value = "";
  document.getElementById("ab-blurb").value = "";
  document.getElementById("ab-confirm").checked = false;
  document.getElementById("addbook-error").style.display = "none";
  const rows = document.getElementById("ab-chapters");
  rows.innerHTML = "";
  chapterRowCount = 0;
  addChapterRow();
  document.getElementById("addbook-overlay").classList.add("active");
  document.getElementById("ab-title").focus();
}
function closeAddBook() { document.getElementById("addbook-overlay").classList.remove("active"); }

async function submitNewBook() {
  const errEl = document.getElementById("addbook-error");
  const title = document.getElementById("ab-title").value.trim();
  const author = document.getElementById("ab-author").value.trim();
  const year = document.getElementById("ab-year").value.trim();
  const blurb = document.getElementById("ab-blurb").value.trim();
  const confirmedPublicDomain = document.getElementById("ab-confirm").checked;
  const chapterRows = [...document.getElementById("ab-chapters").children];
  const chapters = chapterRows.map((row, i) => ({
    num: row.querySelector(".crf-num").value.trim() || String(i + 1),
    title: row.querySelector(".crf-title").value.trim(),
    scene: row.querySelector(".crf-scene").value.trim(),
  }));

  const submitBtn = document.getElementById("addbook-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Adding…";
  try {
    await api("/api/books", { method: "POST", body: { title, author, year, blurb, chapters, confirmedPublicDomain } });
    closeAddBook();
    showToast("Added — it's now on the shelf for everyone.");
    await loadBooks();
    renderHome();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add book";
  }
}

/* ---------- profile & follows ---------- */
function findChapterInfo(bookId, chapterId) {
  const book = findBook(bookId);
  if (!book) return null;
  const idx = book.chapters.findIndex((c) => c.id === chapterId);
  if (idx === -1) return null;
  return { book, chapter: book.chapters[idx] };
}
function goToChapter(bookId, chapterId) {
  const book = findBook(bookId);
  if (!book) { showHome(); return; }
  currentBookObj = book;
  openChapter(chapterId);
}

async function openProfile(userId) {
  if (!userId && !currentUser) { openAuth("login"); return; }
  viewedUserId = userId || currentUser.id;
  const isOwn = viewedUserId === (currentUser && currentUser.id);

  document.getElementById("pf-people").style.display = "none";
  document.getElementById("pf-people-heading").style.display = "none";
  document.getElementById("pf-versions-heading").style.display = "block";
  document.getElementById("pf-versions").style.display = "block";
  document.getElementById("pf-books-heading").style.display = "block";
  document.getElementById("pf-books").style.display = "block";
  document.getElementById("pf-versions-heading").textContent = isOwn ? "Your versions" : "Versions";
  document.getElementById("pf-books-heading").textContent = isOwn ? "Books you added" : "Books added";

  let profileUser = isOwn ? currentUser : null;
  if (!profileUser) {
    try { const data = await api("/api/users/" + encodeURIComponent(viewedUserId)); profileUser = data.user; }
    catch (e) { showToast("Couldn't find that reader."); showHome(); return; }
  }
  viewedUserName = profileUser.name;
  document.getElementById("pf-avatar").style.background = profileUser.avatarColor;
  document.getElementById("pf-avatar").textContent = initials(profileUser.name);
  document.getElementById("pf-name").textContent = profileUser.name;
  document.getElementById("pf-sub").textContent = isOwn ? "Your activity on Otherwise" : "Their activity on Otherwise";
  document.getElementById("pf-footnote").textContent = "";

  const followBtn = document.getElementById("pf-follow-btn");
  if (isOwn) {
    followBtn.style.display = "inline-block";
    followBtn.className = "btn btn-ghost follow-btn";
    followBtn.textContent = "Log out";
    followBtn.disabled = false;
    followBtn.onclick = () => logout();
  } else if (!currentUser) {
    followBtn.style.display = "none";
  } else {
    followBtn.style.display = "inline-block";
    followBtn.disabled = true;
    followBtn.textContent = "…";
    try {
      const { follows } = await api("/api/follows?followerId=" + currentUser.id);
      setFollowButtonState(follows.some((f) => f.followeeId === viewedUserId));
    } catch (e) { setFollowButtonState(false); }
    followBtn.disabled = false;
  }

  document.getElementById("pf-versions").innerHTML = '<div class="loading-note">Loading…</div>';
  document.getElementById("pf-books").innerHTML = '<div class="loading-note">Loading…</div>';
  ["pf-stat-versions", "pf-stat-likes", "pf-stat-followers", "pf-stat-following"].forEach((id) => (document.getElementById(id).textContent = "–"));
  switchView("view-profile");

  let theirVersions = [], theirBooks = [], followerCount = 0, followingCount = 0;
  try { const d = await api("/api/versions?authorId=" + viewedUserId + (isOwn ? "&all=1" : "")); theirVersions = d.versions; } catch (e) {}
  try { const d = await api("/api/books"); theirBooks = d.books.filter((b) => b.addedBy === viewedUserId); } catch (e) {}
  try { const d = await api("/api/follows?followeeId=" + viewedUserId); followerCount = d.follows.length; } catch (e) {}
  try { const d = await api("/api/follows?followerId=" + viewedUserId); followingCount = d.follows.length; } catch (e) {}

  const totalLikes = theirVersions.reduce((sum, v) => sum + (v.likedBy || []).length, 0);
  document.getElementById("pf-stat-versions").textContent = theirVersions.length;
  document.getElementById("pf-stat-likes").textContent = totalLikes;
  document.getElementById("pf-stat-followers").textContent = followerCount;
  document.getElementById("pf-stat-following").textContent = followingCount;

  const vEl = document.getElementById("pf-versions");
  if (theirVersions.length === 0) {
    vEl.innerHTML = isOwn
      ? '<div class="empty-state"><p>You haven\'t written a version yet. Pick a book and rewrite a chapter your way.</p><button class="btn btn-primary" onclick="showHome()">Browse books</button></div>'
      : '<div class="empty-state"><p>No versions from this reader yet.</p></div>';
  } else {
    vEl.innerHTML = "";
    theirVersions.forEach((v) => {
      const info = findChapterInfo(v.bookId, v.chapterId);
      const row = document.createElement("button");
      row.className = "profile-item";
      row.onclick = () => goToChapter(v.bookId, v.chapterId);
      row.innerHTML = `
        <div class="pi-main">
          <div class="pi-title">${escapeHtml(v.title)}</div>
          <div class="pi-sub">${info ? escapeHtml(info.chapter.title) + " · " + escapeHtml(info.book.title) : "a chapter"}</div>
        </div>
        <div class="pi-meta">&#9825; ${(v.likedBy || []).length}</div>
      `;
      vEl.appendChild(row);
    });
  }

  const bEl = document.getElementById("pf-books");
  if (theirBooks.length === 0) {
    bEl.innerHTML = isOwn
      ? '<div class="empty-state"><p>You haven\'t added a book yet.</p><button class="btn btn-primary" onclick="showHome()">Add a book</button></div>'
      : '<div class="empty-state"><p>No books added by this reader yet.</p></div>';
  } else {
    bEl.innerHTML = "";
    theirBooks.forEach((b) => {
      const row = document.createElement("button");
      row.className = "profile-item";
      row.onclick = () => openBook(b.id);
      row.innerHTML = `
        <div class="pi-main"><div class="pi-title">${escapeHtml(b.title)}</div><div class="pi-sub">${escapeHtml(b.author)}</div></div>
        <div class="pi-meta">${b.chapters.length} chapter${b.chapters.length === 1 ? "" : "s"}</div>
      `;
      bEl.appendChild(row);
    });
  }
}

function setFollowButtonState(following) {
  const btn = document.getElementById("pf-follow-btn");
  btn.textContent = following ? "Following" : "Follow";
  btn.className = following ? "btn btn-ghost follow-btn" : "btn btn-primary follow-btn";
  btn.onclick = () => toggleFollow(following);
}

async function toggleFollow(currentlyFollowing) {
  if (!requireLogin("follow a reader")) return;
  const btn = document.getElementById("pf-follow-btn");
  btn.disabled = true;
  try {
    if (currentlyFollowing) {
      await api("/api/follows/" + viewedUserId, { method: "DELETE" });
      setFollowButtonState(false);
      showToast("Unfollowed " + viewedUserName + ".");
      const el = document.getElementById("pf-stat-followers");
      el.textContent = Math.max(0, parseInt(el.textContent || "0") - 1);
    } else {
      await api("/api/follows", { method: "POST", body: { followeeId: viewedUserId } });
      setFollowButtonState(true);
      showToast("Following " + viewedUserName + ".");
      const el = document.getElementById("pf-stat-followers");
      el.textContent = parseInt(el.textContent || "0") + 1;
    }
  } catch (e) {
    showToast(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function renderPeopleList(ids, emptyText) {
  document.getElementById("pf-versions-heading").style.display = "none";
  document.getElementById("pf-versions").style.display = "none";
  document.getElementById("pf-books-heading").style.display = "none";
  document.getElementById("pf-books").style.display = "none";
  document.getElementById("pf-people-heading").style.display = "block";
  document.getElementById("pf-people").style.display = "block";
  const listEl = document.getElementById("pf-people");
  listEl.innerHTML = '<div class="loading-note">Loading…</div>';

  if (ids.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p>${emptyText}</p></div>`;
    return;
  }
  let users = {};
  try { const d = await api("/api/users?ids=" + ids.join(",")); users = d.users; } catch (e) {}
  listEl.innerHTML = "";
  ids.forEach((uid) => {
    const user = users[uid];
    const name = user ? user.name : "a reader";
    const row = document.createElement("button");
    row.className = "profile-item";
    row.onclick = () => openProfile(uid);
    row.innerHTML = `
      <span class="avatar-circle" style="background:${user ? user.avatarColor : "#33473a"}">${initials(name)}</span>
      <div class="pi-main"><div class="pi-title">${escapeHtml(name)}</div></div>
    `;
    listEl.appendChild(row);
  });
}

async function showFollowersList() {
  document.getElementById("pf-people-heading").textContent = "Followers";
  try {
    const { follows } = await api("/api/follows?followeeId=" + viewedUserId);
    renderPeopleList(follows.map((f) => f.followerId), "No followers yet.");
  } catch (e) { renderPeopleList([], "Couldn't load followers right now."); }
}
async function showFollowingList() {
  document.getElementById("pf-people-heading").textContent = "Following";
  try {
    const { follows } = await api("/api/follows?followerId=" + viewedUserId);
    renderPeopleList(follows.map((f) => f.followeeId), "Not following anyone yet.");
  } catch (e) { renderPeopleList([], "Couldn't load that right now."); }
}
