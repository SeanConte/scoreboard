  // Event-level metrics, never estimated by spreading final box-score totals over time.
  // Score stays the default; unsupported metrics are absent from the selector.
  const progressionOptions={
    nba:[['threesMade','3PT made'],['threesAttempted','3PT attempts'],['fgMade','FG made'],['fgAttempted','FG attempts'],['ftMade','FT made'],['ftAttempted','FT attempts'],['rebounds','Rebounds'],['assists','Assists'],['turnovers','Turnovers']],
    wnba:[['threesMade','3PT made'],['threesAttempted','3PT attempts'],['fgMade','FG made'],['fgAttempted','FG attempts'],['ftMade','FT made'],['ftAttempted','FT attempts'],['rebounds','Rebounds'],['assists','Assists'],['turnovers','Turnovers']],
    nfl:[['rushYards','Rushing yards'],['passYards','Passing yards'],['totalYards','Total yards'],['rushAttempts','Rush attempts'],['firstDowns','First downs']],
    cfb:[['rushYards','Rushing yards'],['passYards','Passing yards'],['totalYards','Total yards'],['rushAttempts','Rush attempts'],['firstDowns','First downs']],
    mlb:[['hits','Hits'],['walks','Walks'],['strikeouts','Strikeouts'],['homeRuns','Home runs']],
    nhl:[['shotsOnGoal','Shots on goal'],['hits','Hits'],['faceoffsWon','Faceoffs won']],
    mls:[['shots','Shots'],['shotsOnTarget','Shots on target'],['corners','Corners'],['yellowCards','Yellow cards']],
    nwsl:[['shots','Shots'],['shotsOnTarget','Shots on target'],['corners','Corners'],['yellowCards','Yellow cards']],
    tennis:[['setsWon','Sets won']],
    atp:[['setsWon','Sets won']],wta:[['setsWon','Sets won']]
  };
  function eventTeamIndex(g,data,play,drive){
    const comps=data?.header?.competitions?.[0]?.competitors??[];
    const entity=play?.team??drive?.team??{};
    const ref=entity?.$ref??entity?.team?.$ref??play?.teamRef??'';
    const refId=typeof ref==='string'?ref.match(/\/teams\/(\d+)(?:[/?#]|$)/)?.[1]:undefined;
    const id=String(entity?.id??entity?.team?.id??play?.teamId??play?.team?.teamId??refId??'');
    if(id){
      const side=g.sides.findIndex(s=>String(s.id??'')===id);
      if(side>=0)return side;
    }
    const abbr=String(entity?.abbreviation??entity?.team?.abbreviation??'').toUpperCase();
    if(id){
      const match=comps.find(c=>String(c.team?.id??c.id)===id);
      if(match){
        const ab=String(match.team?.abbreviation??'').toUpperCase();
        const side=g.sides.findIndex(s=>String(s.short).toUpperCase()===ab);
        if(side>=0)return side;
        if(match.homeAway==='away')return 0;
        if(match.homeAway==='home')return 1;
      }
    }
    if(abbr){const found=g.sides.findIndex(s=>String(s.short).toUpperCase()===abbr);if(found>=0)return found;}
    const homeAway=String(play?.homeAway??entity?.homeAway??'').toLowerCase();
    if(homeAway==='away')return 0;
    if(homeAway==='home')return 1;
    return -1;
  }
  // Prefer full football drive plays, supplemented by uniquely identified direct
  // plays. Never merge unidentifiable duplicates from a second source.
  function eventSamples(g,data){
    const direct=Array.isArray(data?.plays)?data.plays:[];
    if(g.league==='nba'||g.league==='wnba'){
      const seen=new Set();return direct.filter(play=>{
        const id=String(play?.id??'');
        if(!id)return true;
        if(seen.has(id))return false;
        seen.add(id);return true;
      }).map(play=>({play,drive:null}));
    }
    if(g.league!=='nfl'&&g.league!=='cfb')return [];
    const drives=data?.drives;
    const groups=[...(Array.isArray(drives?.previous)?drives.previous:[]),...(drives?.current?[drives.current]:[])];
    const nested=groups.flatMap(d=>(Array.isArray(d.plays)?d.plays:[]).map(play=>({play,drive:d})));
    const primary=nested.length>=direct.length?nested:direct.map(play=>({play,drive:null}));
    const secondary=nested.length>=direct.length?direct.map(play=>({play,drive:null})):nested;
    const seen=new Set(),result=[];
    for(const [index,source] of [primary,secondary].entries())for(const item of source){
      const id=String(item.play?.id??'');
      if(index===1&&!id)continue; // Cannot safely merge unidentified events.
      if(id&&seen.has(id))continue;
      if(id)seen.add(id);
      result.push(item);
    }
    return result;
  }
  // Per-sport non-scoring progressions share the same event -> axis -> series pipeline.
  // Prefer a complete play list over scoring/key-event subsets. Never interpolate totals.
  const newMetricLeagues=new Set(['mlb','nhl','mls','nwsl']);
  const metricMemo=new WeakMap();
  function metricSamples(g,data){
    const arrays=[data?.progressionPlays,data?.plays,data?.playByPlay?.plays,data?.playbyplay?.plays,data?.details?.plays,
      data?.commentary?.plays,data?.keyEvents].filter(Array.isArray);
    // The full core feed is more trustworthy than a longer collection of highlights.
    const raw=(Array.isArray(data?.progressionPlays)&&data.progressionPlays.length>=5
      ?data.progressionPlays:arrays.sort((a,b)=>b.length-a.length)[0])??[];
    const unique=[],seen=new Set();
    for(const play of raw){
      const id=String(play?.id??'');
      const description=String(play?.text??play?.shortText??'').trim();
      const key=id|| (description?['text',description,playPeriod(play),play?.clock?.displayValue,play?.team?.id].join('|'):'');
      if(key&&seen.has(key))continue;
      if(key)seen.add(key);
      unique.push({play,drive:null});
    }
    return unique;
  }
  function actionText(p){return String([p?.type?.text,p?.type?.name,p?.alternativeType?.text,p?.result?.type,p?.result?.event,p?.type?.type].filter(Boolean).join(' ')).toLowerCase();}
  function eventDeltas(g,play){
    const kind=actionText(play),desc=String(play?.text??play?.shortText??'').toLowerCase();
    const raw=kind+' '+desc;
    if(g.league==='mlb'){
      const hit=/\b(?:single|double|triple|home run|homerun|homered|base hit)\b/.test(kind)||
        /\b(?:singled|doubled|tripled|homered)\b/.test(desc);
      const homer=/\b(?:home run|homerun|homered)\b/.test(kind)||/\bhomered\b/.test(desc);
      const walk=/\b(?:walk|base on balls)\b/.test(kind)&&!/intentional.*walked past/.test(raw);
      const so=/\b(?:strikeout|strike out|struck out)\b/.test(kind)||/\bstruck out\b/.test(desc);
      return {hits:+hit,walks:+walk,strikeouts:+so,homeRuns:+homer};
    }
    if(g.league==='nhl'){
      const excluded=/\b(?:blocked|missed|wide|off target|disallowed|no goal)\b/.test(raw);
      const goal=(play.scoringPlay===true||/\bgoal\b/.test(kind))&&!excluded;
      const shot=(play.shootingPlay===true||/\b(?:shot on goal|shot-on-goal|saved shot|shot)\b/.test(kind))&&!excluded;
      const hit=/\b(?:hit|body check)\b/.test(kind);
      const faceoff=/\bface[ -]?off\b/.test(kind)&&/\b(?:win|won|winner)\b/.test(raw);
      // ESPN classifies a goal as a shot on goal. Never double-count one event.
      return {shotsOnGoal:+(goal||shot),hits:+hit,faceoffsWon:+faceoff};
    }
    if(g.league==='mls'||g.league==='nwsl'){
      const goal=/\bgoal\b/.test(kind)&&!/own goal|disallowed/.test(raw);
      const onTarget=/\b(?:shot on target|shot on goal|saved shot)\b/.test(raw)||goal;
      const blockedOrMiss=/\b(?:blocked shot|shot blocked|shot wide|shot off target)\b/.test(raw);
      const shot=/\bshot\b/.test(raw)||onTarget;
      const corner=/\bcorner(?: kick)?\b/.test(kind);
      const yellow=/\b(?:yellow card|booking|booked)\b/.test(kind);
      return {shots:+shot,shotsOnTarget:+(onTarget&&!blockedOrMiss),corners:+corner,yellowCards:+yellow};
    }
    return {};
  }

  function eventAxis(g,play){
    const period=playPeriod(play);
    // Shootout attempts do not count toward official NHL shots on goal.
    if(g.league==='nhl'&&/shootout/i.test(String(play.period?.type??'')+' '+String(play.period?.displayValue??'')))return null;
    if(g.league==='mlb'){
      if(period<1)return null;
      const half=inningHalf(play);
      if(!half)return null; // Can't attribute baseball actions without the batting half.
      return {basis:'inning',period,half,x:period-1+(half==='top'?.25:.75)};
    }
    if(g.league==='mls'||g.league==='nwsl'){
      const x=soccerGameMinute(play);
      return Number.isFinite(x)&&x>=0&&x<=150?{basis:'minutes',period,x}:null;
    }
    const clock=playClockSeconds(play),x=elapsedGameMinutes(g,period,clock);
    return Number.isFinite(x)&&x>=0?{basis:'clock',period,x}:null;
  }
  function metricEventLabel(g,play,axis){
    const action=shortText(play?.alternativeType?.text??play?.type?.text??play?.result?.event??'',23);
    if(axis.basis==='inning')return shortText(`${axis.half==='top'?'Top':'Bottom'} ${axis.period}${action?' · '+action:''}`,48);
    if(axis.basis==='minutes'){
      const stamp=String(play?.clock?.displayValue??Math.floor(axis.x)+"'");
      return shortText(`${stamp}${action?' · '+action:''}`,48);
    }
    return shortText(`${playLabel(play,g)}${action?' · '+action:''}`,48);
  }
  // This function is used by new sports; existing NBA/NFL adapters remain intact.
  function otherSportHistory(g,data,metric){
    if(!newMetricLeagues.has(g.league)||!data||g.state==='pre')return null;
    const samples=metricSamples(g,data);
    if(samples.length<(g.state==='post'?12:5))return null;
    const events=[],represented=new Set();
    for(const {play} of samples){
      const axis=eventAxis(g,play);
      if(!axis)continue;
      // Baseball actions belong to the batting side, even if ESPN's event
      // attributes refer to the pitcher or fielding team instead.
      const side=g.league==='mlb'?(axis.half==='top'?0:1):eventTeamIndex(g,data,play,null);
      if(side<0)continue;
      represented.add(side);
      const delta=eventDeltas(g,play)[metric]??0;
      if(!delta)continue;
      events.push({...axis,side,delta,label:metricEventLabel(g,play,axis)});
    }
    if(events.length===0||represented.size<2)return null;
    if(g.league==='mlb'){
      // Ordinal spacing within the recorded half-inning, not fake elapsed time.
      const groups=new Map();
      for(const event of events){
        const key=`${event.period}:${event.half}`;
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(event);
      }
      for(const group of groups.values()){
        const midpoint=group[0].x;
        group.forEach((e,i)=>e.x=midpoint-.20+.40*(i+1)/(group.length+1));
      }
    }
    return assembleMetricTimeline(g,data,metric,events);
  }
  function tennisHistory(g,metric){
    if(!g.tennis||g.state==='pre')return null;
    const a=g.sides[0]?.sets??[],b=g.sides[1]?.sets??[];
    const n=Math.min(a.length,b.length);if(!n)return null;
    const totals=[0,0],points=[{away:0,home:0,x:0,label:'Start'}];
    for(let i=0;i<n;i++){
      const av=asNumber(a[i]?.value),bv=asNumber(b[i]?.value);
      if(av===null||bv===null)return null;
      if(metric==='gamesWon'){totals[0]+=av;totals[1]+=bv;}
      else{
        const winnerA=a[i]?.winner===true,winnerB=b[i]?.winner===true;
        // Some ESPN set linescores omit .winner. Infer only an unambiguous
        // completed set (6-0..6-4, 7-5, 7-6, or an extended two-game margin).
        const av=asNumber(a[i]?.value),bv=asNumber(b[i]?.value);
        const completedA=av!==null&&bv!==null&&av>=6&&((av===7&&bv===6)||(av-bv>=2));
        const completedB=av!==null&&bv!==null&&bv>=6&&((bv===7&&av===6)||(bv-av>=2));
        if(winnerA!==winnerB&&(winnerA||winnerB))totals[winnerA?0:1]++;
        else if(completedA!==completedB)totals[completedA?0:1]++;
      }
      points.push({away:totals[0],home:totals[1],x:i+1,period:i+1,label:`After set ${i+1}`});
    }
    return {points,basis:'set',quality:'periods',metric,coverage:'set-score'};
  }
  function cachedMetricHistory(g,data,metric){
    const key=data&&typeof data==='object'?data:g;
    let memo=metricMemo.get(key);if(!memo){memo=new Map();metricMemo.set(key,memo);}
    const phaseKey=`${g.state}:${metric}`;
    if(!memo.has(phaseKey))memo.set(phaseKey,g.tennis?tennisHistory(g,metric):newMetricLeagues.has(g.league)?otherSportHistory(g,data,metric):metricHistory(g,data,metric));
    return memo.get(phaseKey);
  }
  function basketballEvent(play){
    const kind=String(play?.type?.text??play?.type?.name??'').toLowerCase();
    const description=String(play?.text??'').toLowerCase();
    const raw=kind+' '+description;
    const attemptedPoints=asNumber(play?.pointsAttempted);
    const explicitShot=play?.shootingPlay===true;
    const free=/free[ -]?throw/.test(raw)||(explicitShot&&attemptedPoints===1);
    const three=attemptedPoints===3||/\b(?:3[ -]?pt|3[ -]?point|three[ -]?point)\b/.test(raw);
    const made=play?.scoringPlay===true||/\b(?:made|makes|hits|sinks|good)\b/.test(raw)&&
      !/\b(?:missed|misses|no good|blocked)\b/.test(raw);
    const miss=/\b(?:missed|misses|no good|blocked)\b/.test(raw);
    const shot=!free&&(explicitShot||/\b(?:layup|dunk|jumper|jump shot|hook shot|shot|3pt|three[ -]?point)\b/.test(raw));
    const fg=shot&&(explicitShot||made||miss);
    const ft=free&&(explicitShot||made||miss);
    const rebound=/\brebound\b/.test(raw);
    const turnover=/\bturnover\b/.test(raw);
    const assist=fg&&made&&/\bassist(?:ed)?(?:\s+by)?\b/.test(description);
    return {
      threesMade:fg&&three&&made?1:0,threesAttempted:fg&&three?1:0,
      fgMade:fg&&made?1:0,fgAttempted:fg?1:0,
      ftMade:ft&&made?1:0,ftAttempted:ft?1:0,
      rebounds:+rebound,assists:+assist,turnovers:+turnover
    };
  }
  function footballPlayType(play){
    const type=String(play?.type?.text??play?.type?.name??'').toLowerCase();
    const desc=String(play?.text??'').toLowerCase();
    if(/penalt|kick|punt|return|sack|fumble return|interception return|no play/.test(type))return '';
    if(/penalty|no play/.test(desc)&&!/declined/.test(desc))return '';
    if(/\b(?:sacked|intercepted|picked off|returned for|fumble recovery)\b/.test(desc))return '';
    if(/\b(?:rush|rushing|run|scramble|kneel)\b/.test(type))return 'rushYards';
    if(/\bpass\b|reception|completion/.test(type)&&!/intercept|sack/.test(type))return 'passYards';
    if(/\bscrambl(?:e|ed)|\brush(?:ed|es)? for|\bran for\b|\bkneeled\b/.test(desc))return 'rushYards';
    if(/\bpass(?:es|ed)? (?:to|complete to|incomplete)|\bpass reception\b/.test(desc))return 'passYards';
    return '';
  }
  // Team totals are exposed by ESPN both as paired box-score values (FG 32-83)
  // and, for some games/sports, as separately named made/attempted values.
  // The field name is more reliable than its display label or abbreviation.
  function officialMetricTotal(g,data,side,metric){
    const comps=data?.boxscore?.teams??[];
    const team=comps.find(c=>String(c.team?.id??'')&&String(c.team?.id)===String(g.sides[side].id??''))??
      comps.find(c=>String(c.team?.abbreviation??'').toUpperCase()===String(g.sides[side].short).toUpperCase())??
      comps.find(c=>c.homeAway===(side===0?'away':'home'));
    if(!team)return null;
    const stats=team.statistics??[];
    const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const pairSpecs={
      threesMade:['threepointfieldgoals','made'],threesAttempted:['threepointfieldgoals','attempted'],
      fgMade:['fieldgoals','made'],fgAttempted:['fieldgoals','attempted'],
      ftMade:['freethrows','made'],ftAttempted:['freethrows','attempted']
    };
    if(Object.hasOwn(pairSpecs,metric)){
      const [root,part]=pairSpecs[metric];
      const alt=root==='threepointfieldgoals'?'threepoint':root;
      for(const row of stats){
        const key=norm(row.name??row.label??row.abbreviation);
        const ab=norm(row.abbreviation),label=norm(row.label);
        const isThree=root==='threepointfieldgoals';
        const belongs=isThree?(/threepoint|3pt|3point/.test(key)||/^(3pt|3p|3pm|3pa)$/.test(ab)):
          root==='fieldgoals'?((/fieldgoals|^fg(?:made|attempted)?$/.test(key)||/^fg$|^fgm$|^fga$/.test(ab))&&!/threepoint|3pt|3point/.test(key)):
          /freethrow|^ft(?:made|attempted)?$/.test(key)||/^ft$|^ftm$|^fta$/.test(ab);
        if(!belongs||/pct|percent|percentage/.test(key+ab+label))continue;
        const raw=String(row.displayValue??row.value??'').replace(/,/g,'').trim();
        const split=raw.match(/^(\d+)\s*[-/]\s*(\d+)$/);
        // ESPN uses "fieldGoalsMade-fieldGoalsAttempted" and similarly for FT/3PT.
        if(split)return Number(split[part==='made'?1:2]);
        const value=metricNumber(raw);
        if(value===null)continue;
        const namedPart=/attempt|^fga$|^fta$|^3pa$/.test(key+ab)?'attempted':
          /made|^fgm$|^ftm$|^3pm$/.test(key+ab)?'made':null;
        if(namedPart===part)return value;
      }
      return null;
    }
    const patterns={
      rebounds:/^(?:totalrebounds|rebounds)$/,assists:/^assists$/,turnovers:/^turnovers$/,
      hits:/^(?:hits|totalhits)$/,walks:/^(?:walks|baseonballs|bb)$/,
      strikeouts:/^(?:strikeouts|battingstrikeouts|so|ks)$/,homeRuns:/^(?:homeruns|hr)$/,
      shotsOnGoal:/^(?:shotsongoal|totalshotsongoal|shots|sog)$/,
      faceoffsWon:/^(?:faceoffswon|faceoffwins|fow)$/,
      shots:/^(?:totalshots|shots|shotattempts)$/,
      shotsOnTarget:/^(?:shotsontarget|shotsongoal)$/,
      corners:/^(?:cornerkicks|corners)$/,yellowCards:/^(?:yellowcards|yellowcard)$/,
      rushYards:/^(?:rushingyards|rushyards)$/,passYards:/^(?:passingyards|passyards)$/,
      totalYards:/^(?:totalyards|nettotalyards)$/,firstDowns:/^(?:firstdowns|firstdown)$/,
      rushAttempts:/^(?:rushingattempts|rushattempts)$/
    };
    const matcher=patterns[metric];
    if(!matcher)return null;
    for(const row of stats){
      if(matcher.test(norm(row.name??row.abbreviation??row.label)))return metricNumber(row.displayValue??row.value);
    }
    return null;
  }
  // Canonical progression pipeline for every event-derived statistic.
  // Parsers above only identify events; this handles sorting, final totals,
  // cumulative history and provenance consistently for every sport.
  function assembleMetricTimeline(g,data,metric,events){
    if(!events.length||events.some(e=>!Number.isFinite(e.x)||e.x<0||
      !Number.isFinite(e.delta)||e.side!==0&&e.side!==1))return null;
    // Stable sort preserves play order for multiple actions at the same clock time.
    events.sort((a,b)=>a.x-b.x);
    const totals=[0,0];
    for(const event of events)totals[event.side]+=event.delta;
    const official=[0,1].map(side=>officialMetricTotal(g,data,side,metric));
    if(g.state==='post'){
      // For finished games require independent confirmation on BOTH sides.
      if(official.some(n=>n===null)||official.some((n,i)=>Math.abs(n-totals[i])>1e-6))return null;
    }
    // Live box scores and plays can be slightly out of sync; keep the
    // event-derived curve provisional instead of silently dropping it.
    const count=[0,0],points=[{away:0,home:0,label:'Start',x:0}];
    for(const event of events){
      count[event.side]+=event.delta;
      points.push({away:count[0],home:count[1],x:event.x,
        label:event.label,period:event.period,changed:event.side});
    }
    return {points,basis:events[0].basis??'clock',quality:'plays',metric,
      coverage:g.state==='post'?'reconciled':'event-based'};
  }
  function metricHistory(g,data,metric){
    if(!progressionOptions[g.league]?.some(([id])=>id===metric)||g.state==='pre'||!data)return null;
    const samples=eventSamples(g,data),basketball=g.league==='nba'||g.league==='wnba';
    if(samples.length<(basketball?16:12))return null;
    if(g.state==='post'){
      const periods=samples.map(({play})=>playPeriod(play)).filter(n=>n>0);
      if(!periods.includes(1)||Math.max(...periods,0)<regulationCount(g.league))return null;
      const represented=new Set(samples.map(({play,drive})=>eventTeamIndex(g,data,play,drive)).filter(n=>n>=0));
      if(represented.size<2)return null;
    }
    const events=[];
    for(const {play,drive} of samples){
      const period=playPeriod(play),clock=playClockSeconds(play);
      const x=elapsedGameMinutes(g,period,clock);
      if(x===null||!Number.isFinite(x)||x<0)continue;
      const side=eventTeamIndex(g,data,play,drive);
      if(side<0)continue;
      let delta=0;
      if(basketball){
        delta=basketballEvent(play)[metric]??0;
      }else{
        const kind=footballPlayType(play);
        if(metric==='firstDowns')delta=play?.start?.down!==undefined&&play?.end?.down===1&&play?.start?.down>1?1:
          (play?.firstDown===true||play?.stat?.firstDown===true?1:0);
        else if(kind&&(metric==='totalYards'||kind===metric||metric==='rushAttempts'&&kind==='rushYards')){
          if(metric==='rushAttempts')delta=1;
          else {
            const yardage=asNumber(play.statYardage??play.yardsGained??play.yards);
            if(yardage===null||Math.abs(yardage)>99)continue;
            delta=yardage;
          }
        }
      }
      if(!delta)continue;
      events.push({side,delta,x,basis:'clock',label:playLabel(play,g),period});
    }
    return assembleMetricTimeline(g,data,metric,events);
  }
  function availableGraphMetrics(g,data){
    const options=[['score',g.tennis?'Games won':'Score']];
    for(const [id,label] of progressionOptions[g.league]??[]){
      if(cachedMetricHistory(g,data,id))options.push([id,label]);
    }
    return options;
  }
  function selectedChartSeries(g,data){
    const options=availableGraphMetrics(g,data);
    const wanted=preferences(g.id).metric??'score';
    const metric=options.some(([id])=>id===wanted)?wanted:'score';
    const series=metric==='score'?chartSeries(g,data):cachedMetricHistory(g,data,metric);
    return {options,metric,series};
  }
  function chartSeries(g,data){
    if(g.state==='pre')return null;
    if(!g.tennis){
      const detailed=scoringHistory(g,data);
      if(detailed)return detailed;
    }
    const snapshots=scoreSnapshots(g,data);
    return snapshots.length>1?{points:snapshots,basis:g.tennis?'set':g.league==='mlb'?'inning':'period',quality:'periods'}:null;
  }
