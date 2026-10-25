# Scoreboard changelog

| Version | Status | Summary |
| --- | --- | --- |
| 0_39 | Release | Two-line sticky navigation with Settings at top-right, Pins/Favorites and date on second row; live count joins them when scrolling. Sports icon row scrolls only horizontally; no experimental GIFs. |
| 0_39-experiment | Optional branch | Separate NBA/WNBA ambient GIF prototype; not incorporated into the standard app. |
| 0_38 | Release | Replaced pin-board filter graphic with two pushpins; sticky pinned/favorite filters and live counter share a synchronized compact rail when original controls scroll away; Customize gains a separate Favorite teams tab, with team names/logos, remove controls, and migration of older ID-only favorites. |
| 0_37 | Release | Pinned and favorite games are in-place filters (no duplicate card sections); compact pin-board and three-star icons. League display is now expanded/collapsed/hidden in Settings. The grouped All view shows 12 events per league, with View all and league-title links opening the full league list. Independent collapse arrows, bottom-right version label, preserved browser preferences. |
| 0_36 | Release | Full-screen graph click/tap deselection, responsive mobile detail readout, and live, sport-specific situation details in the game monitor. |
| 0_35 | Release | Mobile sticky navigation with full-width sport icons and second-row live counter; retained family icon alongside its ALL option; background monthly schedule cross-checks across NBA/WNBA, MLB, NHL, NFL, MLS/NWSL, ATP/WTA, with additive game recovery and primary-failure fallback without disrupting live feeds. |
| 0_34 | Release | CFB coverage reconciliation: main FBS roll-up plus separately refreshed Top-25 and conference feeds, nonblocking FBS–FCS discovery, resilient partial-date results and backup-live count behavior; concrete Ole Miss–Texas missing-game regression. |
| 0_33 | Release | Counter/live-only consistency in collapsed leagues; independent per-league refreshes and queued manual rechecks; better live game cache handling across midnight; monotonic live/final deduplication; incomplete-feed feedback and desktop/mobile regression coverage. |
| 0_32 | Release | Clickable live/total counter (header and sticky nav) toggles live-only filtering; day-scoped pinned games in a mixed-league top section; persistent favorite teams accessible from cards and team pages, duplicated at the top with original league cards retained; deduplicated featured games, synchronized feed refresh, localStorage persistence and desktop/mobile tests. |
| 0_31 | Release | Team schedules highlight in-progress games and today’s future games; team-colored season summaries with opponent crests and richer game/week tooltips; compact live/total counter centered in the sticky scoreboard bar when scrolled; two bottom-centered game controls (Expanded card and Full screen), with direct full-screen access from collapsed cards; improved live schedule refresh without interrupting season-stat views. |
| 0_30 | Release | ATP and WTA as separate tour leagues (all singles tournaments supplied by ESPN, not majors-only), WNBA-first default and one-time browser layout migration, symmetrical gear icon, Group by league wording, verified time-based player overlays for football, hockey, soccer and baseball hits where play feeds support attribution; no inferred events. |
| 0_29 | Release | Cross-league tightening: week/game/opponent-aware season chart hover/tap/focus, chart-to-scoreboard navigation, linked team-stat/game-stat figures, chart views for points scored/allowed/margin, season-year football rollover correction, full Box Score deep links and tennis set-stat links. |
| 0_28 | Release | Team season statistics; per-game scoring chart; complete reported Core team categories where available. |
| 0_27 | Release | Clickable teams; season-specific schedules, results and game-date navigation, without changing game cards. |
| 0_26 | Release | Stable expanded/fullscreen game view with linked player selection and comparable team statistics. *Useful rollback reference.* |
| 0_25 | Release | Restored graph proportions; expanded player lists and images; overlay off by default. |
| 0_24 | Release | Hover/tap game chart inspection and richer box scores. |
| 0_23 | Release | Player-attributed scoring event overlay where reliable. |
| 0_22 | Release | Fullscreen overview and complete player box-score tab. |
| 0_21 | Release | Fullscreen game monitor. |
| 0_20 | Release | Stable single sticky sports navigation, settings for league visibility/order, collapsed sections. *Useful rollback reference.* |
| 0_19 | Release | Initial persistent league ordering and collapsing. |
| 0_18 | Release | Robust scoreboard baseline, scoring history safety, feed deduplication and graph fixes. *Useful rollback reference.* |

## Data and compatibility guarantees

