# Scoreboard — scoreboard0_15

A portable sports scoreboard for WNBA, NBA, MLB, NWSL, MLS, NHL, NFL, college football (FBS), and men's and women's singles at the Australian Open, Roland-Garros, Wimbledon, and US Open.

The complete application is in **index.html**. Its HTML, CSS, JavaScript, header logo, and explicit browser icons are embedded in that one file. There are no package installations, build steps, API keys, accounts, or server dependencies.

## Scoreboard 0.15 — metric integrity and reliability pass

No new interface panels or default-card changes. The single, two-team chart remains unchanged in presentation. This release focuses on recovering missing histories and suppressing misleading ones:

- **NHL shots on goal:** Lazy-fetches ESPN's separate core game play-by-play collection, when readable from the browser. Classifies goal/shot-on-goal events while excluding missed, blocked, disallowed, and shootout events; counts a goal only once as a shot. Also supports team references supplied as URLs rather than embedded team IDs.
- **MLB / MLS / NWSL:** Attempts the same full-play collection when an expanded game is opened. Improved treatment of recorded baseball hit text and soccer on-target vs off-target events. Does not infer events from final totals.
- **Other sports:** NBA/WNBA, NFL/CFB and tennis metrics remain; for finished NBA and football games, event-reconstructed totals now require exact two-team reconciliation with ESPN's box scores, just as the other completed-game metrics do. Both teams' currently reported totals are also used to flag incomplete live histories when available.
- **Data loading:** Added capped/paginated optional play-fetching, de-duplication, lazy loading (only for expanded games), 60-second retry for failed optional feeds on an expanded game, and invalidation of cached histories when a fuller feed arrives. Malformed or reference-only play collections are rejected.
- **Transparency:** The expanded chart quietly explains when additional stat histories could not be verified. The original Score and period-scoring fallbacks remain usable even if the optional play feed fails or is blocked by the browser.

**Validation:** Tested in headless Chromium against fixture-shaped NBA, WNBA, NFL, CFB, MLB, NHL, MLS, NWSL, and tennis examples. Checks include core pagination, NHL goal/shot classification, team reference matching, official-stat reconciliation, selector visibility, signed-area display, and phone-width overflow. No JavaScript runtime errors were observed in these tests.

**Important limitation:** Live requests to ESPN and cross-origin browser access to the core play endpoint could not be verified from the test environment. Consequently some verified-only metrics may remain unavailable on particular real games. Re-test on the deployed GitHub Pages origin to confirm actual ESPN coverage and browser permissions. The published website is unchanged until deployment.

## Scoreboard 0.14 — cross-sport graph metrics and data integrity

The expanded card still contains ONE progression chart and its sport-specific metric dropdown. Score remains the default, except tennis where "Games won" describes the set-based default accurately. New selectable metrics when ESPN's data supports a full timeline:

- **NBA / WNBA:** 3PT made/attempted, FG made/attempted, free throws made/attempted, rebounds, assists, turnovers (existing features retained).
- **NFL / CFB:** rushing yards, passing yards, total yards, rushing attempts, first downs (existing features retained).
- **MLB:** hits, walks, batter strikeouts, home runs, positioned by INNING and batting half. Within each batting half, non-clocked plays use their event order, not pretend elapsed minutes.
- **NHL:** shots on goal, hits, faceoffs won using period and game clock.
- **MLS / NWSL:** shots, shots on target, corners, yellow cards using recorded match minutes, including stoppage time where present.
- **Tennis:** games won and sets won accumulated from scoreboard set scores (no invented rally or point-by-point detail); no integral in set-based charts.

Backend changes include a shared normalization/classification-to-timeline pipeline, ESPN team ID matching with fallback logic, memoized metric calculations for expanded cards, sport-specific time bases, and an explicit reconciliation check. **Finished-game** non-tennis metric histories require both teams' reconstructed counts to match the available ESPN team box-score totals; otherwise the option is hidden. Live events may still be incomplete and are labeled accordingly. The chart always shows both teams, only puts dots on the team whose cumulative value changes, and colors the fill by whichever team leads in the selected statistic.

