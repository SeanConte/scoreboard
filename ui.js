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
        if(!key||numeric===null)continue;
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
          if(!player){player={id:String(players.length),name:shortText(name,60),team:idx,stats:[]};players.push(player);}
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
  function graphSVG(g,series,colors){
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
    return `<svg class="margin-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="Both teams’ cumulative totals plotted by ${esc(unit.toLowerCase())}"><g>${horizontal}${separators}${periodLabels}${shading}${lines}${dots}${axisTicks}${axisName}</g></svg>`;
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
  function graphSection(g,data){
    const {options,metric,series}=selectedChartSeries(g,data),colors=teamColors(g,data);
    const selectedLabel=options.find(([id])=>id===metric)?.[1]??'Score';
    const subtitle=metric==='score'?(series?.quality==='plays'?{clock:'Scoring plays · elapsed game time',minutes:'Goals · match minute',inning:'Runs · by half-inning'}[series.basis]??'Scoring plays':g.tennis?'Cumulative games by set':g.league==='mlb'?'Inning totals':'Period totals'):
      series?.basis==='clock'?'Running totals · elapsed game minutes':series?.basis==='minutes'?'Running totals · match minute':series?.basis==='inning'?'Running totals · inning / batting half':'Running totals · by set';
    const selector=options.length>1?`<label class="chart-heading"><span class="sr-only">Graph statistic</span><select class="chart-metric-select" aria-label="Graph statistic" data-chart-metric="${esc(g.id)}">${opts(options,metric)}</select></label>`:`<h3>Scoring progression</h3>`;
    const legend=`<div class="chart-legend" aria-label="Team colors">${g.sides.slice(0,2).map((side,i)=>`<span><i style="background:${colors[i]}"></i>${esc(side.short)}</span>`).join('')}</div>`;
    if(!series)return `<section class="detail-panel chart-panel"><div class="detail-panel-head"><div>${selector}<p>${esc(subtitle)}</p></div>${legend}</div><div class="detail-empty">${g.state==='pre'?'The game has not started.':'A scoring timeline isn’t available for this game.'}</div></section>`;
    const last=series.points.at(-1);
    const footnote=metric!=='score'?`${series.coverage==='set-score'?'Derived from reported set scores.':'Cumulative event totals.'} Dots mark changes in this statistic.${series.coverage==='reconciled'?' Verified against final team totals.':series.coverage==='event-based'?' Live event timeline may still be incomplete.':''}${series.basis==='inning'?' Positions within each half-inning are event order, not clock time.':''}`:series.quality==='plays'?{clock:'Each point uses the recorded game clock; spacing reflects elapsed game minutes.',minutes:'Goal events positioned by elapsed match minute, including added time.',inning:'Scoring events positioned within their recorded inning halves; spacing within a half-inning is ordinal, not clock time.'}[series.basis]:g.tennis?'Games won cumulatively by set; not point-by-point scoring.':g.league==='mlb'?'Inning-end scores; exact scoring moments are unavailable.':'Period totals only (including any live partial period); exact scoring times are unavailable.';
    const missingMetrics=data&&g.state!=='pre'&&options.length===1&&(progressionOptions[g.league]?.length??0)>0;
    const area=signedArea(g,series);
    const signed=area&&area.span>0?`<div class="area-difference" title="Signed difference of the integrals of the two running totals over elapsed game time; positive values favor ${esc(g.sides[0].short)}. Leads by one team cancel leads by the other."><span>Signed area (∫Δ)</span><strong style="color:${colors[area.value>=0?0:1]}">${esc(Math.abs(area.value).toLocaleString(undefined,{maximumFractionDigits:1}))} ${esc(metric==='score'?(g.league==='nhl'||g.league==='mls'||g.league==='nwsl'?'goal·min':'pt·min'):['rushYards','passYards','totalYards'].includes(metric)?'yd·min':'count·min')}</strong><span>${esc(Math.abs(area.value)<.0001?'Even':g.sides[area.value>0?0:1].short+' advantage')}</span></div>`:'';
    return `<section class="detail-panel chart-panel"><div class="detail-panel-head"><div>${selector}<p>${esc(metric==='score'?subtitle:selectedLabel+' · '+subtitle)}</p></div>${legend}</div><div class="chart-wrap">${graphSVG(g,series,colors)}</div><div class="chart-readout" aria-live="polite">${esc(last.label)} · ${esc(g.sides[0].short)} ${last.away} – ${last.home} ${esc(g.sides[1].short)}${metric==='score'?'':` · ${esc(selectedLabel)}`}</div>${signed}<p class="chart-source">${esc(footnote)}${missingMetrics?' Additional stat histories unavailable or unverified for this game.':''}</p></section>`;
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
  function statsForDisplay(g,box){
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
    const config={nba:{focus:[['PTS']],extras:[['REB'],['AST']],count:2},wnba:{focus:[['PTS']],extras:[['REB'],['AST']],count:2},
      nfl:{focus:[['YDS','PASSING'],['YDS','RUSHING'],['YDS','RECEIVING']],extras:[['TD'],['YDS']],count:3},
      cfb:{focus:[['YDS','PASSING'],['YDS','RUSHING'],['YDS','RECEIVING']],extras:[['TD'],['YDS']],count:3},
      mlb:{focus:[['H'],['RBI'],['HR']],extras:[['RBI'],['HR'],['H']],count:2},
      nhl:{focus:[['G'],['A'],['SV']],extras:[['G'],['A'],['SOG']],count:2},
      mls:{focus:[['G'],['A'],['SH']],extras:[['G'],['A'],['SH']],count:2},
      nwsl:{focus:[['G'],['A'],['SH']],extras:[['G'],['A'],['SH']],count:2}}[g.league];
    if(!config)return [[],[]];
    return [0,1].map(team=>{
      const players=box.players.filter(p=>p.team===team),picked=[];
      if(g.league==='nfl'||g.league==='cfb'){
        for(const [code,group] of config.focus){
          const chosen=players.map(p=>({p,stat:byCode(p,[code],[group.toLowerCase()])})).filter(x=>x.stat&&metricNumber(x.stat.value)!==null).sort((a,b)=>metricNumber(b.stat.value)-metricNumber(a.stat.value))[0];
          if(chosen&&!picked.some(x=>x.p.id===chosen.p.id))picked.push(chosen);
        }
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
        return {name:p.name,value:stat.value,unit,secondary};
      });
    });
  }
  function topPerformers(g,box,colors){
    const groups=performerRows(g,box);
    if(!groups.some(rows=>rows.length))return '';
    return `<section class="detail-panel performers-panel"><div class="detail-panel-head"><div><h3>Top performers</h3><p>Game totals</p></div></div><div class="performer-teams">${groups.map((rows,i)=>`<div class="performer-team"><div class="performer-team-name"><i style="background:${colors[i]}"></i>${esc(g.sides[i].short)}</div>${rows.length?rows.map(row=>`<div class="performer-row"><div class="performer-person"><strong>${esc(row.name)}</strong>${row.secondary.length?`<span>${row.secondary.map(s=>`${esc(s.value)} ${esc(s.code)}`).join(' · ')}</span>`:''}</div><span class="performer-number">${esc(row.value)} <small>${esc(row.unit)}</small></span></div>`).join(''):'<p class="stat-unavailable">No player totals available</p>'}</div>`).join('')}</div></section>`;
  }
  function statsSection(g,data){
    if(g.tennis){
      const games=tennisHistory(g,'gamesWon'),sets=tennisHistory(g,'setsWon');
      if(!games||!sets)return `<section class="detail-panel stats-panel"><h3>Match statistics</h3><div class="detail-empty">Set scores will appear as the match progresses.</div></section>`;
      const values=[['Sets won',sets.points.at(-1)],['Games won',games.points.at(-1)]];
      return `<section class="detail-panel stats-panel"><div class="detail-panel-head"><div><h3>Match totals</h3><p>From recorded set scores</p></div></div><div class="team-stat-list">${values.map(([label,last])=>`<div class="stat-match"><div class="stat-match-values"><strong>${esc(last.away)}</strong><span>${esc(label)}</span><strong>${esc(last.home)}</strong></div></div>`).join('')}</div></section>`;
    }
    const box=parseBox(g,data),colors=teamColors(g,data),rows=statsForDisplay(g,box);
    const statHtml=rows.length?`<section class="detail-panel stats-panel"><div class="detail-panel-head"><div><h3>Team statistics</h3><p>Selected game totals</p></div></div><div class="stat-team-head"><span><i style="background:${colors[0]}"></i>${esc(g.sides[0].short)}</span><span>${esc(g.sides[1].short)}<i style="background:${colors[1]}"></i></span></div><div class="team-stat-list">${rows.map(({label,a,b})=>{
      const max=Math.max(Math.abs(a.value),Math.abs(b.value),1),left=Math.max(0,Math.min(100,Math.abs(a.value)/max*100)),right=Math.max(0,Math.min(100,Math.abs(b.value)/max*100));
      return `<div class="stat-match"><div class="stat-match-values"><strong>${esc(a.display)}</strong><span>${esc(label)}</span><strong>${esc(b.display)}</strong></div><div class="stat-match-bars"><div><span style="width:${left}%;background:${colors[0]}"></span></div><div><span style="width:${right}%;background:${colors[1]}"></span></div></div></div>`;
    }).join('')}</div></section>`:'';
    const performerHtml=topPerformers(g,box,colors);
    if(statHtml||performerHtml)return `<div class="detail-rail">${statHtml}${performerHtml}</div>`;
    return `<section class="detail-panel stats-panel"><div class="detail-panel-head"><div><h3>Game statistics</h3></div></div><div class="detail-empty">${g.state==='pre'?'Stats will appear as the game gets underway.':'Team and player totals aren’t available for this game.'}</div></section>`;
  }
  function detailContent(g){
    const entry=getSummary(g),pref=preferences(g.id),data=entry?.data;
    const status=entry?.loading&&!data?'<p class="detail-refresh" role="status">Loading detailed game statistics…</p>':entry?.error&&!data?`<p class="detail-refresh" role="status">${esc(entry.error)} Showing any available period scores. <button class="details-retry" type="button" data-details-retry="${esc(g.id)}">Retry</button></p>`:'';
    return `<div class="expanded-inner">${status}<div class="expanded-layout">${graphSection(g,data)}${statsSection(g,data)}</div>${periodTable(g,data)}${entry?.loading&&data?'<p class="detail-refresh">Updating details…</p>':''}${entry?.error&&data?`<p class="detail-refresh">${esc(entry.error)} Showing last received data.</p>`:''}</div>`;
  }
  function paintExpanded(id){
    if(expandedGame!==id)return;
    const element=document.getElementById('details-'+id);
    const game=findGame(id);
    if(element&&game)element.innerHTML=detailContent(game);
  }
  function toggleExpanded(id){
    expandedGame=expandedGame===id?'':id;
    render();
    const button=[...document.querySelectorAll('[data-expand]')].find(el=>el.dataset.expand===id);
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
  function card(g,stale) {
    const opened=expandedGame===g.id;
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
      return `<div class="side ${s.winner?'winner':''}"><div class="team-name">${badge}<span><span class="name">${position}${esc(s.name)}${s.serving?'<span class="serve" aria-label="Serving">●</span>':''}</span>${s.record?`<span class="record">${esc(s.record)}</span>`:''}</span></div>${sets}</div>`;
    }).join('');
    const sport=SPORTS.find(s=>s.id===g.league);
    const gap=gapOf(g);
    const gapText=gap?(g.tennis?`Set gap ${gap.primary} · latest-set gap ${gap.secondary}`:`Gap ${gap.primary} ${gap.unit}`):'';
    const timeText=Number.isFinite(g.remainingSeconds)?`${clockLabel(g.remainingSeconds)} ${g.timeBasis==='current OT'?'in this OT':'reg. left'}`:g.timeBasis==='untimed OT'?'Untimed OT':'';
    const metricText=[gapText,timeText].filter(Boolean).join(' · ');
    const sparkline=miniScoreFlow(g);
    return `<article style="--league-color:${sport?.color??'#a2afbd'}" class="score-card ${live?'live-card':''} ${completed?'completed-card':''} ${opened?'expanded-card':''}"><div class="game-meta"><span class="game-meta-left"><span class="league-tag">${esc(sport?.name??g.league)}${g.league==='cfb'?' · FBS':''}</span>${g.context?.label?`<span class="game-context">· ${esc(g.context.label)}</span>`:''}${g.context?.series?`<span class="game-context">· ${esc(g.context.series)}</span>`:''}</span><span class="game-start">Start ${esc(starts)}</span></div><div class="card-top"><span class="${live?'live-label':'game-status'}">${live?'<span class="live-badge"><span class="live-dot" aria-hidden="true"></span>LIVE</span>':''}<span>${stale?'Last known · ':''}${esc(status)}</span></span>${g.tennis?`<span class="match-title">${esc(g.title)}</span>`:`<span class="card-detail">${esc(g.detail)}</span>`}</div>${g.tennis?`<div class="tennis-label">${esc(g.detail)}</div>`:''}<div class="sides">${rows}</div>${metricText||sparkline?`<div class="game-metrics game-metrics-flow"><span>${stale?'Last known · ':''}${esc(metricText)}</span>${sparkline}</div>`:''}<div class="card-bottom"><span>${esc(g.venue||'Venue not listed')}</span><div class="card-actions"><button type="button" class="game-flow-toggle" data-expand="${esc(g.id)}" aria-expanded="${opened}" aria-label="${opened?'Hide':'Show'} game flow and statistics for ${esc(g.title)}" aria-controls="details-${esc(g.id)}"><svg class="game-flow-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12 6 8l3 2 5-6"/></svg><span>Game flow + stats</span><span class="expand-chevron" aria-hidden="true">⌄</span></button>${g.url?`<a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer" aria-label="Details for ${esc(g.title)}">Details ↗</a>`:''}</div></div>${opened?`<div id="details-${esc(g.id)}" role="region" aria-label="${esc(g.title)} game details">${detailContent(g)}</div>`:''}</article>`;
  }
  let staleSignature='';
  function render() {
    const focused=document.activeElement?.getAttribute?.('data-chart-metric');
    const visible=SPORTS.filter(s=>selected==='all'||s.id===selected);
    let live=0,count=0,unknown=false;
    const allItems=[],allNotices=[],waiting=[];
    const groupedHTML=visible.map(s=>{
      const sources=defs.filter(d=>d.id===s.id);
      const ff=sources.map(d=>({def:d,feed:feeds.get(d.key)}));
      const items=ff.flatMap(({feed:f})=>f?f.games.map(g=>({game:g,stale:isStale(f)})):[])
        .sort((a,b)=>compareGames(a,b,sortMode));
      allItems.push(...items);
      count+=items.length;live+=items.filter(i=>gamePhase(i)===0).length;
      const pending=ff.some(({feed:f})=>!f||f.loading&&!f.receivedAt);
      const errors=ff.filter(({feed:f})=>f&&isStale(f));
      const incomplete=pending||!!errors.length;unknown||=incomplete;
      if(pending)waiting.push(s.name);
      const supplement=ff.filter(({feed:f})=>f?.coverageWarning).map(({feed:f})=>`<div class="feed-warning"><span>${esc(f.coverageWarning)}</span></div>`).join('');
      const notices=supplement+errors.map(({def:d,feed:f})=>`<div class="feed-warning"><span>${esc(d.label+': ')}${f.error?'Feed unavailable.':'Scores have not refreshed recently.'} ${f.receivedAt?'Last received '+esc(time(f.receivedAt))+'. ':''}${f.error?`<span data-retry="${f.nextTry}"></span>`:'Checking again automatically.'}</span></div>`).join('');
      allNotices.push(notices);
      const subtitle=items.length?`${items.length} ${s.id==='tennis'?'matches':'games'}${incomplete?' · incomplete':''}`:s.id==='tennis'?'Australian Open · Roland-Garros · Wimbledon · US Open':s.id==='cfb'?'FBS · all rankings':'Daily schedule';
      let content;
      if(items.length)content=`<div class="games-grid">${items.map(i=>card(i.game,i.stale)).join('')}</div>`;
      else if(pending)content=`<div class="empty-state loading-state"><span class="empty-dash">···</span><div><p>Loading ${esc(s.name)} scores…</p><span>Connecting to ESPN.</span></div></div>`;
      else content=`<div class="empty-state"><span class="empty-dash">—</span><div><p>${errors.length?'Waiting for scores':s.id==='tennis'?'No Grand Slam singles matches listed':'No games listed for this date'}</p><span>${errors.length?'Automatic retries are on. You can also use Refresh.':s.id==='tennis'?'Men’s and women’s singles across the four majors.':'Choose another date to see the schedule.'}</span></div></div>`;
      return `<section class="league-section" style="--league-color:${s.color}" aria-label="${esc(s.name)}"><div class="league-heading"><h2><span class="league-bar" aria-hidden="true"></span>${esc(s.name)}</h2><span>${subtitle}</span></div>${notices}${content}</section>`;
    }).join('');
    const across=!grouped&&selected==='all';
    allItems.sort((a,b)=>compareGames(a,b,sortMode));
    $('scores-panel').innerHTML=across?`<section class="league-section" aria-label="All games sorted together">${allNotices.join('')}${waiting.length?`<p class="loading-summary">Loading ${esc(waiting.join(', '))}…</p>`:''}${allItems.length?`<div class="games-grid">${allItems.map(i=>card(i.game,i.stale)).join('')}</div>`:waiting.length?'':`<div class="empty-state"><span class="empty-dash">—</span><div><p>${unknown?'Waiting for scores':'No games listed for this date'}</p><span>${unknown?'Automatic retries are on.':'Choose another date to see the schedule.'}</span></div></div>`}</section>`:groupedHTML;
    $('sort-scope').textContent=across?'Sorting across all sports.':selected==='all'?'Sorting within each sport.':'Sorting this sport.';
    $('sort-description').textContent=SORT_MODES[sortMode].help;
    $('group-sports').disabled=selected!=='all';
    $('live-count').textContent=String(live);
    $('event-count').textContent=`/ ${count} events${unknown?' · partial':''}`;
    staleSignature=Array.from(feeds.entries()).map(([k,f])=>k+isStale(f)).join('|');
    updateStatus();
    if(focused){
      const selector=[...$('scores-panel').querySelectorAll('[data-chart-metric]')].find(e=>e.dataset.chartMetric===focused);
      selector?.focus({preventScroll:true});
    }
  }
  function updateStatus() {
    const relevant=defs.filter(d=>selected==='all'||d.id===selected).map(d=>feeds.get(d.key));
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
  $('sort').innerHTML=Object.entries(SORT_MODES).map(([key,mode])=>`<option value="${key}">${esc(mode.label)}</option>`).join('');
  $('sort').value=sortMode;$('group-sports').checked=grouped;
  $('sort').addEventListener('change',()=>{const next=$('sort').value;if(SORT_MODES[next]){sortMode=next;saveView();render();}});
  $('group-sports').addEventListener('change',()=>{grouped=$('group-sports').checked;saveView();render();});
  $('sport-tabs').innerHTML=[{id:'all',name:'All sports'},...SPORTS].map(s=>`<button type="button" role="tab" id="tab-${s.id}" aria-controls="scores-panel" aria-selected="${s.id==='all'}" tabindex="${s.id==='all'?0:-1}" data-slot="tabs-trigger" data-sport="${s.id}" data-state="${s.id==='all'?'active':'inactive'}">${s.color?`<span class="sport-color" style="background:${s.color}" aria-hidden="true"></span>`:''}${esc(s.name)}</button>`).join('');
  $('sport-tabs').addEventListener('click',event=>{const button=event.target.closest('[role="tab"]');if(button)selectTab(button.dataset.sport);});
  $('sport-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const buttons=Array.from($('sport-tabs').querySelectorAll('[role="tab"]'));const i=buttons.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[next].focus();selectTab(buttons[next].dataset.sport);
  });
  // Delegate controls so interactive details survive periodic score refreshes.
  $('scores-panel').addEventListener('click',event=>{
    const toggle=event.target.closest('[data-expand]');
    if(toggle){toggleExpanded(toggle.dataset.expand);return;}
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
  $('scores-panel').addEventListener('change',event=>{
    const input=event.target.closest('[data-chart-metric]');
    if(!input)return;
    const id=input.dataset.chartMetric,g=findGame(id);
    if(!g)return;
    const available=availableGraphMetrics(g,getSummary(g)?.data);
    if(!available.some(([value])=>value===input.value))return;
    preferences(id).metric=input.value;
    paintExpanded(id);
    const updated=document.querySelector('[data-chart-metric="'+CSS.escape(id)+'"]');
    updated?.focus({preventScroll:true});
  });
  $('scores-panel').addEventListener('pointerover',event=>{
    const point=event.target.closest('[data-point]');if(point)selectPoint(point);
  });
  $('scores-panel').addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-point]')){event.preventDefault();selectPoint(event.target);}
  });
  // If a logo fails, its text badge remains visible. No external asset is required for the UI.
  $('scores-panel').addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
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

