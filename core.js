
'use strict';
const SPORTS = [
    { id: 'wnba', name: 'WNBA', path: 'basketball/wnba', color: '#ff8756' },
    { id: 'nba', name: 'NBA', path: 'basketball/nba', color: '#79a8ff' },
    { id: 'mlb', name: 'MLB', path: 'baseball/mlb', color: '#70d8c2' },
    { id: 'nwsl', name: 'NWSL', path: 'soccer/usa.nwsl', color: '#f29bb8' },
    { id: 'mls', name: 'MLS', path: 'soccer/usa.1', color: '#a4d786' },
    { id: 'nhl', name: 'NHL', path: 'hockey/nhl', color: '#8ed6e8' },
    { id: 'nfl', name: 'NFL', path: 'football/nfl', color: '#cf9cff' },
    { id: 'cfb', name: 'CFB', path: 'football/college-football', color: '#ffbf69' },
    { id: 'atp', name: 'ATP Tour', path: 'tennis/atp', color: '#c8cc8a' },
    { id: 'wta', name: 'WTA Tour', path: 'tennis/wta', color: '#e9aaa3' },
];
function dateInZone(date, zone) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(date)); return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)?.value).join('-'); }
function val(s) { return s == null ? '—' : typeof s === 'object' ? String(s.displayValue ?? s.value ?? '—') : String(s); }
function safeLink(url) { try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'www.espn.com' || u.hostname === 'espn.com') ? u.href : undefined;
}
catch {
    return undefined;
} }
// Extract compact, game-specific competition context from ESPN metadata.
// Unknown or ambiguous stages are left blank instead of inferred from dates.
function competitionStage(text, league) {
  const value=String(text??'').replace(/\s+/g,' ').trim();
  if(!value)return '';
  if(/\b(ALWC|NLWC)\b/i.test(value))return value.match(/\b(ALWC|NLWC)\b/i)[0].toUpperCase();
  if(/\b(ALDS|NLDS|ALCS|NLCS)\b/i.test(value))return value.match(/\b(ALDS|NLDS|ALCS|NLCS)\b/i)[0].toUpperCase();
  if(/world series/i.test(value))return 'World Series';
  if(/american league (?:division|championship) series/i.test(value))return /division/i.test(value)?'ALDS':'ALCS';
  if(/national league (?:division|championship) series/i.test(value))return /division/i.test(value)?'NLDS':'NLCS';
  if(/\b(?:AL|NL) wild card series/i.test(value))return value.match(/\b(AL|NL) wild card/i)[1].toUpperCase()+' Wild Card';
  if(/stanley cup final/i.test(value))return 'Stanley Cup Final';
  if(/\b(?:nba|wnba|mls|nwsl) (?:cup )?finals?\b/i.test(value))return /nba cup/i.test(value)?'NBA Cup Final':/wnba/i.test(value)?'WNBA Finals':/nba/i.test(value)?'NBA Finals':/mls/i.test(value)?'MLS Cup Final':'NWSL Final';
  if(/super bowl/i.test(value))return 'Super Bowl';
  if(/(?:afc|nfc) championship/i.test(value))return value.match(/\b(AFC|NFC) championship/i)[1].toUpperCase()+' Championship';
  if(/(?:college football playoff|\bCFP\b)/i.test(value)) {
    const stage=value.match(/(?:national championship|championship game|quarterfinals?|semifinals?|first round)/i);
    return stage?'CFP '+(stage[0].toLowerCase().startsWith('national')||stage[0].toLowerCase().startsWith('championship')?'Championship':stage[0].replace(/s$/i,'').replace(/\b\w/g,c=>c.toUpperCase())):'CFP';
  }
  if(/\b(?:nba cup|in.season tournament)\b/i.test(value))return /group (?:play|stage)/i.test(value)?'NBA Cup · Group Play':/knockout/i.test(value)?'NBA Cup · Knockout':'NBA Cup';
  if(/\bplay.in\b/i.test(value))return 'Play-In';
  if(/\b(?:wild card|wildcard)\b/i.test(value))return 'Wild Card';
  if(/\bdivisional (?:playoffs?|round)\b/i.test(value))return 'Divisional Round';
  if(/conference (?:championships?|finals?)\b/i.test(value))return 'Conference Finals';
  if(/conference semifinals?\b/i.test(value))return 'Conference Semifinals';
  if(/\b(?:league|conference) quarterfinals?\b/i.test(value))return 'Quarterfinal';
  if(/\b(?:division series|divisional series)\b/i.test(value))return 'Division Series';
  if(/\b(?:semifinals?|semi-finals?)\b/i.test(value))return 'Semifinal';
  if(/\bquarterfinals?\b/i.test(value))return 'Quarterfinal';
  if(/\bround of (?:16|32)\b/i.test(value))return value.match(/round of (16|32)/i)[0].replace(/^r/i,'R');
  if(/\bfirst round\b/i.test(value))return 'First Round';
  if(/\bsecond round\b/i.test(value))return 'Second Round';
  // "Final" alone can mean the score status rather than a championship round.
  if(/\bchampionship game\b/i.test(value))return 'Championship';
  if(/\bfinals?\b/i.test(value)&&/playoffs?|post.?season|tournament|cup/i.test(value))return 'Final';
  return '';
}
function competitionContext(league, event, competition, data) {
  if(league==='atp'||league==='wta'||league==='tennis')return {label:'',series:''}; // Tournament and round displayed on the match card.
  const season=event.season??{};
  const slug=String(season.slug??'').toLowerCase();
  const type=Number(season.type);
  const preseason=type===1||/^(?:pre-?season|spring-training)$/.test(slug);
  const postseason=type===3||/^(?:post-?season|playoffs?|play-?in|finals?|knockout)$/.test(slug);
  const headlines=Array.isArray(competition.notes)?competition.notes.map(n=>typeof n==='string'?n:n?.headline??'').filter(Boolean):[];
  const sources=[...headlines,competition.type?.text,competition.type?.name,event.week?.text,data.week?.text].filter(Boolean);
  // A round name is accepted only from competition/week metadata, never from game title.
  const stage=sources.map(t=>competitionStage(t,league)).find(Boolean)||'';
  const gameSource=sources.find(t=>/\bgame\s*\d{1,2}\b/i.test(String(t)));
  const numberFromText=gameSource?String(gameSource).match(/\bgame\s*(\d{1,2})\b/i):null;
  const number=Number(competition.series?.gameNumber??competition.series?.game??numberFromText?.[1]);
  const gameNo=postseason&&Number.isInteger(number)&&number>=1&&number<=7?`Game ${number}`:'';
  let label=stage;
  if(!label) {
    if(preseason)label=league==='mlb'?'Spring Training':'Preseason';
    else if(postseason)label=slug==='play-in'?'Play-In':'Postseason';
    else if((league==='nfl'||league==='cfb')&&(!Number.isFinite(type)||type===2)) {
      const week=Number(event.week?.number??data.week?.number);
      if(Number.isInteger(week)&&week>=1&&week<=20)label=`Week ${week}`;
    }
  }
  // A round note can occur without a season flag (common in some soccer feeds).
  if(gameNo&&label)label+=` · ${gameNo}`;
  const rawSeries=String(competition.series?.summary??event.series?.summary??'').replace(/\s+/g,' ').trim();
  const series=postseason&&/\b(?:lead(?:s|ing)?|tied)\b/i.test(rawSeries)&&rawSeries.length<=38?rawSeries:'';
  return {label,series};
}

