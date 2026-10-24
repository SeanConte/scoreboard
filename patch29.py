from pathlib import Path
root=Path(__file__).resolve().parents[1]
def update(name,fn):
 p=root/'src'/name; text=p.read_text();t=fn(text); assert t!=text,name;p.write_text(t)

def team_patch(s):
 s=s.replace("    if(Number.isInteger(g.seasonYear)&&g.seasonYear>=2000)return g.seasonYear;\n    const d=new Date(g.date),year=d.getUTCFullYear(),month=d.getUTCMonth()+1;", "    if(Number.isInteger(g.seasonYear)&&g.seasonYear>=2000)return g.seasonYear;\n    const d=new Date(g.date),year=d.getUTCFullYear(),month=d.getUTCMonth()+1;\n    // Bowl games and NFL playoffs in January/February belong to the prior season.\n    if(['nfl','cfb'].includes(g.league)&&month<=2)return year-1;")
 s=s.replace("      const id=String(e.id??c.id??'');", "      const id=String(e.id??c.id??'');\n      const rawWeek=e.week?.number??e.week?.week??(typeof e.week==='number'?e.week:null)??c.week?.number??c.week??null;\n      const weekNumber=Number(rawWeek);\n      const week=rawWeek!==null&&rawWeek!==''&&Number.isInteger(weekNumber)&&weekNumber>0&&weekNumber<100?weekNumber:null;")
 s=s.replace("sides,league:team.league});", "sides,league:team.league,week});")
 s=s.replace("    list.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));\n    return list;", "    list.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));\n    list.forEach((game,i)=>{game.gameNumber=i+1;});\n    return list;")
 s=s.replace("    const dayOfGame=dateInZone(row.date,zone),canNavigate", "    const weekText=['nfl','cfb'].includes(team.league)&&row.week?`Week ${row.week}`:null;\n    const dayOfGame=dateInZone(row.date,zone),canNavigate")
 s=s.replace("<span class=\"team-schedule-date\">${esc(formatted)}</span>", "<span class=\"team-schedule-date\">${esc(formatted)}${weekText?`<small>${esc(weekText)}</small>`:''}</span>")
 s=s.replace("    if(teamMode.tab==='stats')loadTeamStatistics(teamMode);", "    if(teamMode.tab==='stats')loadTeamStatistics(teamMode);")
 # Charts have a single underlying game id: clicking opens the canonical scorecard. On touch, first tap inspects.
 needle="  teamPanel.addEventListener('click',e=>{\n"
 insert="""  function teamChartTooltip(target){
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
    tooltip.innerHTML=`<strong>${esc(match)} · ${esc(date)}</strong><span>${row.home?'vs':'@'} ${esc(row.opp?.name??'Opponent')}</span><b>${esc(teamMode.short)} ${row.selfScore} – ${row.oppScore} ${esc(row.opp?.short??'OPP')} · ${outcome}</b><small>Click to view game · On touch, tap again</small><button type=\"button\" data-team-chart-open=\"${esc(row.id)}\" data-team-chart-day=\"${esc(dateInZone(row.date,zone))}\" aria-label=\"Open this game\">View game ↗</button>`;
    tooltip.hidden=false;
    teamPanel.querySelectorAll('[data-season-game-index]').forEach(el=>el.classList.toggle('is-inspected',el===element));
  }
  teamPanel.addEventListener('pointerover',event=>{
    const point=event.target.closest('[data-season-game-index]');if(point)teamChartTooltip(point);
  });
  teamPanel.addEventListener('focusin',event=>{
    const point=event.target.closest('[data-season-game-index]');if(point)teamChartTooltip(point);
  });
  teamPanel.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch'){
      const point=event.target.closest('[data-season-game-index]');if(point){
        const already=point.classList.contains('is-inspected');
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
"""
 assert needle in s;s=s.replace(needle,insert+needle)
 s=s.replace("    const row=e.target.closest('[data-team-game]');", """    const summary=e.target.closest('[data-season-summary]');if(summary&&teamMode){
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
    const row=e.target.closest('[data-team-game]');""")
 return s
update('team.js',team_patch)

