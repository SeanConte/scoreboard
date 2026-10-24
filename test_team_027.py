"""Team season view: canonical ID and date navigation, season selector, and back path."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ns={'__file__':str(Path(__file__).with_name('test_player_monitor.py'))}
exec(Path(__file__).with_name('test_player_monitor.py').read_text().split('def run(width,height):')[0],ns)
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
scoreboard=ns['scoreboard'];WHEN=ns['WHEN']
def schedule():
    return {'events':[{'id':'424242','date':WHEN,'competitions':[{'id':'424242','date':WHEN,'status':{'type':{'state':'post','shortDetail':'Final'}},'competitors':[{'homeAway':'away','score':'122','winner':True,'team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'}},{'homeAway':'home','score':'110','winner':False,'team':{'id':'2','displayName':'Home Team','abbreviation':'HME'}}]}]}]}

def run(width):
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':width,'height':850},timezone_id='America/Denver',has_touch=width<500)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
    url=r.request.url
    body=schedule() if '/teams/1/schedule?' in url else scoreboard() if '/basketball/nba/scoreboard?' in url else {'events':[]}
    r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
  page.route('https://site.api.espn.com/**',route)
  page.set_content(HTML,wait_until='load')
  page.locator('.league-section[data-league="nba"] .team-link').first.wait_for(timeout=15000)
  page.locator('.league-section[data-league="nba"] .team-link').first.click()
  page.locator('.team-hero h1').wait_for()
  assert page.locator('.team-hero h1').inner_text()=='Away Team'
  page.locator('.team-schedule-game').first.wait_for(timeout=10000)
  assert 'Home Team' in page.locator('.team-schedule-game').first.inner_text()
  assert page.locator('.team-view').count()==1
  page.locator('[data-team-season]').select_option(index=1)
  page.locator('[data-team-back]').click()
  assert page.locator('#team-view').is_hidden()
  page.locator('.league-section[data-league="nba"] .team-link').first.click()
  page.locator('.team-schedule-game').first.wait_for(timeout=10000)
  page.locator('.team-schedule-game').first.click()
  page.locator('[data-expand="nba-424242"]').wait_for(timeout=20000)
  assert page.locator('#team-view').is_hidden()
  assert page.locator('[data-expand="nba-424242"]').get_attribute('aria-expanded')=='true'
  page.locator('#team-return-shortcut').click()
  assert page.locator('.team-hero h1').inner_text()=='Away Team'
  assert page.locator('.team-schedule-game').count()==1
  page.locator('[data-team-back]').click()
  assert not errors,errors
  browser.close()
if __name__=='__main__':
 for width in [1280,390]:run(width)
 print('team 0.27 passed')
