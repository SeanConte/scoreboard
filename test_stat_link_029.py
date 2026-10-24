"""A real in-app team stat -> graph -> Box Score -> graph linking flow."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ns={'__file__':str(Path(__file__).with_name('test_player_monitor.py'))}
exec(Path(__file__).with_name('test_player_monitor.py').read_text().split('def run(width,height):')[0],ns)
WHEN=ns['WHEN'];HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()

def event():
 return {'id':'424242','date':WHEN,'name':'Away at Home','competitions':[{'id':'424242','date':WHEN,'status':{'type':{'state':'post','shortDetail':'Final'}},'competitors':[{'homeAway':'away','score':'2','team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'}},{'homeAway':'home','score':'1','team':{'id':'2','displayName':'Home Team','abbreviation':'HME'}}]}]}
def summary():
 plays=[]
 for i in range(16):
  side=i%2
  plays.append({'id':str(i+1),'type':{'text':'Shot'},'text':'Saved shot on goal','shootingPlay':True,'period':{'number':i%3+1},'clock':{'displayValue':f'{18-i%3}:00'},'team':{'id':'1' if side==0 else '2'}})
 return {'progressionPlays':plays,'header':{'competitions':[{'competitors':[{'homeAway':'away','team':{'id':'1','abbreviation':'AWY'}},{'homeAway':'home','team':{'id':'2','abbreviation':'HME'}}]}]},
 'boxscore':{'teams':[{'team':{'id':'1','abbreviation':'AWY'},'statistics':[{'name':'shotsOnGoal','label':'Shots on goal','displayValue':'8'},{'name':'faceoffPct','label':'Faceoff percentage','displayValue':'51.4%'}]},
 {'team':{'id':'2','abbreviation':'HME'},'statistics':[{'name':'shotsOnGoal','label':'Shots on goal','displayValue':'8'},{'name':'faceoffPct','label':'Faceoff percentage','displayValue':'48.6%'}]}]}}

def run(width):
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=b.new_context(viewport={'width':width,'height':850},timezone_id='America/Denver',has_touch=width<500,reduced_motion='reduce')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   u=r.request.url
   body=summary() if '/summary?' in u else {'events':[event()]} if '/hockey/nhl/scoreboard?' in u else {'events':[]}
   r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
  page.route('https://site.api.espn.com/**',route)
  page.set_content(HTML,wait_until='load')
  game=page.locator('.league-section[data-league="nhl"] .score-card').first
  game.wait_for(timeout=15000);game.locator('[data-expand]').click()
  button=game.locator('[data-stat-metric="shotsOnGoal"]');button.wait_for(timeout=10000)
  assert game.locator('.stat-match-linked').count()==1,game.locator('.stat-match-linked').count()
  assert game.locator('.stat-match').filter(has_text='Faceoff percentage').locator('button').count()==0
  button.click()
  game.locator('[data-chart-metric]').wait_for();assert game.locator('[data-chart-metric]').input_value()=='shotsOnGoal'
  page.locator('[data-monitor-open]').first.click()
  dialog=page.locator('#game-monitor');dialog.locator('[data-chart-metric]').wait_for()
  assert dialog.locator('[data-chart-metric]').input_value()=='shotsOnGoal'
  dialog.locator('[data-chart-metric]').select_option('score')
  dialog.locator('[data-monitor-view="box"]').click()
  dialog.locator('[data-box-stat-metric="shotsOnGoal"]').wait_for(timeout=10000)
  dialog.locator('[data-box-stat-metric="shotsOnGoal"]').click()
  assert dialog.locator('[data-monitor-view="overview"]').get_attribute('aria-selected')=='true'
  assert dialog.locator('[data-chart-metric]').input_value()=='shotsOnGoal'
  assert not errors,errors
  b.close();print('GAME STAT LINK PASS',width)
if __name__=='__main__':
 for width in [1280,390]:run(width)
