# Otherwise — Project File

*A platform where readers rewrite the chapters that stayed with them.*

---

## 1. Concept

Readers don't just read a book — sometimes they finish a chapter thinking "I would have written that differently." **Otherwise** gives them a place to do exactly that: pick a book, pick a chapter, write your own version of it, and see everyone else's versions of the same chapter sitting alongside yours.

This is distinct from:
- **Fan fiction** (usually *continues* a story past its ending)
- **Book clubs** (discussion, not creation)
- **Wikis** (factual, not creative)

It's closer to a living anthology of "alternate universes" for a single chapter, all written by readers instead of one author.

---

## 2. Core Loop

1. Reader browses to a **book page**
2. Picks a **chapter**
3. Sees a short, original reference note (not the book's actual text) reminding them what that chapter covers
4. Clicks **"Write your version"**
5. Writes their own take, tags it with a mood (dark / comedic / romantic / poetic / etc.)
6. Publishes — it appears in that chapter's feed, filterable by tag

---

## 3. Copyright Strategy (core to this project, not an afterthought)

**Principle: never store or display the original book's actual text.**

| Element | Source | Copyright status |
|---|---|---|
| Book title, author, publication year | Fact | Not copyrightable |
| Chapter number & chapter title | Fact | Not copyrightable |
| One-line scene description ("the moment she follows the rabbit down the hole") | Written fresh by us/platform, not quoted from the book | Original text, not the book's — safe |
| User's rewritten version | 100% user-written | Belongs to the user; platform gets a display license via Terms of Service |

**Launch catalog:** public-domain books only (pre-~1965 author death, verified via Project Gutenberg or similar). This avoids copyright risk entirely for phase one.

**Modern/in-copyright books:** only added later, and only for authors who explicitly opt in — never opened to any book by default. Treat as a separate "licensed tier" once the platform has traction to show authors.

**Moderation guardrail:** scene descriptions must stay one line / factual — not scene-by-scene summaries, to avoid the description set for a book collectively functioning as an unauthorized plot abridgment.

**Report/takedown flow:** needed from day one in case a user's "version" is actually a copy-pasted excerpt from a copyrighted source rather than original writing.

---

## 4. MVP Scope (what to actually build first)

**In scope:**
- Book page (title, author, blurb, chapter list)
- Chapter page (reference note + write button + versions feed)
- Write/editor flow (title, tag, body text)
- Tag-based filtering on the feed
- 15–20 public-domain books to launch with

**Out of scope for v1** (add later):
- Accounts with follows/profiles
- Comments/likes/notifications
- "Family tree" view of versions inspired by other versions
- Licensed modern books

---

## 5. Open Decisions

- **Audience/visibility:** public from day one, or invite-only/book-club style at first? *(not yet decided)*
- **Who writes chapter reference notes:** curated by the platform (safer, slower) or first user to reference an untagged chapter (faster, needs light moderation)? *(not yet decided)*
- **Accounts:** anonymous/pseudonymous writing vs. requiring sign-up before publishing a version?
- **Monetization:** not yet discussed — free/ad-free community, paid pro features, or licensing revenue share with opted-in authors later?

---

## 6. Prototype

A clickable prototype exists, built around *Alice's Adventures in Wonderland* (3 chapters), demonstrating the full core loop with the copyright-safe reference model (no original book text stored).

---

## 7. Suggested Next Steps

1. Decide public vs. invite-only launch (affects moderation load and legal ToS needs)
2. Pick the initial 15–20 public-domain book catalog
3. Decide chapter-reference-note ownership (platform-curated vs. user-submitted)
4. Move from prototype (local browser storage) to a real backend/database so versions are shared across users
5. Draft Terms of Service covering: user ownership of their writing, platform display license, and the takedown/report process
