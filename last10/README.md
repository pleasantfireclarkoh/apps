# Last 10 incidents

Read-only PTFD station board. Open `last10/` through the dashboard's HTTP server. Deploy `index.html`, `styles.css`, `app.js`, and `model.mjs` together; no build or package installation is needed. The server must serve JavaScript modules with a JavaScript MIME type, including `.mjs`.

The board uses the existing `pleasant-fire` Firebase project and `artifacts/pleasant-township-app/public/data/calls` collection. It supports the existing injected custom auth token and anonymous sign-in. It does not write incident records or save incident details to browser storage.

Records follow Run Tracker's descending year/sequence order. Legacy records can fall back to the incident ID or dispatch date. EMS nature codes remain masked as `EMS CALL`; explicitly EMS responses are also masked. Combined responses retain their response label.

The interface shows only incident cards, with the last three digits of the run number enlarged in each card's left rail. Hovering the number reveals the full run number, which is also available to screen readers. There is no header, summary, or footer. Desktop order is newest to oldest down the left column, then the right column; phones show a single ordered column. Long text wraps rather than being truncated. Incident dates and times use the stored dispatch values. Connection warnings and retry controls appear below the cards only when needed; loading and empty states appear when there are no cards.

The full collection listener preserves legacy records that lack sort fields. Moving to a limited server query requires backfilling those fields and setting up an appropriate Firestore index first.

At TV-sized viewports (at least 1500×900), the board enlarges call types to 46px, addresses to 36px, dates/times to 24px, and response labels to 18px. The three-digit run numbers retain their existing size. The 1920×1080 layout shows all ten incidents without scrolling.

Run the focused data checks with `node --test last10/model.test.mjs` from the APPS folder. Visual checks should cover 1280×720, 1920×1080, and phone widths.