function normalize(data, league, day, zone, tour) {
    if (!Array.isArray(data.events))
        throw new Error('Invalid scoreboard response');
    const games = [];
    for (const e of data.events) {
        const tennis = league === 'atp' || league === 'wta' || league === 'tennis';
        const groups = tennis ? (Array.isArray(e.groupings)&&e.groupings.length?e.groupings:[{grouping:{},competitions:(e.competitions??[]).filter(c=>(c.competitors??[]).every(p=>p.athlete&&!p.team))}]) : [{ grouping: {}, competitions: e.competitions ?? [] }];
        for (const g of groups) {
            if (tennis && g.grouping?.slug) {
                const slug=String(g.grouping.slug).toLowerCase();
                const gender=(tour==='wta'||league==='wta')?'women':'men';
                // Doubles, mixed, juniors, and qualifying have distinct draws.
                // Keep the main singles draw, even if ESPN varies the slug.
                if (!slug.includes('singles') || (gender==='women' ? /\bmen[s-]|boys/.test(slug)&&!slug.includes('women') : /women|girls/.test(slug)))continue;
            }
            for (const c of g.competitions ?? []) {
                const date = c.date ?? e.date;
                if (!date || dateInZone(date, zone) !== day)
                    continue;
                const status = c.status ?? e.status ?? {};
                const type = status.type ?? {};
                const state = type.state ?? 'pre';
                const sides = (c.competitors ?? []).slice().sort((a, b) => tennis ? (a.order ?? 0) - (b.order ?? 0) : (a.homeAway === 'away' ? -1 : 1)).map((p) => ({
                    id: String(p.team?.id ?? p.athlete?.id ?? p.id ?? ''),
                    name: p.team?.displayName ?? p.athlete?.displayName ?? 'To be determined',
                    short: p.team?.abbreviation ?? p.athlete?.shortName ?? 'TBD',
                    score: state === 'pre' ? '—' : val(p.score), winner: !!p.winner,
                    logo: p.team?.logo, color:p.team?.color, alternateColor:p.team?.alternateColor, record: p.records?.find((r) => r.type === 'total')?.summary,
                    sets: (p.linescores ?? []).map((s) => ({ value: val(s.value), tiebreak: s.tiebreak == null ? undefined : val(s.tiebreak), winner: !!s.winner })),
                    serving: !!p.serving, point: p.point == null ? undefined : val(p.point),
                    rank: league==='cfb'&&Number.isInteger(Number(p.curatedRank?.current))&&Number(p.curatedRank.current)>=1&&Number(p.curatedRank.current)<=25?Number(p.curatedRank.current):null,
                    seed: tennis&&Number.isInteger(Number(p.seed??p.athlete?.seed))&&Number(p.seed??p.athlete.seed)>=1&&Number(p.seed??p.athlete.seed)<=32?Number(p.seed??p.athlete.seed):null,
                    worldRank:tennis&&Number.isInteger(Number(p.athlete?.ranking?.current??p.ranking?.current??p.athlete?.currentRanking??p.athlete?.rank??p.currentRank))&&Number(p.athlete?.ranking?.current??p.ranking?.current??p.athlete?.currentRanking??p.athlete?.rank??p.currentRank)>=1?Number(p.athlete?.ranking?.current??p.ranking?.current??p.athlete?.currentRanking??p.athlete?.rank??p.currentRank):null,
                }));
                const sit = c.situation;
                const context=competitionContext(league,e,c,data);
                const detail = tennis ? [g.grouping?.displayName, c.round?.displayName].filter(Boolean).join(' · ') : league === 'mlb' && state === 'in' && sit ? `${sit.outs ?? 0} out${sit.outs === 1 ? '' : 's'}${sit.balls != null ? ' · ' + sit.balls + '–' + (sit.strikes ?? 0) + ' count' : ''}` : (league === 'nfl' || league === 'cfb') && state === 'in' ? (sit?.downDistanceText ?? '') : (c.broadcasts ?? []).flatMap((b) => b.names ?? []).join(' · ');
                games.push({ seasonYear:Number(e.season?.year)||null, postseason:e.season?.type===3||Number(e.season?.type)===3, eventId:String(e.id??c.id), id: tennis ? `${tour||league}-${c.id}` : `${league}-${c.id}`, league, tour:tennis?(tour||league):null, date, state, ...remainingTime(league,status,e.season?.type===3), status: type.shortDetail ?? type.description ?? 'Scheduled', title: tennis ? e.name : e.name ?? '', detail, context, venue: c.venue?.court ?? c.venue?.fullName ?? '', url: safeLink((e.links ?? []).find((l) => l.rel?.includes('summary'))?.href ?? e.links?.[0]?.href), sides, tennis });
            }
        }
    }
    return games;
}

