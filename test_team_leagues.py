"""Season pages and sport-specific scoring labels across all eight team leagues.
   These are offline ESPN-shape tests, NOT evidence of live endpoint uptime."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ns={'__file__':str(Path(__file__).with_name('test_player_monitor.py'))}
exec(Path(__file__).with_name('test_player_monitor.py').read_text().split('def run(width,height):')[0],ns)
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
WHEN=ns['WHEN']
LEAGUES=[('nba','basketball/nba','Points'),('wnba','basketball/wnba','Points'),('mlb','baseball/mlb','Runs'),('nhl','hockey/nhl','Goals'),('nfl','football/nfl','Points'),('cfb','football/college-football','Points'),('mls','soccer/usa.1','Goals'),('nwsl','soccer/usa.nwsl','Goals')]
def event(state,score):
 return {'id':'424242','date':WHEN,'season':{'type':2},'name':'Away at Home','competitions':[{'id':'424242','date':WHEN,'status':{'type':{'state':state,'shortDetail':'Final' if state=='post' else 'Scheduled'}},'competitors':[{'homeAway':'away','score':score,'winner':True,'team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'}},{'homeAway':'home','score':'2','winner':False,'team':{'id':'2','displayName':'Home Team','abbreviation':'HME'}}]}]}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for league,path,unit in LEAGUES:
  ctx=browser.new_context(viewport={'width':1200,'height':850},timezone_id='America/Denver')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   u=r.request.url
   if '/schedule?' in u:body={'events':[event('post','5')]}
   elif '/scoreboard?' in u:body={'events':[event('pre','5')]} if path in u else {'events':[]}
   elif '/statistics' in u:body={'splits':{'categories':[{'name':'General','stats':[{'displayName':'Field metric','displayValue':'3.4'}]}]}}
   else:body={'events':[]}
   r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
  page.route('https://site.api.espn.com/**',route)
  page.route('https://sports.core.api.espn.com/**',route)
  page.set_content(HTML,wait_until='load')
  link=page.locator(f'.league-section[data-league="{league}"] .team-link').first
  link.wait_for(timeout=12000);link.click()
  page.locator('.team-schedule-game').first.wait_for(timeout=10000)
  page.locator('[data-team-tab="stats"]').click()
  page.locator('.team-derived-grid').wait_for(timeout=10000)
  assert unit in page.locator('.team-derived-grid').inner_text(),(league,page.locator('.team-derived-grid').inner_text())
  page.get_by_text('Field metric').wait_for(timeout=10000)
  assert not errors,(league,errors)
  print('TEAM LEAGUE PASS',league,unit)
  ctx.close()
 browser.close()
