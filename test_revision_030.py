"""0_30 live UI regression fixtures: tour coverage, league migration, player overlays."""
from pathlib import Path
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
WHEN=datetime.now(ZoneInfo('America/Denver')).replace(hour=13,minute=0,second=0,microsecond=0).isoformat()

def tennis_event(name,slug,event_id):
 return {'id':event_id,'name':name,'date':WHEN,'groupings':[{'grouping':{'slug':slug,'displayName':'Singles'},'competitions':[{'id':event_id+'1','date':WHEN,'status':{'type':{'state':'post','description':'Final'}},'round':{'displayName':'Quarterfinal'},'competitors':[{'order':1,'athlete':{'id':'11','displayName':'First Player','shortName':'F. Player'},'score':2,'linescores':[{'value':6,'winner':True},{'value':6,'winner':True}]},{'order':2,'athlete':{'id':'22','displayName':'Second Player','shortName':'S. Player'},'score':0,'linescores':[{'value':3},{'value':4}]}]}]}]}
def game_fixture(league):
 return {'events':[{'id':'424242','date':WHEN,'name':'Away at Home','season':{'type':2},'competitions':[{'id':'424242','date':WHEN,'status':{'type':{'state':'in','description':'In progress','shortDetail':'P2 12:00'},'period':2,'displayClock':'12:00'},'competitors':[{'homeAway':'away','score':'2','team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'},'linescores':[{'value':1},{'value':1}]},{'homeAway':'home','score':'1','team':{'id':'2','displayName':'Home Team','abbreviation':'HME'},'linescores':[{'value':1},{'value':0}]}]}]}]}
def summary_fixture(league):
 def event(i,team,name,scoreA,scoreB,period=1,clock='18:00',typ='Goal'):
  return {'id':str(i),'scoringPlay':True,'scoreValue':1,'team':{'id':str(team)},'type':{'text':typ},'text':f'{name} goal scored' if league=='nhl' else f'{name} Goal','period':{'number':period},'clock':{'displayValue':clock},'awayScore':scoreA,'homeScore':scoreB,'participants':[{'athlete':{'id':'101' if team==1 else '202'}}]}
 def grp(team,name,id):
  return {'team':{'id':str(team),'abbreviation':'AWY' if team==1 else 'HME'},'statistics':[{'name':'Scoring','labels':['G','A','SOG'],'athletes':[{'athlete':{'id':id,'displayName':name},'stats':['1','0','2']}]}]}
 plays=[event(1,1,'A. Scorer',1,0,1,'18:00'),event(2,2,'B. Scorer',1,1,1,'11:00'),event(3,1,'A. Scorer',2,1,2,'16:00')]
 return {'plays':plays,'boxscore':{'players':[grp(1,'A. Scorer','101'),grp(2,'B. Scorer','202')]},'header':{'competitions':[{'competitors':[{'homeAway':'away','team':{'id':'1','abbreviation':'AWY'}},{'homeAway':'home','team':{'id':'2','abbreviation':'HME'}}]}]}}

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(1280,900),(390,844)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},timezone_id='America/Denver',has_touch=width==390)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  def handler(route):
   u=route.request.url
   if '/tennis/atp/scoreboard?' in u:body={'events':[tennis_event('Shanghai Masters','mens-singles','123'),tennis_event('Excluded Doubles','mens-doubles','333')]}
   elif '/tennis/wta/scoreboard?' in u:body={'events':[tennis_event('Wuhan Open','womens-singles','223')]}
   elif '/hockey/nhl/scoreboard?' in u:body=game_fixture('nhl')
   elif '/hockey/nhl/summary?' in u:body=summary_fixture('nhl')
   else:body={'events':[]}
   route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
  page.route('https://site.api.espn.com/**',handler)
  page.goto('about:blank')
  page.set_content(HTML,wait_until='load')
  page.locator('.league-section[data-league="atp"] .score-card').first.wait_for(timeout=13000)
  page.locator('.league-section[data-league="wta"] .score-card').first.wait_for(timeout=12000)
  print('counts',page.locator('.league-section[data-league="wta"] .score-card').count(),page.locator('.league-section[data-league="atp"] .score-card').count(),page.locator('.league-section[data-league="wta"]').inner_text()[:300]);assert page.locator('.league-section[data-league="wta"] .score-card').count()==1
  assert page.locator('.league-section[data-league="atp"] .score-card').count()==1
  assert 'Shanghai Masters' in page.locator('[data-league="atp"] .score-card').inner_text()
  assert 'Wuhan Open' in page.locator('[data-league="wta"] .score-card').inner_text()
  assert page.locator('.league-section[data-league="wnba"]').first.evaluate('(el)=>el.compareDocumentPosition(document.querySelector("[data-league=nba]"))&4')==4
  assert 'Group by league' in page.locator('.group-choice').inner_text()
  assert page.locator('#settings-open svg').count()==1
  card=page.locator('.league-section[data-league="nhl"] .score-card').first
  card.wait_for(timeout=12000)
  card.locator('[data-expand]').click()
  page.locator('[data-monitor-open]').first.click()
  dialog=page.locator('#game-monitor');picker=dialog.locator('[data-monitor-player]')
  picker.wait_for(timeout=8000)
  print('Hockey picker',width,picker.locator('option').all_text_contents())
  assert picker.locator('option').count()>=2,picker.locator('option').all_text_contents()
  picker.select_option('101')
  assert dialog.locator('.player-score-point').count()>=1
  assert dialog.locator('.performer-button.is-selected').count()>=1
  assert not dialog.evaluate('(d)=>d.scrollWidth>d.clientWidth+4')
  assert not errors,errors
  ctx.close();print('PASS',width,height)
 browser.close()
