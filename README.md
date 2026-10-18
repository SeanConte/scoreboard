# Scoreboard 0.18

A browser-based, static sports scoreboard. `index.html` is the deployable file for GitHub Pages and can be opened directly. No account or application server is required. Live scores and expanded statistics still require access to ESPN's public feeds (including their CORS availability).

## Files

- `index.html`: compiled standalone application; deploy this to GitHub Pages.
- `src/core.js`: data discovery, networking, normalization, and caching.
- `src/progression.js`: sport-specific event classification and shared metric validation.
- `src/ui.js`: charts, cards, controls, and interaction.
- `src/styles.css`: styles.
- `src/template.html`: page shell and embedded assets.
- `tools/build.py`: deterministically regenerates `index.html` from the source components.
- `tests/`: browser regression fixtures for NBA/WNBA validation, CFB discovery and cross-sport progressions.

Edit the appropriate source JavaScript file or `src/styles.css`, then run `python tools/build.py`. Do **not** edit the compiled `index.html` and source independently.

## Architecture

1. Discovery: ESPN scoreboard feeds, three candidate dates to handle time-zone rollover; FBS–FCS supplement is included only for teams confirmed in the FBS standings registry. Supplemental failure produces a visible coverage warning.
2. Normalization: stable league-specific game objects, team IDs, clocks, ranks, status and scores.
3. Detail requests: loaded only for expanded games, using one queued, timeout-and-abort-aware JSON transport. Some sports optionally request paginated event feeds.
4. Sport adapters: interpret event types and assign team and axis positions. Basketball and football use summary plays/drives; baseball, hockey, and soccer use available play-by-play.
5. One shared progression assembler: stable event ordering, cumulative running totals, and two-team official-total reconciliation for finished games. Missing or unverified histories are not offered as selectable statistics.
6. Rendering: compact cards and one optional expandable graph/stat panel. Both derive from normalized snapshots; graph controls preserve selection on refresh. Live metrics are provisional until the final totals can be reconciled.

## Reliability changes in 0.18

- Consolidated repeated networking, historical event accumulation, and validation into shared helpers.
- Fixed missed/blocked shot categorization and duplicate-ID handling; stopped collapsing distinct plays when ESPN omits event IDs.
- Reduced repeated historical/adjacent-date feed requests through time-aware cache TTLs; current-date scores retain a short TTL.
- Graph scales correctly when football yardage dips below zero.
- Scoring histories with final scores inconsistent with the official scoreboard fall back to period totals.
- Surface incomplete CFB supplemental coverage rather than silently implying all FBS–FCS games were checked.
- Bound per-day expanded-game state; retain current cards and visuals.

## Tests

With Python, Playwright and a Chromium browser installed, from the project directory run:

```bash
python tests/test_cross_sport.py
python tests/test_wnba_integrity.py
python tests/test_cfb_discovery.py
```

The test fixtures simulate ESPN-shaped responses and do not validate live ESPN API availability. Browser platform cross-origin restrictions, partial ESPN event feeds and postgame corrections remain external dependencies; unsupported statistics intentionally disappear instead of being invented. ESPN is a third-party source and these endpoints are not a contracted data service.
