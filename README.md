# Scoreboard 0.32

A browser-based, static sports scoreboard. `index.html` is the deployable file for GitHub Pages and can be opened directly. No account or application server is required. Live scores and expanded statistics still require access to ESPN's public feeds (including their CORS availability).

The release history is recorded in [`CHANGELOG.md`](CHANGELOG.md), with versions **0_18**, **0_20**, and **0_26** explicitly flagged as important recovery points.

## Important rollback checkpoints (preserve these versions)

| Version | Why preserve it |
| --- | --- |
| **0_18 — IMPORTANT** | Reliability baseline: consolidated feed, historical play and normalization safeguards. |
| **0_20 — IMPORTANT** | Stable customizable scoreboard layout, persistent league order and sticky sports navigation. |
| **0_26 — IMPORTANT** | Mature game-detail/full-screen monitor before introducing team-season pages. |

These are deliberate comparison/recovery milestones. Newer versions do not replace these reference releases.

## 0.32 — Daily pinned games and favorite teams

- Click either **live / total** count (by the day heading or in the sticky sport/date bar) to toggle **Live only**. Both reflect the same state. The selected filter is saved in browser storage; click again for scheduled and completed games. The counter is based on distinct game IDs, so duplicated feature cards do not inflate it.
- Each card now has a small **Pin** button. Pinned games for the currently selected date appear in a top, mixed-sport **Pinned games** section. Unpin them from either copy. Pins are remembered per date and are retained when you revisit past days.
- Use the star beside a team's name in a game card, or beside its name on its season page, to toggle a favorite. An active favorite team highlights its game cards and duplicates its matchups in **Favorite teams** at the top. The original league cards remain in their original sorting/grouping position. Favorite identities persist across dates and seasons.
- Games that are both pinned and involve a favorite team appear once in the featured area (under Pins) and still once in their original league. Featured sections are independent of the sport-tab selection but respect league visibility settings.
- All featured cards and standard cards open the same underlying game record and game monitor. Expanded cards have unique detail regions so expanding a promoted copy does not accidentally expand its original. The chart/stat data cache remains shared by ID.
- Favorite teams use stable ESPN numeric team IDs qualified by league. Tennis player favorites are not implemented yet; tennis **match pins** work. No accounts or backend needed.
- 18 browser test suites, including new fixtures for persistence, daily pin scope, team-page favorite toggles, mobile layouts, live-only filtering, and earlier sports/statistics/game pages. Live ESPN feeds remain dependent on external availability.

## 0.31 — Team schedule polish and consistent game controls

- In team schedules, an **in-progress** game receives a prominent LIVE label and accented row, while an **upcoming game today** gets a quieter TODAY label. An open, relevant team schedule rechecks ESPN about once per minute while visible without disrupting the season-statistics tab.
- Team identity colors (when supplied by ESPN) now accent the hero, record tiles, selected tab, and per-game season-scoring bars. Each season game can show the opponent crest just below its bars. Hover, focus, or touch inspection identifies the week/game number, opponent, home/away, date, result, score, and ESPN status. Failed crest images are hidden gracefully. Statistics remain schedule-derived rather than being inferred from the team colors.
- When the main scoreboard heading leaves the screen, its **live / total** count appears in the sticky sport/date navigation. In 0_32 it also serves as the live-only toggle, and its tally includes distinct featured games from other selected-followed sports without double-counting.
- Each game card now offers two centered controls along its bottom edge: **Expanded card** (toggles the inline figures and stats) and **Full screen** (opens the existing game monitor directly, even without first expanding the card). The separate launcher inside the expanded detail panel is removed. Existing graphs, box scores, metric preferences, and keyboard accessible return controls are unchanged.
- Desktop and mobile fixture tests cover schedule highlight states, team accents, chart crests and tooltips, sticky counter, both game buttons and direct full-screen behavior. Earlier league/monitor tests were also rerun. This does not independently certify all live ESPN endpoints.
- Still preserve **0_18**, **0_20**, and **0_26** as important rollback checkpoints. The 0_30 WNBA/NBA preference migration has not been repeated or altered.

## 0.30 — ATP/WTA tennis and player event links

- Tennis is organized under **ATP Tour** and **WTA Tour**, rather than a single "Grand Slams" section. The tournament is the event context on each match card; singles matches are no longer restricted to four majors. Other tour levels appear only where the ESPN feeds supply them. Tennis is still *not* a team league.
- The default ordering keeps **WNBA ahead of NBA**. Existing stored league layouts migrate once; future manual order changes are honored. Settings retain visibility, drag/reorder, collapsed sections and reset.
- **Group by league** describes the league sections, and the Settings control now uses an even eight-tooth gear icon.
- Fullscreen player highlighting is still off by default. Verified player events can now highlight points for NBA/WNBA, football scoring contributors, NHL scoring/shots, soccer scoring/shots and MLB hit/home run statistics. Unverified attribution is not shown; database-backed live event availability varies among leagues.
- 0_18, 0_20 and 0_26 remain the important rollback checkpoints.