The signed-area readout is only calculated for clocked events or real elapsed match minutes, never for innings or sets. Completed soccer matches carry the last advantage to at least the end of regulation (and to 120 minutes only when events establish extra time). Tennis sets won are inferred from completed set scores when winner flags are absent.

**QA:** Chromium desktop (1280px) and mobile (390px) browser simulations covered NBA, WNBA, NFL, CFB, MLB, NHL, MLS, NWSL, and tennis. Tests verified metric switching, empty/partial responses, final-total mismatch rejection for MLB/NHL/soccer, inferred tennis set winners, responsive width, and syntax (no runtime JS errors in the fixtures). ESPN live responses could not be fetched from the test environment, so per-game metric availability is conservative and some providers' event formats may require follow-up adaptation. The published GitHub Pages site is unchanged until you deploy the ZIP.

## Scoreboard 0.12 — statistics on the progression graph

Game flow now has **one chart** with an optional, sport-specific metric selector. It defaults to Score for every game. When game event history provides usable clocks, team IDs, and classified plays, NBA/WNBA add cumulative **three-pointers made** and **three-point attempts**; NFL/CFB add cumulative **rushing yards** and **passing yards**. Scoring and statistical lines both use game time on the x-axis, and colored fill remains restricted to the area between the two lines, changing color when the leader in the selected measure changes. Football yardage can decrease following a negative play. A dot marks only the team whose running total changes, retaining smaller basketball dots.

Metrics only appear when usable event history is present. For finished games, reconstructed totals are checked against ESPN box-score totals where those are available; mismatches suppress the metric. Partial or unsupported play feeds do **not** become fabricated timelines. This release was exercised in Chromium with simulated NBA/NFL play-by-play, missing-data fallbacks, and narrow screens; actual ESPN live game responses were not accessible for exhaustive testing.

## Scoreboard 0.10 — true timeline spacing

The expanded two-team scoring chart places clocked scoring plays according to **elapsed game minutes**, including regulation period boundaries. The score line remains flat between scoring events and steps when a team scores. Soccer uses elapsed match minute (including stoppage time); baseball uses inning and half-inning position, and tennis uses set number. With incomplete play clocks, the graph falls back to available **period totals** rather than placing scoring events at falsely equal intervals. Chart labels distinguish actual timing from aggregated totals. Scoring dots appear only on teams whose scores increase at an event, and NBA/WNBA dots are smaller than the other sports. There are no new user controls.

The ESPN summary service is undocumented, and available play-level timing varies by game. Graphical browser checks used simulated response data; live cross-league requests are not exhaustively verified.

## Competition context in scoreboard0_6

Game cards now display a small, muted context label beside the league: **Preseason**, **Spring Training**, NFL/CFB **Week N**, **Postseason**, and named playoff rounds such as **ALCS**, **Wild Card**, **Conference Finals**, and **Stanley Cup Final** when ESPN supplies that information. Series game numbers and standings are shown only when provided in game data. Regular-season games outside football have no additional label. The existing tennis round details are unchanged.

This change does not modify game sorting, live highlighting, score calculations, date selection, the refresh schedule, or the supported leagues. Labels depend on the ESPN scoreboard feed and are omitted when ambiguous.

## Schedule progression in scoreboard0_5

The previous “Live first” default is now **Schedule order (default)**. Games remain in scheduled start-time order through upcoming, live, and completed states. Live highlighting therefore moves through the day's schedule without moving cards to the top. Other sorting options retain their previous behavior.

Completed games fade to 55% opacity; hovering or focusing a link inside a completed card restores full opacity for reading. Live, upcoming, postponed, cancelled, delayed, and suspended games do not receive this completed-game fade. Existing saved preferences continue to work.

## New leagues in scoreboard0_4

Added NWSL, MLS, and NHL immediately after MLB, in that order, in both the tabs and grouped scoreboard. They share automatic refreshing, date navigation, live highlighting, score sorting, and feed-failure handling. Soccer and hockey margins are labeled in goals.

