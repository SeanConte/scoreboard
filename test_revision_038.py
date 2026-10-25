"""0_38 filters migrate to sticky nav and Favorites settings share persistent IDs."""
from pathlib import Path
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
now=datetime.now(ZoneInfo('America/Denver')).replace(hour=18,minute=0,second=0,microsecond=0).isoformat()
def game(ident,league,state='in'):
 return {'id':str(ident),'date':now,'name':f'{league} Away at {league} Home','competitions':[{'id':str(ident),'date':now,'status':{'type':{'state':state,'shortDetail':'Q2 7:22'}},'competitors':[{'homeAway':'away','score':'15','team':{'id':str(ident)+'11','displayName':f'{league} Away','abbreviation':'AWY','color':'ea6677'}},{'homeAway':'home','score':'20','team':{'id':str(ident)+'12','displayName':f'{league} Home','abbreviation':'HME','color':'2278aa'}}]}]}

def run(width):
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':width,'height':850},timezone_id='America/Denver')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   u=r.request.url
   if '/basketball/wnba/scoreboard?' in u:data={'events':[game(1001,'WNBA'),game(1002,'WNBA','pre')]}
   elif '/basketball/nba/scoreboard?' in u:data={'events':[game(i,'NBA') for i in range(3000,3016)]}
   else:data={'events':[]}
   r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(data))
  ctx.route('https://site.api.espn.com/**',route)
  ctx.route('https://sports.core.api.espn.com/**',route)
  ctx.route('https://a.espncdn.com/**',lambda r:r.fulfill(status=404,body=''))
  page.evaluate("""() => {const memory={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(memory,k)?memory[k]:null,setItem:(k,v)=>memory[k]=String(v),removeItem:k=>delete memory[k]}})}""")
  page.set_content(HTML,wait_until='load')
  page.locator('[data-league="wnba"] .score-card').first.wait_for(timeout=30000)
  assert page.locator('.pin-board-icon').count()==0
  assert page.locator('.double-pin-icon').count()==2
  assert page.locator('#filter-pinned-sticky').get_attribute('aria-pressed')=='false'
  assert page.locator('#sticky-filter-rail').is_visible()
  page.locator('[data-league="wnba"] .pin-game-button').first.click()
  page.locator('[data-league="wnba"] .favorite-team-button').first.click()
  assert page.locator('#pinned-filter-count').inner_text()==page.locator('#pinned-filter-count-sticky').inner_text()
  assert page.locator('#favorite-filter-count').inner_text()==page.locator('#favorite-filter-count-sticky').inner_text()
  page.locator('#settings-open').click();page.locator('#settings-tab-favorites').click()
  assert page.locator('#settings-leagues-panel').is_hidden()
  assert page.locator('#settings-favorites-panel').is_visible()
  assert page.locator('.settings-favorite-row').count()==1
  assert 'WNBA Away' in page.locator('.settings-favorite-row').inner_text()
  assert page.locator('#settings-reset').is_hidden()
  assert page.locator('#settings-favorites-count').inner_text()=='1'
  page.locator('#settings-tab-leagues').click();assert page.locator('[data-league-display="nba"]').count()==1
  page.locator('#settings-tab-favorites').click();page.locator('#settings-done').click()
  # The navigation filters remain visible in the second sticky row.
  page.evaluate('window.scrollTo(0, document.querySelector(".sort-toolbar").getBoundingClientRect().bottom + window.scrollY + 130)')
  page.wait_for_timeout(300)
  assert page.locator('#sticky-score-nav').evaluate('(e)=>e.classList.contains("has-sticky-filters")')
  assert page.locator('#sticky-filter-rail').is_visible()
  assert page.locator('#filter-pinned-sticky').is_visible()
  page.locator('#filter-pinned-sticky').click()
  assert page.locator('#filter-pinned-sticky').get_attribute('aria-pressed')=='true'
  assert page.locator('#filter-pinned').get_attribute('aria-pressed')=='true'
  # Filtering down to one match may legitimately remove the page's scroll
  # height, returning the sticky controls to the normal toolbar.
  if page.locator('#filter-favorites-sticky').is_visible():
   page.locator('#filter-favorites-sticky').click()
  else:
   page.locator('#filter-favorites').click()
  assert page.locator('#filter-favorites-sticky').get_attribute('aria-pressed')=='true'
  assert page.locator('#filter-favorites').get_attribute('aria-pressed')=='true'
  page.locator('#settings-open').click()
  assert page.locator('#settings-favorites-panel').is_visible()  # retained tab
  page.locator('.settings-unfavorite').click()
  assert page.locator('.settings-favorite-row').count()==0
  assert page.locator('#settings-favorites-count').inner_text()=='0'
  store=page.evaluate('JSON.parse(localStorage.getItem("scoreboard-favorites-v1"))')
  assert not store['teams']
  assert not errors,errors
  assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 3'),width
  page.locator('#settings-done').click()
  # No preview dependency in shipped source.
  browser.close()
if __name__=='__main__':
 for w in [1280,390,320]:run(w)
 print('0_38 interactions passed desktop and phone')
