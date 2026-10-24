"""0_29 data relationships and chart inspection, including touch and keyboard."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ns={'__file__':str(Path(__file__).with_name('test_player_monitor.py'))}
exec(Path(__file__).with_name('test_player_monitor.py').read_text().split('def run(width,height):')[0],ns)
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
WHEN=ns['WHEN']
paths={'nba':'basketball/nba','nfl':'football/nfl','mls':'soccer/usa.1'}

def fixture_event(i=0,week=None,league='nba'):
 from datetime import datetime,timedelta
 date=(datetime.fromisoformat(WHEN)+timedelta(days=i*7)).isoformat()
 result={'id':str(424242+i),'date':date,'name':'Away Team at Home Team','competitions':[{'id':str(424242+i),'date':date,'status':{'type':{'state':'post','shortDetail':'Final'}},'competitors':[{'homeAway':'away','score':str(90+i),'winner':True,'team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'}},{'homeAway':'home','score':str(80+i),'winner':False,'team':{'id':'2','displayName':'Home Team','abbreviation':'HME'}}]}]}
 if week:result['week']={'number':week}
 return result

def run(league,width):
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=b.new_context(viewport={'width':width,'height':850},has_touch=width<500,timezone_id='America/Denver',reduced_motion='reduce')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   url=r.request.url
   if '/schedule?' in url:
    body={'events':[fixture_event(i, i+6 if league in ['nfl','cfb'] else None,league) for i in range(3)]}
   elif '/scoreboard?' in url:body={'events':[fixture_event(0)]} if paths[league] in url else {'events':[]}
   elif '/statistics' in url:body={'splits':{'categories':[]}}
   else:body={'events':[]}
   r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
  page.route('https://site.api.espn.com/**',route)
  page.route('https://sports.core.api.espn.com/**',route)
  page.set_content(HTML,wait_until='load')
  page.locator(f'.league-section[data-league="{league}"] .team-link').first.wait_for(timeout=15000)
  page.locator(f'.league-section[data-league="{league}"] .team-link').first.click()
  page.locator('.team-schedule-game').first.wait_for(timeout=10000)
  if league=='nfl': assert 'Week 6' in page.locator('.team-schedule-game').first.inner_text()
  page.locator('[data-team-tab="stats"]').click()
  page.locator('.team-season-bar').first.wait_for(timeout=10000)
  assert page.locator('.team-season-bar').count()==3
  # Hover, keyboard focus and tap all reveal opponent and game identity.
  if width<500:
   page.locator('.team-season-bar').first.tap()
   assert page.locator('.team-hero').is_visible(),'First touch should inspect, not navigate'
  else:page.locator('.team-season-bar').first.hover()
  tip=page.locator('[data-team-chart-tooltip]');assert tip.is_visible()
  assert 'Home Team' in tip.inner_text() and ('Week 6' if league=='nfl' else 'Game 1') in tip.inner_text(),tip.inner_text()
  assert '90 – 80' in tip.inner_text(),tip.inner_text()
  if league=='nba':page.locator('#team-view').screenshot(path=f'/mnt/data/scoreboard29_team_{width}.png')
  page.locator('[data-season-summary="margin"]').click()
  assert page.locator('[data-team-chart-mode]').input_value()=='margin'
  page.locator('[data-team-chart-mode]').select_option('both')
  assert page.locator('[data-team-chart-mode]').input_value()=='both'
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+4')
  page.locator('.team-season-bar').first.focus()
  assert tip.is_visible()
  # Explicit opening of chart-selected event returns to canonical scoreboard.
  page.locator('[data-team-chart-open]').click()
  page.locator(f'[data-expand="{league}-424242"]').wait_for(timeout=20000)
  assert page.locator(f'[data-expand="{league}-424242"]').get_attribute('aria-expanded')=='true'
  page.locator('#team-return-shortcut').click()
  assert page.locator('[data-team-tab="stats"]').get_attribute('aria-selected')=='true'
  assert page.locator('.team-season-bar').count()==3
  assert not errors,errors
  print('TEAM LINK PASS',league,width)
  b.close()

def check_maps():
 # Ensure numbers on cards represent exactly the available time-series statistic.
 html=HTML.replace('  updateDate();render();refresh();', '''  window.__test29={linkedStatMetric};\n  updateDate();render();refresh();''')
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=b.new_page();page.route('https://site.api.espn.com/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"events":[]}'))
  page.set_content(html)
  samples={
   'nba':[('rebounds','rebounds'),('assists','assists'),('threePointFieldGoalsMade','threesMade')],
   'wnba':[('totalRebounds','rebounds'),('turnovers','turnovers')],
   'nfl':[('rushingYards','rushYards'),('firstDowns','firstDowns')],
   'cfb':[('passingYards','passYards')],
   'mlb':[('hits','hits'),('baseOnBalls','walks')],
   'nhl':[('shotsOnGoal','shotsOnGoal'),('faceoffsWon','faceoffsWon')],
   'mls':[('shotsOnTarget','shotsOnTarget'),('cornerKicks','corners')],
   'nwsl':[('yellowCards','yellowCards')]
  }
  for league,records in samples.items():
   for key,metric in records:
    val=page.evaluate('v=>window.__test29.linkedStatMetric({league:v.league},{key:v.key},null,[[v.metric,"Metric"]])',{'league':league,'key':key,'metric':metric})
    assert val==metric,(league,key,val)
    assert page.evaluate('v=>window.__test29.linkedStatMetric({league:v.league},{key:v.key},null,[])',{'league':league,'key':key}) is None
  assert page.evaluate('()=>window.__test29.linkedStatMetric({league:"nba"},{key:"fieldGoalPct"},null,[["fgMade","FG made"]])') is None
  assert page.evaluate('()=>window.__test29.linkedStatMetric({league:"mlb"},{key:"strikeouts"},null,[["strikeouts","Strikeouts"]])') is None
  b.close();print('LEAGUE METRIC MAPPINGS PASS',len(samples),'leagues')

if __name__=='__main__':
 check_maps()
 for l in ['nba','nfl','mls']:
  for w in [1280,390]:run(l,w)