def stats_patch(s):
 begin=s.index('  function seasonScoringGraphic(');end=s.index('  function teamStatisticsContent(',begin)
 s=s[:begin]+'''  function seasonScoringGraphic(finished,team,mode='both'){
    if(!finished.length)return '';
    const games=finished.slice(-32),marginMode=mode==='margin';
    const max=Math.max(1,...games.map(r=>marginMode?Math.abs(r.selfScore-r.oppScore):Math.max(r.selfScore,r.oppScore)));
    const W=780,H=204,L=39,R=15,T=20,B=40,baseline=H-B;
    const n=games.length,step=(W-L-R)/Math.max(n,1),mid=T+(baseline-T)/2;
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
        shapes=rect({x:center-bw/2,y:diff>=0?mid-height:mid},height,bw,diff>=0?'#8faefa':'#f2a56c');
      }else{
        if(mode!=='against')shapes+=rect({x,y:baseline-g.selfScore*scale},g.selfScore*scale,mode==='both'?bw:bw*1.7,'#8faefa');
        if(mode!=='for')shapes+=rect({x:mode==='both'?x+bw+1:x,y:baseline-g.oppScore*scale},g.oppScore*scale,mode==='both'?bw:bw*1.7,'#f2a56c',.87);
      }
      return `<g class="team-season-bar" data-season-game-index="${i}" role="button" tabindex="0" aria-label="${esc(title)}; inspect game and click to open" style="cursor:pointer"><title>${esc(title)}</title><rect x="${(L+i*step).toFixed(1)}" y="${T}" width="${step.toFixed(1)}" height="${(baseline-T).toFixed(1)}" fill="transparent"/>${shapes}</g>`;
    }).join('');
    const grids=(marginMode?[-1,0,1]:[0,.5,1]).map(v=>{
      const y=marginMode?mid-v*max*scale:baseline-v*max*scale;
      return `<line x1="${L}" x2="${W-R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#444038" stroke-width="1"/><text x="${L-9}" y="${(y+4).toFixed(1)}" fill="#ada69b" font-size="11" text-anchor="end">${Math.round(v*max)}</text>`;
    }).join('');
    const labels=games.map((r,i)=>i===0||i===games.length-1||i===Math.floor((games.length-1)/2)?`<text x="${(L+(i+.5)*step).toFixed(1)}" y="${H-13}" text-anchor="middle" font-size="11" fill="#a9a395">${['nfl','cfb'].includes(team.league)&&r.week?'W'+r.week:esc(new Date(r.date).toLocaleDateString([],{month:'short',day:'numeric'}))}</text>`:'').join('');
    const select=`<label class="team-chart-select">Show <select data-team-chart-mode aria-label="Season scoring chart statistic">${[['both','Scored + allowed'],['for','Scored'],['against','Allowed'],['margin','Margin']].map(([id,label])=>`<option value="${id}"${id===mode?' selected':''}>${label}</option>`).join('')}</select></label>`;
    return `<div class="team-season-chart" id="season-scoring-chart"><div class="team-chart-heading"><h3>${scoringUnit(team.league)} by game</h3><div>${select}</div></div><div class="team-season-chart-interactive"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Game-by-game season scoring chart. Hover or focus a game for opponent, week, date and score details. Click a bar to open its original game.">${grids}${cells}${labels}</svg><div class="team-chart-tooltip" data-team-chart-tooltip role="status" hidden></div></div><p>${finished.length>32?'Last 32 of '+finished.length+' completed games':'Completed games'} · Hover, focus or tap a bar to inspect its game; select a game to open the existing scoreboard. Week labels are shown when supplied.</p></div>`;
  }
''' +s[end:]
 # derived metrics interactive, let users choose chart mode
 s=s.replace('const numbers=n?`<div class="team-derived-grid"><div><span>${scoringUnit(team.league)} for / game</span><strong>${n.averageFor.toFixed(1)}</strong></div><div><span>${scoringUnit(team.league)} against / game</span><strong>${n.averageAgainst.toFixed(1)}</strong></div><div><span>${scoringUnit(team.league).slice(0,-1)} differential / game</span><strong>${(n.averageFor-n.averageAgainst)>0?\'+\':\'\'}${(n.averageFor-n.averageAgainst).toFixed(1)}</strong></div><div><span>Win percentage</span><strong>${(n.winPct*100).toFixed(1)}%</strong></div></div>`:', '''const numbers=n?`<div class="team-derived-grid"><button type="button" data-season-summary="for" aria-label="Show per-game scoring chart"><span>${scoringUnit(team.league)} for / game</span><strong>${n.averageFor.toFixed(1)}</strong></button><button type="button" data-season-summary="against" aria-label="Show per-game scores allowed chart"><span>${scoringUnit(team.league)} against / game</span><strong>${n.averageAgainst.toFixed(1)}</strong></button><button type="button" data-season-summary="margin" aria-label="Show per-game scoring margin chart"><span>Scoring differential / game</span><strong>${(n.averageFor-n.averageAgainst)>0?'+':''}${(n.averageFor-n.averageAgainst).toFixed(1)}</strong></button><div><span>Win percentage</span><strong>${(n.winPct*100).toFixed(1)}%</strong></div></div>`:''')
 s=s.replace('seasonScoringGraphic(finished,team)',"seasonScoringGraphic(finished,team,team.chartMode??'both')")
 return s
