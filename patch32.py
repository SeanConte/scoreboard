from pathlib import Path
root=Path(__file__).resolve().parents[1]
def edit(file, fn):
 p=root/file;s=p.read_text();t=fn(s);assert t!=s,file;p.write_text(t)
def once(s,a,b):
 assert s.count(a)==1,(a[:90],s.count(a));return s.replace(a,b)

def core(s):
 s=once(s,"  let sortMode='original',grouped=true;","""  let sortMode='original',grouped=true,liveOnly=false;
  // Independent local preferences. Pins belong to a calendar day; teams are
  // identified by league and stable ESPN team ID (never a display name).
  const FAVORITES_KEY='scoreboard-favorites-v1';
  let pinnedByDay={},favoriteTeams=new Set();
  try {
    const saved=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'{}');
    if(saved.pins&&typeof saved.pins==='object'&&!Array.isArray(saved.pins))for(const [date,entries] of Object.entries(saved.pins)){
      if(validDay(date)&&Array.isArray(entries))pinnedByDay[date]=[...new Set(entries.filter(x=>typeof x==='string'&&/^[a-z0-9-]+:[a-z0-9-]+$/i.test(x)))].slice(0,100);
    }
    if(Array.isArray(saved.teams))favoriteTeams=new Set(saved.teams.filter(x=>typeof x==='string'&&/^[a-z0-9-]+:\\d+$/i.test(x)));
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
    saveFavorites();render();
  }
  function toggleTeamFavorite(league,id){
    if(!SPORTS.some(s=>s.id===league)||['atp','wta'].includes(league)||!/^\\d+$/.test(String(id)))return;
    const key=sideKey(league,id);
    if(favoriteTeams.has(key))favoriteTeams.delete(key);else favoriteTeams.add(key);
    saveFavorites();render();if(teamMode)renderTeamPage();if(!busy)refresh();
  }""")
 s=once(s,"if(typeof pref.grouped==='boolean')grouped=pref.grouped;","if(typeof pref.grouped==='boolean')grouped=pref.grouped;if(typeof pref.liveOnly==='boolean')liveOnly=pref.liveOnly;")
 s=once(s,"JSON.stringify({sort:sortMode,grouped})","JSON.stringify({sort:sortMode,grouped,liveOnly})")
 s=once(s,"  function resetSelectionIfHidden()", """  // Keep actively followed games fresh even when their sport tab isn't open.
  const neededLeagueIds=()=>new Set([...visibleLeagueIds(),
    ...[...favoriteTeams].map(x=>x.split(':')[0]),
    ...(pinnedByDay[day]??[]).map(x=>x.split(':')[0])].filter(id=>!hiddenLeagues.has(id)));
  function resetSelectionIfHidden()""")
 s=once(s,"const needed=defs.filter(d=>visibleLeagueIds().includes(d.id)).filter(","const neededIds=neededLeagueIds();\n    const needed=defs.filter(d=>neededIds.has(d.id)).filter(")
 return s
edit(Path('src/core.js'),core)

def templ(s):
 s=once(s,'<div class="live-count"><span class="live-dot" aria-hidden="true"></span><b id="live-count">0</b> live <span class="total-count" id="event-count">/ loading</span></div>', '<button type="button" id="live-filter-main" class="live-count live-filter-button" aria-pressed="false" aria-label="Show only live games"><span class="live-dot" aria-hidden="true"></span><b id="live-count">0</b> live <span class="total-count" id="event-count">/ loading</span></button>')
 s=once(s,'<div class="sticky-live-summary" aria-label="Live and total events" role="status">','<button type="button" id="live-filter-sticky" class="sticky-live-summary live-filter-button" aria-label="Show only live games" aria-pressed="false">')
 s=once(s,'<span id="sticky-event-count">/ 0</span></div>','<span id="sticky-event-count">/ 0</span></button>')
 return s
edit(Path('src/template.html'),templ)

