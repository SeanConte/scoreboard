  function parseBox(g,data){
    const box=data?.boxscore??{},teamRows=Array.isArray(box.teams)?box.teams:[];
    const findSide=team=>{
      const abbreviation=String(team?.abbreviation??'').toUpperCase();
      const byAbbr=g.sides.findIndex(s=>s.short.toUpperCase()===abbreviation);
      if(byAbbr>=0)return byAbbr;
      const byName=g.sides.findIndex(s=>s.name===team?.displayName);
      return byName>=0?byName:-1;
    };
    const teamStats=[new Map(),new Map()];
    for(const item of teamRows){
      const idx=findSide(item.team);
      if(idx<0)continue;
      for(const stat of item.statistics??[]){
        const key=String(stat.name??stat.abbreviation??stat.label??'').trim();
        const numeric=metricNumber(stat.displayValue??stat.value);
        if(!key||stat.displayValue==null&&stat.value==null||String(stat.displayValue??stat.value).trim()==='')continue;
        teamStats[idx].set(key,{name:shortText(stat.label??stat.displayName??key,34),display:shortText(stat.displayValue??stat.value,20),value:numeric});
      }
    }
    const teamKeys=[...teamStats[0].keys()].filter(k=>teamStats[1].has(k));
    const players=[];
    for(const group of Array.isArray(box.players)?box.players:[]){
      const idx=findSide(group.team);
      if(idx<0)continue;
      for(const category of group.statistics??[]){
        const labels=category.labels??category.names??[];
        const names=category.names??category.labels??[];
        for(const row of category.athletes??[]){
          const athlete=row.athlete??{},name=athlete.displayName??row.displayName;
          if(!name||row.didNotPlay)continue;
          let player=players.find(p=>p.team===idx&&p.name===name);
          if(!player){const raw=athlete.headshot?.href??athlete.headshot??'';const headshot=typeof raw==='string'&&/^https:\/\//i.test(raw)?raw:'';player={id:String(athlete.id??name),name:shortText(name,60),team:idx,stats:[],headshot};players.push(player);}
          for(let k=0;k<(row.stats??[]).length;k++){
            const v=row.stats[k];if(v===undefined||v===null||String(v).trim()==='')continue;
            const abbreviation=shortText(labels[k]??names[k]??`Stat ${k+1}`,16);
            const groupName=String(category.name??category.displayName??'');
            if(!player.stats.some(s=>s.code===abbreviation&&s.group===groupName))player.stats.push({code:abbreviation,group:groupName,label:shortText(names[k]??abbreviation,26),value:shortText(v,24)});
          }
        }
      }
    }
    return {teamStats,teamKeys,players};
  }
  const opts=(items,selected)=>items.map(([value,label])=>`<option value="${esc(value)}"${value===selected?' selected':''}>${esc(label)}</option>`).join('');
  // ESPN supplies team colors in many leagues; brighten dark colors just enough
  // to keep both lines readable against the graphite chart background.
  function validHex(raw){const s=String(raw??'').trim().replace(/^#/,'');return /^[0-9a-f]{6}$/i.test(s)?s.toLowerCase():'';}
  function graphColor(raw,fallback){
    const hex=validHex(raw);if(!hex)return fallback;
    let rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
    const luminance=c=>{const values=c.map(v=>{const u=v/255;return u<=.04045?u/12.92:((u+.055)/1.055)**2.4;});return .2126*values[0]+.7152*values[1]+.0722*values[2];};
    for(let i=0;i<20&&(luminance(rgb)+.05)/(.015+.05)<3.7;i++)rgb=rgb.map(v=>Math.round(v*.84+255*.16));
    return '#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join('');
  }
  function teamColors(g,data){
    const teams=data?.header?.competitions?.[0]?.competitors??[];
    const found=g.sides.map((side,i)=>teams.find(x=>x.homeAway===(i===0?'away':'home'))?.team??teams.find(x=>x.team?.abbreviation===side.short)?.team??{});
    const sources=g.sides.map((side,i)=>({color:side.color||found[i].color,alternate:side.alternateColor||found[i].alternateColor}));
    const result=sources.map((s,i)=>graphColor(s.color,i===0?'#8dabff':'#f6bd6c'));
    const distance=(a,b)=>{const x=a.match(/\w\w/g)?.map(v=>parseInt(v,16))??[],y=b.match(/\w\w/g)?.map(v=>parseInt(v,16))??[];return x.reduce((sum,v,i)=>sum+Math.abs(v-y[i]),0);};
    if(distance(result[0].replace('#',''),result[1].replace('#',''))<95){
      const alternative=graphColor(sources[1].alternate,'#f6bd6c');
      result[1]=distance(result[0].replace('#',''),alternative.replace('#',''))>90?alternative:'#f6bd6c';
    }
    return result;
  }
  // Verify per-player events against actual play records. Never distribute
  // final box totals across periods or infer a scorer from team totals.
  function playerScoringTimeline(g,data,metric='score'){
    if(!data||g.tennis||!['score','shotsOnGoal','shots','hits','homeRuns'].includes(metric))return [];
    const compatible=metric==='score'&&['nba','wnba','nfl','cfb','nhl','mls','nwsl'].includes(g.league)||
      metric==='shotsOnGoal'&&g.league==='nhl'||metric==='shots'&&['mls','nwsl'].includes(g.league)||
      ['hits','homeRuns'].includes(metric)&&g.league==='mlb';
    if(!compatible)return [];
    const series=metric==='score'?chartSeries(g,data):cachedMetricHistory(g,data,metric);
    if(!series||series.quality!=='plays')return [];
    const roster=parseBox(g,data).players;
    if(!roster.length)return [];
    const samples=g.league==='nfl'||g.league==='cfb'?eventSamples(g,data).map(row=>row.play):
      [data.progressionPlays,data.plays,data.scoringPlays,data.keyEvents,data.playByPlay?.plays].filter(Array.isArray).flat();
    if(!samples.length)return [];
    const canonical=t=>String(t??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
    const seen=new Set(),eventsById=new Map(),inningSequence=new Map();
    for(const play of samples){
      if(!play)continue;
      const text=String(play.text??play.shortText??'').trim(),kind=actionText(play);
      const key=String(play.id??'')||[text,playPeriod(play),play.clock?.displayValue].join('|');
      if(key&&seen.has(key))continue;
      if(key)seen.add(key);
      const axis=eventAxis(g,play);
      // ESPN baseball play.team can refer to the pitcher: the inning half,
      // not that team pointer, determines which side is batting.
      const side=g.league==='mlb'?(axis?.half==='top'?0:axis?.half==='bottom'?1:-1):eventTeamIndex(g,data,play,null);
      if(side<0)continue;
      let quantity=1;
      if(metric==='score'){
        if(['nba','wnba'].includes(g.league)){
          quantity=metricNumber(play.scoreValue??play.points);
          if(!Number.isInteger(quantity)||quantity<1||quantity>4||play.scoringPlay!==true&&!/\b(?:makes|made|hits|sinks|dunks|layup|free throw)\b/i.test(text))continue;
        }else if(['nfl','cfb'].includes(g.league)){
          quantity=metricNumber(play.scoreValue??play.points);
          if(!Number.isInteger(quantity)||quantity<1||quantity>8||play.scoringPlay!==true&&!/touchdown|field goal|extra point|two.point conversion/i.test(text))continue;
          if(/safety|defensive two.point/i.test(text))continue; // no identified scoring player
        }else if(['nhl','mls','nwsl'].includes(g.league)){
          if(/own goal|disallowed|no goal|overturned/i.test(text+' '+kind))continue;
          if(play.scoringPlay!==true&&!/\bgoal\b/i.test(kind))continue;
          quantity=1;
        }
      }else{
        const deltas=eventDeltas(g,play);
        if(!deltas[metric])continue;
      }
      let x=axis?.x,period=axis?.period??playPeriod(play);
      if(['nba','wnba','nfl','cfb'].includes(g.league))x=elapsedGameMinutes(g,playPeriod(play),playClockSeconds(play));
      if(!Number.isFinite(x)||x<0)continue;
      // Require a real increase by the same team in the matching chart.
      let candidates=series.points.slice(1).map((p,i)=>({p,prev:series.points[i]}))
        .filter(({p,prev})=>((side===0?p.away-prev.away:p.home-prev.home)>0));
      if(series.basis==='inning'){
        // Baseball x coordinates represent order *within an inning half*.
        // We only claim the half-inning, never an invented exact play time.
        candidates=candidates.filter(({p})=>Math.floor(p.x)===Math.floor(x)&&Math.abs(p.x-x)<.76);
      }else candidates=candidates.filter(({p})=>Math.abs(p.x-x)<.025);
      if(!candidates.length)continue;
      const bucket=axis?.basis==='inning'?`${side}:${axis.period}:${axis.half}:${metric}`:'';
      const serial=bucket?(inningSequence.get(bucket)??0):0;
      if(bucket)inningSequence.set(bucket,serial+1);
      const matching=candidates[Math.min(serial,candidates.length-1)].p;
      const rosterSide=roster.filter(p=>p.team===side);
      const mentions=rosterSide.map(p=>{
        const full=canonical(p.name),short=full.split(' ').at(-1);
        const hay=canonical(text);
        const i=hay.indexOf(full);
        return {p,at:i>=0?i:(short&&short.length>=4?hay.search(new RegExp('\\b'+short+'\\b')):-1)};
      }).filter(row=>row.at>=0).sort((a,b)=>a.at-b.at);
      const participantIds=(Array.isArray(play.participants)?play.participants:[]).map(row=>{
        const person=row.athlete??row,ref=String(person?.$ref??'');
        return String(person?.id??ref.match(/\/athletes\/(\d+)/)?.[1]??'');
      }).filter(Boolean);
      let chosen=null;
      const first=mentions[0]?.p;
      if(['nfl','cfb'].includes(g.league)&&/\bpass(?:es|ed)? to\b/i.test(text)){
        const normalized=canonical(text),segment=normalized.split(/\bpass(?:es|ed)? to\b/)[1]?.split(/\bfor\b|\btouchdown\b|\bpass\b/)[0]??'';
        chosen=rosterSide.find(p=>segment&&canonical(p.name)===segment.trim())??null;
      }
      if(!chosen&&first)chosen=first;
      if(!chosen&&participantIds.length===1)chosen=rosterSide.find(p=>p.id===participantIds[0])??null;
      if(!chosen)continue;
      // A named football QB is not the TD recipient when an explicit second
      // receiving player is present. Omit rather than guessing the scorer.
      if(['nfl','cfb'].includes(g.league)&&/\bpass\b/i.test(text)&&mentions.length>1&&!/\bpass(?:es|ed)? to\b/i.test(text)&&!/(?:yd|yard) pass from/i.test(text))continue;
      const event={id:key,playerId:chosen.id,team:side,x:matching.x,pts:quantity,period,stamp:playLabel(play,g),name:chosen.name,text:shortText(text,160),basis:series.basis};
      const id=chosen.id;
      if(!eventsById.has(id))eventsById.set(id,[]);
      eventsById.get(id).push(event);
    }
    return roster.map(p=>{
      const events=eventsById.get(p.id)??[];
      if(!events.length)return null;
      // Validate basketball point attribution against the actual final box.
      const pointStat=p.stats.find(s=>s.code.toUpperCase()==='PTS');
      const total=pointStat?metricNumber(pointStat.value):null;
      const credited=events.reduce((sum,e)=>sum+e.pts,0);
      if(metric==='score'&&['nba','wnba'].includes(g.league)&&total!==null&&credited>total)return null;
      return {...p,events,credited,metric};
    }).filter(Boolean).sort((a,b)=>b.events.length-a.events.length||b.credited-a.credited||a.name.localeCompare(b.name));
  }
  function graphSVG(g,series,colors,player=null,interactive=false){
    const pts=series.points;
    const W=680,H=264,left=46,right=18,top=28,bottom=50,pw=W-left-right,ph=H-top-bottom;
    const allValues=pts.flatMap(p=>[p.away,p.home]);
    const maxVal=Math.max(0,...allValues),minVal=Math.min(0,...allValues);
    const pad=Math.max(1,Math.ceil((maxVal-minVal)*.10)),min=minVal<0?minVal-pad:0,max=maxVal+pad;
    const basis=series.basis,lastX=Math.max(...pts.map(p=>p.x),0);
    let hi=Math.max(1,lastX),unit='',boundaries=[],ticks=[],bands=[];
    if(basis==='clock'){
      const reg=regulationCount(g.league);
      let total=0;const count=Math.max(reg,...pts.map(p=>p.period||0));
      for(let p=1;p<=count;p++){
        const duration=periodSeconds(g,p);
        if(duration===null)break;
        const a=total/60;total+=duration;
        const b=total/60;
        bands.push({x:(a+b)/2,label:periodName(g.league,p)});
        boundaries.push(b);
        ticks.push({x:a,label:String(Math.round(a))});
      }
      hi=Math.max(total/60,lastX,1);
      ticks.push({x:hi,label:String(Math.round(hi))});
      unit='Elapsed game minutes';
    }else if(basis==='minutes'){
      hi=Math.max(90,Math.ceil(lastX/15)*15);
      ticks=Array.from({length:Math.floor(hi/15)+1},(_,i)=>({x:i*15,label:String(i*15)}));
      boundaries=[45,90,105].filter(v=>v<hi);
      unit='Match minute';
    }else if(basis==='inning'){
      hi=Math.max(9,Math.ceil(lastX));
      ticks=Array.from({length:Math.min(hi,16)},(_,i)=>({x:i+.5,label:String(i+1)}));
      boundaries=Array.from({length:Math.min(hi,16)-1},(_,i)=>i+1);
      unit='Inning';
    }else if(basis==='set'){
      hi=Math.max(pts.length-1,1);
      ticks=pts.slice(1).map((p,i)=>({x:p.x,label:`S${i+1}`}));
      unit='Set';
    }else{
      hi=Math.max(pts.length-1,1);
      ticks=pts.slice(1).map((p,i)=>({x:p.x,label:periodName(g.league,i+1)}));
      unit='Period (scoring times unavailable)';
    }
    const x=n=>left+Math.max(0,Math.min(1,n/hi))*pw;
    const y=n=>top+(max-n)/(max-min)*ph;
    const fmt=n=>String(Math.round(n*10)/10);
    const alpha=(hex,a)=>`${hex}${Math.max(0,Math.min(255,Math.round(a*255))).toString(16).padStart(2,'0')}`;
    const path=values=>values.map((v,i)=>{
      const here=`${fmt(x(pts[i].x))} ${fmt(y(v))}`;
      if(!i)return `M ${here}`;
      return series.quality==='plays'?`H ${fmt(x(pts[i].x))} V ${fmt(y(v))}`:`L ${here}`;
    }).join(' ');
    const fillBetween=()=>{
      const polygons=[];
      for(let i=1;i<pts.length;i++){
        const a=pts[i-1],b=pts[i];
        const x1=x(a.x),x2=x(b.x);
        if(!(x2>x1))continue;
        const ay1=y(a.away),hy1=y(a.home),ay2=y(b.away),hy2=y(b.home);
        if(series.quality==='plays'){
          const diff=a.away-a.home;
          if(!diff)continue;
          const leader=diff>0?0:1;
          polygons.push(`<polygon points="${fmt(x1)},${fmt(ay1)} ${fmt(x2)},${fmt(ay1)} ${fmt(x2)},${fmt(hy1)} ${fmt(x1)},${fmt(hy1)}" fill="${alpha(colors[leader],0.16)}" pointer-events="none"/>`);
          continue;
        }
        const d1=a.away-a.home,d2=b.away-b.home;
        if(!d1&&!d2)continue;
        const seg=(sx,ex,sy1,sy2,ty1,ty2,leader)=>polygons.push(`<polygon points="${fmt(sx)},${fmt(sy1)} ${fmt(ex)},${fmt(sy2)} ${fmt(ex)},${fmt(ty2)} ${fmt(sx)},${fmt(ty1)}" fill="${alpha(colors[leader],0.16)}" pointer-events="none"/>`);
        if(!d1){
          if(!d2)continue;
          seg(x1,x2,ay1,ay2,hy1,hy2,d2>0?0:1);
        }else if(!d2){
          seg(x1,x2,ay1,ay2,hy1,hy2,d1>0?0:1);
        }else if((d1>0)===(d2>0)){
          seg(x1,x2,ay1,ay2,hy1,hy2,d1>0?0:1);
        }else{
          const t=Math.max(0,Math.min(1,d1/(d1-d2)));
          const xm=x1+(x2-x1)*t;
          const ym=ay1+(ay2-ay1)*t;
          seg(x1,xm,ay1,ym,hy1,ym,d1>0?0:1);
          seg(xm,x2,ym,ay2,ym,hy2,d2>0?0:1);
        }
      }
      return polygons.join('');
    };
    const guides=[0,.25,.5,.75,1].map(v=>Math.round(min+(max-min)*v));
    const horizontal=[...new Set(guides)].map(v=>`<line x1="${left}" y1="${fmt(y(v))}" x2="${W-right}" y2="${fmt(y(v))}" stroke="#37372f" stroke-width="1"/><text x="${left-9}" y="${fmt(y(v)+4)}" text-anchor="end" fill="#a7a398" font-size="12">${esc(v)}</text>`).join('');
    const separators=boundaries.filter(p=>p>0&&p<hi).map(p=>`<line x1="${fmt(x(p))}" y1="${top}" x2="${fmt(x(p))}" y2="${H-bottom}" stroke="#414138" stroke-dasharray="3 5"/>`).join('');
    const periodLabels=bands.map(p=>`<text x="${fmt(x(p.x))}" y="17" text-anchor="middle" fill="#aaa69b" font-size="11">${esc(p.label)}</text>`).join('');
    const axisTicks=ticks.map(t=>`<text x="${fmt(x(t.x))}" y="${H-24}" text-anchor="middle" fill="#aaa69b" font-size="11">${esc(t.label)}</text>`).join('');
    const axisName=`<text x="${fmt((left+W-right)/2)}" y="${H-5}" text-anchor="middle" fill="#9f9b91" font-size="11">${esc(unit)}</text>`;
    const shading=fillBetween();
    const lines=`<path d="${path(pts.map(p=>p.away))}" stroke="${colors[0]}" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="${path(pts.map(p=>p.home))}" stroke="${colors[1]}" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
    const playerDots=player&&series.quality==='plays'&&['clock','minutes','inning'].includes(series.basis)?player.events.map(event=>{
      const side=event.team;
      // A point must exist in this actual scoring timeline near the official
      // play time. Do not interpolate hypothetical individual contributions.
      const candidates=pts.slice(1).map((p,i)=>({p,prev:pts[i]}))
        .filter(({p,prev})=>Math.abs(p.x-event.x)<.02&&(side===0?p.away!==prev.away:p.home!==prev.home));
      if(!candidates.length)return '';
      const point=candidates.at(-1).p;
      const yy=side===0?point.away:point.home;
      return `<circle class="player-score-point" cx="${fmt(x(point.x))}" cy="${fmt(y(yy))}" r="6" fill="none" stroke="#fff1c5" stroke-width="2.4" pointer-events="none"><title>${esc(player.name)} · +${event.pts} · ${esc(event.stamp)}</title></circle>`;
    }).join(''):'';
    const radius=g.league==='nba'||g.league==='wnba'?1.65:3.3;
    const dots=pts.slice(1).map((p,i)=>{
      const xx=x(p.x),ys=[y(p.away),y(p.home)];
      const previous=pts[i];
      const scored=[p.away!==previous.away,p.home!==previous.home];
      const scoredSides=scored.flatMap((yes,side)=>yes?[side]:[]);
      if(!scoredSides.length)return '';
      const activeYs=scoredSides.map(side=>ys[side]);
      const markers=scoredSides.map(side=>`<circle cx="${fmt(xx)}" cy="${fmt(ys[side])}" r="${radius}" fill="${colors[side]}" stroke="#20201e" stroke-width="${radius<2?.65:1.15}" pointer-events="none"/>`).join('');
      const changedNames=scoredSides.map(side=>g.sides[side].short).join(' and ');
      return `${markers}<rect class="chart-hotspot" x="${fmt(xx-7)}" y="${fmt(Math.min(...activeYs)-9)}" width="14" height="${fmt(Math.max(...activeYs)-Math.min(...activeYs)+18)}" fill="transparent" data-point="${i+1}" tabindex="0" role="button" aria-label="${esc(p.label)}: ${esc(changedNames)} updated; ${esc(g.sides[0].short)} ${p.away}, ${esc(g.sides[1].short)} ${p.home}"/>`;
    }).join('');
    const hover=interactive?`<rect class="chart-hover-surface" x="${left}" y="${top}" width="${pw}" height="${ph}" fill="transparent"/><line class="chart-cursor-line" x1="${left}" x2="${left}" y1="${top}" y2="${H-bottom}" stroke="#f0c06d" stroke-dasharray="4 5" stroke-width="1.15" visibility="hidden" pointer-events="none"/><circle class="chart-cursor-away" cx="${left}" cy="${top}" r="5" stroke="#f4e5ca" stroke-width="1.3" fill="${colors[0]}" visibility="hidden" pointer-events="none"/><circle class="chart-cursor-home" cx="${left}" cy="${top}" r="5" stroke="#f4e5ca" stroke-width="1.3" fill="${colors[1]}" visibility="hidden" pointer-events="none"/>`:'';
    return `<svg class="margin-svg${interactive?' monitor-interactive-chart':''}" ${interactive?`data-chart-game="${esc(g.id)}" data-chart-hi="${hi}" data-chart-left="${left}" data-chart-width="${pw}" data-chart-top="${top}" data-chart-height="${ph}" data-chart-ymin="${min}" data-chart-ymax="${max}" tabindex="0"`:''} viewBox="0 0 ${W} ${H}" role="group" aria-label="Both teams’ cumulative totals plotted by ${esc(unit.toLowerCase())}"><g>${horizontal}${separators}${periodLabels}${shading}${lines}${dots}${playerDots}${axisTicks}${axisName}${hover}</g></svg>`;
  }
  function chartEventForPoint(g,data,p){
    // Do not claim an event if its official running score and clock do not
    // coincide with the plotted event. Period-only charts remain unlabeled.
    const samples=[data?.progressionPlays,data?.plays,data?.scoringPlays].filter(Array.isArray).flat();
    const matches=samples.filter(play=>{
      const a=metricNumber(play.awayScore??play.score?.awayScore),b=metricNumber(play.homeScore??play.score?.homeScore);
      if(a===null||b===null||a!==p.away||b!==p.home)return false;
      if(p.period&&playPeriod(play)!==p.period)return false;
      if(Number.isFinite(p.clock)&&Math.abs(playClockSeconds(play)-p.clock)>2)return false;
      return true;
    });
    return shortText((matches.find(play=>play.scoringPlay===true)?.text??matches[0]?.text??matches[0]?.shortText??''),160);
  }
  const chartCursorCache=new WeakMap();
  function chartCursorAt(svg, targetX, pin=false){
    const id=svg.dataset.chartGame,g=findGame(id);
    if(!g)return;
    let cache=chartCursorCache.get(svg);
    if(!cache){const data=getSummary(g)?.data,{series,metric}=selectedChartSeries(g,data);
      cache={data,series,metric,players:playerScoringTimeline(g,data,metric)};chartCursorCache.set(svg,cache);}
    const {data,series,metric}=cache;
    if(!series?.points?.length)return;
    const points=series.points,hi=Number(svg.dataset.chartHi),left=Number(svg.dataset.chartLeft),pw=Number(svg.dataset.chartWidth),top=Number(svg.dataset.chartTop),ph=Number(svg.dataset.chartHeight);
    const lo=Number(svg.dataset.chartYmin),high=Number(svg.dataset.chartYmax);
    const x=Math.max(0,Math.min(hi,targetX));
    // Discrete axes (periods, innings and sets) must snap to actual points.
    const discrete=!['clock','minutes'].includes(series.basis);
    const closest=points.reduce((best,p)=>Math.abs(p.x-x)<Math.abs(best.x-x)?p:best,points[0]);
    const near=closest&&Math.abs(closest.x-x)<=Math.max(.015,hi*5/pw);
    const effective=(discrete||(near&&series.quality==='plays'))?closest.x:x;
    const point=points.reduce((last,p)=>p.x<=effective+1e-7?p:last,points[0]);
    const px=left+effective/hi*pw,ordinate=n=>top+(high-n)/(high-lo)*ph;
    const line=svg.querySelector('.chart-cursor-line'),away=svg.querySelector('.chart-cursor-away'),home=svg.querySelector('.chart-cursor-home');
    for(const shape of [line,away,home]){if(shape)shape.setAttribute('visibility','visible');}
    line?.setAttribute('x1',String(px));line?.setAttribute('x2',String(px));
    away?.setAttribute('cx',String(px));away?.setAttribute('cy',String(ordinate(point.away)));
    home?.setAttribute('cx',String(px));home?.setAttribute('cy',String(ordinate(point.home)));
    const tooltip=svg.closest('.monitor-chart-wrap')?.querySelector('[data-chart-tooltip]');
    if(!tooltip)return;
    let stamp='';
    if(series.basis==='clock'){
      let prior=0,period=1,seconds=0;
      while(period<12){const length=periodSeconds(g,period);if(length===null||effective*60<prior+length||period===11){seconds=length===null?0:Math.max(0,length-(effective*60-prior));break;}prior+=length;period++;}
      stamp=periodName(g.league,period)+' · '+Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0')+' left · '+effective.toFixed(1)+' elapsed min';
    }else if(series.basis==='minutes')stamp='Match minute '+effective.toFixed(1);
    else stamp=near?closest.label:point.label;
    // Events only when near a real plotted event, never at an arbitrary point.
    const isPlay=near&&series.quality==='plays'&&closest.x>0&&metric==='score';
    const event=isPlay?chartEventForPoint(g,data,closest):'';
    const selectedId=preferences(g.id).playerId;
    const selected=cache.players.find(p=>p.id===selectedId);
    const selectedEvent=near?selected?.events.find(p=>Math.abs(p.x-closest.x)<.02):null;
    tooltip.hidden=false;
    tooltip.innerHTML=`<div class="chart-hover-time">${esc(stamp)}</div><div class="chart-hover-score"><span>${esc(g.sides[0].short)} <b>${esc(point.away)}</b></span><span>–</span><span><b>${esc(point.home)}</b> ${esc(g.sides[1].short)}</span></div>${event?`<div class="chart-hover-event">${esc(event)}</div>`:selectedEvent?`<div class="chart-hover-event">${esc(selectedEvent.text||selectedEvent.name+' scored '+selectedEvent.pts)}</div>`:''}`;
    const rel=(px-left)/pw;
    tooltip.style.left=`${Math.max(14,Math.min(80,rel*100))}%`;
    tooltip.classList.toggle('chart-hover-right',rel>.58);
    if(pin){svg.dataset.chartPinned='true';svg.dataset.chartPinnedX=String(effective);preferences(g.id).chartPinX=effective;}
  }
  function chartPointerPosition(event,svg){
    const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
    const matrix=svg.getScreenCTM();return matrix?p.matrixTransform(matrix.inverse()).x:null;
  }
  function moveChartCursor(event){
    const svg=event.target.closest?.('.monitor-interactive-chart');if(!svg)return;
    if(svg.dataset.chartPinned==='true'&&event.type==='pointermove')return;
    const px=chartPointerPosition(event,svg);if(px===null)return;
    const x=(px-Number(svg.dataset.chartLeft))/Number(svg.dataset.chartWidth)*Number(svg.dataset.chartHi);
    chartCursorAt(svg,x,event.type==='pointerdown');
  }
  function signedArea(g,series){
    if(!series||series.quality!=='plays'||!['clock','minutes'].includes(series.basis))return null;
    const p=series.points;
    if(p.length<2)return null;
    let end=p.at(-1).x;
    if(series.basis==='clock'){
      if(g.state==='post'){
        const maxPeriod=Math.max(regulationCount(g.league),...p.map(t=>t.period||0));
        let total=0;
        for(let period=1;period<=maxPeriod;period++){
          const length=periodSeconds(g,period);
          if(length===null)return null;
          total+=length;
        }
        end=Math.max(end,total/60);
      }else if(g.state==='in'&&g.timeBasis==='regulation'&&Number.isFinite(g.remainingSeconds)){
        let total=0;
        for(let k=1;k<=regulationCount(g.league);k++)total+=periodSeconds(g,k)??0;
        end=Math.max(end,(total-g.remainingSeconds)/60);
      }
    }
    // Soccer is an elapsed match clock. For a finished 90-minute match,
    // the last recorded event is not the end of the match: carry the final
    // difference through regulation. Extend to 120 only if events establish ET.
    if(series.basis==='minutes'&&g.state==='post')
      end=Math.max(end,p.some(q=>q.x>105)?120:90);
    let integral=0;
    for(let i=1;i<p.length;i++){
      const delta=Math.max(0,p[i].x-p[i-1].x);
      integral+=(p[i-1].away-p[i-1].home)*delta;
    }
    integral+=(p.at(-1).away-p.at(-1).home)*Math.max(0,end-p.at(-1).x);
    return {value:integral,span:end};
  }
  function graphSection(g,data,inMonitor=false){
    const {options,metric,series}=selectedChartSeries(g,data),colors=teamColors(g,data);
    const players=inMonitor?playerScoringTimeline(g,data,metric):[];
    const prefs=preferences(g.id);
    // Team scoring is the default; player highlights are explicitly opt-in.
    const selectedPlayerId=prefs.playerId??'';
    const selectedPlayer=players.find(p=>p.id===selectedPlayerId)??null;
    // Keep metric and player choices as two modest, adjacent controls.
    // Some ESPN summaries have no identifiable scorer; display a disabled
    // selector instead of putting a large error panel above the figure.
    const canPickPlayer=inMonitor&&!g.tennis&&['nba','wnba','nfl','cfb','nhl','mls','nwsl','mlb'].includes(g.league);
    const playerImage=selectedPlayer?.headshot;
    const playerPicker=canPickPlayer?`<label class="monitor-player-picker"><select data-monitor-player="${esc(g.id)}" aria-label="Player scoring overlay" ${players.length?'':'disabled title="No attributable player scoring events in this game"'}><option value="" ${selectedPlayerId===''?'selected':''}>${players.length?'Player: None':'Player: Unavailable'}</option>${players.map(p=>`<option value="${esc(p.id)}" ${selectedPlayerId===p.id?'selected':''}>${esc(p.name)} (${esc(g.sides[p.team].short)})</option>`).join('')}</select></label>${playerImage?`<img class="monitor-player-avatar" src="${esc(playerImage)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`:''}`:'';
    const selectedLabel=options.find(([id])=>id===metric)?.[1]??'Score';
    const subtitle=metric==='score'?(series?.quality==='plays'?{clock:'Scoring plays · elapsed game time',minutes:'Goals · match minute',inning:'Runs · by half-inning'}[series.basis]??'Scoring plays':g.tennis?'Cumulative games by set':g.league==='mlb'?'Inning totals':'Period totals'):
      series?.basis==='clock'?'Running totals · elapsed game minutes':series?.basis==='minutes'?'Running totals · match minute':series?.basis==='inning'?'Running totals · inning / batting half':'Running totals · by set';
    const selector=(options.length>1||inMonitor)?`<label class="chart-heading"><span class="sr-only">Graph statistic</span><select class="chart-metric-select" aria-label="Graph statistic" data-chart-metric="${esc(g.id)}">${opts(options,metric)}</select></label>`:`<h3>Scoring progression</h3>`;
    const legend=`<div class="chart-legend" aria-label="Team colors">${g.sides.slice(0,2).map((side,i)=>`<span><i style="background:${colors[i]}"></i>${esc(side.short)}</span>`).join('')}</div>`;
    if(!series)return `<section class="detail-panel chart-panel"><div class="detail-panel-head"><div class="chart-heading-group"><div class="monitor-chart-controls">${selector}${playerPicker}</div><p>${esc(subtitle)}</p></div>${legend}</div><div class="detail-empty">${g.state==='pre'?'The game has not started.':'A scoring timeline isn’t available for this game.'}</div></section>`;
    const last=series.points.at(-1);
    const footnote=metric!=='score'?`${series.coverage==='set-score'?'Derived from reported set scores.':'Cumulative event totals.'} Dots mark changes in this statistic.${series.coverage==='reconciled'?' Verified against final team totals.':series.coverage==='event-based'?' Live event timeline may still be incomplete.':''}${series.basis==='inning'?' Positions within each half-inning are event order, not clock time.':''}`:series.quality==='plays'?{clock:'Each point uses the recorded game clock; spacing reflects elapsed game minutes.',minutes:'Goal events positioned by elapsed match minute, including added time.',inning:'Scoring events positioned within their recorded inning halves; spacing within a half-inning is ordinal, not clock time.'}[series.basis]:g.tennis?'Games won cumulatively by set; not point-by-point scoring.':g.league==='mlb'?'Inning-end scores; exact scoring moments are unavailable.':'Period totals only (including any live partial period); exact scoring times are unavailable.';
    const missingMetrics=data&&g.state!=='pre'&&options.length===1&&(progressionOptions[g.league]?.length??0)>0;
    const area=signedArea(g,series);
    const signed=area&&area.span>0?`<div class="area-difference" title="Signed difference of the integrals of the two running totals over elapsed game time; positive values favor ${esc(g.sides[0].short)}. Leads by one team cancel leads by the other."><span>Signed area (∫Δ)</span><strong style="color:${colors[area.value>=0?0:1]}">${esc(Math.abs(area.value).toLocaleString(undefined,{maximumFractionDigits:1}))} ${esc(metric==='score'?(g.league==='nhl'||g.league==='mls'||g.league==='nwsl'?'goal·min':'pt·min'):['rushYards','passYards','totalYards'].includes(metric)?'yd·min':'count·min')}</strong><span>${esc(Math.abs(area.value)<.0001?'Even':g.sides[area.value>0?0:1].short+' advantage')}</span></div>`:'';
    return `<section class="detail-panel chart-panel"><div class="detail-panel-head"><div class="chart-heading-group"><div class="monitor-chart-controls">${selector}${playerPicker}</div><p>${esc(metric==='score'?subtitle:selectedLabel+' · '+subtitle)}</p></div>${legend}</div><div class="chart-wrap${inMonitor?' monitor-chart-wrap':''}">${graphSVG(g,series,colors,selectedPlayer,inMonitor)}${inMonitor?'<div class="chart-hover-tooltip" data-chart-tooltip role="status" hidden></div>':''}</div><div class="chart-readout" aria-live="polite">${esc(last.label)} · ${esc(g.sides[0].short)} ${last.away} – ${last.home} ${esc(g.sides[1].short)}${metric==='score'?'':` · ${esc(selectedLabel)}`}</div>${signed}<p class="chart-source">${esc(footnote)}${missingMetrics?' Additional stat histories unavailable or unverified for this game.':''}</p></section>`;
  }
  function periodTable(g,data){
    const result=scoreSnapshots(g,data);if(result.length<2)return '';
    const away=result.slice(1).map((p,i)=>p.away-result[i].away),home=result.slice(1).map((p,i)=>p.home-result[i].home);
    const columns=result.slice(1).map((_,i)=>`<th scope="col">${esc(g.tennis?`S${i+1}`:g.league==='mlb'?String(i+1):periodName(g.league,i+1))}</th>`).join('');
    const rows=[away,home].map((values,i)=>`<tr><th scope="row">${esc(g.sides[i].short)}</th>${values.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('');
    return `<div class="period-scroll"><table class="period-table"><caption>${esc(g.tennis?'Set games':'Scoring by period')}</caption><thead><tr><th></th>${columns}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  // Prefer a small, useful set of metrics for each sport over an enormous box-score table.
  const statSelections={
    nba:[['FG%','^(?:fieldgoalpct|fieldgoalpercentage|fgpct)$'],['3PT%','^(?:threepoint.*pct|3point.*pct|3pt.*pct)$'],['Rebounds','^(?:totalrebounds|rebounds)$'],['Assists','^assists$'],['Turnovers','^turnovers$']],
    wnba:[['FG%','^(?:fieldgoalpct|fieldgoalpercentage|fgpct)$'],['3PT%','^(?:threepoint.*pct|3point.*pct|3pt.*pct)$'],['Rebounds','^(?:totalrebounds|rebounds)$'],['Assists','^assists$'],['Turnovers','^turnovers$']],
    nfl:[['Total yards','totalyards'],['Passing yards','passingyards'],['Rushing yards','rushingyards'],['First downs','firstdowns'],['Turnovers','totalturnovers|turnovers']],
    cfb:[['Total yards','totalyards'],['Passing yards','passingyards'],['Rushing yards','rushingyards'],['First downs','firstdowns'],['Turnovers','totalturnovers|turnovers']],
    mlb:[['Hits','^hits$'],['Errors','^errors$'],['Walks','^walks$|baseonballs'],['Strikeouts','strikeouts'],['Left on base','leftonbase|lob']],
    nhl:[['Shots','shotsongoal|^shots$'],['Faceoff %','faceoff.*pct|faceoff.*percent'],['Power play','powerplay.*pct|powerplaygoals'],['Hits','^hits$'],['Blocks','blockedshots|^blocks$']],
    nwsl:[['Possession','possession'],['Shots','totalshots|^shots$'],['On target','shotsontarget|shotsongoal'],['Corners','cornerkicks|corners'],['Fouls','fouls']],
    mls:[['Possession','possession'],['Shots','totalshots|^shots$'],['On target','shotsontarget|shotsongoal'],['Corners','cornerkicks|corners'],['Fouls','fouls']]
  };
  function statsForDisplay(g,box,inMonitor=false){
    const keys=box.teamKeys;
    const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
    const used=new Set(),out=[];
    for(const [label,matcher] of statSelections[g.league]??[]){
      const re=new RegExp(matcher,'i');
      const key=keys.find(k=>!used.has(k)&&re.test(norm(k)))??keys.find(k=>!used.has(k)&&re.test(norm(box.teamStats[0].get(k).name)));
      if(key){used.add(key);out.push({label,key,a:box.teamStats[0].get(key),b:box.teamStats[1].get(key)});}
    }
    // A league may offer only a few of the common stats. Use those before generic ones.
    if(out.length<3)for(const key of keys){
      if(out.length>=5)break;
      if(used.has(key))continue;
      const a=box.teamStats[0].get(key),b=box.teamStats[1].get(key);
      if(a.value<0||b.value<0)continue;
      used.add(key);out.push({label:a.name,key,a,b});
    }
    if(inMonitor){
      const normalized=new Set(out.map(row=>norm(row.label)));
      for(const key of keys){
        if(used.has(key))continue;
        const a=box.teamStats[0].get(key),b=box.teamStats[1].get(key);
        if(!a||!b)continue;
        const label=a.name||b.name||key,identity=norm(label);
        if(normalized.has(identity))continue;
        normalized.add(identity);
        out.push({label,key,a,b});
      }
      return out;
    }
    return out.slice(0,5);
  }
  function byCode(player,codes,groups){
    for(const code of codes){
      const found=player.stats.find(s=>(!groups||groups.some(g=>s.group.toLowerCase().includes(g)))&&s.code.toUpperCase()===code);
      if(found)return found;
    }
    return null;
  }
  function performerRows(g,box){
    const config={nba:{focus:[['PTS']],extras:[['REB'],['AST']],count:5},wnba:{focus:[['PTS']],extras:[['REB'],['AST']],count:5},
      nfl:{focus:[['YDS','PASSING'],['YDS','RUSHING'],['YDS','RECEIVING']],extras:[['TD'],['YDS']],count:5},
      cfb:{focus:[['YDS','PASSING'],['YDS','RUSHING'],['YDS','RECEIVING']],extras:[['TD'],['YDS']],count:5},
      mlb:{focus:[['H'],['RBI'],['HR']],extras:[['RBI'],['HR'],['H']],count:5},
      nhl:{focus:[['G'],['A'],['SV']],extras:[['G'],['A'],['SOG']],count:5},
      mls:{focus:[['G'],['A'],['SH']],extras:[['G'],['A'],['SH']],count:5},
      nwsl:{focus:[['G'],['A'],['SH']],extras:[['G'],['A'],['SH']],count:5}}[g.league];
    if(!config)return [[],[]];
    return [0,1].map(team=>{
      const players=box.players.filter(p=>p.team===team),picked=[];
      if(g.league==='nfl'||g.league==='cfb'){
        for(const [code,group] of config.focus){
          const chosen=players.map(p=>({p,stat:byCode(p,[code],[group.toLowerCase()])})).filter(x=>x.stat&&metricNumber(x.stat.value)!==null).sort((a,b)=>metricNumber(b.stat.value)-metricNumber(a.stat.value))[0];
          if(chosen&&!picked.some(x=>x.p.id===chosen.p.id))picked.push(chosen);
        }
        const other=players.map(p=>({p,stat:byCode(p,['YDS','TD','REC'])})).filter(x=>x.stat&&metricNumber(x.stat.value)!==null).sort((a,b)=>metricNumber(b.stat.value)-metricNumber(a.stat.value));
        for(const row of other){if(picked.length>=config.count)break;if(!picked.some(x=>x.p.id===row.p.id))picked.push(row);}
      }else{
        const mainCodes=config.focus.map(x=>x[0]);
        for(const p of players){
          const stat=byCode(p,mainCodes)||p.stats.find(s=>['PTS','G','H','RBI','HR','A','SV'].includes(s.code.toUpperCase()));
          if(stat&&metricNumber(stat.value)!==null)picked.push({p,stat});
        }
        picked.sort((a,b)=>metricNumber(b.stat.value)-metricNumber(a.stat.value));
      }
      return picked.slice(0,config.count).map(({p,stat})=>{
        const secondary=[];
        for(const codes of config.extras){
          const s=byCode(p,codes);if(s&&s!==stat&&metricNumber(s.value)!==null&&!secondary.some(x=>x.code===s.code))secondary.push(s);
          if(secondary.length>=2)break;
        }
        const unit=stat.code.toUpperCase()==='YDS'&&stat.group?stat.group.replace(/s?$/,'').replace(/^(.)/,s=>s.toUpperCase())+' yds':stat.code;
        return {id:p.id,team:p.team,name:p.name,headshot:p.headshot,value:stat.value,unit,secondary};
      });
    });
  }
  function topPerformers(g,box,colors,inMonitor=false,data=null){
    const groups=performerRows(g,box);
    const timeline=inMonitor?playerScoringTimeline(g,data,selectedChartSeries(g,data).metric):[];
    const selectable=new Set(timeline.map(p=>String(p.id)));
    const selectedId=inMonitor?String(preferences(g.id).playerId??''):'';
    // Keep the dropdown and performer panel in sync even when the chosen
    // scorer is not one of the five statistical leaders on that team.
    const selected=timeline.find(p=>String(p.id)===selectedId);
    if(selected&&!groups[selected.team]?.some(r=>String(r.id)===selectedId)){
      const full=box.players.find(p=>p.team===selected.team&&(String(p.id)===selectedId||p.name===selected.name));
      const stat=full&&(byCode(full,['PTS'])||full.stats.find(item=>metricNumber(item.value)!==null));
      groups[selected.team].push({id:selected.id,team:selected.team,name:selected.name,
        headshot:selected.headshot||full?.headshot||'',value:stat?.value??String(selected.credited),
        unit:stat?.code??'PTS',secondary:[],promoted:true});
    }
    if(!groups.some(rows=>rows.length))return '';
    return `<section class="detail-panel performers-panel"><div class="detail-panel-head"><div><h3>Top performers</h3><p>${inMonitor&&timeline.length?'Select a player to highlight verified events':'Game totals'}</p></div></div><div class="performer-teams">${groups.map((rows,i)=>`<div class="performer-team"><div class="performer-team-name"><i style="background:${colors[i]}"></i>${esc(g.sides[i].short)}</div>${rows.length?rows.map(row=>{
      const canSelect=inMonitor&&selectable.has(String(row.id));
      const isSelected=canSelect&&String(row.id)===selectedId;
      const opening=canSelect?`<button type="button" class="performer-row performer-button${isSelected?' is-selected':''}" data-select-performer="${esc(g.id)}" data-player-id="${esc(row.id)}" aria-pressed="${isSelected}" aria-label="${esc(isSelected?'Remove player overlay for ':'Highlight recorded events for ')}${esc(row.name)}">`:`<div class="performer-row${inMonitor?' performer-static':''}"${inMonitor?' title="Individual scoring timeline unavailable for this player"':''}>`;
      const closing=canSelect?'</button>':'</div>';
      return `${opening}<div class="performer-person">${row.headshot?`<img class="performer-avatar" src="${esc(row.headshot)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`:''}<span class="performer-person-copy"><strong>${esc(row.name)}</strong>${row.secondary.length?`<span>${row.secondary.map(s=>`${esc(s.value)} ${esc(s.code)}`).join(' · ')}</span>`:''}${row.promoted?'<small class="performer-promoted">Selected player</small>':''}</span></div><span class="performer-number">${esc(row.value)} <small>${esc(row.unit)}</small></span>${closing}`;
    }).join(''):'<p class="stat-unavailable">No player totals available</p>'}</div>`).join('')}</div></section>`;
  }
  // Link statistics to graph histories only if both labels have exactly the
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
  function statsSection(g,data,inMonitor=false){
    if(g.tennis){
      const games=tennisHistory(g,'gamesWon'),sets=tennisHistory(g,'setsWon');
      if(!games||!sets)return `<section class="detail-panel stats-panel"><h3>Match statistics</h3><div class="detail-empty">Set scores will appear as the match progresses.</div></section>`;
      const values=[['Sets won',sets.points.at(-1)],['Games won',games.points.at(-1)]];
      return `<section class="detail-panel stats-panel"><div class="detail-panel-head"><div><h3>Match totals</h3><p>From recorded set scores</p></div></div><div class="team-stat-list">${values.map(([label,last],i)=>{const metric=i===0?'setsWon':'score',available=availableGraphMetrics(g,data).some(([id])=>id===metric);return `<${available?'button':'div'} class="stat-match${available?' stat-match-linked':''}" ${available?`type="button" data-stat-game="${esc(g.id)}" data-stat-metric="${metric}" aria-label="Show ${esc(label)} on the match figure"`:''}><div class="stat-match-values"><strong>${esc(last.away)}</strong><span>${esc(label)}${available?' ↗':''}</span><strong>${esc(last.home)}</strong></div></${available?'button':'div'}>`;}).join('')}</div></section>`;
    }
    const box=parseBox(g,data),colors=teamColors(g,data),rows=statsForDisplay(g,box,inMonitor);
    const chartOptions=availableGraphMetrics(g,data);
    const statHtml=rows.length?`<section class="detail-panel stats-panel"><div class="detail-panel-head"><div><h3>Team statistics</h3><p>${inMonitor?'Expanded comparisons · all available game metrics':'Selected game totals'}</p></div></div><div class="stat-team-head"><span><i style="background:${colors[0]}"></i>${esc(g.sides[0].short)}</span><span>${esc(g.sides[1].short)}<i style="background:${colors[1]}"></i></span></div><div class="team-stat-list">${rows.map(({label,key,a,b})=>{
      const comparable=a.value!==null&&b.value!==null&&a.value>=0&&b.value>=0;
      const max=comparable?Math.max(Math.abs(a.value),Math.abs(b.value),1):1,left=comparable?Math.max(0,Math.min(100,Math.abs(a.value)/max*100)):0,right=comparable?Math.max(0,Math.min(100,Math.abs(b.value)/max*100)):0;
      const metric=linkedStatMetric(g,{key},data,chartOptions);
      const tag=metric?'button':'div';
      return `<${tag} ${metric?`type="button" data-stat-metric="${esc(metric)}" data-stat-game="${esc(g.id)}" title="Show ${esc(label)} over game time" aria-label="Show ${esc(label)} over game time"`:''} class="stat-match${metric?' stat-match-linked':''}${metric&&preferences(g.id).metric===metric?' is-active':''}"><div class="stat-match-values"><strong>${esc(a.display)}</strong><span>${esc(label)}${metric?' <span aria-hidden="true">↗</span>':''}</span><strong>${esc(b.display)}</strong></div>${comparable?`<div class="stat-match-bars"><div><span style="width:${left}%;background:${colors[0]}"></span></div><div><span style="width:${right}%;background:${colors[1]}"></span></div></div>`:''}</${tag}>`;
    }).join('')}</div></section>`:'';
    const performerHtml=topPerformers(g,box,colors,inMonitor,data);
    if(statHtml||performerHtml)return `<div class="detail-rail">${statHtml}${performerHtml}</div>`;
    return `<section class="detail-panel stats-panel"><div class="detail-panel-head"><div><h3>Game statistics</h3></div></div><div class="detail-empty">${g.state==='pre'?'Stats will appear as the game gets underway.':'Team and player totals aren’t available for this game.'}</div></section>`;
  }
  // Monitor box scores use the complete ESPN category/athlete tables, not the
  // limited two-player selection used to summarize a normal expanded card.
  function completeTeamStats(g,data){
    const rows=data?.boxscore?.teams??[];
    const gathered=[new Map(),new Map()];
    for(const row of rows){
      const team=row.team??{};
      const side=g.sides.findIndex(s=>String(s.id??'')===String(team.id??'') || String(s.short).toUpperCase()===String(team.abbreviation??'').toUpperCase() || s.name===team.displayName);
      if(side<0)continue;
      for(const stat of row.statistics??[]){
        const key=String(stat.name??stat.abbreviation??stat.label??'').trim();
        if(!key)continue;
        const value=stat.displayValue??stat.value;
        if(value===null||value===undefined||String(value)==='')continue;
        gathered[side].set(key,{label:shortText(stat.label??stat.displayName??key,60),value:shortText(String(value),35)});
      }
    }
    const keys=[...new Set([...gathered[0].keys(),...gathered[1].keys()])];
    const graphOptions=availableGraphMetrics(g,data);
    if(!keys.length)return '';
    const cells=keys.map(key=>{
      const a=gathered[0].get(key),b=gathered[1].get(key);
      const metric=linkedStatMetric(g,{key},data,graphOptions),label=a?.label??b?.label??key;
      return `<tr><th scope="row">${metric?`<button class="box-stat-link" type="button" data-box-stat-metric="${esc(metric)}" title="View ${esc(label)} as a game progression">${esc(label)} ↗</button>`:esc(label)}</th><td>${esc(a?.value??'—')}</td><td>${esc(b?.value??'—')}</td></tr>`;
    }).join('');
    return `<section class="monitor-team-box monitor-full-team-stats"><h3>Complete team statistics <span class="box-team-short">As supplied by the game feed</span></h3><div class="box-table-scroll"><table class="box-player-table monitor-team-stat-table"><thead><tr><th scope="col">Metric</th><th scope="col">${esc(g.sides[0].short)}</th><th scope="col">${esc(g.sides[1].short)}</th></tr></thead><tbody>${cells}</tbody></table></div></section>`;
  }
  function fullPlayerBox(g,data){
    const groups=[...(Array.isArray(data?.boxscore?.players)?data.boxscore.players:[]),
      ...(data?.boxscore?.teams??[]).filter(t=>Array.isArray(t.players)).flatMap(t=>t.players)];
    const colors=teamColors(g,data);
    let rendered=0;
    const sections=g.sides.slice(0,2).map((side,i)=>{
      const teamGroups=groups.filter(group=>{
        const team=group.team??{};
        return String(team.id??'')===String(side.id??'')||String(team.abbreviation??'').toUpperCase()===String(side.short).toUpperCase()||String(team.displayName??'')===side.name;
      });
      const tables=[];
      teamGroups.forEach((group,groupIndex)=>{
        (group.statistics??[]).forEach((category,categoryIndex)=>{
          const athletes=Array.isArray(category.athletes)?category.athletes:[];
          if(!athletes.length)return;
          const labels=category.labels?.length?category.labels:category.names??[];
          const count=Math.max(labels.length,...athletes.map(a=>(a.stats??[]).length),0);
          if(count===0&&!athletes.some(a=>a.didNotPlay))return;
          rendered++;
          const tableKey=`${i}-${groupIndex}-${categoryIndex}`;
          const active=monitorSort.key===tableKey?monitorSort:null;
          const items=athletes.map((a,originalIndex)=>({a,originalIndex}));
          if(active){
            const value=item=>active.col===-1?String(item.a.athlete?.displayName??item.a.displayName??''):
              String(item.a.stats?.[active.col]??'');
            items.sort((left,right)=>{
              const a=value(left),b=value(right),an=metricNumber(a),bn=metricNumber(b);
              const cmp=(an!==null&&bn!==null)?an-bn:a.localeCompare(b,undefined,{numeric:true});
              return cmp*active.dir||left.originalIndex-right.originalIndex;
            });
          }
          const sortButton=(label,col)=>`<button type="button" data-box-sort="${esc(tableKey)}" data-box-column="${col}" aria-label="Sort ${esc(category.displayName??category.name??'player statistics')} by ${esc(label)}">${esc(label)}${active?.col===col?(active.dir===1?' ↑':' ↓'):''}</button>`;
          const body=items.map(({a})=>{
            const athlete=a.athlete??{};
            const player=shortText(athlete.displayName??a.displayName??'Unknown player',70);
            const headshot=athlete.headshot?.href??athlete.headshot??'',portrait=typeof headshot==='string'&&/^https:\/\//i.test(headshot)?`<img class="box-player-avatar" src="${esc(headshot)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`:'';
            const unavailable=a.didNotPlay||a.didNotDress;
            return `<tr class="${unavailable?'box-dnp':''}"><th scope="row"><span class="box-player-name">${portrait}${esc(player)}</span>${a.starter?'<span class="box-starter">Starter</span>':''}</th>${Array.from({length:count},(_,k)=>`<td>${esc(a.stats?.[k]??(unavailable?'—':'—'))}</td>`).join('')}</tr>`;
          }).join('');
          const caption=shortText(category.displayName??category.name??'Player statistics',65);
          tables.push(`<section class="box-category"><h4>${esc(caption)}</h4><div class="box-table-scroll"><table class="box-player-table"><thead><tr><th scope="col" aria-sort="${active?.col===-1?(active.dir===1?'ascending':'descending'):'none'}">${sortButton('Player',-1)}</th>${Array.from({length:count},(_,j)=>`<th scope="col" aria-sort="${active?.col===j?(active.dir===1?'ascending':'descending'):'none'}">${sortButton(labels[j]??`Stat ${j+1}`,j)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></section>`);
        });
      });
      return `<section class="monitor-team-box"><h3><span class="box-team-dot" style="background:${colors[i]}"></span>${esc(side.name)} <span class="box-team-short">${esc(side.short)}</span></h3>${tables.length?tables.join(''):'<p class="monitor-box-empty">Player box scores are not supplied for this team.</p>'}</section>`;
    });
    return `<div class="monitor-box"><p class="monitor-box-note">Full game statistics · Column headings can be sorted. Categories and availability vary by league.</p>${completeTeamStats(g,data)}${rendered?sections.join(''):'<div class="monitor-unavailable">Individual player box scores are not supplied for this game.</div>'}</div>`;
  }
  function monitorScore(g,side){
    if(g.tennis)return `<span class="monitor-set-scores">${(side.sets??[]).map((v,i)=>`<span title="Set ${i+1}">${esc(v.value)}</span>`).join(' ')||'—'}</span>`;
    return `<strong class="monitor-score" aria-label="${esc(side.name)} score">${esc(side.score??'—')}</strong>`;
  }
  function monitorOverview(g,data){
    const colors=teamColors(g,data);
    const entry=getSummary(g);
    const label=entry?.loading&&!data?'Fetching details…':entry?.error&&!data?'Game details unavailable':g.state==='pre'?'Upcoming game':g.state==='post'?'Final / completed':g.status;
    const sides=g.sides.slice(0,2).map((side,i)=>`<div class="monitor-team-line" style="--monitor-team-color:${colors[i]}"><span class="monitor-team-ident"><span class="monitor-team-mark" aria-hidden="true"></span>${!g.tennis&&/^\d+$/.test(side.id)?`<button type="button" class="monitor-team-name team-link" data-open-team="${esc(g.league)}:${esc(side.id)}" aria-label="Open ${esc(side.name)} season">${esc(side.name)}</button>`:`<span class="monitor-team-name">${esc(side.name)}</span>`}<small>${esc(side.short)}</small></span>${monitorScore(g,side)}</div>`).join('');
    return `<section class="monitor-overview" aria-label="Game overview">
      <header class="monitor-matchup"><div class="monitor-matchup-main">${sides}</div><div class="monitor-matchup-status"><strong>${esc(label)}</strong><span>${esc(g.detail??'')}</span></div></header>
      <div class="monitor-overview-grid"><div class="monitor-chart-area">${graphSection(g,data,true)}</div><div class="monitor-stats-area">${statsSection(g,data,true)}</div></div>
      <div class="monitor-overview-footer"><span>Move across the chart to inspect a game moment; tap to lock it.</span><span>${esc(g.venue||'')}</span></div>
      ${entry?.error?`<p class="monitor-data-notice">${esc(entry.error)} ${data?'Showing last received data.':''}</p>`:''}
    </section>`;
  }
  function detailContent(g,inMonitor=false){
    const entry=getSummary(g),data=entry?.data;
    const status=entry?.loading&&!data?'<p class="detail-refresh" role="status">Loading detailed game statistics…</p>':entry?.error&&!data?`<p class="detail-refresh" role="status">${esc(entry.error)} Showing any available period scores. <button class="details-retry" type="button" data-details-retry="${esc(g.id)}">Retry</button></p>`:'';
    const toolbar=inMonitor?'':`<div class="expanded-tools"><span>GAME DETAILS</span></div>`;
    return `<div class="expanded-inner">${toolbar}${status}<div class="expanded-layout">${graphSection(g,data)}${statsSection(g,data)}</div>${periodTable(g,data)}${entry?.loading&&data?'<p class="detail-refresh">Updating details…</p>':''}${entry?.error&&data?`<p class="detail-refresh">${esc(entry.error)} Showing last received data.</p>`:''}</div>`;
  }
  function paintExpanded(id){
    if(expandedGame!==id&&!(monitorGame===id&&monitorDialog.open))return;
    const game=findGame(id);
    if(!game)return;
    if(expandedGame===id){
      const element=document.getElementById((expandedCopy==='original'?'details-':'details-'+expandedCopy+'-')+id);
      if(element)element.innerHTML=detailContent(game);
    }
    if(monitorGame===id&&monitorDialog.open)renderMonitor();
  }
  let expandedCopy='original';
  function toggleExpanded(id,copy='original'){
    const same=expandedGame===id&&expandedCopy===copy;
    expandedGame=same?'':id;expandedCopy=copy;
    render();
    const button=[...document.querySelectorAll('[data-expand]')].find(el=>el.dataset.expand===id&&el.dataset.expandCopy===copy);
    button?.focus({preventScroll:true});
    if(expandedGame){const game=findGame(id);if(game)loadExpanded(game);}
  }

  function miniScoreFlow(g){
    if(g.state==='pre'||g.sides.length!==2)return '';
    const a=g.sides[0].sets??[],b=g.sides[1].sets??[];
    const n=Math.min(a.length,b.length);
    if(n<2)return '';
    const away=[0],home=[0];
    for(let i=0;i<n;i++){
      const x=Number(a[i]?.value),y=Number(b[i]?.value);
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0)return '';
      away.push(away.at(-1)+x);home.push(home.at(-1)+y);
    }
    const lo=Math.min(...away,...home),hi=Math.max(...away,...home);
    if(hi===lo)return '';
    const W=88,H=27,pad=2;
    const xx=i=>pad+i*(W-2*pad)/n;
    const yy=v=>H-pad-(v-lo)/(hi-lo)*(H-2*pad);
    const draw=arr=>arr.map((v,i)=>`${i?'L':'M'}${xx(i).toFixed(1)},${yy(v).toFixed(1)}`).join(' ');
    const colors=teamColors(g,null);
    return `<svg class="mini-score-flow" width="88" height="27" viewBox="0 0 88 27" aria-label="Period-level scoring preview: ${esc(g.sides[0].short)} versus ${esc(g.sides[1].short)}" role="img"><path d="${draw(away)}" fill="none" stroke="${colors[0]}" stroke-width="1.7"/><path d="${draw(home)}" fill="none" stroke="${colors[1]}" stroke-width="1.7"/></svg>`;
  }
  function card(g,stale,inMonitor=false,copy='original') {
    const opened=inMonitor||(expandedGame===g.id&&expandedCopy===copy);
    const detailId=(inMonitor?'monitor-details-':copy==='original'?'details-':'details-'+copy+'-')+g.id;
    const live=gamePhase({game:g,stale})===0;
    const completed=g.state==='post'&&!/postpon|cancel|delay|suspend/i.test(g.status);
    const starts=new Date(g.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    const status=g.state==='pre'&&!/postpon|cancel|delay|suspend/i.test(g.status)?starts:g.status;
    const rows=g.sides.map(s=>{
      const img=imageURL(s.logo);
      const initials=g.tennis?s.name.split(' ').map(n=>n[0]).slice(0,2).join(''):s.short;
      const badge=`<span class="team-badge"><span class="initials">${esc(initials)}</span>${img?`<img src="${esc(img)}" width="32" height="32" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}</span>`;
      const sets=g.tennis?`<div class="sets" aria-label="Set scores">${g.state==='pre'||!s.sets.length?'<span>—</span>':s.sets.map((v,i)=>`<span class="${v.winner?'won-set':''}" title="Set ${i+1}">${esc(v.value)}${v.tiebreak!==undefined?`<sup>${esc(v.tiebreak)}</sup>`:''}</span>`).join('')}${g.state==='in'&&s.point!=null?`<b class="point" title="Current game points">${esc(s.point)}</b>`:''}</div>`:`<span class="score">${esc(s.score)}</span>`;
      const position=s.rank?`<span class="standing-rank" title="ESPN ranked No. ${s.rank}">#${s.rank}</span>`:s.seed?`<span class="standing-rank" title="Tournament seed ${s.seed}">[${s.seed}]</span>`:s.worldRank?`<span class="standing-rank" title="World ranking ${s.worldRank}">#${s.worldRank}</span>`:'';
      const favored=!g.tennis&&/^\d+$/.test(s.id)&&isFavoriteTeam(g.league,s.id);
      const teamStar=!g.tennis&&/^\d+$/.test(s.id)?`<button type="button" class="favorite-team-button ${favored?'is-favorite':''}" data-favorite-team="${esc(g.league)}:${esc(s.id)}" aria-pressed="${favored}" aria-label="${favored?'Remove':'Add'} ${esc(s.name)} ${favored?'from':'to'} favorite teams" title="${favored?'Unfavorite':'Favorite'} ${esc(s.name)}">${favored?'★':'☆'}</button>`:'';
      return `<div class="side ${s.winner?'winner':''}"><div class="team-name">${badge}<span><span class="name">${position}${!g.tennis&&/^\d+$/.test(s.id)?`<button class="team-link" type="button" data-open-team="${esc(g.league)}:${esc(s.id)}" aria-label="Open ${esc(s.name)} team schedule">${esc(s.name)}</button>`:esc(s.name)}${teamStar}${s.serving?'<span class="serve" aria-label="Serving">●</span>':''}</span>${s.record?`<span class="record">${esc(s.record)}</span>`:''}</span></div>${sets}</div>`;
    }).join('');
    const sport=SPORTS.find(s=>s.id===g.league);
    const gap=gapOf(g);
    const gapText=gap?(g.tennis?`Set gap ${gap.primary} · latest-set gap ${gap.secondary}`:`Gap ${gap.primary} ${gap.unit}`):'';
    const timeText=Number.isFinite(g.remainingSeconds)?`${clockLabel(g.remainingSeconds)} ${g.timeBasis==='current OT'?'in this OT':'reg. left'}`:g.timeBasis==='untimed OT'?'Untimed OT':'';
    const metricText=[gapText,timeText].filter(Boolean).join(' · ');
    const sparkline=miniScoreFlow(g);
    const pinned=isPinned(g),favorite=isFavoriteGame(g);
    const pinButton=`<button type="button" class="pin-game-button ${pinned?'is-pinned':''}" data-pin-game="${esc(g.id)}" aria-pressed="${pinned}" aria-label="${pinned?'Unpin':'Pin'} ${esc(g.title)} for ${esc(day)}" title="${pinned?'Remove day pin':'Pin game for this day'}"><svg viewBox="0 0 24 24" width="15" height="15" fill="${pinned?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v6"/></svg><span>${pinned?'Pinned':'Pin'}</span></button>`;
    return `<article style="--league-color:${sport?.color??'#a2afbd'}" class="score-card ${live?'live-card':''} ${completed?'completed-card':''} ${opened?'expanded-card':''} ${favorite?'favorite-card':''} ${pinned?'pinned-card':''}"><div class="game-meta"><span class="game-meta-left"><span class="league-tag">${esc(sport?.name??g.league)}${g.league==='cfb'?' · FBS':''}</span>${g.context?.label?`<span class="game-context">· ${esc(g.context.label)}</span>`:''}${g.context?.series?`<span class="game-context">· ${esc(g.context.series)}</span>`:''}</span><span class="game-start">Start ${esc(starts)}</span>${pinButton}</div><div class="card-top"><span class="${live?'live-label':'game-status'}">${live?'<span class="live-badge"><span class="live-dot" aria-hidden="true"></span>LIVE</span>':''}<span>${stale?'Last known · ':''}${esc(status)}</span></span>${g.tennis?`<span class="match-title">${esc(g.title)}</span>`:`<span class="card-detail">${esc(g.detail)}</span>`}</div>${g.tennis?`<div class="tennis-label">${esc(g.detail)}</div>`:''}<div class="sides">${rows}</div>${metricText||sparkline?`<div class="game-metrics game-metrics-flow"><span>${stale?'Last known · ':''}${esc(metricText)}</span>${sparkline}</div>`:''}<div class="card-bottom"><div class="card-bottom-meta"><span>${esc(g.venue||'Venue not listed')}</span>${g.url?`<a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer" aria-label="ESPN details for ${esc(g.title)}">ESPN ↗</a>`:''}</div><div class="card-actions"><button type="button" class="game-flow-toggle" data-expand="${esc(g.id)}" data-expand-copy="${esc(copy)}" aria-expanded="${opened}" aria-label="${opened?'Hide':'Show'} expanded game flow and statistics for ${esc(g.title)}" aria-controls="${esc(detailId)}"><svg class="game-flow-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12 6 8l3 2 5-6"/></svg><span>Expanded card</span><span class="expand-chevron" aria-hidden="true">⌄</span></button><button type="button" class="monitor-launch" data-monitor-open="${esc(g.id)}" aria-label="Open full-screen view for ${esc(g.title)}" aria-haspopup="dialog" aria-controls="game-monitor"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"/></svg><span>Full screen</span></button></div></div>${opened?`<div id="${esc(detailId)}" role="region" aria-label="${esc(g.title)} game details">${detailContent(g,inMonitor)}</div>`:''}</article>`;
  }
  // Full-window focus mode is a separate presentation of the same live game.
  // Both surfaces share a single detail cache and per-game metric selection.
  const monitorDialog=$('game-monitor');
  const monitorBody=$('game-monitor-body');
  let monitorGame='',monitorReturnFocus=null;
  let monitorView='overview',monitorSort={key:'',col:-1,dir:1};
  function renderMonitor(){
    if(!monitorGame||!monitorDialog.open)return;
    const g=findGame(monitorGame);
    if(!g){
      monitorBody.innerHTML='<div class="monitor-unavailable" role="status">This game is no longer in the current feed. Return to the scoreboard to find another game.</div>';
      return;
    }
    const data=getSummary(g)?.data;
    const active=document.activeElement;
    const focusMetric=monitorDialog.contains(active)&&active?.matches?.('[data-chart-metric]');
    const focusPlayer=monitorDialog.contains(active)&&active?.matches?.('[data-monitor-player]');
    const focusTab=monitorDialog.contains(active)&&active?.matches?.('[data-monitor-view]')?active.dataset.monitorView:'';
    const focusSort=monitorDialog.contains(active)&&active?.matches?.('[data-box-sort]')?[active.dataset.boxSort,active.dataset.boxColumn]:null;
    const scrollTop=monitorDialog.scrollTop;
    $('game-monitor-title').textContent=g.title;
    const tabs=`<div class="monitor-view-tabs" role="tablist" aria-label="Game monitor views"><button type="button" role="tab" id="monitor-tab-overview" data-monitor-view="overview" aria-selected="${monitorView==='overview'}" aria-controls="monitor-current-panel">Overview</button><button type="button" role="tab" id="monitor-tab-box" data-monitor-view="box" aria-selected="${monitorView==='box'}" aria-controls="monitor-current-panel">Box score</button></div>`;
    monitorBody.innerHTML=`${tabs}<div id="monitor-current-panel" role="tabpanel" aria-labelledby="monitor-tab-${monitorView}">${monitorView==='overview'?monitorOverview(g,data):fullPlayerBox(g,data)}</div>`;
    monitorDialog.scrollTop=scrollTop;
    const pinned=preferences(g.id).chartPinX,chart=monitorBody.querySelector('.monitor-interactive-chart');
    if(chart&&Number.isFinite(pinned))chartCursorAt(chart,pinned,true);
    if(focusMetric)monitorBody.querySelector('[data-chart-metric]')?.focus({preventScroll:true});
    else if(focusPlayer)monitorBody.querySelector('[data-monitor-player]')?.focus({preventScroll:true});
    else if(focusTab)monitorBody.querySelector(`[data-monitor-view="${focusTab}"]`)?.focus({preventScroll:true});
    else if(focusSort){[...monitorBody.querySelectorAll('[data-box-sort]')].find(e=>e.dataset.boxSort===focusSort[0]&&e.dataset.boxColumn===focusSort[1])?.focus({preventScroll:true});}
  }
  function openMonitor(id){
    const target=findGame(id);
    if(!target)return;
    monitorReturnFocus=document.activeElement;
    monitorGame=id;monitorView='overview';monitorSort={key:'',col:-1,dir:1};
    document.body.classList.add('monitor-open');
    monitorDialog.showModal();
    renderMonitor();
    loadExpanded(target);
    $('game-monitor-close').focus({preventScroll:true});
  }
  function closeMonitor(){if(monitorDialog.open)monitorDialog.close();}
  monitorDialog.addEventListener('close',()=>{
    const id=monitorGame;
    monitorGame='';document.body.classList.remove('monitor-open');
    const opener=monitorReturnFocus?.isConnected?monitorReturnFocus:
      [...document.querySelectorAll('[data-monitor-open]')].find(el=>el.dataset.monitorOpen===id);
    monitorReturnFocus=null;
    opener?.focus({preventScroll:true});
    monitorBody.innerHTML='';
  });
  $('game-monitor-close').addEventListener('click',closeMonitor);
  monitorDialog.addEventListener('click',event=>{
    const tab=event.target.closest('[data-monitor-view]');
    if(tab){monitorView=tab.dataset.monitorView;monitorDialog.scrollTop=0;renderMonitor();return;}
    const sort=event.target.closest('[data-box-sort]');
    if(sort){const key=sort.dataset.boxSort,col=Number(sort.dataset.boxColumn);monitorSort=monitorSort.key===key&&monitorSort.col===col?{key,col,dir:-monitorSort.dir}:{key,col,dir:1};renderMonitor();return;}
    const retry=event.target.closest('[data-details-retry]');
    if(retry){const g=findGame(retry.dataset.detailsRetry);if(g)loadExpanded(g,true);return;}
    const point=event.target.closest('[data-point]');if(point)selectPoint(point);
  });
  __SB_TEAM_JS__
  let staleSignature='';
  // Counter appears in the sticky sport/date bar only once the original headline has scrolled away.
  const stickyNav=$('sticky-score-nav'),dayHeading=document.querySelector('.day-heading');
  let countTick=false;
  function syncStickyCounter(){
    const scrolled=dayHeading.getBoundingClientRect().bottom<=0&&stickyNav.getBoundingClientRect().top<=1;
    stickyNav.classList.toggle('has-sticky-count',scrolled);
  }
  function queueStickyCounter(){if(countTick)return;countTick=true;requestAnimationFrame(()=>{countTick=false;syncStickyCounter();});}
  window.addEventListener('scroll',queueStickyCounter,{passive:true});
  window.addEventListener('resize',queueStickyCounter,{passive:true});
  function render() {
    const focused=document.activeElement?.getAttribute?.('data-chart-metric');
    const visible=orderedSports().filter(s=>visibleLeagueIds().includes(s.id));
    let live=0,count=0,unknown=false;
    const allItems=[],allRawItems=[],allNotices=[],waiting=[];
    const groupedHTML=visible.map(s=>{
      const sources=defs.filter(d=>d.id===s.id);
      const ff=sources.map(d=>({def:d,feed:feeds.get(d.key)}));
      const allLeagueGames=ff.flatMap(({feed:f})=>f?f.games.map(g=>({game:g,stale:isStale(f)})):[])
        .sort((a,b)=>compareGames(a,b,sortMode));
      const items=liveOnly?allLeagueGames.filter(i=>gamePhase(i)===0):allLeagueGames;
      allItems.push(...items);allRawItems.push(...allLeagueGames);
      count+=allLeagueGames.length;live+=allLeagueGames.filter(i=>gamePhase(i)===0).length;
      const pending=ff.some(({feed:f})=>!f||f.loading&&!f.receivedAt);
      const errors=ff.filter(({feed:f})=>f&&isStale(f));
      const incomplete=pending||!!errors.length;unknown||=incomplete;
      if(pending)waiting.push(s.name);
      const supplement=ff.filter(({feed:f})=>f?.coverageWarning).map(({feed:f})=>`<div class="feed-warning"><span>${esc(f.coverageWarning)}</span></div>`).join('');
      const notices=supplement+errors.map(({def:d,feed:f})=>`<div class="feed-warning"><span>${esc(d.label+': ')}${f.error?'Feed unavailable.':'Scores have not refreshed recently.'} ${f.receivedAt?'Last received '+esc(time(f.receivedAt))+'. ':''}${f.error?`<span data-retry="${f.nextTry}"></span>`:'Checking again automatically.'}</span></div>`).join('');
      allNotices.push(notices);
      const subtitle=items.length?`${items.length} ${['atp','wta'].includes(s.id)?'matches':'games'}${incomplete?' · incomplete':''}`:['atp','wta'].includes(s.id)?'Singles · all available tour events':s.id==='cfb'?'FBS · all rankings':'Daily schedule';
      let content;
      if(items.length)content=`<div class="games-grid">${items.map(i=>card(i.game,i.stale)).join('')}</div>`;
      else if(liveOnly&&!pending&&!errors.length)content=`<div class="empty-state"><span class="empty-dash">—</span><div><p>No live games in ${esc(s.name)}</p><span>Turn off the live-only filter to see scheduled and final games.</span></div></div>`;
      else if(pending)content=`<div class="empty-state loading-state"><span class="empty-dash">···</span><div><p>Loading ${esc(s.name)} scores…</p><span>Connecting to ESPN.</span></div></div>`;
      else content=`<div class="empty-state"><span class="empty-dash">—</span><div><p>${errors.length?'Waiting for scores':['atp','wta'].includes(s.id)?'No singles matches listed':'No games listed for this date'}</p><span>${errors.length?'Automatic retries are on. You can also use Refresh.':['atp','wta'].includes(s.id)?'Tour tournaments, including Grand Slams, Masters/1000s and other available events.':'Choose another date to see the schedule.'}</span></div></div>`;
      // Live-only always exposes matching cards even if a league was collapsed
      // in the normal scoreboard. The stored collapse preference is untouched.
      const collapsed=collapsedLeagues.has(s.id)&&!(liveOnly&&items.length);
      if(liveOnly&&!items.length&&!incomplete)return '';
      return `<section class="league-section ${collapsed?'league-is-collapsed':''}" data-league="${s.id}" style="--league-color:${s.color}" aria-label="${esc(s.name)}"><div class="league-heading"><div class="league-heading-main"><h2><button type="button" class="league-collapse" data-collapse-league="${s.id}" aria-expanded="${!collapsed}" aria-controls="league-content-${s.id}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(s.name)}"><span class="league-bar" aria-hidden="true"></span>${esc(s.name)}<span class="league-chevron" aria-hidden="true">⌄</span></button></h2></div><span class="league-subtitle">${subtitle}</span></div><div class="league-content" id="league-content-${s.id}" ${collapsed?'hidden':''}>${collapsed?'':notices+content}</div></section>`;
    }).join('');
    const across=!grouped&&(selected==='all'||selected.startsWith('sport:'));
    allItems.sort((a,b)=>compareGames(a,b,sortMode));
    // Featured games are additional presentations of the same normalized game
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
    // Live/total reflects all unique games represented on-screen, including
    // followed games from another sport, never counting duplicated cards twice.
    const counted=new Map([...allRawItems,...allFollowed.filter(i=>isPinned(i.game)||isFavoriteGame(i.game))].map(i=>[gameKey(i.game),i]));
    count=counted.size;live=[...counted.values()].filter(i=>gamePhase(i)===0).length;
    const eligible=allFollowed.filter(i=>!liveOnly||gamePhase(i)===0);
    const pinnedItems=eligible.filter(i=>isPinned(i.game)).sort((a,b)=>compareGames(a,b,sortMode));
    const favoriteItems=eligible.filter(i=>!isPinned(i.game)&&isFavoriteGame(i.game)).sort((a,b)=>compareGames(a,b,sortMode));
    const featured=(label,items,slug,icon)=>items.length?`<section class="featured-games featured-${slug}" aria-label="${label}"><div class="featured-heading"><h2><span class="featured-symbol" aria-hidden="true">${icon}</span> ${label}</h2><span>${items.length} ${items.length===1?'game':'games'} · Also listed in their leagues</span></div><div class="games-grid">${items.map(i=>card(i.game,i.stale,false,slug)).join('')}</div></section>`:'';
    const featuredHTML=featured('Pinned games',pinnedItems,'pinned','⌖')+featured('Favorite teams',favoriteItems,'favorites','★');
    const noLiveMessage=liveOnly&&!live&&!unknown?'<div class="empty-state" role="status"><span class="empty-dash">—</span><div><p>No live games in this selection</p><span>Turn off the live-only filter to see all games.</span></div></div>':'';
    $('scores-panel').innerHTML=featuredHTML+(across?`<section class="league-section" aria-label="All games sorted together">${allNotices.join('')}${waiting.length?`<p class="loading-summary">Loading ${esc(waiting.join(', '))}…</p>`:''}${allItems.length?`<div class="games-grid">${allItems.map(i=>card(i.game,i.stale)).join('')}</div>`:waiting.length?'':`<div class="empty-state"><span class="empty-dash">—</span><div><p>${liveOnly&&!unknown?'No live games in this selection':unknown?'Live status temporarily unavailable':'No games listed for this date'}</p><span>${liveOnly&&!unknown?'Turn off the live-only filter to see the full schedule.':unknown?'A feed is missing or stale. Automatic retries are on.':'Choose another date to see the schedule.'}</span></div></div>`}</section>`:groupedHTML+noLiveMessage);
    $('sort-scope').textContent=across?'All visible leagues, sorted together. Enable grouping for collapsible league sections.':'Sorting within each visible league.';
    $('sort-description').textContent=SORT_MODES[sortMode].help;
    $('group-sports').disabled=selected!=='all'&&!selected.startsWith('sport:');
    $('live-count').textContent=String(live);
    $('event-count').textContent=`/ ${count} events${unknown?' · partial':''}`;
    $('sticky-live-count').textContent=String(live);
    $('sticky-event-count').textContent=`/ ${count}${unknown?' · partial':''}`;
    for(const id of ['live-filter-main','live-filter-sticky']){
      const button=$(id);
      button.setAttribute('aria-pressed',String(liveOnly));
      button.setAttribute('aria-label',liveOnly?'Show all games':'Show live games only');
      button.title=(liveOnly?'Show scheduled, live and finished games':'Show live games only')+(unknown?' (some feeds are incomplete)':'');
      button.classList.toggle('is-active',liveOnly);
    }
    queueStickyCounter();
    staleSignature=Array.from(feeds.entries()).map(([k,f])=>k+isStale(f)).join('|');
    renderMonitor();
    updateStatus();
    // Pending schedule navigation resolves only after this date's game feed arrives.
    if(teamPendingJump)completeTeamGameJump();
    if(focused){
      const selector=[...$('scores-panel').querySelectorAll('[data-chart-metric]')].find(e=>e.dataset.chartMetric===focused);
      selector?.focus({preventScroll:true});
    }
  }
  function updateStatus() {
    const relevant=defs.filter(d=>visibleLeagueIds().includes(d.id)).map(d=>feeds.get(d.key));
    const errors=relevant.filter(f=>f&&isStale(f));
    const offline=!navigator.onLine;
    const allFailed=relevant.length>0&&relevant.every(f=>f?.error&&!f.receivedAt);
    const message=offline?'You’re offline. Reconnect to load new scores.':allFailed?'The score feeds could not be reached. Check your connection or browser blockers; automatic retries are on.':'';
    $('connection-warning').hidden=!message;$('connection-warning').textContent=message;
    const seconds=lastCheck?Math.max(0,Math.floor((Date.now()-lastCheck)/1000)):null;
    $('refresh-status').textContent=offline?'Offline':document.hidden?'Updates paused':busy?'Checking scores…':errors.length?'Some scores unavailable':seconds===null?'Connecting…':`Checked ${seconds<5?'just now':seconds<60?seconds+'s ago':Math.floor(seconds/60)+'m ago'}`;
    $('refresh-status').classList.toggle('warning-text',!!errors.length||offline);
    for(const el of document.querySelectorAll('[data-retry]')) {
      const seconds=Math.max(0,Math.ceil((Number(el.dataset.retry)-Date.now())/1000));
      el.textContent=seconds?'Retrying in about '+seconds+'s.':'Retrying shortly.';
    }
  }
  for(const id of ['live-filter-main','live-filter-sticky'])$(id).addEventListener('click',()=>{
    liveOnly=!liveOnly;saveView();render();
    if(liveOnly)refresh();
    $(id).focus({preventScroll:true});
    $('announcer').textContent=liveOnly?'Showing live games only.':'Showing all games.';
  });
  $('sort').innerHTML=Object.entries(SORT_MODES).map(([key,mode])=>`<option value="${key}">${esc(mode.label)}</option>`).join('');
  $('sort').value=sortMode;$('group-sports').checked=grouped;
  $('sort').addEventListener('change',()=>{const next=$('sort').value;if(SORT_MODES[next]){sortMode=next;saveView();render();}});
  $('group-sports').addEventListener('change',()=>{grouped=$('group-sports').checked;saveView();render();});
  function paintSportTabs(){
    // Only one navigation: family icons reveal their leagues in-place.
    // Keep the sport icon in place when expanded; ALL precedes it.
    const families=SPORT_FAMILIES.filter(f=>f.leagues.some(id=>!hiddenLeagues.has(id))).sort((a,b)=>Math.min(...a.leagues.filter(id=>!hiddenLeagues.has(id)).map(id=>leagueOrder.indexOf(id)))-Math.min(...b.leagues.filter(id=>!hiddenLeagues.has(id)).map(id=>leagueOrder.indexOf(id))));
    let tabs=`<button type="button" role="tab" id="tab-all" aria-selected="${selected==='all'}" data-sport="all" data-state="${selected==='all'?'active':'inactive'}" class="sport-all" aria-label="All sports" title="All sports">All</button>`;
    for(const family of families){
      const expanded=selected==='sport:'+family.id||family.leagues.includes(selected);
      const leagueItems=leagueOrder.filter(id=>family.leagues.includes(id)&&!hiddenLeagues.has(id));
      const isSelected=selected==='sport:'+family.id;
      tabs+=`<div class="sport-family ${expanded?'family-expanded':''}" data-family="${family.id}">${expanded?`<button type="button" role="tab" data-sport="sport:${family.id}" aria-selected="${isSelected}" data-state="${isSelected?'active':'inactive'}" class="family-all-choice" title="All ${esc(family.name)} leagues" aria-label="All ${esc(family.name)} leagues">ALL</button>`:''}<button type="button" id="tab-sport-${family.id}" data-sport="sport:${family.id}" data-state="${expanded?'family':'inactive'}" title="${esc(family.name)}" aria-label="${esc(family.name)}" class="sport-family-trigger"><span class="sport-symbol" aria-hidden="true">${family.icon}</span></button>${expanded?leagueItems.map(id=>{const sport=SPORTS.find(s=>s.id===id);return `<button type="button" role="tab" id="tab-${id}" data-sport="${id}" data-state="${selected===id?'active':'inactive'}" aria-selected="${selected===id}" title="${esc(sport.name)}" class="league-nav-choice">${esc(sport.name)}</button>`;}).join(''):''}</div>`;
    }
    $('sport-tabs').innerHTML=tabs;
  }
  paintSportTabs();
  $('sport-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-sport]');if(button)selectTab(button.dataset.sport);});
  $('sport-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const buttons=Array.from($('sport-tabs').querySelectorAll('[data-sport]'));const i=buttons.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    selectTab(buttons[next].dataset.sport);
    $('sport-tabs').querySelector(`[data-sport="${buttons[next].dataset.sport}"]`)?.focus();
  });
  const settings=$('league-settings');
  const showSettings=()=>{paintSettings();settings.showModal();};
  const paintSettings=()=>{
    $('settings-list').innerHTML=leagueOrder.map((id,index)=>{
      const s=SPORTS.find(s=>s.id===id),visible=!hiddenLeagues.has(id);
      return `<div class="settings-item ${visible?'':'settings-item-hidden'}" data-settings-league="${id}">
        <label class="settings-item-label"><input type="checkbox" data-league-visible="${id}" ${visible?'checked':''}><span class="settings-color" style="background:${s.color}"></span><span>${esc(s.name)}</span></label>
        <div class="settings-order" aria-label="Order ${esc(s.name)}"><span class="settings-position">${index+1}</span><span class="settings-drag" draggable="true" data-settings-drag="${id}" title="Drag ${esc(s.name)} to reorder" aria-hidden="true">⠿</span><button type="button" data-settings-move="${id}" data-direction="-1" ${index===0?'disabled':''} aria-label="Move ${esc(s.name)} up">↑</button><button type="button" data-settings-move="${id}" data-direction="1" ${index===leagueOrder.length-1?'disabled':''} aria-label="Move ${esc(s.name)} down">↓</button></div></div>`;
    }).join('');
  };
  function applySettings(){resetSelectionIfHidden();saveLeagueLayout();paintSettings();paintSportTabs();render();if(!busy)refresh();}
  $('settings-open').addEventListener('click',showSettings);
  $('settings-close').addEventListener('click',()=>settings.close());
  $('settings-done').addEventListener('click',()=>settings.close());
  settings.addEventListener('click',event=>{if(event.target===settings)settings.close();});
  $('settings-reset').addEventListener('click',()=>{
    leagueOrder=[...leagueIds];hiddenLeagues.clear();collapsedLeagues.clear();
    applySettings();$('announcer').textContent='League layout reset to defaults.';
  });
  $('settings-list').addEventListener('change',event=>{
    const check=event.target.closest('[data-league-visible]');if(!check)return;
    const id=check.dataset.leagueVisible;
    if(!check.checked&&hiddenLeagues.size>=leagueIds.length-1){check.checked=true;$('announcer').textContent='Keep at least one league visible.';return;}
    if(check.checked)hiddenLeagues.delete(id);else hiddenLeagues.add(id);
    applySettings();
  });
  $('settings-list').addEventListener('click',event=>{
    const move=event.target.closest('[data-settings-move]');if(!move)return;
    const id=move.dataset.settingsMove,dir=Number(move.dataset.direction);
    if(moveLeagueBy(id,dir)){applySettings();$('settings-list').querySelector(`[data-settings-move="${id}"][data-direction="${dir}"]`)?.focus();}
  });
  let draggedSetting='';
  const clearSettingDrag=()=>$('settings-list').querySelectorAll('.settings-drop-before,.settings-drop-after,.settings-dragging').forEach(el=>el.classList.remove('settings-drop-before','settings-drop-after','settings-dragging'));
  $('settings-list').addEventListener('dragstart',event=>{
    const handle=event.target.closest('[data-settings-drag]');if(!handle)return;
    draggedSetting=handle.dataset.settingsDrag;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',draggedSetting);
    handle.closest('.settings-item')?.classList.add('settings-dragging');
  });
  $('settings-list').addEventListener('dragover',event=>{
    const target=event.target.closest('[data-settings-league]');if(!draggedSetting||!target||target.dataset.settingsLeague===draggedSetting)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
    const after=event.clientY>target.getBoundingClientRect().top+target.getBoundingClientRect().height/2;
    $('settings-list').querySelectorAll('.settings-drop-before,.settings-drop-after').forEach(el=>el.classList.remove('settings-drop-before','settings-drop-after'));
    target.classList.add(after?'settings-drop-after':'settings-drop-before');
  });
  $('settings-list').addEventListener('drop',event=>{
    const target=event.target.closest('[data-settings-league]');if(!target||!draggedSetting)return;
    event.preventDefault();const after=event.clientY>target.getBoundingClientRect().top+target.getBoundingClientRect().height/2;
    if(moveLeague(draggedSetting,target.dataset.settingsLeague,after))applySettings();
    clearSettingDrag();draggedSetting='';
  });
  $('settings-list').addEventListener('dragend',()=>{clearSettingDrag();draggedSetting='';});
  // League controls use delegation because the scoreboard is rerendered as feeds refresh.
  $('scores-panel').addEventListener('click',event=>{
    const collapse=event.target.closest('[data-collapse-league]');
    if(collapse){
      const id=collapse.dataset.collapseLeague;
      if(collapsedLeagues.has(id))collapsedLeagues.delete(id);else collapsedLeagues.add(id);
      saveLeagueLayout();render();
      $('scores-panel').querySelector(`[data-collapse-league="${id}"]`)?.focus({preventScroll:true});
      return;
    }
  });
  // Delegate controls so interactive details survive periodic score refreshes.
  $('scores-panel').addEventListener('click',event=>{
    const pin=event.target.closest('[data-pin-game]');
    if(pin){const game=findGame(pin.dataset.pinGame);if(game)togglePin(game);return;}
    const favorite=event.target.closest('[data-favorite-team]');
    if(favorite){const [league,id]=favorite.dataset.favoriteTeam.split(':');toggleTeamFavorite(league,id);return;}
    const monitor=event.target.closest('[data-monitor-open]');
    if(monitor){openMonitor(monitor.dataset.monitorOpen);return;}
    const toggle=event.target.closest('[data-expand]');
    if(toggle){toggleExpanded(toggle.dataset.expand,toggle.dataset.expandCopy);return;}
    const retry=event.target.closest('[data-details-retry]');
    if(retry){const g=findGame(retry.dataset.detailsRetry);if(g)loadExpanded(g,true);return;}
    const point=event.target.closest('[data-point]');
    if(point)selectPoint(point);
  });
  function selectPoint(point){
    const g=findGame(expandedGame),data=getSummary(findGame(expandedGame)??{})?.data;
    if(!g)return;
    const {series,metric,options}=selectedChartSeries(g,data),p=series?.points[Number(point.dataset.point)];
    const readout=point.closest('.chart-panel')?.querySelector('.chart-readout');
    if(readout&&p)readout.textContent=`${p.label} · ${g.sides[0].short} ${p.away} – ${p.home} ${g.sides[1].short}${metric==='score'?'':' · '+(options.find(([id])=>id===metric)?.[1]??metric)}`;
  }
  function onMetricChange(event){
    const input=event.target.closest('[data-chart-metric]');
    if(!input)return;
    const id=input.dataset.chartMetric,g=findGame(id);
    if(!g)return;
    const available=availableGraphMetrics(g,getSummary(g)?.data);
    if(!available.some(([value])=>value===input.value))return;
    const inMonitor=monitorDialog.contains(input);
    preferences(id).metric=input.value;
    if(!playerScoringTimeline(g,getSummary(g)?.data,input.value).some(p=>p.id===preferences(id).playerId))preferences(id).playerId='';
    paintExpanded(id);
    if(inMonitor)renderMonitor();
    const surface=inMonitor?monitorDialog:$('scores-panel');
    [...surface.querySelectorAll('[data-chart-metric]')].find(el=>el.dataset.chartMetric===id)?.focus({preventScroll:true});
  }
  monitorDialog.addEventListener('click',event=>{
    const button=event.target.closest('[data-box-stat-metric]');if(!button||!monitorGame)return;
    const game=findGame(monitorGame),metric=button.dataset.boxStatMetric;
    if(!game||!availableGraphMetrics(game,getSummary(game)?.data).some(([id])=>id===metric))return;
    preferences(game.id).metric=metric;
    if(!playerScoringTimeline(game,getSummary(game)?.data,metric).some(p=>p.id===preferences(game.id).playerId))preferences(game.id).playerId='';
    monitorView='overview';monitorDialog.scrollTop=0;renderMonitor();
    monitorDialog.querySelector('[data-chart-metric]')?.focus({preventScroll:true});
  });
  function statToChartClick(event){
    const button=event.target.closest('[data-stat-metric][data-stat-game]');if(!button)return;
    const id=button.dataset.statGame,game=findGame(id),metric=button.dataset.statMetric;
    if(!game||!availableGraphMetrics(game,getSummary(game)?.data).some(([m])=>m===metric))return;
    preferences(id).metric=metric;
    if(!playerScoringTimeline(game,getSummary(game)?.data,metric).some(p=>p.id===preferences(id).playerId))preferences(id).playerId='';
    const inMonitor=monitorDialog.contains(button);
    if(inMonitor)renderMonitor();else paintExpanded(id);
    const chart=(inMonitor?monitorDialog:$('scores-panel')).querySelector('.chart-panel');
    chart?.scrollIntoView({block:'nearest',behavior:'auto'});
    chart?.querySelector('[data-chart-metric]')?.focus({preventScroll:true});
  }
  $('scores-panel').addEventListener('click',statToChartClick);
  monitorDialog.addEventListener('click',statToChartClick);
  $('scores-panel').addEventListener('change',onMetricChange);
  monitorDialog.addEventListener('pointermove',moveChartCursor);
  monitorDialog.addEventListener('pointerdown',moveChartCursor);
  monitorDialog.addEventListener('pointerleave',event=>{
    const svg=event.target.closest?.('.monitor-interactive-chart');if(!svg||svg!==event.target||svg.dataset.chartPinned==='true')return;
    for(const shape of svg.querySelectorAll('.chart-cursor-line,.chart-cursor-away,.chart-cursor-home'))shape.setAttribute('visibility','hidden');
    const tooltip=svg.closest('.monitor-chart-wrap')?.querySelector('[data-chart-tooltip]');if(tooltip)tooltip.hidden=true;
  },true);
  monitorDialog.addEventListener('keydown',event=>{
    const svg=event.target.closest?.('.monitor-interactive-chart');if(!svg||!['ArrowLeft','ArrowRight','Escape'].includes(event.key))return;
    if(event.key==='Escape'){
      if(svg.dataset.chartPinned==='true'){event.stopPropagation();event.preventDefault();svg.dataset.chartPinned='false';delete preferences(svg.dataset.chartGame).chartPinX;}
      return;
    }
    event.preventDefault();const hi=Number(svg.dataset.chartHi),old=Number(svg.dataset.chartPinnedX??0);
    svg.dataset.chartPinned='false';chartCursorAt(svg,old+(event.key==='ArrowRight'?1:-1)*hi/48,true);
  });
  monitorDialog.addEventListener('click',event=>{
    const button=event.target.closest('[data-select-performer]');
    if(!button)return;
    const id=button.dataset.selectPerformer,g=findGame(id);
    if(!g)return;
    const choice=button.dataset.playerId;
    if(!playerScoringTimeline(g,getSummary(g)?.data,selectedChartSeries(g,getSummary(g)?.data).metric).some(p=>String(p.id)===choice))return;
    const prefs=preferences(id);
    prefs.playerId=String(prefs.playerId??'')===choice?'':choice;
    // Preserve the selected compatible metric (e.g., hockey shots or baseball hits).
    renderMonitor();
    const active=monitorDialog.querySelector(`[data-select-performer][data-player-id="${CSS.escape(choice)}"]`);
    active?.focus({preventScroll:true});
  });
  monitorDialog.addEventListener('change',onMetricChange);
  monitorDialog.addEventListener('change',event=>{
    const select=event.target.closest('[data-monitor-player]');if(!select)return;
    const g=findGame(select.dataset.monitorPlayer);if(!g)return;
    const players=playerScoringTimeline(g,getSummary(g)?.data,selectedChartSeries(g,getSummary(g)?.data).metric);
    if(select.value&&!players.some(p=>p.id===select.value))return;
    preferences(g.id).playerId=select.value;
    // Selecting a player does not silently change the statistical figure.
    renderMonitor();
    monitorDialog.querySelector('[data-monitor-player]')?.focus({preventScroll:true});
  });
  for(const surface of [$('scores-panel'),monitorDialog]){
    surface.addEventListener('pointerover',event=>{
      const point=event.target.closest('[data-point]');if(point)selectPoint(point);
    });
    surface.addEventListener('keydown',event=>{
      if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-point]')){event.preventDefault();selectPoint(event.target);}
    });
  }
  // If a logo fails, its text badge remains visible. No external asset is required for the UI.
  for(const surface of [$('scores-panel'),monitorDialog])surface.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
  $('previous').addEventListener('click',()=>changeDay(dayShift(day,-1)));
  $('next').addEventListener('click',()=>changeDay(dayShift(day,1)));
  $('today').addEventListener('click',()=>changeDay(dateInZone(new Date(),zone)));
  $('date').addEventListener('change',event=>changeDay(event.target.value));
  $('refresh').addEventListener('click',()=>refresh(true));
  $('timezone').textContent='Times in '+zone.replaceAll('_',' ')+'.';
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});
  window.addEventListener('online',()=>refresh(true));
  window.addEventListener('offline',()=>{render();updateStatus();});
  setInterval(()=>{
    const today=dateInZone(new Date(),zone);
    if(followToday&&day!==today){changeDay(today);return;}
    const nextSignature=Array.from(feeds.entries()).map(([k,f])=>k+isStale(f)).join('|');
    if(staleSignature!==nextSignature)render();else updateStatus();
  },1000);
  setInterval(()=>refresh(),REFRESH_MS);
  updateDate();render();refresh();
})();

