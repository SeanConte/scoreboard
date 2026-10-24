"""0.24: league-by-league stat fidelity, player identification, and chart inspection."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
src=(Path(__file__).resolve().parents[1]/'index.html').read_text()
marker='  updateDate();render();refresh();'
assert marker in src
src=src.replace(marker,'''  window.__audit24={completeTeamStats,fullPlayerBox,statsSection,playerScoringTimeline,chartEventForPoint,chartCursorAt,graphSVG,selectedChartSeries};
'''+marker)

def game(league):
    return {'id':league+'-777','league':league,'eventId':'777','date':'2026-10-24T17:00:00Z','state':'in',
            'sides':[{'id':'1','short':'AWY','name':'Away Team','score':'5'},{'id':'2','short':'HME','name':'Home Team','score':'3'}],
            'tennis':league=='tennis','status':'In progress','postseason':False}

def payload(league):
    metric={
        'nba':['fieldGoalPct','rebounds','threePointFieldGoalPct','assists','turnovers','fieldGoalsAttempted'],
        'wnba':['fieldGoalPct','rebounds','threePointFieldGoalPct','assists','turnovers','fieldGoalsAttempted'],
        'nfl':['totalYards','passingYards','rushingYards','firstDowns','turnovers'],
        'cfb':['totalYards','passingYards','rushingYards','firstDowns','turnovers'],
        'mlb':['hits','errors','walks','strikeouts','leftOnBase'],
        'nhl':['shotsOnGoal','faceoffPct','powerPlayPct','hits','blockedShots'],
        'nwsl':['possessionPct','shotsOnGoal','totalShots','cornerKicks','fouls'],
        'mls':['possessionPct','shotsOnGoal','totalShots','cornerKicks','fouls'],
        'tennis':['aces','doubleFaults','firstServePct']
    }[league]
    teams=[];players=[]
    for i in [0,1]:
        tm={'id':str(i+1),'abbreviation':'AWY' if i==0 else 'HME'}
        stats=[{'name':m,'label':m,'displayValue':str(j+2+i)} for j,m in enumerate(metric)]
        # Rich team totals contain values that are not always numeric (FG-A).
        stats.append({'name':'fgMadeAttempted','label':'FG made/attempted','displayValue':'11-24'})
        teams.append({'team':tm,'statistics':stats})
        players.append({'team':tm,'statistics':[{'name':'Game stats','labels':['MIN','PTS','REB','AST'],
                    'athletes':[{'athlete':{'id':str(101+i),'displayName':'Alpha Guard' if i==0 else 'Beta Forward'},'stats':['24','2','7','3']},
                                {'athlete':{'id':str(301+i),'displayName':'Bench Player'},'stats':['10','0','1','0']}]}]})
    return {'boxscore':{'teams':teams,'players':players},'header':{'competitions':[{'competitors':[{'homeAway':'away','team':teams[0]['team']},{'homeAway':'home','team':teams[1]['team']}]}]}}

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://site.api.espn.com/**',lambda route:route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='{"events":[]}'))
    page.set_content(src,wait_until='load')
    for league in ('nba','wnba','nfl','cfb','mlb','nhl','mls','nwsl','tennis'):
        r=page.evaluate('''({g,d})=>{
            const t=window.__audit24;
            const full=t.completeTeamStats(g,d),box=t.fullPlayerBox(g,d),overview=t.statsSection(g,d);
            const root=document.createElement('div');root.innerHTML=box;
            return {teamRows:(full.match(/<tr>/g)||[]).length-1,teams:full.includes('FG made/attempted'),
             roster:root.querySelectorAll('.monitor-team-box:not(.monitor-full-team-stats) .box-player-table tbody tr').length,
             teamCount:root.querySelectorAll('.monitor-team-stat-table').length,
             showsData:overview.includes('Team statistics')||overview.includes('Match totals')};
          }''',{'g':game(league),'d':payload(league)})
        assert r['teamRows']>=(4 if league=='tennis' else 5) and r['teams'] and r['roster']==4 and r['teamCount']==1,(league,r)
        assert r['showsData'] or league=='tennis',(league,r)
        print('LEAGUE STATS PASS',league,r)
    w=game('wnba');d=payload('wnba')
    # Absence of participants in ESPN scoring plays must not hide an unambiguous scorer.
    d['plays']=[{'id':'10','scoringPlay':True,'scoreValue':2,'text':'Alpha Guard makes layup',
                 'period':{'number':1},'clock':{'displayValue':'09:55'},
                 'team':{'id':'1'},'awayScore':2,'homeScore':0}]
    pl=page.evaluate('v=>window.__audit24.playerScoringTimeline(v.g,v.d)',{'g':w,'d':d})
    assert len(pl)==1 and pl[0]['name']=='Alpha Guard' and pl[0]['credited']==2,pl
    event=page.evaluate('v=>window.__audit24.chartEventForPoint(v.g,v.d,v.point)',{'g':w,'d':d,'point':{'away':2,'home':0,'period':1,'clock':595}})
    assert event=='Alpha Guard makes layup',event
    # Unidentified scoring plays must not produce a fabricated player history.
    d['plays'][0]['text']='Unattributed score'
    pl=page.evaluate('v=>window.__audit24.playerScoringTimeline(v.g,v.d)',{'g':w,'d':d})
    assert pl==[],pl
    assert not errors,errors
    print('CROSS-LEAGUE STAT AND PLAYER ATTRIBUTION TESTS PASSED')
    browser.close()
