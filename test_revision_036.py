"""0_36 touchscreen chart inspection, dismiss behavior and sport-aware live situation."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import json
from playwright.sync_api import sync_playwright
HTML=(Path(__file__).resolve().parents[1]/'index.html').read_text()
DATE=datetime.now(ZoneInfo('America/Denver')).replace(hour=16,minute=0,second=0,microsecond=0).isoformat()
PATHS={'nfl':'football/nfl','cfb':'football/college-football','nba':'basketball/nba','wnba':'basketball/wnba','mlb':'baseball/mlb','nhl':'hockey/nhl','mls':'soccer/usa.1','nwsl':'soccer/usa.nwsl','atp':'tennis/atp','wta':'tennis/wta'}

def fixture(league):
  situation={'possession':'101','downDistanceText':'3rd & 6 at DEN 42','awayTimeouts':2,'homeTimeouts':3} if league in ('nfl','cfb') else {'outs':2,'balls':1,'strikes':2,'onSecond':True,'inningHalf':'top'} if league=='mlb' else {}
  competitors=[]
  for i in range(2):
    competitor={'homeAway':('away' if i==0 else 'home'),'score':str(14+i*2),'linescores':[{'value':7+i},{'value':7+i}], 'team':{'id':str(101+i),'abbreviation':('AWY' if i==0 else 'HME'),'displayName':('Away' if i==0 else 'Home')}}
    competitors.append(competitor)
  if league in ('atp','wta'):
    players=[{'athlete':{'id':str(501+i),'displayName':('Player A' if i==0 else 'Player B'),'shortName':('A' if i==0 else 'B')},'score':str(1+i),'linescores':[{'value':6-i},{'value':2+i}], 'point':('40' if i==0 else '30'),'serving':i==0} for i in range(2)]
    return {'id':'992211','date':DATE,'name':'Example Tour Open','groupings':[{'grouping':{'slug':'mens-singles' if league=='atp' else 'womens-singles','displayName':'Singles'},'competitions':[{'id':'992211','date':DATE,'status':{'type':{'state':'in','shortDetail':'Set 2'}},'competitors':players}]}]}
  c={'id':'992211','date':DATE,'status':{'type':{'state':'in','shortDetail':'Q2 8:17'},'period':2,'displayClock':'8:17'},'situation':situation,'competitors':competitors}
  return {'id':'992211','date':DATE,'name':'Away vs Home', 'competitions':[c]}

def check(league,width=390,touch=False):
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':width,'height':850},has_touch=touch,is_mobile=touch,timezone_id='America/Denver')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   url=r.request.url
   if '/summary?' in url:
    extra={'nhl':[('shotsOnGoal','Shots on goal','14'),('shotsOnGoal','Shots on goal','17')],'mls':[('shotsOnTarget','Shots on target','3'),('shotsOnTarget','Shots on target','5')],'nwsl':[('shotsOnTarget','Shots on target','3'),('shotsOnTarget','Shots on target','5')],'nba':[('personalFouls','Fouls','8'),('personalFouls','Fouls','6')],'wnba':[('personalFouls','Fouls','8'),('personalFouls','Fouls','6')]}.get(league,[])
    teams=[{'team':{'id':str(101+i),'abbreviation':('AWY' if i==0 else 'HME')},'statistics':[{'name':key,'label':label,'displayValue':value}]} for i,(key,label,value) in enumerate(extra)]
    body={'header':{'competitions':[{'competitors':fixture(league)['competitions'][0]['competitors']}]},'boxscore':{'teams':teams}}
   elif PATHS[league] in url and '/scoreboard?' in url: body={'events':[fixture(league)]}
   else:body={'events':[]}
   r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
  ctx.route('https://site.api.espn.com/**',route)
  ctx.route('https://sports.core.api.espn.com/**',lambda r:r.fulfill(status=200,body='{}',content_type='application/json'))
  ctx.route('https://a.espncdn.com/**',lambda r:r.fulfill(status=404,body=''))
  # Hide unrelated leagues without altering their data loaders.
  hidden=[x for x in PATHS if x!=league]
  page.goto('about:blank')
  page.evaluate('''(hidden)=>{Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(k)=>k==='scoreboard-layout-v1'?JSON.stringify({order:['wnba','nba','mlb','nhl','nfl','cfb','mls','nwsl','atp','wta'],hidden,collapsed:[],orderRevision:30}):null,setItem:()=>{},removeItem:()=>{}}});}''',hidden)
  page.set_content(HTML,wait_until='load')
  leaguecard=page.locator(f'[data-league="{league}"] .score-card').first
  leaguecard.wait_for(timeout=14000)
  leaguecard.locator('[data-monitor-open]').click()
  modal=page.locator('#game-monitor');modal.locator('.monitor-overview').wait_for()
  context=modal.locator('.monitor-live-context')
  assert context.count()==1,(league,modal.inner_text()[:600])
  if league in ('nfl','cfb'):
   assert 'AWY' in context.inner_text() and '3rd & 6 at DEN 42' in context.inner_text(),(league,context.inner_text())
   assert 'AWY 2 · HME 3' in context.inner_text()
  if league=='mlb':assert 'Outs' in context.inner_text() and '1–2' in context.inner_text()
  if league in ('atp','wta'):assert 'Server' in context.inner_text() and '40' in context.inner_text()
  if league in ('nhl','mls','nwsl','nba','wnba'):assert 'AWY' in context.inner_text() and 'HME' in context.inner_text()
  svg=modal.locator('.monitor-interactive-chart');svg.wait_for()
  box=svg.bounding_box();x=box['x']+box['width']*.38;y=box['y']+box['height']*.55
  (page.touchscreen.tap(x,y) if touch else page.mouse.click(x,y))
  assert svg.get_attribute('data-chart-pinned')=='true',league
  tooltip=modal.locator('[data-chart-tooltip]')
  assert tooltip.is_visible()
  assert tooltip.locator('[data-chart-clear]').is_visible()
  if touch:page.screenshot(path='/mnt/data/scoreboard0_36_mobile.png')
  if width<=650:
   assert tooltip.evaluate('(e)=>getComputedStyle(e).position')=='relative'
   assert tooltip.bounding_box()['y']>=box['y']+box['height']-3,(league,box,tooltip.bounding_box())
   assert tooltip.bounding_box()['width']<=width
  (page.touchscreen.tap(x,y) if touch else page.mouse.click(x,y))
  assert svg.get_attribute('data-chart-pinned')=='false',league
  assert tooltip.is_hidden()
  (page.touchscreen.tap(x,y) if touch else page.mouse.click(x,y))
  tooltip.locator('[data-chart-clear]').click()
  assert svg.get_attribute('data-chart-pinned')=='false'
  (page.touchscreen.tap(x,y) if touch else page.mouse.click(x,y))
  page.keyboard.press('Escape')
  assert svg.get_attribute('data-chart-pinned')=='false',league
  (page.touchscreen.tap(x,y) if touch else page.mouse.click(x,y))
  modal.locator('[data-monitor-view="box"]').click()
  assert modal.locator('[data-chart-tooltip]').count()==0
  modal.locator('[data-monitor-view="overview"]').click()
  assert modal.locator('.monitor-interactive-chart').get_attribute('data-chart-pinned')!='true'
  assert not errors,(league,errors)
  browser.close()

if __name__=='__main__':
 for league in ['nfl','cfb','mlb','nba','nhl','mls','nwsl','wnba','atp','wta']:
  check(league,width=390 if league=='nfl' else 1280)
 check('nfl',1280)
 check('nfl',390,True)
 print('PASS 0_36 mobile/desktop chart selection and feed-backed live status')