// Clock values are reported game-clock seconds, never elapsed wall time.
function parseClock(status) {
  const text=String(status.displayClock??'').trim();
  const match=/^(\d{1,2}):(\d{2}(?:\.\d+)?)$/.exec(text);
  if(match&&Number(match[2])<60)return Number(match[1])*60+Number(match[2]);
  if(/^\d+(?:\.\d+)?$/.test(text))return Number(text);
  return typeof status.clock==='number'&&Number.isFinite(status.clock)&&status.clock>=0?status.clock:null;
}
function remainingTime(league,status,playoffs=false) {
  if(league==='nhl') {
    const period=Number(status.period),clock=parseClock(status);
    const shootout=/SHOOTOUT|STATUS_SO/i.test([status.type?.name,status.type?.description,status.type?.shortDetail].join(' '))||(!playoffs&&period>4);
    if(status.type?.state!=='in'||shootout||!Number.isInteger(period)||period<1||clock===null||clock<0||clock>(period<=3||playoffs?1200:300))return {remainingSeconds:null,timeBasis:''};
    return {remainingSeconds:period<=3?(3-period)*1200+clock:clock,timeBasis:period<=3?'regulation':'current OT'};
  }
  const quarter={wnba:600,nba:720,nfl:900,cfb:900}[league];
  const period=Number(status.period),clock=parseClock(status);
  if(!quarter||status.type?.state!=='in'||!Number.isInteger(period)||period<1)return {remainingSeconds:null,timeBasis:''};
  if(/HALFTIME/i.test(status.type?.name??''))return {remainingSeconds:quarter*2,timeBasis:'regulation'};
  if(period>4&&league==='cfb')return {remainingSeconds:null,timeBasis:'untimed OT'};
  if(clock===null||clock<0||clock>(period<=4?quarter:league==='nba'||league==='wnba'?300:900))return {remainingSeconds:null,timeBasis:''};
  return {remainingSeconds:period<=4?(4-period)*quarter+clock:clock,timeBasis:period<=4?'regulation':'current OT'};
}
function gapOf(game) {
  if(game.state==='pre'||game.sides.length!==2)return null;
  if(game.tennis) {
    const [a,b]=game.sides;
    if(!a.sets.length||!b.sets.length)return null;
    const av=a.sets.filter(s=>s.winner).length,bv=b.sets.filter(s=>s.winner).length;
    const last=Math.min(a.sets.length,b.sets.length)-1;
    const ga=Number(a.sets[last].value),gb=Number(b.sets[last].value);
    return {primary:Math.abs(av-bv),secondary:Number.isFinite(ga)&&Number.isFinite(gb)?Math.abs(ga-gb):0,unit:'sets'};
  }
  const values=game.sides.map(s=>/^\d+(?:\.\d+)?$/.test(s.score)?Number(s.score):NaN);
  return values.every(Number.isFinite)?{primary:Math.abs(values[0]-values[1]),secondary:0,unit:game.league==='mlb'?'runs':['nwsl','mls','nhl'].includes(game.league)?'goals':'pts'}:null;
}
function gamePhase(item) {
  const g=item.game;
  if(item.stale)return 4;
  if(/postpon|cancel|delay|suspend/i.test(g.status))return 4;
  return {in:0,pre:2,post:3}[g.state]??4;
}
function compareGames(a,b,mode) {
  const start=()=>Date.parse(a.game.date)-Date.parse(b.game.date)||a.game.id.localeCompare(b.game.id);
  if(mode==='original')return start();
  const gapA=gapOf(a.game),gapB=gapOf(b.game);
  const clockA=a.game.remainingSeconds,clockB=b.game.remainingSeconds;
  const timed=['more','less','close-late'].includes(mode);
  const eligible=(item,gap,clock)=>gamePhase(item)===0&&(timed?Number.isFinite(clock)&&(mode==='more'||mode==='less'||!!gap):!!gap);
  const ea=eligible(a,gapA,clockA),eb=eligible(b,gapB,clockB);
  const bucket=(item,yes)=>yes?0:gamePhase(item)===0?1:gamePhase(item);
  const bucketDelta=bucket(a,ea)-bucket(b,eb);
  if(bucketDelta)return bucketDelta;
  if(!ea||!eb)return start();
  if(mode==='closest')return gapA.primary-gapB.primary||gapA.secondary-gapB.secondary||start();
  if(mode==='more')return clockB-clockA||start();
  if(mode==='less')return clockA-clockB||start();
  const minutesA=Math.max(clockA/60,1/60),minutesB=Math.max(clockB/60,1/60);
  if(mode==='close-late')return 1/((gapB.primary+1)*minutesB)-1/((gapA.primary+1)*minutesA)||gapA.primary-gapB.primary||clockA-clockB||start();
  return start();
}
function clockLabel(seconds) {
  const n=Math.ceil(seconds);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
}
const SORT_MODES={
  original:{label:'Schedule order (default)',help:'Games stay in scheduled start-time order as they move from upcoming to live to finished. Live games light up in place; completed games fade. Event ID breaks ties for games with the same start time.'},
  closest:{label:'Closest score',help:'Live games first, smallest raw score margin first. Points, runs, and goals are compared directly; tennis uses set margin, then the latest-set game margin. These units are not equivalent across sports.'},
  more:{label:'More time left',help:'Live games with clocks first, most game-clock time remaining first. Includes all remaining regulation quarters or hockey periods; in overtime, uses only the current OT clock.'},
  less:{label:'Less time left',help:'Live games with clocks first, least game-clock time remaining first. This is playing time, not an estimate of real-world minutes until the game ends.'},
  'close-late':{label:'Close + late',help:'Highest 1 / ((score margin + 1) × minutes left) first. Smaller margins and less time both raise priority; +1 keeps ties finite. This is a viewing-priority score, not a win probability.'},
};