def ui(s):
 s=once(s,"  function card(g,stale,inMonitor=false) {", "  function card(g,stale,inMonitor=false,copy='original') {")
 s=once(s,"const opened=inMonitor||expandedGame===g.id;", "const opened=inMonitor||(expandedGame===g.id&&expandedCopy===copy);")
 s=once(s,"const detailId=(inMonitor?'monitor-details-':'details-')+g.id;", "const detailId=(inMonitor?'monitor-details-':'details-'+copy+'-')+g.id;")
 s=once(s,"    const rows=g.sides.map(s=>{", """    const rows=g.sides.map(s=>{""")
 s=once(s,"      return `<div class=\"side ${s.winner?'winner':''}\"><div class=\"team-name\">${badge}<span><span class=\"name\">${position}${!g.tennis&&/^\\d+$/.test(s.id)?`<button class=\"team-link\" type=\"button\" data-open-team=\"${esc(g.league)}:${esc(s.id)}\" aria-label=\"Open ${esc(s.name)} team schedule\">${esc(s.name)}</button>`:esc(s.name)}${s.serving?'<span class=\"serve\" aria-label=\"Serving\">●</span>':''}</span>${s.record?`<span class=\"record\">${esc(s.record)}</span>`:''}</span></div>${sets}</div>`;", """      const favored=!g.tennis&&/^\\d+$/.test(s.id)&&isFavoriteTeam(g.league,s.id);
      const teamStar=!g.tennis&&/^\\d+$/.test(s.id)?`<button type="button" class="favorite-team-button ${favored?'is-favorite':''}" data-favorite-team="${esc(g.league)}:${esc(s.id)}" aria-pressed="${favored}" aria-label="${favored?'Remove':'Add'} ${esc(s.name)} ${favored?'from':'to'} favorite teams" title="${favored?'Unfavorite':'Favorite'} ${esc(s.name)}">${favored?'★':'☆'}</button>`:'';
      return `<div class="side ${s.winner?'winner':''}"><div class="team-name">${badge}<span><span class="name">${position}${!g.tennis&&/^\\d+$/.test(s.id)?`<button class="team-link" type="button" data-open-team="${esc(g.league)}:${esc(s.id)}" aria-label="Open ${esc(s.name)} team schedule">${esc(s.name)}</button>`:esc(s.name)}${teamStar}${s.serving?'<span class="serve" aria-label="Serving">●</span>':''}</span>${s.record?`<span class="record">${esc(s.record)}</span>`:''}</span></div>${sets}</div>`;""")
 s=once(s,"    const sparkline=miniScoreFlow(g);", """    const sparkline=miniScoreFlow(g);
    const pinned=isPinned(g),favorite=isFavoriteGame(g);
    const pinButton=`<button type="button" class="pin-game-button ${pinned?'is-pinned':''}" data-pin-game="${esc(g.id)}" aria-pressed="${pinned}" aria-label="${pinned?'Unpin':'Pin'} ${esc(g.title)} for ${esc(day)}" title="${pinned?'Remove day pin':'Pin game for this day'}"><svg viewBox="0 0 24 24" width="15" height="15" fill="${pinned?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v6"/></svg><span>${pinned?'Pinned':'Pin'}</span></button>;""")
 s=once(s,"class=\"score-card ${live?'live-card':''} ${completed?'completed-card':''} ${opened?'expanded-card':''}\"", "class=\"score-card ${live?'live-card':''} ${completed?'completed-card':''} ${opened?'expanded-card':''} ${favorite?'favorite-card':''} ${pinned?'pinned-card':''}\"")
 s=once(s,"<span class=\"game-start\">Start ${esc(starts)}</span></div>","<span class=\"game-start\">Start ${esc(starts)}</span>${pinButton}</div>")
 s=once(s,"data-expand=\"${esc(g.id)}\" aria-expanded", "data-expand=\"${esc(g.id)}\" data-expand-copy=\"${esc(copy)}\" aria-expanded")
 # protect duplicate detail IDs
 s=once(s,"    if(expandedGame===id){\n      const element=document.getElementById('details-'+id);\n      if(element)element.innerHTML=detailContent(game);\n    }", """    if(expandedGame===id){
      const element=document.getElementById('details-'+expandedCopy+'-'+id);
      if(element)element.innerHTML=detailContent(game);
    }""")
 s=once(s,"  function toggleExpanded(id){\n    expandedGame=expandedGame===id?'':id;", """  let expandedCopy='original';
  function toggleExpanded(id,copy='original'){
    const same=expandedGame===id&&expandedCopy===copy;
    expandedGame=same?'':id;expandedCopy=copy;""")
 s=once(s,"const button=[...document.querySelectorAll('[data-expand]')].find(el=>el.dataset.expand===id);", "const button=[...document.querySelectorAll('[data-expand]')].find(el=>el.dataset.expand===id&&el.dataset.expandCopy===copy);")
 s=once(s,"if(toggle){toggleExpanded(toggle.dataset.expand);return;}","if(toggle){toggleExpanded(toggle.dataset.expand,toggle.dataset.expandCopy);return;}")
 # extra event handlers before monitor and expand
 s=once(s,"    const monitor=event.target.closest('[data-monitor-open]');", """    const pin=event.target.closest('[data-pin-game]');
    if(pin){const game=findGame(pin.dataset.pinGame);if(game)togglePin(game);return;}
    const favorite=event.target.closest('[data-favorite-team]');
    if(favorite){const [league,id]=favorite.dataset.favoriteTeam.split(':');toggleTeamFavorite(league,id);return;}
    const monitor=event.target.closest('[data-monitor-open]');""")
 # rendering grouping and featured
 s=once(s,"    let live=0,count=0,unknown=false;", "    let live=0,count=0,unknown=false;")
 s=once(s,"      const items=ff.flatMap(({feed:f})=>f?f.games.map(g=>({game:g,stale:isStale(f)})):[])\n        .sort((a,b)=>compareGames(a,b,sortMode));", """      const allLeagueGames=ff.flatMap(({feed:f})=>f?f.games.map(g=>({game:g,stale:isStale(f)})):[])
        .sort((a,b)=>compareGames(a,b,sortMode));
      const items=liveOnly?allLeagueGames.filter(i=>gamePhase(i)===0):allLeagueGames;""")
 s=once(s,"      count+=items.length;live+=items.filter(i=>gamePhase(i)===0).length;", "      count+=allLeagueGames.length;live+=allLeagueGames.filter(i=>gamePhase(i)===0).length;")
 s=once(s,"      if(items.length)content=", "      if(items.length)content=")
 s=once(s,"      else if(pending)content=", "      else if(liveOnly&&!pending)content=`<div class=\"empty-state\"><span class=\"empty-dash\">—</span><div><p>No live games in ${esc(s.name)}</p><span>Turn off the live-only filter to see scheduled and final games.</span></div></div>`;\n      else if(pending)content=")
 s=once(s,"    $('scores-panel').innerHTML=across?", """    // Featured games are additional presentations of the same normalized game
    // records, never moved away from their regular league position. Distinct
    // feature sections never repeat each other: a pin takes precedence.
    const allFollowed=[];
    const known=new Set();
    for(const league of orderedSports()){
      const feed=feeds.get(league.id);
      for(const game of feed?.games??[]){
        const key=gameKey(game);
        if(known.has(key))continue;known.add(key);
        allFollowed.push({game,stale:isStale(feed)});
      }
    }
    const eligible=allFollowed.filter(i=>!liveOnly||gamePhase(i)===0);
    const pinnedItems=eligible.filter(i=>isPinned(i.game)).sort((a,b)=>compareGames(a,b,sortMode));
    const favoriteItems=eligible.filter(i=>!isPinned(i.game)&&isFavoriteGame(i.game)).sort((a,b)=>compareGames(a,b,sortMode));
    const featured=(label,items,slug,icon)=>items.length?`<section class="featured-games featured-${slug}" aria-label="${label}"><div class="featured-heading"><h2><span class="featured-symbol" aria-hidden="true">${icon}</span> ${label}</h2><span>${items.length} ${items.length===1?'game':'games'} · Also listed in their leagues</span></div><div class="games-grid">${items.map(i=>card(i.game,i.stale,false,slug)).join('')}</div></section>`:'';
    const featuredHTML=featured('Pinned games',pinnedItems,'pinned','⌖')+featured('Favorite teams',favoriteItems,'favorites','★');
    $('scores-panel').innerHTML=featuredHTML+(across?""")
 s=once(s,"</section>`:groupedHTML;\n    $('sort-scope')", "</section>`:groupedHTML);\n    $('sort-scope')")
 s=once(s,"    $('sticky-event-count').textContent=`/ ${count}${unknown?' · partial':''}`;", """    $('sticky-event-count').textContent=`/ ${count}${unknown?' · partial':''}`;
    for(const id of ['live-filter-main','live-filter-sticky']){
      const button=$(id);
      button.setAttribute('aria-pressed',String(liveOnly));
      button.setAttribute('aria-label',liveOnly?'Show all games':'Show live games only');
      button.title=liveOnly?'Show scheduled, live and finished games':'Show live games only';
      button.classList.toggle('is-active',liveOnly);
    }""")
 s=once(s,"  $('sort').innerHTML=", """  for(const id of ['live-filter-main','live-filter-sticky'])$(id).addEventListener('click',()=>{
    liveOnly=!liveOnly;saveView();render();
    $(id).focus({preventScroll:true});
    $('announcer').textContent=liveOnly?'Showing live games only.':'Showing all games.';
  });
  $('sort').innerHTML=""")
 return s
edit(Path('src/ui.js'),ui)

def team(s):
 s=once(s,'<h1>${esc(team.name)}</h1><p class="team-summary">', '<h1>${esc(team.name)}<button type="button" class="team-page-favorite ${isFavoriteTeam(team.league,team.id)?\'is-favorite\':\'\'}" data-team-page-favorite="${esc(team.league)}:${esc(team.id)}" aria-pressed="${isFavoriteTeam(team.league,team.id)}" aria-label="${isFavoriteTeam(team.league,team.id)?\'Remove from\':\'Add to\'} favorite teams" title="${isFavoriteTeam(team.league,team.id)?\'Unfavorite team\':\'Favorite team\'}">${isFavoriteTeam(team.league,team.id)?\'★\':\'☆\'}</button></h1><p class="team-summary">')
 s=once(s,"  teamPanel.addEventListener('change',e=>{", """  teamPanel.addEventListener('click',e=>{
    const button=e.target.closest('[data-team-page-favorite]');if(!button)return;
    const [league,id]=button.dataset.teamPageFavorite.split(':');toggleTeamFavorite(league,id);
  });
  teamPanel.addEventListener('change',e=>{""")
 return s
edit(Path('src/team.js'),team)
