  // 0.28 — factual season statistics. Official aggregates, when ESPN supplies
  // them, are separate from values derived from the listed completed games.
  const teamSeasonStatsCache=new Map();
  function statsURL(team){
    const path=sportsById[team.league]?.path??'';
    const [sport,league]=path.split('/');
    if(!sport||!league||!/^\d+$/.test(team.id))return '';
    return `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/seasons/${team.season}/types/2/teams/${encodeURIComponent(team.id)}/statistics`;
  }
  function numericStat(v){
    if(typeof v==='number'&&Number.isFinite(v))return v;
    const raw=String(v??'').trim().replace(/,/g,'').replace(/%$/,'');
    if(!/^-?\d+(?:\.\d+)?$/.test(raw))return null;
    const n=Number(raw);return Number.isFinite(n)?n:null;
  }
  function parseTeamSeasonStats(payload){
    // The Core response may expose splits/categories or top-level categories.
    // No attempt to interpret athlete splits as team statistics.
    const groups=payload?.splits?.categories??payload?.categories??payload?.statistics?.splits?.categories??[];
    if(!Array.isArray(groups))return [];
    return groups.map((group,index)=>{
      const rows=Array.isArray(group?.stats)?group.stats:Array.isArray(group?.statistics)?group.statistics:[];
      const values=rows.map(s=>{
        const label=String(s.displayName??s.label??s.name??s.abbreviation??'').trim();
        const raw=s.displayValue??s.value;
        if(!label||raw===undefined||raw===null)return null;
        // Avoid displaying $ref stubs as though they were numeric stats.
        if(typeof raw==='object'&&!('value' in raw)&&!('displayValue' in raw))return null;
        const value=typeof raw==='object'?(raw.displayValue??raw.value):raw;
        const rank=numericStat(s.rank??s.rankDisplayValue);
        return {label:label.slice(0,64),value:String(value).slice(0,32),rank:Number.isInteger(rank)&&rank>0?rank:null,numeric:numericStat(value)};
      }).filter(Boolean);
      return {title:String(group.displayName??group.name??`Category ${index+1}`).slice(0,64),rows:values};
    }).filter(group=>group.rows.length);
  }
  async function loadTeamStatistics(team,force=false){
    if(!team)return;
    const key=teamKey(team.league,team.id,team.season),prev=teamSeasonStatsCache.get(key);
    if(prev?.loading||(!force&&prev?.at&&Date.now()-prev.at<TEAM_SEASON_CACHE_MS))return;
    const url=statsURL(team);
    if(!url)return;
    teamSeasonStatsCache.set(key,{...prev,loading:true,error:''});renderTeamPage();
    try{
      const payload=await fetchESPNJSON(url,new AbortController().signal);
      const groups=parseTeamSeasonStats(payload);
      teamSeasonStatsCache.set(key,{at:Date.now(),groups,loading:false,error:groups.length?'':'No published team statistics found.'});
    }catch(err){teamSeasonStatsCache.set(key,{at:Date.now(),groups:[],loading:false,error:'ESPN season aggregates unavailable.'});}
    if(teamMode?.league===team.league&&teamMode?.id===team.id&&teamMode?.season===team.season&&teamMode?.tab==='stats')renderTeamPage();
  }
  function scoringUnit(league){return league==='mlb'?'Runs':['nhl','mls','nwsl'].includes(league)?'Goals':'Points';}
  function teamSummaryNumbers(finished){
    const count=finished.length;
    if(!count)return null;
    const scored=finished.reduce((t,r)=>t+r.selfScore,0),allowed=finished.reduce((t,r)=>t+r.oppScore,0);
    const win=finished.filter(r=>r.selfScore>r.oppScore).length;
    return {count,scored,allowed,averageFor:scored/count,averageAgainst:allowed/count,winPct:win/count};
  }
  function seasonScoringGraphic(finished,team,mode='both'){
    if(!finished.length)return '';
    const games=finished.slice(-32),marginMode=mode==='margin';
    const max=Math.max(1,...games.map(r=>marginMode?Math.abs(r.selfScore-r.oppScore):Math.max(r.selfScore,r.oppScore)));
    const W=780,H=220,L=39,R=15,T=20,B=51,baseline=H-B;
    const n=games.length,step=(W-L-R)/Math.max(n,1),mid=T+(baseline-T)/2;
    const teamColor=graphColor(team.color||games.find(g=>g.selfColor)?.selfColor,'#8faefa');
    const opponentColor='#baaa91';
    const scale=marginMode?(baseline-T)/(2*max):(baseline-T)/max;
    const cells=games.map((g,i)=>{
      const center=L+(i+.5)*step,bw=Math.max(2,Math.min(step*.35,14)),x=center-bw-1;
      const compact=new Date(g.date).toLocaleDateString([],{month:'short',day:'numeric'});
      const week=['nfl','cfb'].includes(team.league)&&g.week?`Week ${g.week}`:`Game ${g.gameNumber}`;
      const opponent=`${g.home?'vs':'@'} ${g.opp?.name??'Opponent'}`;
      const title=`${week} · ${compact} · ${opponent} · ${team.short} ${g.selfScore} – ${g.oppScore} ${g.opp?.short??'OPP'}`;
      const rect=(pos,height,width,fill,opacity=.9)=>`<rect x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" width="${width.toFixed(1)}" height="${Math.max(1,height).toFixed(1)}" fill="${fill}" opacity="${opacity}" rx="1"/>`;
      let shapes='';
      if(marginMode){
        const diff=g.selfScore-g.oppScore,height=Math.abs(diff)*scale;
        shapes=rect({x:center-bw/2,y:diff>=0?mid-height:mid},height,bw,diff>=0?teamColor:'#e39980');
      }else{
        if(mode!=='against')shapes+=rect({x,y:baseline-g.selfScore*scale},g.selfScore*scale,mode==='both'?bw:bw*1.7,teamColor);
        if(mode!=='for')shapes+=rect({x:mode==='both'?x+bw+1:x,y:baseline-g.oppScore*scale},g.oppScore*scale,mode==='both'?bw:bw*1.7,opponentColor,.87);
      }
      const oppLogo=imageURL(g.opp?.logo);
      const crestSize=Math.max(9,Math.min(16,step-3));
      const crest=oppLogo?`<image href="${esc(oppLogo)}" x="${(center-crestSize/2).toFixed(1)}" y="${(baseline+4).toFixed(1)}" width="${crestSize.toFixed(1)}" height="${crestSize.toFixed(1)}" preserveAspectRatio="xMidYMid meet" pointer-events="none"/>`:'';
      return `<g class="team-season-bar" data-season-game-index="${i}" role="button" tabindex="0" aria-label="${esc(title)}; inspect game and click to open" style="cursor:pointer"><title>${esc(title)}</title><rect x="${(L+i*step).toFixed(1)}" y="${T}" width="${step.toFixed(1)}" height="${(baseline-T+24).toFixed(1)}" fill="transparent"/>${shapes}${crest}</g>`;
    }).join('');
    const grids=(marginMode?[-1,0,1]:[0,.5,1]).map(v=>{
      const y=marginMode?mid-v*max*scale:baseline-v*max*scale;
      return `<line x1="${L}" x2="${W-R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#444038" stroke-width="1"/><text x="${L-9}" y="${(y+4).toFixed(1)}" fill="#ada69b" font-size="11" text-anchor="end">${Math.round(v*max)}</text>`;
    }).join('');
    const labels=games.map((r,i)=>(['nfl','cfb'].includes(team.league)&&r.week?(i%Math.max(1,Math.ceil(n/11))===0||i===n-1):(i===0||i===n-1||i===Math.floor((n-1)/2)))?`<text x="${(L+(i+.5)*step).toFixed(1)}" y="${H-12}" text-anchor="middle" font-size="11" fill="#a9a395">${['nfl','cfb'].includes(team.league)&&r.week?'W'+r.week:esc(new Date(r.date).toLocaleDateString([],{month:'short',day:'numeric'}))}</text>`:'').join('');
    const select=`<label class="team-chart-select">Show <select data-team-chart-mode aria-label="Season scoring chart statistic">${[['both','Scored + allowed'],['for','Scored'],['against','Allowed'],['margin','Margin']].map(([id,label])=>`<option value="${id}"${id===mode?' selected':''}>${label}</option>`).join('')}</select></label>`;
    return `<div class="team-season-chart" id="season-scoring-chart"><div class="team-chart-heading"><h3>${scoringUnit(team.league)} by game</h3><div>${select}</div></div><div class="team-chart-key"><span class="team-chart-key-item"><i style="background:${teamColor}"></i>${esc(team.short)} scored</span><span class="team-chart-key-item"><i style="background:${opponentColor}"></i>Opponent scored</span><span class="team-chart-key-note">Opponent logos mark games; select a bar for details</span></div><div class="team-season-chart-interactive"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Game-by-game season scoring chart. Hover or focus a game for opponent, week, date and score details. Click a bar to open its original game.">${grids}${cells}${labels}</svg><div class="team-chart-tooltip" data-team-chart-tooltip role="status" hidden></div></div><p>${finished.length>32?'Last 32 of '+finished.length+' completed games':'Completed games'} · Hover, focus or tap a bar to inspect its game; select a game to open the existing scoreboard. Week labels are shown when supplied.</p></div>`;
  }
  function teamStatisticsContent(team,entry,finished){
    const key=teamKey(team.league,team.id,team.season),official=teamSeasonStatsCache.get(key);
    const n=teamSummaryNumbers(finished);
    const numbers=n?`<div class="team-derived-grid"><button type="button" data-season-summary="for" aria-label="Show per-game scoring chart"><span>${scoringUnit(team.league)} for / game</span><strong>${n.averageFor.toFixed(1)}</strong></button><button type="button" data-season-summary="against" aria-label="Show per-game scores allowed chart"><span>${scoringUnit(team.league)} against / game</span><strong>${n.averageAgainst.toFixed(1)}</strong></button><button type="button" data-season-summary="margin" aria-label="Show per-game scoring margin chart"><span>Scoring differential / game</span><strong>${(n.averageFor-n.averageAgainst)>0?'+':''}${(n.averageFor-n.averageAgainst).toFixed(1)}</strong></button><div><span>Win percentage</span><strong>${(n.winPct*100).toFixed(1)}%</strong></div></div>`:'';
    const groups=official?.groups??[];
    const aggregates=groups.length?`<div class="team-official-sections">${groups.map((g,i)=>`<details class="team-stat-group" ${i===0?'open':''}><summary>${esc(g.title)} <span>${g.rows.length} metrics</span></summary><div class="team-stat-grid">${g.rows.map(s=>`<div class="team-stat-tile"><span>${esc(s.label)}</span><strong>${esc(s.value)}</strong>${s.rank?`<small>League rank: ${s.rank}</small>`:''}</div>`).join('')}</div></details>`).join('')}</div>`:'';
    return `<div class="team-section-heading"><h2>Season statistics</h2><span>${esc(String(team.season))}</span></div>
      <div class="team-stats-intro">${n?`Derived from ${n.count} completed games returned by ESPN’s season schedule. Includes postseason games if they appear in that schedule.`:'No completed games with usable final scores in the schedule.'}</div>${numbers}${n?seasonScoringGraphic(finished,team,team.chartMode??'both'):''}
      <div class="team-section-heading team-official-heading"><h2>ESPN season team statistics</h2><span>Official regular-season aggregates · where available</span></div>
      ${official?.loading?'<p class="team-state">Loading published season statistics…</p>':groups.length?aggregates:`<p class="team-state">${esc(official?.error??'Fetching season aggregates…')} ${official&&!official.loading?'<button type="button" data-team-stats-retry>Retry</button>':''}</p>`}`;
  }
