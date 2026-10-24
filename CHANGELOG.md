# Scoreboard changelog

Important rollback checkpoints are bold and explicitly marked. Preserve these releases rather than overwriting them.

| Version | Status | Summary |
| --- | --- | --- |
| 0_32 | Current | Clickable live/total counter (header and sticky nav) toggles live-only filtering; day-scoped pinned games in a mixed-league top section; persistent favorite teams accessible from cards and team pages, duplicated at the top with original league cards retained; deduplicated featured games, synchronized feed refresh, localStorage persistence and desktop/mobile tests. |
| 0_31 | Release | Team schedules highlight in-progress games and today’s future games; team-colored season summaries with opponent crests and richer game/week tooltips; compact live/total counter centered in the sticky scoreboard bar when scrolled; two bottom-centered game controls (Expanded card and Full screen), with direct full-screen access from collapsed cards; improved live schedule refresh without interrupting season-stat views. |
| 0_30 | Release | ATP and WTA as separate tour leagues (all singles tournaments supplied by ESPN, not majors-only), WNBA-first default and one-time browser layout migration, symmetrical gear icon, Group by league wording, verified time-based player overlays for football, hockey, soccer and baseball hits where play feeds support attribution; no inferred events. |
| 0_29 | Release | Cross-league tightening: week/game/opponent-aware season chart hover/tap/focus, chart-to-scoreboard navigation, linked team-stat/game-stat figures, chart views for points scored/allowed/margin, season-year football rollover correction, full Box Score deep links and tennis set-stat links. |
| 0_28 | Release | Team season statistics; per-game scoring chart; complete reported Core team categories where available. |
| 0_27 | Release | Clickable teams; season-specific schedules, results and game-date navigation, without changing game cards. |
| **0_26** | **IMPORTANT CHECKPOINT** | Stable expanded/fullscreen game view with linked player selection and comparable team statistics. Recommended rollback point before team pages. |
| 0_25 | Release | Restored graph proportions; expanded player lists and images; overlay off by default. |
| 0_24 | Release | Hover/tap game chart inspection and richer box scores. |
| 0_23 | Release | Player-attributed scoring event overlay where reliable. |
| 0_22 | Release | Fullscreen overview and complete player box-score tab. |
| 0_21 | Release | Fullscreen game monitor. |
| **0_20** | **IMPORTANT CHECKPOINT** | Stable single sticky sports navigation, settings for league visibility/order, collapsed sections. |
| 0_19 | Release | Initial persistent league ordering and collapsing. |
| **0_18** | **IMPORTANT CHECKPOINT** | Robust scoreboard baseline, scoring history safety, feed deduplication and graph fixes. |

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
- **Rollback:** Preserve **0_18**, **0_20**, and **0_26** as IMPORTANT CHECKPOINTs.

## 0_32 — Live-only filter, daily pinned games, favorite teams

- The live/total event counter is a button in both its original location and the sticky navigation; either toggles a single live-only state. The count continues to describe all unique represented games (including games promoted from another sport), rather than being reduced to the number of cards after filtering. The filter is stored with existing view preferences.
- Every matchup now has a small **Pin** control. Pins are stored under the selected local scoreboard date and remain available when revisiting that date. A new **Pinned games** section mixes sports/leagues at the top, followed by their unchanged original league cards.
- Team names continue opening team pages; a separate star alongside each team and on its dedicated page toggles a persistent favorite keyed by league and team ID. Games featuring favorites are highlighted in their regular league and duplicated in the **Favorite teams** section.
- A pinned favorite appears only once across the featured sections (pins take precedence), but the original remains. Featured cards use the same normalized game, statistics cache, monitor and buttons; each duplicate has its own expanded-panel ID. Hidden leagues remain hidden, and the selected sport/league filter does not hide cross-sport pinned/favorite rows.
- Local storage: `scoreboard-favorites-v1` for day pins and team identities; `scoreboard-sort-v1` adds `liveOnly`, preserving older settings and requiring no login. Tennis match pinning is supported; tennis athlete favorites are deferred pending player profile work.
- All 18 browser test files passed, including 0_32 desktop/mobile tests for pins, favorites, live filtering, same-date retention, cross-league display, and linked team-page controls. Tests use mocked league feeds and do not certify ESPN's live network reliability.
- Retain **0_18**, **0_20**, **0_26** as IMPORTANT CHECKPOINTS.