## 0.27 — Team identity and season schedules

- Click a team name in a game card to open a dedicated team season view. ESPN team IDs, together with league identifiers, remain the stable identities; existing game IDs and date-scoreboard logic are not duplicated.
- Season picker and a full team schedule use ESPN's team-schedule feed. Schedule results link to the exact game in the existing scoreboard on its local date, where the usual card opens and shares its unchanged details and monitor logic. A small “← Team” control then returns to the originating season view and scroll position.
- Browser Back to scoreboard restores the earlier scroll position. Feed requests cache season schedules separately from the existing scoreboard cache.
- Tennis is intentionally left out of **team** pages; athlete profiles require a distinct data model.
- Next revision adds season-statistics panels; the team view is intentionally kept independent of game-detail network requests.

## 0.28 — Season statistics

- Every team schedule now has a **Statistics** tab. It shows labeled, schedule-derived points for/against, average differential, win percentage, and a compact per-game scoring figure, using *only* completed games with valid final scores. The derived sample can include postseason and is identified as such; it is not presented as ESPN's official regular-season aggregate.
- Separately requests season/team/type-2 (regular-season) aggregates from ESPN's Core API. Groups and renders every returned named team statistic with its reported value and league rank when supplied. It does not guess meanings of undocumented fields or invent unavailable totals. An unavailable aggregate feed does not block the schedule or the derived summaries.
- Statistics are cached per league/team/season, share the existing read queue/timeout behavior, and update when the user selects a different season. All cards, sorting, full-screen game monitoring and day navigation retain their 0.26 behavior.
- ESPN endpoints are undocumented, so availability across all leagues must be checked during live use. The project includes offline multi-league fixture tests, not live-feed guarantees.

## Files

- `index.html`: compiled standalone application; deploy this to GitHub Pages.
- `src/core.js`: data discovery, networking, normalization, and caching.
- `src/progression.js`: sport-specific event classification and shared metric validation.
- `src/ui.js`: charts, cards, controls, and interaction.
- `src/team.js`: season pages and schedule-to-game navigation.
- `src/team-stats.js`: season-statistics module (added in 0_28).
- `src/styles.css`: styles.
- `src/template.html`: page shell and embedded assets.
- `tools/build.py`: deterministically regenerates `index.html` from the source components.
- `tests/`: browser regression fixtures for NBA/WNBA validation, CFB discovery, cross-sport progressions, and navigation/settings persistence.

Edit the appropriate source JavaScript file or `src/styles.css`, then run `python tools/build.py`. Do **not** edit the compiled `index.html` and source independently.

## Architecture

1. Discovery: ESPN scoreboard feeds, three candidate dates to handle time-zone rollover; FBS–FCS supplement is included only for teams confirmed in the FBS standings registry. Supplemental failure produces a visible coverage warning.
2. Normalization: stable league-specific game objects, team IDs, clocks, ranks, status and scores.
3. Detail requests: loaded only for expanded games, using one queued, timeout-and-abort-aware JSON transport. Some sports optionally request paginated event feeds.
4. Sport adapters: interpret event types and assign team and axis positions. Basketball and football use summary plays/drives; baseball, hockey, and soccer use available play-by-play.
5. One shared progression assembler: stable event ordering, cumulative running totals, and two-team official-total reconciliation for finished games. Missing or unverified histories are not offered as selectable statistics.
6. Rendering: compact cards and one optional expandable graph/stat panel. Both derive from normalized snapshots; graph controls preserve selection on refresh. Live metrics are provisional until the final totals can be reconciled.

## Navigation and customization in 0.20

- The sport picker is now a **single sticky navigation bar** with the date controls opposite it and a settings button at the right. The old static league list is removed. A sport icon expands inline to show that sport’s visible leagues and an **ALL** control for the entire sport. **All** at the far left selects all visible leagues.
- League headers still collapse and expand directly on the scoreboard. Reordering handles and arrows no longer clutter the scoreboard.
- Use the settings button to choose visible leagues, drag to reorder, use up/down arrows for touch or keyboard, or **Reset league layout** to restore default visibility, order, and expanded sections. At least one league must remain visible.
- Order, visibility, and collapsed states use browser `localStorage` under `scoreboard-layout-v1`; 0.19 order/collapse preferences carry forward. Sort modes remain separately stored under `scoreboard-sort-v1`.
- Redundant **Start time** and **Score margin ÷ time left** sorts have been removed. Old saved selections migrate to **Schedule order** and **Close + late**, respectively. Existing live-first score/time sort behavior is preserved.
- The date selector remains reachable while scrolling; smaller screens use a two-row sticky arrangement. The app remains portable and requires no account/backend.
- Favorites and import/export remain future stages.