update('team-stats.js',stats_patch)

# Teams: reusable stat-row -> graph mapping with verified metric availability.
def ui_patch(s):
 marker='  function statsSection(g,data,inMonitor=false){'
 fn='''  // Link statistics to graph histories only if both labels have exactly the
  // same meaning. Percentages/composite box-score fields are NOT time series.
  const statToGraph={
    nba:{rebounds:'rebounds',totalrebounds:'rebounds',assists:'assists',turnovers:'turnovers',threepointfieldgoalsmade:'threesMade',threepointfieldgoalsattempted:'threesAttempted',fieldgoalsmade:'fgMade',fieldgoalsattempted:'fgAttempted',freethrowsmade:'ftMade',freethrowsattempted:'ftAttempted'},
    wnba:{rebounds:'rebounds',totalrebounds:'rebounds',assists:'assists',turnovers:'turnovers',threepointfieldgoalsmade:'threesMade',threepointfieldgoalsattempted:'threesAttempted',fieldgoalsmade:'fgMade',fieldgoalsattempted:'fgAttempted',freethrowsmade:'ftMade',freethrowsattempted:'ftAttempted'},
    nfl:{totalyards:'totalYards',rushingyards:'rushYards',passingyards:'passYards',rushingattempts:'rushAttempts',firstdowns:'firstDowns'},
    cfb:{totalyards:'totalYards',rushingyards:'rushYards',passingyards:'passYards',rushingattempts:'rushAttempts',firstdowns:'firstDowns'},
    mlb:{hits:'hits',walks:'walks',baseonballs:'walks',homeruns:'homeRuns'},
    nhl:{shotsongoal:'shotsOnGoal',hits:'hits',faceoffswon:'faceoffsWon'},
    mls:{shots:'shots',totalshots:'shots',shotsontarget:'shotsOnTarget',corners:'corners',cornerkicks:'corners',yellowcards:'yellowCards'},
    nwsl:{shots:'shots',totalshots:'shots',shotsontarget:'shotsOnTarget',corners:'corners',cornerkicks:'corners',yellowcards:'yellowCards'}
  };
  function linkedStatMetric(g,stat,data,options){
    const normalized=String(stat?.key??'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const metric=statToGraph[g.league]?.[normalized];
    return metric&&options.some(([key])=>key===metric)?metric:null;
  }
'''
 assert marker in s;s=s.replace(marker,fn+marker)
 s=s.replace('    const box=parseBox(g,data),colors=teamColors(g,data),rows=statsForDisplay(g,box,inMonitor);','    const box=parseBox(g,data),colors=teamColors(g,data),rows=statsForDisplay(g,box,inMonitor);\n    const chartOptions=availableGraphMetrics(g,data);')
 old='''      return `<div class="stat-match"><div class="stat-match-values"><strong>${esc(a.display)}</strong><span>${esc(label)}</span><strong>${esc(b.display)}</strong></div>${comparable?`<div class="stat-match-bars"><div><span style="width:${left}%;background:${colors[0]}"></span></div><div><span style="width:${right}%;background:${colors[1]}"></span></div></div>`:''}</div>`;'''
 new='''      const metric=linkedStatMetric(g,{key:rows.find(r=>r.a===a&&r.b===b)?.key},data,chartOptions);
      const tag=metric?'button':'div';
      return `<${tag} ${metric?`type="button" data-stat-metric="${esc(metric)}" data-stat-game="${esc(g.id)}" title="Show ${esc(label)} over game time" aria-label="Show ${esc(label)} over game time"`:''} class="stat-match${metric?' stat-match-linked':''}${metric&&preferences(g.id).metric===metric?' is-active':''}"><div class="stat-match-values"><strong>${esc(a.display)}</strong><span>${esc(label)}${metric?' <span aria-hidden="true">↗</span>':''}</span><strong>${esc(b.display)}</strong></div>${comparable?`<div class="stat-match-bars"><div><span style="width:${left}%;background:${colors[0]}"></span></div><div><span style="width:${right}%;background:${colors[1]}"></span></div></div>`:''}</${tag}>`;'''
 assert old in s;s=s.replace(old,new)
 # avoid O(n2) but works. Change destructuring if needed; current short rows 5-20.
 marker2="  $('scores-panel').addEventListener('change',onMetricChange);"
 listener='''  function statToChartClick(event){
    const button=event.target.closest('[data-stat-metric][data-stat-game]');if(!button)return;
    const id=button.dataset.statGame,game=findGame(id),metric=button.dataset.statMetric;
    if(!game||!availableGraphMetrics(game,getSummary(game)?.data).some(([m])=>m===metric))return;
    preferences(id).metric=metric;
    if(metric!=='score')preferences(id).playerId='';
    const inMonitor=monitorDialog.contains(button);
    if(inMonitor)renderMonitor();else paintExpanded(id);
    const chart=(inMonitor?monitorDialog:$('scores-panel')).querySelector('.chart-panel');
    chart?.scrollIntoView({block:'nearest',behavior:'auto'});
    chart?.querySelector('[data-chart-metric]')?.focus({preventScroll:true});
  }
  $('scores-panel').addEventListener('click',statToChartClick);
  monitorDialog.addEventListener('click',statToChartClick);
'''
 assert marker2 in s;s=s.replace(marker2,listener+marker2)
 return s