- Versions 0_27 and 0_28 use the same normalized game/event IDs, ESPN feeds, game-card detail cache, and graph/render logic as 0_26. A separate team-season cache stores schedule and published statistics; it does not replace live game state.
- The browser's existing league visibility/order and sort preferences are unchanged. No account or backend is required.
- Soccer and hockey display goals, MLB runs, and football/basketball points in schedule-derived season figures. Values from the schedule are labeled as calculated, distinct from ESPN official regular-season statistics.
- Tennis is still a match/player sport, not a team league. Tennis player profiles are deferred.
- ESPN's undocumented team season feeds may be unavailable or incomplete; failure is shown explicitly. Offline test fixtures verify app behavior, not live ESPN coverage for each sport.

## 0_30 — Tour coverage and cross-sport event linking

- **Tennis:** Removed the four-Grand-Slam-only filter. ATP and WTA are separate league choices and sections within one Tennis sport navigation family; each match card identifies the specific tournament and draw/round. Main singles draws are shown when the ESPN feed provides them; unsupported events are not invented. Existing `tennis` layout preferences migrate to the two tour IDs.
- **Ordering and controls:** WNBA precedes NBA by default, including a one-time correction to the older saved league layout. Subsequent user reordering persists. The toggle now reads **Group by league**. Replaced the uneven settings glyph with a symmetric gear.
- **Player-to-graph linking:** Retained opt-in selection and box-score-card synchronization for basketball. Extended matching to named football scoring contributors, hockey goal scorers and shots, soccer goal scorers and shots, and baseball hitters on the hits/home-runs timeline, but **only** when the event and an appropriate plotted increase are available. A missing or ambiguous name produces no player overlay. Baseball attribution follows the batting half-inning rather than the fielding team pointer, and its x-axis remains ordinal rather than wall-clock time.
- **Testing:** Added simulated non-major ATP/WTA singles, multi-sport event attribution, and mobile/desktop linked-player interaction tests. These are offline fixtures, not a live-feed compatibility certification; some ESPN events, competitions, rosters, player links and play histories may still be absent.

## 0_32 — Live-only filter, daily pinned games, favorite teams

- The live/total event counter is a button in both its original location and the sticky navigation; either toggles a single live-only state. The count continues to describe all unique represented games (including games promoted from another sport), rather than being reduced to the number of cards after filtering. The filter is stored with existing view preferences.
- Every matchup now has a small **Pin** control. Pins are stored under the selected local scoreboard date and remain available when revisiting that date. A new **Pinned games** section mixes sports/leagues at the top, followed by their unchanged original league cards.
- Team names continue opening team pages; a separate star alongside each team and on its dedicated page toggles a persistent favorite keyed by league and team ID. Games featuring favorites are highlighted in their regular league and duplicated in the **Favorite teams** section.
- A pinned favorite appears only once across the featured sections (pins take precedence), but the original remains. Featured cards use the same normalized game, statistics cache, monitor and buttons; each duplicate has its own expanded-panel ID. Hidden leagues remain hidden, and the selected sport/league filter does not hide cross-sport pinned/favorite rows.
- Local storage: `scoreboard-favorites-v1` for day pins and team identities; `scoreboard-sort-v1` adds `liveOnly`, preserving older settings and requiring no login. Tennis match pinning is supported; tennis athlete favorites are deferred pending player profile work.
- All 18 browser test files passed, including 0_32 desktop/mobile tests for pins, favorites, live filtering, same-date retention, cross-league display, and linked team-page controls. Tests use mocked league feeds and do not certify ESPN's live network reliability.

## 0_33 — Live refresh and count consistency

- A live game in a user-collapsed league is visible while the live-only filter is enabled, without modifying the saved collapse preferences. Zero-live sections are suppressed in live mode; partial/unavailable feeds are explicitly differentiated from no live games.
- Refresh requests are isolated per league, so a hanging or erroring sport never blocks a different league from updating. A manual Refresh is available during an active update and schedules at most one additional request for that league. Selecting/favoriting another league during an update can start its feed immediately.
- Explicit refresh bypasses the short scoreboard cache; adjacent-date feeds containing live games use the live-data TTL. Game status deduplication prevents cached scheduled or in-progress copies from reversing live/final states.
- The pinned/favorite duplicates retain unique-game counts and filter behavior; the two live counter buttons still share state. No changes to game cards, player/season pages, settings, or stored preferences.
- Regression: all 19 test files passed (18 in the primary parallel run, the remaining season-tooltip test independently), with new concurrent-refresh/collapse/transition tests at desktop and mobile widths. Actual ESPN availability is external.

## 0_34 — College football completeness and failure isolation