NHL time sorting combines the current clock with the remaining regulation periods, or uses only the current overtime clock. Shootouts have no countdown. Soccer displays the provider's match status/clock but is excluded from countdown-based sorting because the total added time is unknown.

## Live emphasis in scoreboard0_3

Live games have an amber frame, a warm tinted background, an explicit LIVE badge, and brighter team names and scores. Delayed, suspended, cancelled, and stale results do not receive live emphasis. The visual treatment is static, with no pulsing or flashing.

## Visual update in scoreboard0_2

The header and browser icons use the amber-and-ivory SB stadium-lights monogram, without superimposed numbers. Warm charcoal surfaces, ivory text, and amber interface accents complement the logo. League markers retain distinct colors. Scores, refresh behavior, and sorting are unchanged.

## Open it on your computer

Extract the ZIP, then open `index.html` in a modern browser. Internet access is required to retrieve scores and team logos. The interface itself has no external dependencies; failed logos fall back to text badges.

The browser requests ESPN directly. If a browser or extension blocks requests from a local file, use the GitHub Pages version or serve the folder locally. If Python is already installed, run `python -m http.server 8000` from this folder and open `http://localhost:8000/`.

## Put it on GitHub Pages

1. Create a repository, or choose an existing one.
2. Upload **index.html** and this README to the repository root. Also upload `favicon.ico` for browsers that request it automatically, and `.nojekyll` when possible. The `assets` folder contains optional reusable image exports; the app embeds its required icons. Upload the extracted files, not the ZIP or its enclosing folder.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your branch (usually `main`) and **/(root)**, then **Save**.
6. Open the published address shown by GitHub when deployment finishes.

For an existing Pages site, put `index.html` in a subfolder such as `scoreboard/` on its publishing branch instead. The app uses no absolute local paths and can run under that subfolder's address.

GitHub's instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Use

- Choose **All sports** or a league tab. **CFB** includes FBS games at all rankings, including unranked teams; it is not an all-division college-football feed.
- Change the date, use the previous/next buttons, or select **Today**.
- Scores refresh every 30 seconds while the page is visible. Refresh manually with the circular button.
- Start times and date boundaries use your browser's time zone, displayed at the bottom.
- Today's view follows the calendar at midnight. Browsing another day stays on that day.
- Use **Sort** to choose a ranking. **Group by sport** preserves league sections; turn it off to rank all displayed sports together. These two preferences are saved in this browser when storage is available.
- Tennis includes singles only. Other tennis tournaments are filtered out.
- **Details** opens the corresponding ESPN event page.

## Sorting

The default is **Group by sport** enabled and **Schedule order (default)** selected. In this mode, scores and status changes do not affect placement: games remain ordered by the provider’s listed start time, with event ID breaking ties. Schedule corrections or newly listed games can still change positions. Other ranking modes are reapplied after refreshes, so their games can move as scores and clocks change.

| Option | Order |
| --- | --- |
| Schedule order (default) | Scheduled start time, earliest first, regardless of game status; event ID breaks ties. Live highlighting and completed-game fading change in place. |
| Start time | ESPN's listed start time, earliest first, regardless of game status. |
| Closest score | Live games by smallest absolute margin. Points, runs, and goals are raw units, not normalized across sports. Tennis compares completed-set margin, then the latest-set game margin. |
| More time left | Live timed games by most game-clock time left. |
| Less time left | Live timed games by least game-clock time left. |
| Close + late | Highest `1 / ((margin + 1) × minutes remaining)` first. Both smaller margins and less time raise priority. |
| Score margin ÷ time left | Lowest `margin / minutes remaining` first. This literal ratio can favor an early close game over a late close game. |

For **All sports**, disable **Group by sport** to apply the selected comparison across sports. With grouping enabled, the same comparison applies within each sport. League tabs limit the games being compared. Start-time order uses the provider's listed time, not a separate record of actual kickoff or tipoff.

### Time handling

NBA regulation uses four 12-minute quarters, WNBA four 10-minute quarters, and NFL/CFB four 15-minute quarters. The app combines the current clock with all remaining regulation quarters. In NBA, WNBA, or NFL overtime, it uses only the current overtime clock: possible future overtime is unknown. College-football overtime is untimed.