update('ui.js',ui_patch)

def css_patch(s):
 s+='''
/* 0.29 – discoverable, semantically linked statistics */
button.stat-match{appearance:none;display:block;width:100%;border:1px solid transparent;background:transparent;color:inherit;text-align:inherit;font:inherit;padding:2px 4px;border-radius:5px;cursor:pointer}
button.stat-match:hover,button.stat-match:focus-visible{background:#302e28;border-color:#857151;outline-offset:2px}
button.stat-match.is-active{background:#302b20;border-color:#a9844d}
button.stat-match .stat-match-values>span>span{color:#e1be82;font-size:11px}
.team-derived-grid>button{appearance:none;text-align:left;font:inherit;color:inherit;cursor:pointer}
.team-derived-grid>button:hover,.team-derived-grid>button:focus-visible{border-color:#d6ad70;background:#2c291f;outline-offset:3px}
.team-schedule-date small{display:block;color:#d9b474;font:10px/1.45 Arial,sans-serif;padding-top:3px}
.team-chart-select{display:flex;gap:7px;align-items:center;color:#bab2a7;font:12px Arial,sans-serif}
.team-chart-select select{border:1px solid #605343;background:#2d2a23;color:#f1e6d4;border-radius:6px;padding:6px 8px;max-width:175px}
.team-season-chart-interactive{position:relative}
.team-season-bar:focus-visible{outline:none;filter:brightness(1.5)}
.team-season-bar:hover rect:not([fill="transparent"]),.team-season-bar.is-inspected rect:not([fill="transparent"]){stroke:#f4ce8d;stroke-width:1.6}
.team-chart-tooltip{position:relative;z-index:1;margin:8px 0 0;background:#302b22;border:1px solid #7d6643;border-radius:7px;padding:9px 12px;display:flex;gap:5px 15px;align-items:center;flex-wrap:wrap;color:#e9e2d3;font:12px/1.4 Arial,sans-serif}
.team-chart-tooltip[hidden]{display:none}
.team-chart-tooltip strong{color:#f3d1a2}.team-chart-tooltip b{color:#f0e8dc}
.team-chart-tooltip small{color:#b9af9e}
.team-chart-tooltip button{background:#3b3325;color:#f6d18c;border:1px solid #826943;border-radius:5px;cursor:pointer;padding:5px 9px;margin-left:auto}
@media(max-width:650px){.team-chart-tooltip{gap:5px 9px}.team-chart-tooltip small{display:none}}
'''
 return s
update('styles.css',css_patch)
print('patched source')
