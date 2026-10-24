"""0.28 stats: separate schedule-derived statistics from published Core aggregates."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ns={'__file__':str(Path(__file__).with_name('test_player_monitor.py'))}
exec(Path(__file__).with_name('test_player_monitor.py').read_text().split('def run(width,height):')[0],ns)
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
WHEN=ns['WHEN'];scoreboard=ns['scoreboard']

def schedule():
 return {'events':[{'id':str(424242+i),'date':WHEN,'competitions':[{'id':str(424242+i),'date':WHEN,'status':{'type':{'state':'post','shortDetail':'Final'}},'competitors':[{'homeAway':'away','score':str(100+i),'winner':True,'team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'}},{'homeAway':'home','score':str(88+i),'winner':False,'team':{'id':'2','displayName':'Home Team','abbreviation':'HME'}}]}]} for i in range(4)]}

def stats():
 return {'splits':{'categories':[{'displayName':'Offense','stats':[{'displayName':'Assists Per Game','displayValue':'29.8','rank':4},{'displayName':'3 point percentage','displayValue':'41.3%'},{'displayName':'Makes/Attempts','displayValue':'12-29'}]},{'displayName':'Defense','stats':[{'displayName':'Steals','displayValue':'7.5'}]}]}}

def run(width,official=True):
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_context(viewport={'width':width,'height':850},timezone_id='America/Denver').new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   url=r.request.url
   if 'sports.core.api.espn.com' in url:
    if official:r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(stats()))
    else:r.fulfill(status=404,content_type='application/json',headers={'access-control-allow-origin':'*'},body='{}')
    return
   body=schedule() if '/teams/1/schedule?' in url else scoreboard() if '/basketball/nba/scoreboard?' in url else {'events':[]}
   r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
  page.route('https://site.api.espn.com/**',route)
  page.route('https://sports.core.api.espn.com/**',route)
  page.set_content(HTML,wait_until='load')
  page.locator('.league-section[data-league="nba"] .team-link').first.wait_for(timeout=15000)
  page.locator('.league-section[data-league="nba"] .team-link').first.click()
  page.locator('.team-schedule-game').first.wait_for(timeout=15000)
  page.locator('[data-team-tab="stats"]').click()
  page.locator('.team-derived-grid').wait_for(timeout=10000)
  assert '100.0%' in page.locator('.team-derived-grid').inner_text()
  assert page.locator('.team-season-chart svg rect').count()>=8
  if official:
   page.get_by_text('Assists Per Game').wait_for(timeout=10000)
   assert 'League rank: 4' in page.locator('.team-official-sections').inner_text()
   assert page.get_by_text('12-29').count()==1
  else:
   page.get_by_text('ESPN season aggregates unavailable.').wait_for(timeout=15000)
   assert page.locator('.team-derived-grid').is_visible()
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+4'),'horizontal page overflow'
  assert not errors,errors
  browser.close()
if __name__=='__main__':
 for width in [1280,390]:
  run(width,True);run(width,False)
 print('team 0.28 passed')
