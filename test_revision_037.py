"""0_37: filters instead of duplicated cards; tri-state league settings; cap and league navigation."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import json
from playwright.sync_api import sync_playwright
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
now=datetime.now(ZoneInfo('America/Denver'))
date=now.replace(hour=18,minute=0,second=0,microsecond=0).isoformat()

def game(ident,league,state='in'):
 return {'id':str(ident),'date':date,'name':f'{league} Away at {league} Home','competitions':[{'id':str(ident),'date':date,'status':{'type':{'state':state,'shortDetail':'Q2 7:22' if state=='in' else 'Final' if state=='post' else 'Scheduled'}},'competitors':[{'homeAway':'away','score':'15' if state!='pre' else '','team':{'id':'11','displayName':f'{league} Away','abbreviation':'AWY','color':'ea6677'}},{'homeAway':'home','score':'20' if state!='pre' else '','team':{'id':'12','displayName':f'{league} Home','abbreviation':'HME','color':'2278aa'}}]}]}

def run(width):
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':width,'height':900},timezone_id='America/Denver')
  p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   u=r.request.url
   if '/basketball/wnba/scoreboard?' in u:data={'events':[game(1001,'WNBA','in'),game(1002,'WNBA','pre')]}
   elif '/basketball/nba/scoreboard?' in u:data={'events':[game(i,'NBA','in' if i<3002 else 'pre') for i in range(3000,3016)]}
   elif '/hockey/nhl/scoreboard?' in u:data={'events':[game(8001,'NHL','post')]}
   elif '/summary?' in u:data={'header':{'competitions':[{'competitors':[]}]},'boxscore':{'players':[],'teams':[]},'plays':[]}
   else:data={'events':[]}
   r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(data))
  ctx.route('https://site.api.espn.com/**',route)
  ctx.route('https://sports.core.api.espn.com/**',route)
  ctx.route('https://a.espncdn.com/**',lambda r:r.fulfill(status=404,body=''))
  store={}
  p.evaluate('''() => { const stored={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(stored,k)?stored[k]:null,setItem:(k,v)=>stored[k]=String(v),removeItem:k=>delete stored[k]}}) }''')
  p.set_content(HTML,wait_until='load')
  p.locator('[data-league="nba"] .score-card').first.wait_for(timeout=25000)
  assert p.locator('[data-league="nba"] .score-card').count()==12
  if width<=390:
   p.evaluate('window.scrollTo(0,0)');pass
  assert p.locator('[data-league="nba"] .league-view-all').count()==1
  assert p.locator('.featured-games').count()==0
  assert p.locator('#app-version').inner_text() in ('0_37','0_38','0_39')
  # League title opens league view; cap is removed.
  p.locator('[data-league="nba"] .league-page-link').click()
  assert p.locator('[data-league="nba"] .score-card').count()==16
  assert p.locator('[data-league="nba"] .league-view-all').count()==0
  p.locator('[data-sport="all"]').click()
  # Collapse is separate from league navigation.
  p.locator('[data-league="nba"] .league-collapse').click()
  assert p.locator('[data-league="nba"] .score-card').count()==0
  assert p.locator('[data-league="nba"] .league-collapse').get_attribute('aria-expanded')=='false'
  p.locator('[data-league="nba"] .league-collapse').click()
  # Pin once, use filter; never duplicate cards.
  p.locator('[data-league="wnba"] .pin-game-button').first.click()
  p.locator('#filter-pinned-sticky').click()
  assert p.locator('#filter-pinned').get_attribute('aria-pressed')=='true'
  assert p.locator('.score-card').count()==1
  assert p.locator('[data-league="wnba"] .score-card').count()==1
  assert p.locator('.featured-games').count()==0
  # Add favorite team: combined filters use union, no duplicate games.
  p.locator('[data-league="wnba"] .favorite-team-button').first.click()
  p.locator('#filter-favorites-sticky').click()
  assert p.locator('.score-card').count()==2
  assert p.locator('#filter-favorites').get_attribute('aria-pressed')=='true'
  p.locator('#filter-pinned-sticky').click()
  assert p.locator('.score-card').count()==2
  p.locator('#filter-favorites-sticky').click()
  assert p.locator('[data-league="nba"] .score-card').count()==12
  # Tri-state settings propagate to render and localStorage.
  p.locator('#settings-open').click()
  state=p.locator('[data-league-display="nba"]');state.select_option('collapsed')
  assert p.locator('[data-league-display="nba"]').input_value()=='collapsed'
  p.locator('#settings-done').click()
  assert p.locator('[data-league="nba"] .league-collapse').get_attribute('aria-expanded')=='false'
  p.locator('#settings-open').click()
  p.locator('[data-league-display="nba"]').select_option('hidden')
  p.locator('#settings-done').click()
  assert p.locator('[data-league="nba"]').count()==0
  p.locator('#settings-open').click()
  p.locator('[data-league-display="nba"]').select_option('expanded')
  p.locator('#settings-done').click()
  assert p.locator('[data-league="nba"] .score-card').count()==12
  # Cap CTA removes any remaining filters when opening league.
  p.locator('#filter-pinned-sticky').click()
  assert p.locator('[data-league="nba"] .score-card').count()==0
  p.locator('#filter-pinned-sticky').click()
  p.locator('[data-league="nba"] .league-view-all').click()
  assert p.locator('[data-league="nba"] .score-card').count()==16
  assert p.locator('#filter-pinned').get_attribute('aria-pressed')=='false'
  # Previous preferences persist.
  data=p.evaluate('JSON.parse(localStorage.getItem("scoreboard-layout-v1"))')
  assert 'nba' not in data['hidden'] and 'nba' not in data['collapsed']
  assert not errors,errors
  assert not p.evaluate('document.documentElement.scrollWidth > innerWidth + 5'),width
  pass
  browser.close()

if __name__=='__main__':
 run(1280);run(390);run(320);print('0_37 tests pass desktop, 390 and 320 mobile')
