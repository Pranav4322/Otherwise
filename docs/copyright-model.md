# Copyright model

This document explains why the app is built the way it is, so future
changes don't accidentally undo the safety of the design.

## The core rule

**Otherwise never stores or displays a book's actual text.** Every chapter
on the platform is represented only by:

| Element | Where it comes from | Copyright status |
|---|---|---|
| Book title, author, year | Fact | Not copyrightable |
| Chapter number & chapter title | Fact | Not copyrightable |
| A one-line scene description ("the moment she follows the White Rabbit down the hole") | Written fresh by whoever adds the book — never quoted from the book | Original text, not the book's — safe |
| A user's rewritten version | 100% written by that user | Belongs to the user; the platform's Terms of Service should grant it a license to display the work |

Nothing else about a book is ever stored. There is no field anywhere in
the data model for the book's actual prose.

## Why this matters

- **Facts aren't copyrightable.** A title, an author's name, and a chapter
  number can be referenced forever, regardless of the book's copyright
  status.
- **A short, original description is new writing**, not a reproduction of
  the book — so it never touches copyright, as long as it's genuinely
  written fresh and not lifted from a summary site or the book's jacket
  copy.
- **Character names are generally safe to reference** (Alice, Elizabeth
  Bennet, Sherlock Holmes) — names by themselves aren't copyrightable. The
  exception is a small set of extremely distinctive, heavily merchandised
  characters (think Mickey Mouse) where courts have granted separate
  "character copyright" — but this is a movie/franchise-IP problem, not a
  books problem, so novels are very unlikely to run into it.

## Launch catalog: public domain only

Every seed book (`server/store.js`) is chosen because its copyright has
fully expired:

- In the **US**, that's generally works published before 1929.
- In **India**, copyright lasts 60 years after the author's death —
  shorter than the US. A practical, globally-safe rule of thumb: stick to
  authors who died before roughly 1965.
- **Project Gutenberg** is a good source of verified public-domain texts
  and a reasonable sanity check before adding a book.

## The "Add a book" feature keeps the same guarantee

The form in `public/index.html` / `public/app.js` and the
`POST /api/books` route in `server/routes/books.js` only ever accept:

1. Title, author, year, a short blurb — facts or the contributor's own
   words
2. Chapters, each with a number, a title, and **one original sentence**
   describing what happens — explicitly labeled in the UI as "not a quote
   from the book"
3. A **required checkbox** confirming the book is public domain and the
   descriptions are original wording

There is currently no automated verification of that checkbox — it's an
honor-system control. See "Extending it" below for what a review step
would add.

## Guardrail: descriptions must stay short and factual

Keep an eye on scene descriptions drifting into detailed, scene-by-scene
retellings. A one-line label ("the moment the letter arrives") is fine; a
three-paragraph summary starts to look like an unauthorized abridgment —
especially once every chapter's description is stitched together and
could functionally reconstruct the book's plot. If this becomes a real
product, enforce a hard character limit (already 160 characters in the
current form) and spot-check new submissions.

## Modern, in-copyright books: not supported yet, and shouldn't be added casually

If you ever want to open the platform to books that are still under
copyright, do **not** just remove the public-domain requirement. Options,
roughly in order of legal safety:

1. **Direct permission.** Email the author or publisher. Many
   self-published or indie authors are enthusiastic about reader
   engagement and will say yes for free or a small revenue share.
2. **A separate, explicitly opted-in "licensed" catalog.** Keep the
   open/public-domain catalog as is, and add a second, small list of
   modern books whose authors have explicitly agreed — never opened to
   "any book" by default.
3. **Never rely on "fair use" alone for a for-profit platform's core
   product.** Fair use might cover a short quote for commentary, but a
   platform built on remixing copyrighted books as its main feature is a
   much harder case to defend — and outside the US ("fair dealing" in
   India, for example) the exceptions are narrower still.

None of this is legal advice — talk to an actual lawyer before opening the
catalog beyond public domain.

## What NOT to do

- Don't add a field for "original excerpt" or "quote from the book"
  anywhere in the data model — the whole safety of this design rests on
  that field not existing.
- Don't treat a report/takedown system as your only safeguard for
  copyrighted content — that's reactive. Prevention (never storing the
  original text) is what actually protects the platform.
- Don't let scene descriptions balloon in length "to be more helpful" —
  see the guardrail above.

## Extending it: a review queue

Right now, a submitted book goes live immediately once the checkbox is
checked. A safer version would add a `status: "pending" | "approved"`
field to each book, an admin-only route to approve/reject, and a home-page
filter that only shows `approved` books to the public — while the
submitter can still see and edit their own pending submission.