NHL regulation uses three 20-minute periods; overtime uses the reported clock for the current period. Shootouts have no countdown. Soccer’s match clock counts upward and added time is not known in advance, so NWSL and MLS do not receive an invented time-remaining value.

MLB and tennis have no fixed game countdown. They remain on the scoreboard and participate in schedule, start-time, and score-margin sorting. In time-based sorts they follow live games with usable clocks, along with soccer, hockey shootouts, untimed CFB overtime, and missing-clock games. Upcoming and completed games follow those live games. Stale or delayed/suspended/cancelled games follow the other groups for metric sorts. The original and start-time sorts preserve their stated order instead.

Time left means **game-clock time**, not real-world time until a game ends. Scores and clocks update from the feed; the app does not run a synthetic countdown between responses. Ratios clamp remaining time to at least one second to avoid division by zero. The `+1` in Close + late handles tied games without infinity. The combined score is a viewing-priority heuristic, not a win probability or a sport-normalized measure of competitiveness.

Timing references:
- https://www.nhl.com/kraken/news/nhl-overtime-shootouts-row-310366008
- https://official.nba.com/rule-no-5-scoring-and-timing/
- https://www.wnba.com/faq
- https://operations.nfl.com/rules-officiating/2026-nfl-rulebook
- https://www.ncaa.com/news/football/2025-01-01/how-college-football-overtime-works

## Where the scores come from

The app calls ESPN's publicly reachable, undocumented JSON scoreboard endpoints:

| Feed | Endpoint path |
| --- | --- |
| WNBA | `basketball/wnba/scoreboard` |
| NBA | `basketball/nba/scoreboard` |
| MLB | `baseball/mlb/scoreboard` |
| NWSL | `soccer/usa.nwsl/scoreboard` |
| MLS | `soccer/usa.1/scoreboard` |
| NHL | `hockey/nhl/scoreboard` |
| NFL | `football/nfl/scoreboard` |
| CFB (FBS) | `football/college-football/scoreboard?groups=80` |
| Men's tennis | `tennis/atp/scoreboard` |
| Women's tennis | `tennis/wta/scoreboard` |

The base URL is `https://site.api.espn.com/apis/site/v2/sports/`.

These are real API requests, but this is not an officially supported public developer service or a guarantee of continuing access. ESPN can change its format, browser-access policy, or availability. No paid data subscription is used. The app is not affiliated with ESPN or the leagues.

**Thirty seconds is the app's check interval, not a guaranteed delay from the action on court or field.** ESPN's own reporting and caching add delay. The app displays returned scores and clocks; it does not invent a running game clock between responses.

## Failure handling and portability

- Requests go directly from your browser to ESPN. The app does not depend on the previously hosted ChatGPT Site or any proxy service.
- No credentials are sent with score requests. There are no secrets to configure or publish.
- Requests are limited to six simultaneous connections, with a 15-second timeout each.
- Adjacent calendar days are also retrieved so games near midnight are included correctly; duplicates are removed.
- Only feeds relevant to the selected tab are refreshed. A switch during an existing refresh may finish that refresh before fetching additional feeds.
- Failed feeds retain their last received results during the current session and are visibly marked. Results more than 90 seconds old are also marked as last known.
- Repeated failures back off from 30 seconds to at most five minutes. Manual Refresh retries immediately.
- Hidden tabs pause score requests and check again when visible. Closing the app stops all updating.
- Scores are held in memory, not saved across browser reloads. The file is portable; new scores still require internet access.

On October 9, 2026, the six original endpoints accepted requests carrying both a local-file Origin (`null`) and a sample GitHub Pages Origin, returning `Access-Control-Allow-Origin: *`. The college-football endpoint also returned a successful response and the same access header with a local-file Origin. That supports direct browser use, but is not a promise that ESPN will retain that policy.

## Files