- **Missing-game diagnosis:** A single FBS `groups=80` listing cannot guarantee that every announced FBS matchup appears. Reconcile ESPN event IDs with the ranked-game schedule and the independent SEC (group 8) schedule, then rotate through other FBS conference schedules in a rate-limited background audit. This covers cases such as No. 7 Ole Miss at No. 19 Texas on October 24, 2026, without hardcoding the game or changing the CFB FBS restriction.
- **Freshness:** Ranked/SEC supplements update at the live polling cadence. A conference whose independent feed reveals a live game absent from the FBS roll-up is automatically promoted to live-rate polling. All sources deduplicate by ESPN competition ID, giving live/final status priority over old scheduled snapshots.
- **Nonblocking supplements:** Main FBS games publish before standings/FCS discovery completes, so a slow or failing standings feed cannot prevent the CFB league from being populated. FBS-vs-FCS games continue to require independently confirmed FBS team IDs.
- **Partial failure:** Rejected adjacent-day requests no longer discard successful date responses. Even if the main FBS feed is unavailable, a verified ranked/conference result still appears as a current game, including in the live counter/filter, with a visible coverage warning.
- **Regression:** 20 browser test files passed, including a new simulation where Ole Miss–Texas is omitted by `groups=80`, recovered from SEC or ranked data, appears once, updates from scheduled to live, and survives complete primary-feed failure. Tests use offline ESPN response fixtures; live network responses cannot be guaranteed.

## 0_35 — League coverage and navigation consistency

- **Coverage audit:** Every non-CFB league gets a limited, independent monthly-schedule cross-check against its daily feeds. Discovered matchups are merged by stable game ID and date. More advanced game statuses can supersede older ones; otherwise the daily score remains authoritative. The secondary source cannot delete a primary game.
- **Resilience:** Partial daily schedules can be augmented without waiting for all other leagues. If the daily source is temporarily unavailable, verified broader-schedule games can remain visible with an explanatory warning. Unsupported or unavailable monthly endpoints do not interrupt working primary feeds. At most two audit reads run simultaneously, with a four-minute per-league throttle. CFB retains its separate ranked/conference reconciliation.
- **Navigation:** The selected sport family keeps its emoji icon. Its **ALL** league selector appears before the icon. On mobile, the sports navigation occupies a complete row; the sticky live/total counter moves beside the date/settings controls on the next row (or below on extremely narrow screens). Desktop navigation remains unchanged.
- **Verification:** New browser fixtures cover missing games and duplicate/date suppression for WNBA, NBA, MLB, NHL, NFL, NWSL, MLS, ATP and WTA; a complete daily-feed failure; and sticky navigation at 320, 390 and 1280 pixels. Prior browser regression checks remain part of the source archive. Availability of ESPN's undocumented endpoints is not guaranteed by offline tests.

## 0_36 — Chart selection and live situation

- Fixed full-screen chart selection: touching or clicking the same point again clears it; selecting another point moves the inspection. A visible × control and Escape also dismiss a locked selection; clicking outside the chart clears it. Hover alone remains transient.
- On narrow/mobile screens, chart inspection details render in a compact section underneath the SVG rather than obscuring the figure; selected points survive normal live-data re-rendering until dismissed.
- Added a data-backed live situation strip to the full-screen Overview. Football exposes possession and down/distance/field position as actually supplied, plus timeouts when available; baseball displays outs, pitch count and occupied bases; basketball, hockey and soccer use clock/status and available key live team totals; tennis shows server and current points when present. Missing fields remain omitted.
- Reuses ESPN scoreboard situations before detailed summaries finish and upgrades when an available summary supplies more context. No changes to the card, league schedule discovery, team pages, or saved favorites.

## 0_37 — League views, game filters, and settings

- **Filters instead of duplicate cards:** Pin-board and three-star controls filter the games already in their leagues; they do not create a second set of cards. When both are active, include a game if it is pinned **or** involves a favorite team, once only. Live-only combines with these filters. Games stay highlighted and their stored pin/favorite identities remain unchanged.
- **Three display states:** Every league in Settings has Expanded / Collapsed / Hidden. Existing stored collapsed and hidden league preferences migrate without changes; the choice persists through `scoreboard-layout-v1`. Reset returns all leagues to expanded and visible.
- **All-sports limit:** With leagues grouped in the All sports view, show at most 12 cards per league, with View all for longer sections. Clicking a league heading or View all enters its uncapped league view and clears game filters; a separate chevron toggles expansion without navigating. In mixed/ungrouped mode, the previous unrestricted cross-league list remains available.
- **Placement:** A small `0_37` label is at the bottom-right footer rather than the navigation.
- **Validation:** New headless browser tests at desktop, 390px, and 320px check filter combinations without duplication, league cap/uncapping, three-state settings, controls, and overflow. Existing live-refresh and chart-interaction suites passed; a slow legacy team test did not complete and is not counted as passed.
