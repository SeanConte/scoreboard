"""Offline ESPN-shape regression tests for Scoreboard 0.18; run with Python Playwright."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
html=(Path(__file__).resolve().parents[1]/'index.html').read_text()
marker='  updateDate();render();refresh();'
assert marker in html
html=html.replace(marker,'''  window.__test18={eventDeltas,eventSamples,metricHistory,otherSportHistory,tennisHistory,cachedMetricHistory,availableGraphMetrics,graphSVG,signedArea,eventTeamIndex,request,fetchESPNJSON,graphSection,assembleMetricTimeline};
'''+marker)
def g(league):
    return {'id':league+'-100','league':league,'eventId':'100','date':'2026-10-17T17:00:00Z','state':'post','sides':[{'id':'101','short':'AWY','name':'Away'},{'id':'202','short':'HME','name':'Home'}], 'tennis':league=='tennis','postseason':False}
def data(plays,metric,total0,total1):
    return {'plays':plays,'boxscore':{'teams':[{'team':{'id':'101','abbreviation':'AWY'},'homeAway':'away','statistics':[{'name':metric,'displayValue':str(total0)}]},{'team':{'id':'202','abbreviation':'HME'},'homeAway':'home','statistics':[{'name':metric,'displayValue':str(total1)}]}]},'header':{'competitions':[{'competitors':[{'homeAway':'away','team':{'id':'101','abbreviation':'AWY'}},{'homeAway':'home','team':{'id':'202','abbreviation':'HME'}}]}]}}

fixtures=[]
for league in ['nhl','mls','nwsl','mlb','nfl','cfb']:
    plays=[]
    for i in range(16):
        side=i%2
        if league=='nhl':
            play={'id':str(i+1),'type':{'text':'Shot'},'text':'Saved shot on goal','shootingPlay':True,'period':{'number':i%3+1},'clock':{'displayValue':f'{18-i%3}:00'},'team':{'id':'101' if side==0 else '202'}}
        elif league=='mlb':
            play={'id':str(i+1),'type':{'text':'Single'},'text':'Batter singled to center','period':{'number':i//2+1,'type':'top' if side==0 else 'bottom'},'team':{'id':'202' if side==0 else '101'}}
        elif league in ('mls','nwsl'):
            play={'id':str(i+1),'type':{'text':'Shot'},'text':'Shot missed target','period':{'number':1 if i<8 else 2},'clock':{'displayValue':f"{8+i*4}'"},'team':{'id':'101' if side==0 else '202'}}
        else:
            play={'id':str(i+1),'type':{'text':'Rush'},'text':'Runs for 2 yards','period':{'number':i//4+1},'clock':{'displayValue':f'{14-i%4}:00'},'team':{'id':'101' if side==0 else '202'},'statYardage':2,'start':{'down':2},'end':{'down':3}}
        plays.append(play)
    metric={'nhl':'shotsOnGoal','mlb':'hits','mls':'shots','nwsl':'shots','nfl':'rushYards','cfb':'rushYards'}[league]
    official={'nhl':'shotsOnGoal','mlb':'hits','mls':'shots','nwsl':'shots','nfl':'rushingYards','cfb':'rushingYards'}[league]
    d=data(plays,official,8 if league not in ('nfl','cfb') else 16,8 if league not in ('nfl','cfb') else 16)
    if league in ('nfl','cfb'):
        d['drives']={'previous':[{'plays':plays}]}
    if league in ('mlb','nhl','mls','nwsl'):
        d['progressionPlays']=plays
    fixtures.append((league,metric,g(league),d))

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},timezone_id='America/Denver')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://site.api.espn.com/**',lambda r:r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='{"events":[]}'))
    page.route('https://sports.core.api.espn.com/**',lambda r:r.fulfill(status=404,body=''))
    page.goto('about:blank');page.set_content(html,wait_until='load')
    for league,metric,game,feed in fixtures:
        r=page.evaluate('''v=>{
          let t=window.__test18;
          let result=t.cachedMetricHistory(v.g,v.d,v.metric);
          return {present:!!result,basis:result?.basis,points:result?.points.length,totals:result?.points.at(-1),coverage:result?.coverage,
            metricOptions:t.availableGraphMetrics(v.g,v.d).map(x=>x[0]),
            area:t.signedArea(v.g,result)?.value??null,
            pathValid:result?(/<svg.*<\\/svg>/.test(t.graphSVG(v.g,result,['#ffe100','#4899ff']))):false};
        }''',{'g':game,'d':feed,'metric':metric})
        print(league, json.dumps(r))
        assert r['present'] and r['coverage']=='reconciled' and r['pathValid'],(league,r)
        assert r['totals']['away']==(16 if league in ('nfl','cfb') else 8),league
        bad=json.loads(json.dumps(feed));bad['boxscore']['teams'][0]['statistics'][0]['displayValue']='9999'
        assert page.evaluate('v=>!window.__test18.cachedMetricHistory(v.g,v.d,v.metric)',{'g':game,'d':bad,'metric':metric}),league
    # Same-clocking events must remain; dedup only exact IDs.
    dedup=page.evaluate('''()=>window.__test18.eventSamples({league:'nfl'}, {drives:{previous:[{plays:[{id:'1'},{id:'2'}]}]},plays:[{id:'2'},{id:'3'},{text:'no id'}]}).length''')
    assert dedup==4,dedup
    tennis=g('tennis');tennis['sides'][0]['sets']=[{'value':6},{'value':4},{'value':7}];tennis['sides'][1]['sets']=[{'value':3},{'value':6},{'value':5}]
    t=page.evaluate('v=>window.__test18.tennisHistory(v,"setsWon")?.points.at(-1)',tennis)
    print('tennis',t);assert (t['away'],t['home'])==(2,1)
    # Negative yardage should display within the chart's bounds.
    neg=page.evaluate('''v=>{let svg=window.__test18.graphSVG(v,{basis:'clock',quality:'plays',points:[{x:0,away:0,home:0},{x:2,period:1,away:-6,home:0},{x:4,period:1,away:-3,home:1}]},['#111111','#eeeeee']);return svg.includes('>-')&&svg.includes('svg');}''',g('nfl'))
    assert neg, 'negative y-axis labels missing'
    assert not errors,errors
    print('ALL CORE CROSS-SPORT TESTS PASSED')
    browser.close()