## Full-window game monitor in 0.21

- Expand any game, then choose **Full screen** in its game-details toolbar. A full-window modal displays the same score, live status, scoring progression, game/team statistics, and period results, laid out for monitoring one matchup at a time.
- The modal reuses the **same normalized game record and detail cache** as the scoreboard. Metric selections carry across both presentations, and updates occur with the existing automatic refresh. No duplicate ESPN summary polling or external page is created.
- The close button and Escape return to the still-expanded game, with the underlying scoreboard position retained. The monitor scrolls independently and adapts to desktop and mobile screens.
- Adjacent-date game deduplication now prefers the most recently received feed copy so a cached neighboring date cannot overwrite a freshly updated score.
- Added `tests/test_game_monitor.py` for desktop/mobile layout, close behavior, shared detail contents, and live score refresh.

## Monitor workspace in 0.22

- The full-window game monitor has distinct **Overview** and **Box score** tabs. The desktop Overview is composed for a single viewport (matchup score, game-flow graph, team statistics, top performers, and scoring by period). Narrow/mobile screens scroll vertically instead of shrinking the statistics to illegibility.
- Box score renders **all players and stat categories provided in ESPN summary payloads**, not just the leaders. Both teams' sections are shown, with sortable column headings and horizontal scrolling for wide sport-specific tables. DNP entries supplied by the feed remain listed.
- Both monitor tabs share the existing detail cache and live update loop; toggling views does not issue duplicate requests. Scoreboard card layout and collapse, sort, and settings preferences remain unchanged.
- Updated desktop/mobile monitor browser tests for tabs, live refresh, and exiting to the correct expanded game.

## Player timelines in 0.23

- NBA/WNBA **Player layer** selector appears in the full-screen Overview **only when the game feed offers a clock-based scoring progression and identifies at least one scorer in its play-by-play.** Other sports retain the redesigned monitor and full box score, but do not show an unsupported player selector.
- Selecting an identifiable player highlights their recorded scoring plays on the team score timeline. A small quarter-by-quarter summary reports points attributed from available plays and, separately, the box-score point total. This is **not a full minute-by-minute reconstruction of every player statistic**.
- Events are attributed only when a scorer can be matched to a box-score athlete, with event time, team, and scoring value. Duplicate play IDs are ignored. If attributed totals exceed the official box-score points, the contradictory player timeline is hidden. No values are interpolated from box-score totals.
- A player highlight is omitted when the feed lacks suitable play-by-play or when only period totals are available. Players without reliably credited events are not offered as a selection. The monitor continues auto-updating from the shared summary cache.
- Added browser fixtures for NBA-style player play-by-play, full roster box scores, quarter attribution, marker overlay, desktop one-screen fit, mobile layout, and tab switching.

## Chart-first monitor and full-data audit in 0.24

