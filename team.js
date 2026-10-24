  // Team view: a second projection of the same ESPN team and event identities.
  // The scoreboard and game monitor retain ownership of the game experience.
  const teamPanel=$('team-view');
  const teamScheduleCache=new Map();
  let teamMode=null,teamReturnScroll=0,teamPendingJump=null,teamRecent=null,teamRecentScroll=0;
  const TEAM_SEASON_CACHE_MS=4*3600000;
  const sportsById=Object.fromEntries(SPORTS.map(x=>[x.id,x]));
  function defaultTeamSeason(g){
    if(Number.isInteger(g.seasonYear)&&g.seasonYear>=2000)return g.seasonYear;
    const d=new Date(g.date),year=d.getUTCFullYear(),month=d.getUTCMonth()+1;
    // Bowl games and NFL playoffs in January/February belong to the prior season.
    if(['nfl','cfb'].includes(g.league)&&month<=2)return year-1;
    return ['nba','nhl'].includes(g.league)&&month>=7?year+1:year;
  }
  function teamKey(league,id,year){return `${league}:${id}:${year}`;}
  function teamInfoFromGame(g,side){return {league:g.league,id:String(side.id),name:side.name,short:side.short,logo:imageURL(side.logo),color:side.color,alternateColor:side.alternateColor,season:defaultTeamSeason(g)};}
  function findTeamInFeeds(league,id){
    for(const f of feeds.values())for(const g of f.games??[])if(g.league===league){
      const side=g.sides.find(s=>String(s.id)===String(id));if(side)return teamInfoFromGame(g,side);
    }
    return null;
  }
  function normalizeTeamSchedule(payload,team){
    if(!Array.isArray(payload?.events))throw new Error('Team schedule unavailable or unexpected format');
    const list=[];
    for(const e of payload.events){
      const c=(e.competitions??[])[0];if(!c)continue;
      const date=c.date??e.date;
      if(!date||!Number.isFinite(Date.parse(date)))continue;
      const sides=(c.competitors??[]).map(p=>({
        id:String(p.team?.id??p.id??''),name:String(p.team?.displayName??p.team?.name??'TBD'),
        short:String(p.team?.abbreviation??''),score:p.score?.displayValue??p.score?.value??p.score??'',
        homeAway:p.homeAway??'',winner:p.winner===true,logo:imageURL(p.team?.logo??p.team?.logos?.[0]?.href),color:p.team?.color,alternateColor:p.team?.alternateColor
      }));
      const self=sides.find(p=>p.id===String(team.id));
      if(!self)continue; // Never attach an unrelated contest to a team.
      const opp=sides.find(p=>p!==self);
      const state=c.status?.type?.state??e.status?.type?.state??'pre';
      const status=c.status?.type?.shortDetail??e.status?.type?.shortDetail??(state==='post'?'Final':state==='in'?'Live':'Scheduled');
      const id=String(e.id??c.id??'');
      const rawWeek=e.week?.number??e.week?.week??(typeof e.week==='number'?e.week:null)??c.week?.number??c.week??null;
      const weekNumber=Number(rawWeek);
      const week=rawWeek!==null&&rawWeek!==''&&Number.isInteger(weekNumber)&&weekNumber>0&&weekNumber<100?weekNumber:null;
      const numScore=p=>{const n=Number(String(p?.score??'').replace(/,/g,''));return p&&String(p.score).trim()!==''&&Number.isFinite(n)?n:null;};
      list.push({id,date,state,status,opp,home:self.homeAway==='home',selfScore:numScore(self),oppScore:numScore(opp),winner:self.winner,oppWinner:opp?.winner??false,sides,league:team.league,week,selfColor:self.color,selfAlternateColor:self.alternateColor});
    }
    list.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));
    list.forEach((game,i)=>{game.gameNumber=i+1;});
    return list;
  }
  function scheduleURL(team){const path=sportsById[team.league]?.path;
    return /^\d+$/.test(team.id)&&path?`https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${encodeURIComponent(team.id)}/schedule?season=${team.season}`:'';
  }
  async function loadTeamSchedule(team,force=false){
    const key=teamKey(team.league,team.id,team.season),entry=teamScheduleCache.get(key);
    if(entry?.loading)return;
    const hasToday=entry?.rows?.some(r=>r.state==='in'||(r.state==='pre'&&dateInZone(r.date,zone)===dateInZone(new Date(),zone)));
    if(!force&&entry?.rows&&Date.now()-entry.at<(hasToday?60000:TEAM_SEASON_CACHE_MS))return;
    const signal=new AbortController().signal;
    teamScheduleCache.set(key,{...entry,loading:true,error:''});
    // Retain the current schedule DOM/focus during routine live refreshes.
    if(!entry?.rows?.length)renderTeamPage();
    try{
      const data=await fetchESPNJSON(scheduleURL(team),signal);
      const rows=normalizeTeamSchedule(data,team);
      teamScheduleCache.set(key,{rows,loading:false,error:'',at:Date.now(),source:data});
    }catch(error){teamScheduleCache.set(key,{...entry,loading:false,error:'Schedule feed unavailable. Try again.',at:0});}
    if(teamMode?.league===team.league&&teamMode?.id===team.id&&teamMode?.season===team.season){
      const own=teamScheduleCache.get(key)?.rows?.find(r=>r.selfColor);
      if(own){teamMode.color=teamMode.color||own.selfColor;teamMode.alternateColor=teamMode.alternateColor||own.selfAlternateColor;}
    }
    renderTeamPage();
  }
  function teamScheduleRow(row,team){
    const formatted=new Date(row.date).toLocaleDateString([],{month:'short',day:'numeric',weekday:'short'});
    const when=new Date(row.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    const result=row.state==='post'&&row.selfScore!==null&&row.oppScore!==null?
       `${row.winner?'W':row.oppWinner?'L':'D'} · ${row.selfScore}–${row.oppScore}`:
       row.state==='in'&&row.selfScore!==null?`LIVE · ${row.selfScore}–${row.oppScore??'—'}`:row.state==='post'?row.status:when;
    const weekText=['nfl','cfb'].includes(team.league)&&row.week?`Week ${row.week}`:null;
    const dayOfGame=dateInZone(row.date,zone),canNavigate=/^\d{4,15}$/.test(row.id),img=imageURL(row.opp?.logo);
    const isLive=row.state==='in',isToday=!isLive&&row.state==='pre'&&dayOfGame===dateInZone(new Date(),zone);
    return `<button type="button" class="team-schedule-game ${isLive?'schedule-live':isToday?'schedule-today':''}" data-team-game="${esc(row.id)}" data-team-game-day="${dayOfGame}" data-team-game-league="${team.league}" ${canNavigate?'':'disabled'} aria-label="View ${esc(team.name)} ${esc(row.opp?.name??'opponent')} game on ${formatted}">
      <span class="team-schedule-date">${esc(formatted)}${weekText?`<small>${esc(weekText)}</small>`:''}${isToday?'<small class="schedule-day-label">TODAY</small>':isLive?'<small class="schedule-live-label"><span class="live-dot" aria-hidden="true"></span> LIVE</small>':''}</span>
      <span class="team-schedule-opponent">${img?`<img src="${esc(img)}" alt="" loading="lazy">`:''}<span><small>${row.home?'vs':'@'}</small> ${esc(row.opp?.name??'Opponent TBD')}</span></span>
      <span class="team-schedule-result ${row.winner?'team-schedule-win':''}">${esc(result)}</span><span aria-hidden="true" class="team-schedule-arrow">›</span>
    </button>`;
  }
  function renderTeamPage(){
    if(!teamMode)return;
    const team=teamMode,entry=teamScheduleCache.get(teamKey(team.league,team.id,team.season));
    const rows=entry?.rows??[];
    const years=[team.season-2,team.season-1,team.season,team.season+1];
    const currentId=`${team.league}:${team.id}`;
    const tab=teamMode.tab??'schedule';
    const record=rows.filter(r=>r.state==='post'&&r.selfScore!==null&&r.oppScore!==null);
    const wins=record.filter(r=>r.winner||r.selfScore>r.oppScore).length;
    const losses=record.filter(r=>r.oppWinner||r.selfScore<r.oppScore).length;
    const draws=record.length-wins-losses;
    const recordText=record.length?`${wins}–${losses}${draws?`–${draws}`:''}`:'—';
    const next=rows.find(r=>r.state==='in')??rows.find(r=>r.state==='pre');
    const primary=graphColor(team.color||rows.find(r=>r.selfColor)?.selfColor,'#e4bb76');
    const secondary=graphColor(team.alternateColor||rows.find(r=>r.selfAlternateColor)?.selfAlternateColor,'#f2d6a0');
    teamPanel.style.setProperty('--team-accent',primary);
    teamPanel.style.setProperty('--team-secondary',secondary);
    teamPanel.innerHTML=`<div class="team-backbar"><button type="button" data-team-back>← Back to scoreboard</button><span>${esc(sportsById[team.league]?.name??team.league)} · Team season</span></div>
      <div class="team-hero"><div class="team-hero-identity">${team.logo?`<img class="team-hero-logo" src="${esc(team.logo)}" alt="" referrerpolicy="no-referrer">`:''}<div><p class="team-eyebrow">${esc(sportsById[team.league]?.name??'LEAGUE')} · ${esc(String(team.season))} SEASON</p><div class="team-title-with-favorite"><h1>${esc(team.name)}</h1><button type="button" class="team-page-favorite ${isFavoriteTeam(team.league,team.id)?'is-favorite':''}" data-team-page-favorite="${esc(team.league)}:${esc(team.id)}" aria-pressed="${isFavoriteTeam(team.league,team.id)}" aria-label="${isFavoriteTeam(team.league,team.id)?'Remove from':'Add to'} favorite teams" title="${isFavoriteTeam(team.league,team.id)?'Unfavorite team':'Favorite team'}">${isFavoriteTeam(team.league,team.id)?'★':'☆'}</button></div><p class="team-summary">${record.length?`${recordText} in ${record.length} completed games`:'Season schedule and statistics'}</p></div></div><label class="team-year-label">Season <select aria-label="Team season" data-team-season>${years.map(year=>`<option value="${year}" ${year===team.season?'selected':''}>${['nba','nhl'].includes(team.league)?`${year-1}–${String(year).slice(-2)}`:year}</option>`).join('')}</select></label></div>
      <div class="team-overview-strip"><div><span>Record</span><strong>${recordText}</strong></div><div><span>Games completed</span><strong>${record.length||'—'}</strong></div><div><span>Next game</span><strong>${next?new Date(next.date).toLocaleDateString([],{month:'short',day:'numeric'}):'—'}</strong></div></div>
      <div class="team-tabs" role="tablist" aria-label="Team season views"><button type="button" role="tab" data-team-tab="schedule" aria-selected="${tab==='schedule'}">Schedule</button><button type="button" role="tab" data-team-tab="stats" aria-selected="${tab==='stats'}">Statistics</button></div>
      <div class="team-tab-body">${tab==='schedule'?`<div class="team-section-heading"><h2>Season schedule</h2><span>${rows.length} games</span></div>${entry?.loading&&!rows.length?'<p class="team-state">Loading team schedule…</p>':entry?.error&&!rows.length?`<p class="team-state">${esc(entry.error)} <button type="button" data-team-retry>Retry</button></p>`:rows.length?`<div class="team-schedule-list">${rows.map(row=>teamScheduleRow(row,team)).join('')}</div>`:'<p class="team-state">No games reported for this season.</p>'}`:
      teamStatisticsContent(team,entry,record)}</div>`;
  }
  function showTeam(team){
    if(!team||team.league==='tennis'||!sportsById[team.league]||!/^\d+$/.test(team.id))return;
    teamReturnScroll=window.scrollY;
    if(monitorDialog.open)closeMonitor();
    teamMode={...team,tab:'schedule'};
    document.body.classList.add('team-active');teamPanel.hidden=false;
    renderTeamPage();window.scrollTo(0,0);loadTeamSchedule(teamMode);
  }
  function closeTeam(restore=true){
    if(!teamMode)return;
    teamMode=null;document.body.classList.remove('team-active');teamPanel.hidden=true;
    if(restore)window.scrollTo(0,teamReturnScroll);
  }
  // Date and game event ID are authoritative. A team's schedule never constructs
  // a second game card with subtly different game, cache, or monitor behavior.
  function goToTeamGame(id,dayOfGame,league){
    if(!validDay(dayOfGame)||!/^\d{4,15}$/.test(id))return;
    const match=id=>[...feeds.values()].flatMap(f=>f.games??[]).find(g=>g.eventId===id&&g.league===league);
    teamPendingJump={id,league,day:dayOfGame};
    teamRecent={...teamMode};teamRecentScroll=window.scrollY;
    $('team-return-shortcut').hidden=false;
    $('team-return-shortcut').textContent=`← ${teamRecent.name}`;
    closeTeam(false);selected=league;
    paintSportTabs();
    if(day!==dayOfGame)changeDay(dayOfGame);
    else {render();completeTeamGameJump();if(!busy)refresh(true);}
  }
  function completeTeamGameJump(){
    if(!teamPendingJump)return;
    const target=teamPendingJump;
    if(day!==target.day)return;
    const game=[...feeds.values()].flatMap(f=>f.games??[]).find(g=>g.league===target.league&&g.eventId===target.id);
    if(!game)return;
    teamPendingJump=null;expandedGame=game.id;
    render();const card=[...$('scores-panel').querySelectorAll('[data-expand]')].find(x=>x.dataset.expand===game.id)?.closest('.score-card');
    card?.scrollIntoView({block:'center',behavior:'auto'});loadExpanded(game);
  }
  function teamChartTooltip(target){
    if(!teamMode||!target)return;
    const element=target.closest('[data-season-game-index]');if(!element)return;
    const tooltip=teamPanel.querySelector('[data-team-chart-tooltip]');
    const entry=teamScheduleCache.get(teamKey(teamMode.league,teamMode.id,teamMode.season));
    const completed=(entry?.rows??[]).filter(r=>r.state==='post'&&r.selfScore!==null&&r.oppScore!==null).slice(-32);
    const row=completed[Number(element.dataset.seasonGameIndex)];
    if(!tooltip||!row)return;
    const match=['nfl','cfb'].includes(teamMode.league)&&row.week?`Week ${row.week}`:`Game ${row.gameNumber}`;
    const date=new Date(row.date).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'});
    const outcome=row.selfScore>row.oppScore?'Win':row.selfScore<row.oppScore?'Loss':'Draw';
    const crest=imageURL(row.opp?.logo);
    const stage=['nfl','cfb'].includes(teamMode.league)&&row.week?`Week ${row.week}`:`Game ${row.gameNumber}`;
    tooltip.innerHTML=`<strong>${esc(stage)} · ${esc(date)}</strong><span class="team-chart-tooltip-opponent">${crest?`<img src="${esc(crest)}" alt="" loading="lazy">`:''}${row.home?'Home · vs':'Away · @'} ${esc(row.opp?.name??'Opponent')}</span><b>${esc(teamMode.short)} ${row.selfScore} – ${row.oppScore} ${esc(row.opp?.short??'OPP')} · ${outcome}</b><span class="team-chart-tooltip-status">${esc(row.status??'Final')}</span><small>Click to view game · On touch, tap again</small><button type="button" data-team-chart-open="${esc(row.id)}" data-team-chart-day="${esc(dateInZone(row.date,zone))}" aria-label="Open this game">View game ↗</button>`;
    tooltip.hidden=false;
    teamPanel.querySelectorAll('[data-season-game-index]').forEach(el=>el.classList.toggle('is-inspected',el===element));
  }
  // ESPN can return stale logo URLs; omit failed images instead of showing broken glyphs.
  teamPanel.addEventListener('error',event=>{
    if(event.target?.matches?.('.team-season-bar image, .team-hero-logo, .team-chart-tooltip-opponent img'))event.target.style.display='none';
  },true);
  teamPanel.addEventListener('pointerover',event=>{
    const point=event.target.closest('[data-season-game-index]');if(point)teamChartTooltip(point);
  });
  teamPanel.addEventListener('focusin',event=>{
    const point=event.target.closest('[data-season-game-index]');if(point)teamChartTooltip(point);
  });
  teamPanel.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch'){
      const point=event.target.closest('[data-season-game-index]');if(point){
        const index=Number(point.dataset.seasonGameIndex);
        const already=teamMode.chartTappedIndex===index;
        teamMode.chartTappedIndex=index;
        point.dataset.touchWasSelected=String(already);
        teamChartTooltip(point);
      }
    }
  });
  teamPanel.addEventListener('change',event=>{
    const select=event.target.closest('[data-team-chart-mode]');if(!select||!teamMode)return;
    teamMode.chartMode=select.value;const scroll=window.scrollY;renderTeamPage();window.scrollTo(0,scroll);
    teamPanel.querySelector('[data-team-chart-mode]')?.focus({preventScroll:true});
  });
  teamPanel.addEventListener('keydown',event=>{
    if(!['Enter',' '].includes(event.key))return;
    const point=event.target.closest('[data-season-game-index]');if(!point)return;
    event.preventDefault();
    const cache=teamScheduleCache.get(teamKey(teamMode.league,teamMode.id,teamMode.season));
    const games=(cache?.rows??[]).filter(r=>r.state==='post'&&r.selfScore!==null&&r.oppScore!==null).slice(-32);
    const game=games[Number(point.dataset.seasonGameIndex)];
    if(game)goToTeamGame(game.id,dateInZone(game.date,zone),teamMode.league);
  });
  teamPanel.addEventListener('click',e=>{
    const back=e.target.closest('[data-team-back]');if(back){closeTeam();return;}
    const tab=e.target.closest('[data-team-tab]');if(tab){teamMode.tab=tab.dataset.teamTab;renderTeamPage();if(teamMode.tab==='stats')loadTeamStatistics(teamMode);return;}
    const summary=e.target.closest('[data-season-summary]');if(summary&&teamMode){
      teamMode.chartMode=summary.dataset.seasonSummary;
      const scroll=window.scrollY;renderTeamPage();window.scrollTo(0,scroll);
      teamPanel.querySelector('.team-season-chart')?.scrollIntoView({block:'nearest',behavior:'auto'});return;
    }
    const open=e.target.closest('[data-team-chart-open]');if(open){goToTeamGame(open.dataset.teamChartOpen,open.dataset.teamChartDay,teamMode.league);return;}
    const bar=e.target.closest('[data-season-game-index]');if(bar&&teamMode){
      if(e.detail>0&&bar.dataset.touchWasSelected==='false'){delete bar.dataset.touchWasSelected;return;}
      delete bar.dataset.touchWasSelected;
      const cache=teamScheduleCache.get(teamKey(teamMode.league,teamMode.id,teamMode.season));
      const games=(cache?.rows??[]).filter(r=>r.state==='post'&&r.selfScore!==null&&r.oppScore!==null).slice(-32);
      const row=games[Number(bar.dataset.seasonGameIndex)];
      if(row)goToTeamGame(row.id,dateInZone(row.date,zone),teamMode.league);return;
    }
    const row=e.target.closest('[data-team-game]');if(row){goToTeamGame(row.dataset.teamGame,row.dataset.teamGameDay,row.dataset.teamGameLeague);return;}
    if(e.target.closest('[data-team-retry]'))loadTeamSchedule(teamMode,true);
    if(e.target.closest('[data-team-stats-retry]'))loadTeamStatistics(teamMode,true);
  });
  teamPanel.addEventListener('click',e=>{
    const button=e.target.closest('[data-team-page-favorite]');if(!button)return;
    const [league,id]=button.dataset.teamPageFavorite.split(':');toggleTeamFavorite(league,id);
  });
  teamPanel.addEventListener('change',e=>{
    const season=e.target.closest('[data-team-season]');if(!season||!teamMode)return;
    teamMode.season=Number(season.value);renderTeamPage();loadTeamSchedule(teamMode);
    if(teamMode.tab==='stats')loadTeamStatistics(teamMode);
  });
  for(const surface of [$('scores-panel'),monitorDialog])surface.addEventListener('click',e=>{
    const button=e.target.closest('[data-open-team]');if(!button)return;
    e.preventDefault();e.stopPropagation();
    const [league,id]=button.dataset.openTeam.split(':');
    const game=[...feeds.values()].flatMap(f=>f.games??[]).find(g=>g.league===league&&g.sides.some(s=>String(s.id)===id));
    const side=game?.sides.find(s=>String(s.id)===id);
    const team=side?teamInfoFromGame(game,side):findTeamInFeeds(league,id);
    if(team)showTeam(team);
  });
  $('team-return-shortcut').addEventListener('click',()=>{
    if(!teamRecent)return;
    const snapshot={...teamRecent},scroll=teamRecentScroll;
    showTeam(snapshot);teamMode.tab=snapshot.tab;
    renderTeamPage();if(snapshot.tab==='stats')loadTeamStatistics(teamMode);
    window.scrollTo(0,scroll);
  });
  // Follow the live game from the team page without polling historical seasons.
  setInterval(()=>{
    if(!teamMode||document.hidden||teamMode.tab!=='schedule')return;
    const entry=teamScheduleCache.get(teamKey(teamMode.league,teamMode.id,teamMode.season));
    const today=dateInZone(new Date(),zone);
    if(entry?.rows?.some(r=>r.state==='in'||(r.state==='pre'&&dateInZone(r.date,zone)===today)))loadTeamSchedule({...teamMode});
  },60000);
  // populated by stage 0.28, placeholder for stage 0.27
  __SB_TEAM_STATS_JS__