- `index.html` — the entire editable app. This is the only required application file.
- `README.md` — setup, usage, data source, and limitations.
- `favicon.ico` — optional browser fallback with 16, 32, and 48 pixel sizes.
- `assets/` — reusable PNG exports of the logo, favicons, and touch icon; not required alongside the standalone HTML file.
- `.nojekyll` — tells GitHub Pages to serve the files without Jekyll processing.

No website has been published to your GitHub account as part of this export.

## Validation of this export

The inline JavaScript passed syntax checks. Live HTTP checks passed for all six ESPN feeds with local-file and sample GitHub Pages Origin headers. Integration checks using real response fixtures covered sport tabs, score changes, failed refreshes, recovery, hidden-tab pausing, date-change cancellation, and offline messages. Tennis results and tiebreaks were checked against both singles finals of the 2025 US Open.

A full graphical-browser test of a locally opened file or a deployed GitHub Pages copy was not available in the creation environment. The HTTP and simulated-DOM checks do not replace that browser test. The CFB update additionally verified real FBS schedule parsing, sort controls and grouping, all seven comparison rules, regulation/halftime/overtime clocks, missing clocks, zero seconds, and stale/upcoming/completed-game handling.

For scoreboard0_2, embedded icon bytes and export sizes were checked, text contrast was checked against the new surfaces, and the unchanged score logic was verified by comparison with scoreboard0_1. Browser appearance and home-screen icon behavior have not been verified in a graphical browser.

For scoreboard0_4, all three added endpoints returned HTTP 200 and `Access-Control-Allow-Origin: *` with both local-file and sample GitHub Pages Origin headers. The JavaScript syntax, rendered tab/section order, soccer/hockey goal margins, and NHL regulation, overtime, and shootout handling were checked. Real NWSL, MLS, and NHL response fixtures parsed successfully. Soccer empty-date responses were also verified. A graphical-browser check was unavailable in this environment.

For scoreboard0_5, JavaScript syntax and application initialization passed. Checks covered persistent schedule ordering across game-status changes, retained live priority in score-based sorting, completed/live/cancelled card classes, and existing saved preferences. Graphical browser appearance was not checked.


## Expanded game details in scoreboard0_7

In the initial 0.7 release, select **Game flow + stats** on any game card to expand it in the same dashboard. Game flow charts use play-by-play scoring updates when available, and otherwise use period or set scores. Clock-based updates are plotted against playing time; when times are missing the x-axis explicitly states that events are spaced in sequence. Switch between score difference and both teams’ scores. Hover, focus, or tap scoring points for values. Compare a selected team statistic, or select a player and an individual box-score statistic from available ESPN data. Player statistic totals are **not** reconstructed as historical time series. The details load only after expansion, one card at a time, and refresh alongside live game scores. Missing detailed data does not prevent available period scoring from appearing.

## Validation for scoreboard0_7

JavaScript syntax and mocked-browser interaction tests passed for desktop and mobile widths, including expanded panels, chart view switching, player selection, statistic selection, and no horizontal overflow. Real ESPN summary requests could not be exercised in this runtime; data availability and browser permissions may vary by league and game.

## Scoreboard 0.8: simplified expanded cards

Expanded games show a two-team scoring-progression chart by default, with color-matched markers for *both* teams, plus a short sport-sensitive comparison of team totals and notable in-game player totals when ESPN provides them. There is no difference chart, graph mode selector, player picker, or single-stat selector. ESPN primary team colors are used when present and brightened for readability; a contrasting fallback is used if missing or indistinguishable. Period scoring remains available. When detailed ESPN data is missing, the graph can use period-end scores and unavailable panels clearly indicate their limits.


### Scoreboard 0.9 — scoring markers and expanded-card control

The two-team scoring chart places a colored dot only on a team whose score has increased at that event. When a period-only fallback shows increases for both teams at period end, both lines legitimately receive markers. Score corrections and unchanged scores are not marked. The hit area is aligned to the scoring team(s), rather than spanning to the non-scoring line. The compact-card control keeps a consistent **Game flow + stats** label, indicates the open state with a filled/outlined selected style and upward chevron, and uses `aria-expanded` and contextual accessible labels. The existing one-game-at-a-time expansion behavior and card sorting are unchanged.