- Full-screen Overview is **chart-first** and fitted to the viewport on desktop. Removed the old quarter-by-quarter panel and the large redundant readout from monitor mode. A condensed team-stat and top-performer strip sits beneath the chart, rather than squeezing the chart into a side column. Small screens scroll vertically.
- **Chart inspection**: move the pointer across the graph for a crosshair with the elapsed time/period, team totals at that point, and an event description **only when the event is matched to a reported scoring play**. Hovering close to a plotted event snaps to it. Tap/click to pin the crosshair; arrow keys move it when the chart is focused. A pinned moment is restored after live rendering.
- NBA/WNBA **Player overlay** automatically selects the leading *identifiable, play-attributed* scorer on first open (previously started at `No player overlay`). The dropdown shows credited-play point counts and has an explicit Off choice. Where a play has no participant list, conservative, unambiguous name matching against the box-score roster is used. Missing or contradictory information yields a clear unavailable notice, never fabricated points.
- **Complete team-stat comparisons** were added to Box Score, alongside the existing complete player-by-player tables. They include every reported team metric, including display values not suitable for numeric comparisons (e.g., made-attempted strings). Overview displays a curated subset; Box Score exposes the rest if ESPN provides it. Support was tested with separately shaped league fixtures: NBA, WNBA, NFL, CFB, MLB, NHL, MLS, NWSL, and tennis. Player time overlays remain basketball-only; event hover works for sports with suitable progression events. Tennis retains set-based graphics where play times are unavailable.
- New `tests/test_monitor_024.py` verifies nine league-specific box-score stat categories and conservative WNBA scoring attribution. Player monitor integration tests include event tooltip and touch pinning; older regression suites are retained.
- **Data limitation**: Offline fixtures and browser rendering have been tested; live endpoint behavior cannot be guaranteed. ESPN may omit an entire sport's statistics, a player roster, scoring play times, or athlete identity on individual games. The UI intentionally says when something is missing instead of inventing data. No additional account or backend is needed.

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
python tests/test_league_layout.py
python tests/test_game_monitor.py
python tests/test_player_monitor.py
python tests/test_monitor_024.py
```

The test fixtures simulate ESPN-shaped responses and do not validate live ESPN API availability. Browser platform cross-origin restrictions, partial ESPN event feeds and postgame corrections remain external dependencies; unsupported statistics intentionally disappear instead of being invented. ESPN is a third-party source and these endpoints are not a contracted data service.

## Full-screen refinement in 0.25

- Corrected a genuine chart distortion: removed the `preserveAspectRatio="none"` attribute and CSS rule that forcibly stretched the 680×264 SVG to both the containing height and width. Full-screen chart now preserves its native coordinate geometry and fits without vertical squashing/stretched lines.
- Removed the fullscreen quarter breakdown (already absent from the Overview) and retained the single interactive time/score plot and compact team comparisons.
- Player overlay defaults to **None** and only becomes active on explicit selection. Metric and player dropdowns are side-by-side in the graph header, compactly styled; a missing attributable play-by-play disables the player selector instead of adding a large banner.
- Show up to five top performers per team where actual player totals are available, including further football contributors rather than just the three category leaders. Player headshots appear at small size if ESPN supplies HTTPS headshot URLs.
- Scroll naturally when a tall game/roster demands it, rather than squeezing or clipping extra performers to force an arbitrary screen height.

## Full-screen player & team-stat linking (0.26)
- Player cards in the full-screen Top Performers panel and the player-overlay dropdown now use the same ESPN athlete identifiers. Selecting either updates the other and the scoring graph; clicking an active card toggles the overlay off. When the dropdown selects a recorded scorer who is outside the displayed top-five, their card is added to the list. A card without verifiable scoring-event attribution is not made into a misleading selection.
- Choosing a graph metric other than Score automatically clears the scoring-player overlay, so the card selection always reflects what is shown in the figure. Default is still no player overlay.
- Full-screen Team Statistics uses the exact paired-values and bar visualization from the expanded card, and shows **all** game statistics that ESPN supplies for both teams. Composite/text-only values show the numbers but do not get a fabricated numeric comparison bar. The Box Score tab retains its complete team and player tables.
- Athlete headshots are larger (approximately 42 px for performer cards, 38 px on smaller screens); full-player box-score rows can show ESPN portraits too. Images are optional, with fallback when none are supplied.
- Regression tests include fixture-driven selection in both directions, extended numeric and nonnumeric team stats, desktop and mobile layout, and previous cross-sport suites.


## 0_29 tightening release

- **Season scores by game**: Hover/focus a bar (or tap on mobile) for the opponent, home/away status, full date, week when supplied by ESPN (football), the team and opponent scores, and the game number. Tap once to inspect and a second time to open the original day/game; the tooltip also provides a **View game** action. For other leagues use season game order rather than inventing a week. The chart shows the last 32 final results, explicitly labeled.
- **Season statistic links**: Selecting a scored/allowed/differential summary tile switches the per-game season chart to the matching measure. A small selector can restore both series; official season aggregate categories remain separate and are **not** misrepresented as game-by-game histories.
- **Game statistic links**: Where the same quantity is genuinely available as a supported event-derived time series, clickable team-stat comparison rows switch the game graph to that statistic. The full Box Score's corresponding team-stat name links back to the Overview with the chosen chart metric. Tennis set and game totals are linked to corresponding match charts.
- **Semantic checks across leagues**: NBA, WNBA, NFL, CFB, MLB, NHL, MLS, NWSL and tennis; unsupported/unverified histories, percentages, composite shooting stats and ambiguous pitching/batting strikeouts do **not** offer misleading links. Corrected football seasons for January/February games without a feed-supplied season year.
- **Data integrity**: User's preexisting local browser preferences, scoreboard cards, game detail summaries, full-window monitor, live refresh, graph geometries, season pages and important rollback releases (0_18, 0_20, 0_26) remain unchanged. Offline browser fixtures test interactions and data shapes, not every current live ESPN endpoint.
