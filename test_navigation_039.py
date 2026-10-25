"""Clean branch regression: nav row never scrolls vertically, no animations."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
DATE=datetime.now(ZoneInfo('America/Denver')).replace(hour=18,minute=0,second=0,microsecond=0).isoformat()
def game(n,league='NBA',state='in'):
 return {'id':str(n),'date':DATE,'name':f'{league} Away at {league} Home','competitions':[{'id':str(n),'date':DATE,'status':{'type':{'state':state,'shortDetail':'Q2 7:22'}},'competitors':[{'homeAway':'away','score':'15','team':{'id':str(n)+'11','displayName':f'{league} Away','abbreviation':'AWY','color':'ea6677'}},{'homeAway':'home','score':'20','team':{'id':str(n)+'12','displayName':f'{league} Home','abbreviation':'HME','color':'2278aa'}}]}]}
def test(width):
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':width,'height':900},timezone_id='America/Denver')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  def route(r):
   u=r.request.url
   if '/basketball/wnba/scoreboard?' in u:data={'events':[game(i,'WNBA') for i in range(2100,2116)]}
   elif '/basketball/nba/scoreboard?' in u:data={'events':[game(i,'NBA') for i in range(3100,3105)]}
   elif '/football/nfl/scoreboard?' in u:data={'events':[game(i,'NFL') for i in range(4100,4110)]}
   else:data={'events':[]}
   r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(data))
  ctx.route('https://site.api.espn.com/**',route)
  ctx.route('https://sports.core.api.espn.com/**',route)
  ctx.route('https://a.espncdn.com/**',lambda r:r.fulfill(status=404,body=''))
  page.set_content(HTML,wait_until='load')
  page.locator('.score-card').first.wait_for(timeout=30000)
  assert page.locator('#settings-open').is_visible()
  assert page.locator('.sticky-nav-second #filter-pinned-sticky').is_visible()
  assert page.locator('.sticky-nav-second #filter-favorites-sticky').is_visible()
  assert page.locator('.sticky-nav-second #date').is_visible()
  assert page.locator('.monitor-basketball-scene').count()==0
  assert 'data:image/gif;base64' not in HTML
  def nav_state():
   return page.evaluate('''() => {const e=document.querySelector('#sport-tabs');const a=getComputedStyle(e);return {scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,scrollTop:e.scrollTop,overflowY:a.overflowY,overflowX:a.overflowX,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,headerWidth:document.documentElement.scrollWidth-innerWidth}}''')
  state=nav_state()
  assert state['overflowY']=='hidden', (width,state)
  assert state['scrollHeight']<=state['clientHeight']+1, (width,state)
  assert state['headerWidth']<=3,(width,state)
  triggers=page.locator('#sport-tabs .sport-family-trigger')
  for j in range(triggers.count()):
   el=triggers.nth(j)
   el.scroll_into_view_if_needed(timeout=5000)
   el.click()
   page.wait_for_timeout(40)
   expanded=nav_state()
   assert expanded['overflowY']=='hidden', (width,j,expanded)
   assert expanded['scrollHeight']<=expanded['clientHeight']+1,(width,j,expanded)
   assert expanded['headerWidth']<=3,(width,j,expanded)
   # Also check that the actual tab bar does not scroll in response to vertical input.
   page.evaluate('''() => {const e=document.querySelector('#sport-tabs');e.scrollTop=100}''')
   assert page.evaluate("document.querySelector('#sport-tabs').scrollTop")==0, (width,j)
  page.locator('#sport-tabs [data-sport="all"]').first.click()
  page.evaluate('window.scrollTo(0,document.body.scrollHeight)')
  page.wait_for_timeout(150)
  assert page.locator('#live-filter-sticky').is_visible()
  # The existing filter controls stay on the second line with date, not third.
  rects=page.evaluate('''() => ['#filter-pinned-sticky','#filter-favorites-sticky','#date'].map(q=>document.querySelector(q).getBoundingClientRect().top)''')
  assert max(rects)-min(rects)<18,(width,rects)
  assert not errors,(width,errors)
  browser.close()
if __name__=='__main__':
 for w in [1280,390,320]:
  test(w)
  print('PASS',w,flush=True)
