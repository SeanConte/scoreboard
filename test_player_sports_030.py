"""Verify scorer attribution is real event-based across non-basketball sports."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
s=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
marker="  const monitorDialog=$('game-monitor');"
assert s.count(marker)==1
s=s.replace(marker, "  window.__sports30={playerScoringTimeline,chartSeries,cachedMetricHistory};\n"+marker)

def group(team,name,id,stat='G',value='1'):
 return {'team':{'id':str(team),'abbreviation':'AWY' if team==1 else 'HME'},'statistics':[{'name':'Scoring','labels':[stat],'athletes':[{'athlete':{'id':id,'displayName':name},'stats':[value]}]}]}
def g(league):
 return {'league':league,'id':league+'-999999','eventId':'999999','state':'in','sides':[{'id':'1','short':'AWY','name':'Away'},{'id':'2','short':'HME','name':'Home'}], 'postseason':False,'tennis':False}
def event(team,name,id,clock,period,scoreA,scoreB,typ,pts=1):
 return {'id':id,'team':{'id':str(team)},'scoringPlay':True,'scoreValue':pts,'period':{'number':period,'displayValue':'P'+str(period)},'clock':{'displayValue':clock},'awayScore':scoreA,'homeScore':scoreB,'type':{'text':typ},'text':name,'participants':[{'athlete':{'id':'101' if team==1 else '202'}}]}
fixtures=[]
# Full scoring timeline with alternating teams; named event matches box roster.
for league,stamp,kind,text in [
 ('nfl','12:00','Rushing Touchdown','Allen Runner 12 Yd run touchdown'),
 ('cfb','12:00','Rushing Touchdown','Allen Runner 12 Yd run touchdown'),
 ('mls',"15'",'Goal','Alex Scorer Goal'),
 ('nwsl',"15'",'Goal','Alex Scorer Goal'),
 ('nhl','18:00','Goal','Alex Scorer Wrist Shot Goal')]:
 names=('Allen Runner','Other Runner') if league in ('nfl','cfb') else ('Alex Scorer','Other Scorer')
 pts=6 if league in ('nfl','cfb') else 1
 p1=event(1,text,'a','12:00' if league in ('nfl','cfb') else stamp,1,pts,0,kind,pts)
 p2=event(2,names[1]+' Goal' if league not in ('nfl','cfb') else names[1]+' 20 Yd run touchdown','b','09:00' if league in ('nfl','cfb') else ("25'" if league in ('mls','nwsl') else '11:00'),1,pts,pts,kind,pts)
 p3=event(1,text,'c','03:00' if league in ('nfl','cfb') else ("40'" if league in ('mls','nwsl') else '04:00'),1,pts*2,pts,kind,pts)
 fixture={'boxscore':{'players':[group(1,names[0],'101'),group(2,names[1],'202')]},'plays':[p1,p2,p3]}
 fixtures.append((league,'score',fixture))
# Baseball in-play hit history explicitly linked only to the hits plot,
# whose position is ordinal inside the batting half (not actual time).
mlb=[]
for i in range(8):
 team=1 if i%2==0 else 2
 name='Batter One' if team==1 else 'Batter Two'
 mlb.append({'id':str(i+1),'team':{'id':str(team)},'period':{'number':1,'type':'top' if team==1 else 'bottom'},'type':{'text':'Single'},'text':f'{name} singled to center', 'awayScore':0,'homeScore':0,'participants':[{'athlete':{'id':'101' if team==1 else '202'}}]})
fixtures.append(('mlb','hits',{'boxscore':{'players':[group(1,'Batter One','101','H','4'),group(2,'Batter Two','202','H','4')]},'progressionPlays':mlb}))

with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();page.route('https://site.api.espn.com/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"events":[]}'))
 page.goto('about:blank');page.set_content(s,wait_until='load')
 for league,metric,data in fixtures:
  out=page.evaluate('({g,data,metric})=>({hist:metric==="score"?window.__sports30.chartSeries(g,data):window.__sports30.cachedMetricHistory(g,data,metric),players:window.__sports30.playerScoringTimeline(g,data,metric)})',{'g':g(league),'data':data,'metric':metric})
  print(league,metric,'timeline',out['hist'] and out['hist']['quality'],'players',[(p['name'],len(p['events'])) for p in out['players']])
  assert out['hist'] and out['hist']['quality']=='plays',(league,out)
  assert out['players'] and out['players'][0]['events'],(league,out)
 b.close()
print('MULTI-SPORT PLAYER OVERLAYS PASS')
