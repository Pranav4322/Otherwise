// A small, dependency-free JSON-file database.
//
// This is intentionally simple: everything lives in one JSON file on disk,
// loaded into memory on boot and rewritten after every change. That's more
// than enough for a small community site, and it means this project runs
// anywhere Node runs, with nothing to install or configure beyond `npm install`.
//
// If you outgrow this (many concurrent writers, need for transactions,
// real backups), swap this module for Postgres/SQLite/etc. — every route
// file only talks to the functions exported here, so that's the only file
// you'd need to change.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "data", "data.json");

function seedData() {
  const now = Date.now();
  const books = [
    {
      id: "alice",
      title: "Alice's Adventures in Wonderland",
      author: "Lewis Carroll",
      year: "1865",
      color: "#33473a",
      blurb: "A girl follows a waistcoated rabbit down a hole and finds a world that runs on its own logic.",
      addedBy: null,
      createdAt: now,
      chapters: [
        { id: "alice-1", num: "I", title: "Down the Rabbit-Hole", scene: "the moment she follows the White Rabbit down the hole" },
        { id: "alice-2", num: "II", title: "The Pool of Tears", scene: "the chapter where she grows and shrinks and nearly drowns in her own tears" },
        { id: "alice-3", num: "III", title: "A Caucus-Race and a Long Tale", scene: "the chapter where the soaked animals try to dry off together" },
      ],
    },
    {
      id: "pride",
      title: "Pride and Prejudice",
      author: "Jane Austen",
      year: "1813",
      color: "#7a3030",
      blurb: "Five sisters, one entailed estate, and a wealthy new neighbor everyone has an opinion about.",
      addedBy: null,
      createdAt: now,
      chapters: [
        { id: "pride-1", num: "I", title: "Chapter 1", scene: "the opening conversation about a wealthy new neighbor moving in" },
        { id: "pride-3", num: "III", title: "Chapter 3", scene: "the first ball, and the insult Elizabeth overhears" },
        { id: "pride-34", num: "XXXIV", title: "Chapter 34", scene: "the first, disastrous proposal" },
      ],
    },
    {
      id: "frank",
      title: "Frankenstein",
      author: "Mary Shelley",
      year: "1818",
      color: "#22301f",
      blurb: "A scientist assembles life from what he can find, and immediately regrets it.",
      addedBy: null,
      createdAt: now,
      chapters: [
        { id: "frank-4", num: "IV", title: "Chapter 4", scene: "the night the creature first opens its eyes" },
        { id: "frank-5", num: "V", title: "Chapter 5", scene: "the morning after, when Victor flees his own creation" },
        { id: "frank-10", num: "X", title: "Chapter 10", scene: "the confrontation on the glacier" },
      ],
    },
    {
      id: "scarlet",
      title: "A Study in Scarlet",
      author: "Arthur Conan Doyle",
      year: "1887",
      color: "#a9823f",
      blurb: "A doctor back from war moves in with a stranger who deduces his entire life in one glance.",
      addedBy: null,
      createdAt: now,
      chapters: [
        { id: "scarlet-1", num: "I", title: "Mr. Sherlock Holmes", scene: "the first meeting between Watson and Holmes" },
        { id: "scarlet-2", num: "II", title: "The Science of Deduction", scene: "the chapter where Holmes explains his method" },
        { id: "scarlet-3", num: "III", title: "The Lauriston Gardens Mystery", scene: "the first crime scene" },
      ],
    },
    {
      id: "mobydick",
      title: "Moby-Dick",
      author: "Herman Melville",
      year: "1851",
      color: "#243b4a",
      blurb: "A sailor signs onto a whaling ship captained by a man with one obsession.",
      addedBy: null,
      createdAt: now,
      chapters: [
        { id: "mobydick-1", num: "I", title: "Loomings", scene: "the chapter where Ishmael explains why he goes to sea" },
        { id: "mobydick-28", num: "XXVIII", title: "Ahab", scene: "the captain's first appearance on deck" },
        { id: "mobydick-36", num: "XXXVI", title: "The Quarter-Deck", scene: "the chapter where Ahab reveals the real reason for the voyage" },
      ],
    },
    {
      id: "dracula",
      title: "Dracula",
      author: "Bram Stoker",
      year: "1897",
      color: "#4a1f2b",
      blurb: "A young solicitor travels to a remote castle and slowly realizes his host is not what he seems.",
      addedBy: null,
      createdAt: now,
      chapters: [
        { id: "dracula-1", num: "I", title: "Jonathan Harker's Journal", scene: "the journey to the castle and the first strange warnings" },
        { id: "dracula-2", num: "II", title: "Jonathan Harker's Journal continued", scene: "the chapter where Harker realizes he is a prisoner" },
        { id: "dracula-21", num: "XXI", title: "Dr. Seward's Diary", scene: "the discovery of what has been happening to Mina" },
      ],
    },
  ];
  return { users: [], books, versions: [], follows: [] };
}

let db = null;

function load() {
  if (db) return db;
  if (fs.existsSync(DATA_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      // fill in any collections an older data file might be missing
      db.users = db.users || [];
      db.books = db.books || [];
      db.versions = db.versions || [];
      db.follows = db.follows || [];
      return db;
    } catch (e) {
      console.error("Couldn't parse data.json, starting from a fresh seed:", e.message);
    }
  }
  db = seedData();
  save();
  return db;
}

function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function id() {
  return crypto.randomBytes(9).toString("base64url");
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "book"
  );
}

module.exports = { load, save, id, slugify };