// Everything runs in the browser. No server, framework, secret, or build is needed.
(() => {
  const REFRESH_MS = 30000;
  const TIMEOUT_MS = 15000;
  const STALE_MS = 90000;
  const MIN_DAY = '1900-01-02', MAX_DAY = '2100-12-30';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver';
  const defs = [
    ...SPORTS.filter(s=>!['tennis','atp','wta'].includes(s.id)).map(s=>({...s,key:s.id,label:s.name})),
    {id:'atp',key:'atp',path:'tennis/atp',tour:'atp',label:'ATP singles'},
    {id:'wta',key:'wta',path:'tennis/wta',tour:'wta',label:'WTA singles'},
  ];
  const $ = id=>document.getElementById(id);
  const escapeHTML = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const esc=escapeHTML;
  const time = value=>new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});
  function imageURL(value) { try {const u=new URL(value);return u.protocol==='https:'&&u.hostname==='a.espncdn.com'?u.href:'';}catch{return '';}}
  function dayShift(day,n) {return new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
  function validDay(day) {return /^\d{4}-\d{2}-\d{2}$/.test(day)&&day>=MIN_DAY&&day<=MAX_DAY&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
  let day=dateInZone(new Date(),zone),selected='all',followToday=true,revision=0,busy=false,lastCheck=0;
  let sortMode='original',grouped=true,liveOnly=false;
  // Independent local preferences. Pins belong to a calendar day; teams are
  // identified by league and stable ESPN team ID (never a display name).
  const FAVORITES_KEY='scoreboard-favorites-v1';
  let pinnedByDay={},favoriteTeams=new Set();
  try {
    const saved=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'{}');
    if(saved.pins&&typeof saved.pins==='object'&&!Array.isArray(saved.pins))for(const [date,entries] of Object.entries(saved.pins)){
      if(validDay(date)&&Array.isArray(entries))pinnedByDay[date]=[...new Set(entries.filter(x=>typeof x==='string'&&/^[a-z0-9-]+:[a-z0-9-]+$/i.test(x)))].slice(0,100);
    }
    if(Array.isArray(saved.teams))favoriteTeams=new Set(saved.teams.filter(x=>typeof x==='string'&&/^[a-z0-9-]+:\d+$/i.test(x)));
  } catch {}
  const gameKey=g=>`${g.league}:${g.id}`;
  const sideKey=(league,id)=>`${league}:${id}`;
  const isPinned=g=>(pinnedByDay[day]??[]).includes(gameKey(g));
  const isFavoriteTeam=(league,id)=>favoriteTeams.has(sideKey(league,id));
  const isFavoriteGame=g=>!g.tennis&&g.sides.some(s=>isFavoriteTeam(g.league,s.id));
  function saveFavorites(){
    try{
      // Limit history growth while allowing revisit of pinned prior dates.
      const dates=Object.keys(pinnedByDay).sort().slice(-120),pins={};
      for(const d of dates)if(pinnedByDay[d]?.length)pins[d]=pinnedByDay[d];
      pinnedByDay=pins;
      localStorage.setItem(FAVORITES_KEY,JSON.stringify({pins,teams:[...favoriteTeams]}));
    }catch{}
  }
  function togglePin(g){
    const key=gameKey(g),set=new Set(pinnedByDay[day]??[]);
    if(set.has(key))set.delete(key);else set.add(key);
    if(set.size)pinnedByDay[day]=[...set];else delete pinnedByDay[day];
    // A featured copy can disappear on unpin; keep an already expanded game
    // open in its regular league card rather than losing its detail panel.
    if(expandedGame===g.id&&expandedCopy==='pinned'&&!set.has(key))expandedCopy='original';
    saveFavorites();render();
  }
  function toggleTeamFavorite(league,id){
    if(!SPORTS.some(s=>s.id===league)||['atp','wta'].includes(league)||!/^\d+$/.test(String(id)))return;
    const key=sideKey(league,id);
    if(favoriteTeams.has(key))favoriteTeams.delete(key);else favoriteTeams.add(key);
    if(expandedCopy==='favorites'&&expandedGame){
      const game=findGame(expandedGame);
      if(game&&!isFavoriteGame(game))expandedCopy='original';
    }
    saveFavorites();render();if(teamMode)renderTeamPage();if(!busy)refresh();
  }
  try {const pref=JSON.parse(localStorage.getItem('scoreboard-sort-v1')||'{}');const migrated={start:'original','gap-time':'close-late'}[pref.sort]??pref.sort;if(SORT_MODES[migrated])sortMode=migrated;if(typeof pref.grouped==='boolean')grouped=pref.grouped;if(typeof pref.liveOnly==='boolean')liveOnly=pref.liveOnly;}catch{}
  function saveView(){try{localStorage.setItem('scoreboard-sort-v1',JSON.stringify({sort:sortMode,grouped,liveOnly}));}catch{}}
  // League layout is independent of dates and of the existing sort preferences.
  // Stable league IDs, not display names or positions, are persisted to the browser.
  const leagueIds=SPORTS.map(s=>s.id);
  let leagueOrder=[...leagueIds],collapsedLeagues=new Set(),hiddenLeagues=new Set();
  try {
    const layout=JSON.parse(localStorage.getItem('scoreboard-layout-v1')||'{}');
    if(Array.isArray(layout.order)) {
      // Existing browser settings used one 'tennis' row for both tours.
      const migrated=layout.order.flatMap(id=>id==='tennis'?['atp','wta']:[id]);
      const known=migrated.filter((id,i)=>leagueIds.includes(id)&&migrated.indexOf(id)===i);
      leagueOrder=[...known,...leagueIds.filter(id=>!known.includes(id))];
      // One-time default-order correction: WNBA before NBA. Reordering after
      // this migration remains fully user-controlled in Settings.
      if(layout.orderRevision!==30){
        const w=leagueOrder.indexOf('wnba'),n=leagueOrder.indexOf('nba');
        if(w>n){leagueOrder.splice(w,1);leagueOrder.splice(n,0,'wnba');}
      }
    }
    const expandTennis=ids=>ids.flatMap(id=>id==='tennis'?['atp','wta']:[id]);
    if(Array.isArray(layout.collapsed))collapsedLeagues=new Set(expandTennis(layout.collapsed).filter(id=>leagueIds.includes(id)));
    if(Array.isArray(layout.hidden))hiddenLeagues=new Set(expandTennis(layout.hidden).filter(id=>leagueIds.includes(id)));
    if(Array.isArray(layout.order)&&layout.orderRevision!==30)try{localStorage.setItem('scoreboard-layout-v1',JSON.stringify({order:leagueOrder,collapsed:[...collapsedLeagues],hidden:[...hiddenLeagues],orderRevision:30}));}catch{}
    if(hiddenLeagues.size===leagueIds.length)hiddenLeagues.delete(leagueIds[0]);
  } catch {} // A corrupt or blocked browser preference must not prevent scores from loading.
  const orderedSports=()=>leagueOrder.filter(id=>!hiddenLeagues.has(id)).map(id=>SPORTS.find(s=>s.id===id));
  const SPORT_FAMILIES=[
    {id:'basketball',name:'Basketball',icon:'🏀',leagues:['wnba','nba']},
    {id:'baseball',name:'Baseball',icon:'⚾',leagues:['mlb']},
    {id:'soccer',name:'Soccer',icon:'⚽',leagues:['nwsl','mls']},
    {id:'hockey',name:'Hockey',icon:'🏒',leagues:['nhl']},
    {id:'football',name:'Football',icon:'🏈',leagues:['nfl','cfb']},
    {id:'tennis',name:'Tennis',icon:'🎾',leagues:['atp','wta']},
  ];
  const familyFor=id=>SPORT_FAMILIES.find(f=>f.leagues.includes(id));
  const visibleLeagueIds=()=>orderedSports().filter(s=>selected==='all'||selected===s.id||selected==='sport:'+familyFor(s.id)?.id).map(s=>s.id);
  // Keep actively followed games fresh even when their sport tab isn't open.
  const neededLeagueIds=()=>new Set([...visibleLeagueIds(),
    ...[...favoriteTeams].map(x=>x.split(':')[0]),
    ...(pinnedByDay[day]??[]).map(x=>x.split(':')[0])].filter(id=>!hiddenLeagues.has(id)));
  function resetSelectionIfHidden(){if(selected!=='all'&&!visibleLeagueIds().length)selected='all';}

  function saveLeagueLayout(){
    try{localStorage.setItem('scoreboard-layout-v1',JSON.stringify({order:leagueOrder,collapsed:[...collapsedLeagues],hidden:[...hiddenLeagues],orderRevision:30}));}catch{}
  }
  function moveLeague(source,target,after=false){
    if(source===target||!leagueIds.includes(source)||!leagueIds.includes(target))return false;
    const order=leagueOrder.filter(id=>id!==source);
    order.splice(order.indexOf(target)+(after?1:0),0,source);
    if(order.every((id,i)=>leagueOrder[i]===id))return false;
    leagueOrder=order;saveLeagueLayout();return true;
  }
  function moveLeagueBy(source,direction){
    const index=leagueOrder.indexOf(source),next=index+direction;
    if(index<0||next<0||next>=leagueOrder.length)return false;
    return moveLeague(source,leagueOrder[next],direction>0);
  }
  let controller=new AbortController();
  let feeds=new Map();
  const cache=new Map();
  let queue=[],activeRequests=0;
  // Limit simultaneous connections. Queued jobs are cancelled when the date changes.
  function limited(task,signal) {
    return new Promise((resolve,reject)=>{queue.push({task,signal,resolve,reject});drain();});
  }
  function drain() {
    while(activeRequests<6&&queue.length){
      const job=queue.shift();
      if(job.signal.aborted){job.reject(new DOMException('Cancelled','AbortError'));continue;}
      activeRequests++;
      Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{activeRequests--;drain();});
    }
  }
  // All network reads use the same timeout, abort lifecycle, concurrency queue,
  // and JSON/HTTP checks. Only scoreboard requests are short-lived cached reads.
  async function fetchESPNJSON(url,signal){
    return limited(async()=>{
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      const timeout=new AbortController();
      const abort=()=>timeout.abort();
      signal.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,TIMEOUT_MS);
      try{
        const response=await fetch(url,{mode:'cors',credentials:'omit',headers:{Accept:'application/json'},signal:timeout.signal});
        if(!response.ok)throw new Error(`ESPN returned HTTP ${response.status}`);
        return await response.json();
      }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
    },signal);
  }
  async function request(path,date,signal,group=null) {
    const groupParam=path==='football/college-football'?`&groups=${group??80}`:'';
    const url=`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${date.replaceAll('-','')}&limit=1000${groupParam}`;
    const saved=cache.get(url);
    const today=dateInZone(new Date(),zone);
    const offset=Math.abs((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
    const ttl=offset===0?20000:offset===1?120000:600000;
    if(saved&&Date.now()-saved.receivedAt<ttl)return saved;
    const data=await fetchESPNJSON(url,signal);
    if(!Array.isArray(data?.events))throw new Error('Unexpected scoreboard format');
    const value={data,receivedAt:Date.now()};
    if(cache.size>=72)cache.delete(cache.keys().next().value);
    cache.set(url,value);return value;
  }
  // FBS-FCS games can be absent from ESPN's groups=80 scoreboard. Add only
  // groups=81 events involving a confirmed FBS school; never display all FCS.
  let fbsRegistry={ids:null,season:null,receivedAt:0};
  async function fbsTeamIds(signal,season){
    if(fbsRegistry.ids&&fbsRegistry.season===season&&Date.now()-fbsRegistry.receivedAt<24*3600000)return fbsRegistry.ids;
    // The /teams endpoint silently ignores groups=80. The standings tree
    // honors the *singular* group=80 argument and has team IDs at its leaves.
    const url=`https://site.api.espn.com/apis/v2/sports/football/college-football/standings?season=${season}&group=80`;
    const data=await fetchESPNJSON(url,signal);
    const ids=new Set();
    function visit(node){
      if(!node||typeof node!=='object')return;
      const entries=node.standings?.entries??node.entries??[];
      if(Array.isArray(entries))for(const entry of entries){
        const id=String(entry?.team?.id??'');
        if(/^\d+$/.test(id))ids.add(id);
      }
      for(const branch of [node.children,node.groups]){
        if(Array.isArray(branch))for(const child of branch)visit(child);
      }
    }
    visit(data);
    // Avoid treating an unfiltered or incomplete response as confirmed FBS.
    if(ids.size<100||ids.size>180)throw Error('Incomplete or unfiltered FBS standings');
    fbsRegistry={ids,season,receivedAt:Date.now()};
    return ids;
  }
  function mergedCfbScoreboard(fbsFeeds,fcsFeeds,ids){
    const events=new Map();
    for(const result of fbsFeeds)for(const e of result.data.events??[])events.set(String(e.id),e);
    for(const result of fcsFeeds){
      for(const e of result.data.events??[]){
        if(events.has(String(e.id)))continue;
        const competitors=(e.competitions??[]).flatMap(c=>c.competitors??[]);
        if(competitors.some(c=>ids.has(String(c.team?.id??c.id??''))))events.set(String(e.id),e);
      }
    }
    return {events:[...events.values()]};
  }
  function emptyFeed() {return {games:[],receivedAt:0,error:'',failures:0,nextTry:0,loading:false};}
  function isStale(f) {return !!f.error||!!f.receivedAt&&Date.now()-f.receivedAt>STALE_MS;}
  function busyState(value) {
    busy=value;$('refresh').disabled=value;$('refresh-icon').classList.toggle('spin',value);
    $('scores-panel').setAttribute('aria-busy',String(value));updateStatus();
  }
  async function refresh(force=false) {
    if(busy||document.hidden)return;
    if(!navigator.onLine){updateStatus();return;}
    const token=revision,signal=controller.signal,snapshotDay=day;
    const neededIds=neededLeagueIds();
    const needed=defs.filter(d=>neededIds.has(d.id)).filter(d=>force||Date.now()>=(feeds.get(d.key)?.nextTry??0));
    if(!needed.length){updateStatus();return;}
    busyState(true);
    for(const def of needed){const f=feeds.get(def.key)||emptyFeed();f.loading=true;feeds.set(def.key,f);}
    render();
    await Promise.all(needed.map(async def=>{
      const old=feeds.get(def.key)||emptyFeed();
      try {
        // Adjacent calendar days catch games that cross a local midnight.
        const dates=[-1,0,1].map(n=>dayShift(snapshotDay,n));
        const results=await Promise.all(dates.map(date=>request(def.path,date,signal)));
        let payloads=results.map(r=>r.data),coverageWarning='';
        // Best-effort CFB supplement: failure never removes the main FBS feed.
        if(def.id==='cfb'){
          try{
            const season=Number(snapshotDay.slice(0,4))-(Number(snapshotDay.slice(5,7))<=2?1:0);
            const [ids,...fcs]=await Promise.all([fbsTeamIds(signal,season),...dates.map(date=>request(def.path,date,signal,81))]);
            payloads=[mergedCfbScoreboard(results,fcs,ids)];
          }catch(error){
            if(signal.aborted)throw error;
            coverageWarning='FBS–FCS games may be missing (supplemental feed unavailable).';
            console.warn('CFB supplement unavailable.',error);
          }
        }
        // A game can appear in more than one adjacent-date response. Prefer
        // the most recently received copy; otherwise a stale cached neighbor
        // can overwrite a newly fetched score during live monitoring.
        const games=payloads.map((data,i)=>({data,at:results[i]?.receivedAt??Date.now()}))
          .sort((a,b)=>a.at-b.at)
          .flatMap(({data})=>normalize(data,def.id,snapshotDay,zone,def.tour));
        if(token!==revision)return;
        feeds.set(def.key,{games:[...new Map(games.map(g=>[g.id,g])).values()],receivedAt:Math.min(...results.map(r=>r.receivedAt)),error:'',coverageWarning,failures:0,nextTry:0,loading:false});
      } catch(error) {
        if(token!==revision||signal.aborted)return;
        const failures=old.failures+1;
        feeds.set(def.key,{...old,loading:false,error:'Could not reach the score feed.',failures,nextTry:Date.now()+Math.min(300000,REFRESH_MS*2**(failures-1))});
      }
      if(token===revision)render();
    }));
    if(token!==revision)return;
    lastCheck=Date.now();busyState(false);render();
    const open=findGame(expandedGame);if(open)loadExpanded(open);
    const failed=needed.filter(d=>feeds.get(d.key)?.error).length;
    $('announcer').textContent=failed?'Refresh completed. Some scores are unavailable.':'Scores checked at '+time(lastCheck)+'.';
    // A team may have been favorited during this refresh. Pick up its feed
    // immediately instead of waiting for the next 30-second timer cycle.
    if(defs.some(d=>neededLeagueIds().has(d.id)&&!feeds.has(d.key)))queueMicrotask(()=>{if(token===revision&&!busy)refresh();});
  }
  function changeDay(next) {
    if(!validDay(next)){$('date').value=day;return;}
    followToday=next===dateInZone(new Date(),zone);
    if(next===day){refresh(true);return;}
    if(monitorDialog.open)closeMonitor();
    controller.abort();revision++;controller=new AbortController();
    expandedGame='';expandedState.clear();summaryCache.clear();day=next;feeds=new Map();lastCheck=0;busyState(false);updateDate();render();refresh();
  }
  function updateDate() {
    $('date').value=day;
    $('eyebrow').textContent=followToday?'TODAY’S SCOREBOARD':'SCOREBOARD';
    $('day-heading').textContent=new Date(day+'T12:00:00').toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',...(day.slice(0,4)!==String(new Date().getFullYear())?{year:'numeric'}:{})});
    $('previous').disabled=day===MIN_DAY;$('next').disabled=day===MAX_DAY;
  }
  function selectTab(id) {
    if(!['all',...SPORTS.map(s=>s.id),...SPORT_FAMILIES.map(f=>'sport:'+f.id)].includes(id))return;
    if(id!=='all'&&!orderedSports().some(s=>id===s.id||id==='sport:'+familyFor(s.id)?.id))return;
    selected=id;
    paintSportTabs();
    $('scores-panel').setAttribute('aria-label',id==='all'?'All sports':id.startsWith('sport:')?id.slice(6)+' leagues':id.toUpperCase());render();
    // The active refresh finishes its current requests. Start any newly needed feeds next.
    if(!busy)refresh();
  }
  // Expanded views are loaded only when requested, and never change card order.
  let expandedGame='', expandedState=new Map(), summaryCache=new Map();
  const summaryTTL=(g,entry)=>{
    // Recent finals can receive postgame stat corrections. Recheck their
    // summaries while the game is expanded instead of freezing the first
    // final-looking response for an hour.
    const start=Date.parse(g.date??'');
    const since=Date.now()-start;
    const recentFinal=Number.isFinite(start)&&since>=0&&since<(g.league==='mlb'?12:8)*3600000;
    return g.state==='post'&&entry?.sourceFinal&&!recentFinal?3600000:20000;
  };
  function summaryFinal(data){
    const status=data?.header?.competitions?.[0]?.status?.type??data?.header?.competitions?.[0]?.status??{};
    return status.completed===true||status.state==='post'||/STATUS_FINAL|STATUS_FULL_TIME/i.test(String(status.name??''));
  }
  const nonNegative=n=>Number.isFinite(n)&&n>=0;
  const asNumber=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const metricNumber=v=>{const s=String(v??'').replace(/,/g,'').trim();return /^-?\d+(?:\.\d+)?%?$/.test(s)?Number(s.replace('%','')):null;};
  const shortText=(s,max=48)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,max);
  function summaryURL(g){
    const def=defs.find(x=>x.id===g.league);
    return def&&/^\d+$/.test(g.eventId)?`https://site.api.espn.com/apis/site/v2/sports/${def.path}/summary?event=${encodeURIComponent(g.eventId)}`:'';
  }
  function findGame(id){for(const f of feeds.values()){const g=f.games.find(v=>v.id===id);if(g)return g;}return null;}
  function preferences(id){if(!expandedState.has(id))expandedState.set(id,{});return expandedState.get(id);}
  function getSummary(g){return summaryCache.get(g.id);}
  async function loadExpanded(g,force=false){
    if(g.tennis||g.state==='pre'||!summaryURL(g))return;
    const existing=getSummary(g),now=Date.now();
    if(existing?.loading)return;
    // Never give an in-progress snapshot the long final-game cache lifetime.
    // Also refresh immediately when the scoreboard first moves to Final.
    const phaseChanged=g.state==='post'&&existing?.phase==='in';
    if(!force&&!phaseChanged&&existing?.data&&now-existing.at<summaryTTL(g,existing)){
      // A transiently unavailable optional play feed can retry while this game
      // is expanded, without needlessly refetching the full game summary.
      if(coreProgressionLeagues[g.league]&&!existing.data.progressionPlays&&
         now-(existing.lastProgressionAttempt??0)>60000)
        await loadProgressionPlays(g,existing.data,controller.signal);
      return;
    }
    const info={...(existing||{}),loading:true,error:''};summaryCache.set(g.id,info);paintExpanded(g.id);
    const signal=controller.signal;
    try{
      const data=await fetchESPNJSON(summaryURL(g),signal);
      if(signal.aborted)return;
      summaryCache.delete(g.id);summaryCache.set(g.id,{data,at:Date.now(),phase:g.state,sourceFinal:summaryFinal(data),loading:false,error:''});
      if(summaryCache.size>15)summaryCache.delete(summaryCache.keys().next().value);
      paintExpanded(g.id);
      await loadProgressionPlays(g,data,signal);
    }catch(error){
      if(signal.aborted)return;
      summaryCache.set(g.id,{...existing,data:existing?.data,at:existing?.at??0,loading:false,error:'Detailed ESPN data could not be loaded.'});
    }
    paintExpanded(g.id);
  }

  const coreProgressionLeagues={nhl:'hockey/nhl',mlb:'baseball/mlb',mls:'soccer/usa.1',nwsl:'soccer/usa.nwsl'};
  async function requestProgressionPlays(g,signal){
    const sport=coreProgressionLeagues[g.league],id=String(g.eventId??'');
    if(!sport||!/^\d{5,15}$/.test(id))return null;
    // Core game collections may be paginated; avoid silently displaying page 1
    // as if it were the complete game. Set a hard cap on requests and payload.
    const base=`https://sports.core.api.espn.com/v2/sports/${sport.replace('/','/leagues/')}/events/${id}/competitions/${id}/plays`;
    const items=[],limit=300,maxPages=5;
    for(let page=1;page<=maxPages;page++){
      const body=await fetchESPNJSON(`${base}?page=${page}&limit=${limit}`,signal);
      if(!Array.isArray(body.items))return null;
      // A reference-only result is not usable as an event chronology.
      if(body.items.some(p=>!p||!p.type&&!p.text&&!p.shortText))return null;
      items.push(...body.items);
      const count=asNumber(body.count),pages=asNumber(body.pageCount);
      if(pages!==null&&pages>maxPages)return null;
      if(pages!==null){if(page>=pages)break;}
      else if(count!==null){if(items.length>=count)break;}
      else if(body.items.length<limit)break;
      else if(page===maxPages)return null;
    }
    return items.length?items:null;
  }
  async function loadProgressionPlays(g,data,signal){
    if(!coreProgressionLeagues[g.league]||g.state==='pre')return;
    const entry=getSummary(g);if(!entry||entry.loadingPlays)return;
    entry.loadingPlays=true;
    entry.lastProgressionAttempt=Date.now();
    try{
      const plays=await requestProgressionPlays(g,signal);
      if(!signal.aborted&&plays){
        data.progressionPlays=plays;
        // New source data invalidates memoized histories.
        metricMemo.delete(data);
      }
    }catch(_){/* Optional source; the existing summary and period view remain available. */}
    finally{entry.loadingPlays=false;if(!signal.aborted)paintExpanded(g.id);}
  }
  function scoreSnapshots(g,data){
    const competitors=data?.header?.competitions?.[0]?.competitors??[];
    const sideScore=i=>{
      const match=competitors.find(c=>String(c.team?.abbreviation??'')===g.sides[i]?.short)||competitors.find(c=>c.homeAway===(i===0?'away':'home'));
      const source=match?.linescores?.length?match.linescores:g.sides[i]?.sets??[];
      return source.map(s=>asNumber(s.value??s.displayValue)).filter(n=>n!==null);
    };
    const away=sideScore(0),home=sideScore(1);
    if(!away.length||!home.length)return [];
    const result=[{away:0,home:0,label:'Start',x:0}];
    let a=0,h=0;
    const n=Math.min(away.length,home.length);
    for(let i=0;i<n;i++){
      a+=away[i];h+=home[i];
      result.push({away:a,home:h,label:g.tennis?`After set ${i+1}`:g.league==='mlb'?`After inning ${i+1}`:`After ${periodName(g.league,i+1)}`,x:i+1});
    }
    return result;
  }
  function periodName(league,period){
    if(league==='mlb')return `Inning ${period}`;
    if(league==='nhl')return period<=3?`P${period}`:`OT${period-3===1?'':period-3}`;
    if(league==='nwsl'||league==='mls')return period<=2?`Half ${period}`:`ET ${period-2}`;
    return period<=4?`Q${period}`:`OT${period-4===1?'':period-4}`;
  }
  function playPeriod(play){return Number(play.period?.number??play.period??play.inning?.number??0);}
  function playClockSeconds(play){
    const raw=play.clock?.displayValue??play.clock?.displayClock??play.clock?.value??play.clock;
    if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0?raw:null;
    const match=/^(\d{1,3}):(\d{2}(?:\.\d+)?)$/.exec(String(raw??'').trim());
    if(match&&Number(match[2])<60)return Number(match[1])*60+Number(match[2]);
    if(/^\d+(?:\.\d+)?$/.test(String(raw??'').trim()))return Number(raw);
    return null;
  }
  function playLabel(play,g){
    const p=playPeriod(play),clock=play.clock?.displayValue;
    const title=p?periodName(g.league,p):'Scoring play';
    return shortText([title,typeof clock==='string'?clock:''].filter(Boolean).join(' · '),48);
  }
  const clockLeagues=new Set(['nba','wnba','nfl','cfb','nhl']);
  function regulationCount(league){return league==='nhl'?3:4;}
  function periodSeconds(g,period){
    if(!Number.isInteger(period)||period<1)return null;
    const reg=regulationCount(g.league);
    if(period<=reg)return {nba:720,wnba:600,nfl:900,cfb:900,nhl:1200}[g.league]??null;
    if(g.league==='nba'||g.league==='wnba')return 300;
    if(g.league==='cfb')return null; // Overtime is untimed.
    if(g.league==='nfl')return g.postseason?900:600;
    if(g.league==='nhl')return g.postseason?1200:period===4?300:null; // Regular-season shootouts are untimed.
    return null;
  }
  function elapsedGameMinutes(g,period,clock){
    const current=periodSeconds(g,period);
    if(current===null||clock===null||clock<0||clock>current)return null;
    let prior=0;
    for(let p=1;p<period;p++){
      const duration=periodSeconds(g,p);
      if(duration===null)return null;
      prior+=duration;
    }
    return (prior+current-clock)/60;
  }
  function soccerGameMinute(play){
    // Soccer is an elapsed clock. ESPN may include added time such as 45'+2'.
    const raw=String(play.clock?.displayValue??play.clock?.displayClock??'').trim().replace(/\s+/g,'');
    const extra=raw.match(/^(\d{1,3})['’]?\+(\d{1,2})(?:['’])?$/);
    if(extra)return Number(extra[1])+Number(extra[2]);
    const minutes=raw.match(/^(\d{1,3})(?:['’])?$/);
    if(minutes)return Number(minutes[1]);
    const mmss=raw.match(/^(\d{1,3}):(\d{2})$/);
    if(mmss&&Number(mmss[2])<60){
      let result=Number(mmss[1])+Number(mmss[2])/60;
      const period=playPeriod(play);
      if(period===2&&result<45)result+=45; // Only for period-relative clocks.
      if(period===3&&result<15)result+=90;
      if(period===4&&result<15)result+=105;
      return result;
    }
    // ESPN's numeric soccer clocks are seconds elapsed, not time remaining.
    const numeric=asNumber(play.clock?.value);
    return numeric!==null&&numeric>=0&&numeric<=150*60?numeric/60:null;
  }
  function inningHalf(play){
    const s=[play.period?.type,play.period?.displayValue,play.inning?.type,play.inning?.displayValue].join(' ');
    if(/\b(top|upper)\b/i.test(s))return 'top';
    if(/\b(bottom|bot|lower)\b/i.test(s))return 'bottom';
    return '';
  }
  function scoringHistory(g,data){
    const candidates=[data?.progressionPlays,data?.plays,data?.scoringPlays,data?.keyEvents].filter(Array.isArray);
    let raw=[];
    for(const plays of candidates){
      if(plays.some(p=>asNumber(p.awayScore??p.score?.awayScore)!==null&&asNumber(p.homeScore??p.score?.homeScore)!==null)){
        raw=plays;break;
      }
    }
    const points=[{away:0,home:0,label:'Start',x:0}];
    let lastA=0,lastH=0;
    for(const play of raw){
      const a=asNumber(play.awayScore??play.score?.awayScore),h=asNumber(play.homeScore??play.score?.homeScore);
      if(a===null||h===null||a<0||h<0||a>999||h>999)continue;
      if(a===lastA&&h===lastH)continue;
      // A correction can subtract a point; keep it so the line reflects the actual record.
      lastA=a;lastH=h;
      const period=playPeriod(play),clock=playClockSeconds(play);
      let x=null,basis='';
      if(clockLeagues.has(g.league)){
        x=elapsedGameMinutes(g,period,clock);basis='clock';
      }else if(g.league==='mls'||g.league==='nwsl'){
        x=soccerGameMinute(play);basis='minutes';
      }else if(g.league==='mlb'&&period>=1){
        const half=inningHalf(play);
        x=period-1+(half==='top'?.25:half==='bottom'?.75:.5);
        basis='inning';
      }
      points.push({away:a,home:h,label:playLabel(play,g),period,clock,x,basis,half:g.league==='mlb'?inningHalf(play):''});
    }
    if(points.length<2)return null;
    // The detailed feed may lag behind the scoreboard after a game ends.
    // An incomplete scoring chronology must never masquerade as a final one.
    if(g.state==='post'){
      const finalAway=asNumber(g.sides[0]?.score),finalHome=asNumber(g.sides[1]?.score);
      if(finalAway!==null&&finalHome!==null&&(lastA!==finalAway||lastH!==finalHome))return null;
    }
    const basis=points[1].basis;
    if(!basis||points.slice(1).some(p=>p.basis!==basis||p.x===null||!Number.isFinite(p.x)||p.x<0||p.x>180))return null;
    if(points.slice(2).some((p,i)=>p.x+1e-8<points[i+1].x))return null;
    if(basis==='inning'){
      // Multiple scoring plays in a half-inning share an ordinal interval.
      // Distribute them *within that half*, never uniformly across the game.
      const groups=new Map();
      for(const p of points.slice(1)){
        const key=`${p.period}:${p.half}`;
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(p);
      }
      for(const group of groups.values()){
        if(group.length<2)continue;
        const mid=group[0].x;
        group.forEach((p,i)=>p.x=mid-.20+.40*(i+1)/(group.length+1));
      }
    }
    return {points,basis,quality:'plays'};
  }
