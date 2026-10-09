# Scoreboard

A portable sports scoreboard for WNBA, NBA, MLB, NFL, college football (FBS), and men's and women's singles at the Australian Open, Roland-Garros, Wimbledon, and US Open.

The complete application is in **index.html**. Its HTML, CSS, and JavaScript are embedded in that one file. There are no package installations, build steps, API keys, accounts, or server dependencies.

## Open it on your computer

Extract the ZIP, then open `index.html` in a modern browser. Internet access is required to retrieve scores and team logos. The interface itself has no external dependencies; failed logos fall back to text badges.

The browser requests ESPN directly. If a browser or extension blocks requests from a local file, use the GitHub Pages version or serve the folder locally. If Python is already installed, run `python -m http.server 8000` from this folder and open `http://localhost:8000/`.

## Put it on GitHub Pages

1. Create a repository, or choose an existing one.
2. Upload **index.html** and this README to the repository root. Include `.nojekyll` if uploading through Git. Upload the extracted files, not the ZIP or its enclosing folder.
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

The default preserves the original layout: **Group by sport** enabled and **Live first (original)** selected. Sorting is reapplied after score refreshes, so games can move as scores and clocks change.

| Option | Order |
| --- | --- |
| Live first (original) | Live, upcoming, then finished; start time breaks ties. |
| Start time | ESPN's listed start time, earliest first, regardless of game status. |
| Closest score | Live games by smallest absolute margin. Points and runs are raw units, not normalized across sports. Tennis compares completed-set margin, then the latest-set game margin. |
| More time left | Live timed games by most game-clock time left. |
| Less time left | Live timed games by least game-clock time left. |
| Close + late | Highest `1 / ((margin + 1) × minutes remaining)` first. Both smaller margins and less time raise priority. |
| Score margin ÷ time left | Lowest `margin / minutes remaining` first. This literal ratio can favor an early close game over a late close game. |

For **All sports**, disable **Group by sport** to apply the selected comparison across sports. With grouping enabled, the same comparison applies within each sport. League tabs limit the games being compared. Start-time order uses the provider's listed time, not a separate record of actual kickoff or tipoff.

### Time handling

NBA regulation uses four 12-minute quarters, WNBA four 10-minute quarters, and NFL/CFB four 15-minute quarters. The app combines the current clock with all remaining regulation quarters. In NBA, WNBA, or NFL overtime, it uses only the current overtime clock: possible future overtime is unknown. College-football overtime is untimed.

MLB and tennis have no fixed game countdown. They remain on the scoreboard and participate in start-time, live-first, and score-margin sorting. In time-based sorts they follow live games with usable clocks, along with untimed CFB overtime and missing-clock games. Upcoming and completed games follow those live games. Stale or delayed/suspended/cancelled games follow the other groups for metric sorts. The original and start-time sorts preserve their stated order instead.

Time left means **game-clock time**, not real-world time until a game ends. Scores and clocks update from the feed; the app does not run a synthetic countdown between responses. Ratios clamp remaining time to at least one second to avoid division by zero. The `+1` in Close + late handles tied games without infinity. The combined score is a viewing-priority heuristic, not a win probability or a sport-normalized measure of competitiveness.

Timing references:
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
- `.nojekyll` — tells GitHub Pages to serve the files without Jekyll processing.

No website has been published to your GitHub account as part of this export.

## Validation of this export

The inline JavaScript passed syntax checks. Live HTTP checks passed for all six ESPN feeds with local-file and sample GitHub Pages Origin headers. Integration checks using real response fixtures covered sport tabs, score changes, failed refreshes, recovery, hidden-tab pausing, date-change cancellation, and offline messages. Tennis results and tiebreaks were checked against both singles finals of the 2025 US Open.

A full graphical-browser test of a locally opened file or a deployed GitHub Pages copy was not available in the creation environment. The HTTP and simulated-DOM checks do not replace that browser test. The CFB update additionally verified real FBS schedule parsing, sort controls and grouping, all seven comparison rules, regulation/halftime/overtime clocks, missing clocks, zero seconds, and stale/upcoming/completed-game handling.
