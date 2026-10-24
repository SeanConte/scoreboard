"""0_32: live-only counter, date pins, favorite team duplicates, local persistence."""
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import json
from playwright.sync_api import sync_playwright
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
now=datetime.now(ZoneInfo('America/Denver'))
date=now.replace(hour=18,minute=0,second=0,microsecond=0).isoformat()
day=now.strftime('%Y-%m-%d')

def game(ident,league,status='in'):
    return {'id':ident,'date':date,'name':f'{league} Away at {league} Home','competitions':[{'id':ident,'date':date,'status':{'type':{'state':status,'shortDetail':'Q2 7:22' if status=='in' else 'Scheduled' if status=='pre' else 'Final'}},'competitors':[
      {'homeAway':'away','score':'45' if status!='pre' else '', 'team':{'id':'11','displayName':f'{league} Away','abbreviation':'AWY','color':'ea6677'}},
      {'homeAway':'home','score':'50' if status!='pre' else '', 'team':{'id':'12','displayName':f'{league} Home','abbreviation':'HME','color':'2278aa'}}]}]}

def run(width):
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':width,'height':900},timezone_id='America/Denver')
    p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
    def route(r):
      u=r.request.url
      if '/basketball/wnba/scoreboard?' in u: data={'events':[game('1001','WNBA','in')]}
      elif '/basketball/nba/scoreboard?' in u:data={'events':[game('2002','NBA','pre')]}
      elif '/hockey/nhl/scoreboard?' in u:data={'events':[game('3003','NHL','in')]}
      elif '/baseball/mlb/scoreboard?' in u:data={'events':[game('4004','MLB','post')]}
      elif '/summary?' in u:data={'header':{'competitions':[{'competitors':[]}]},'boxscore':{'players':[],'teams':[]},'plays':[]}
      else:data={'events':[]}
      r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(data))
    ctx.route('https://site.api.espn.com/**',route)
    ctx.route('https://sports.core.api.espn.com/**',route)
    ctx.route('https://a.espncdn.com/**',lambda r:r.fulfill(status=404,body=''))
    p.evaluate("""() => {
      const stored = {};
      Object.defineProperty(window, 'localStorage', {configurable:true, value:{
        getItem(k){return Object.prototype.hasOwnProperty.call(stored,k)?stored[k]:null},
        setItem(k,v){stored[k]=String(v)},removeItem(k){delete stored[k]}
      }});
    }""")
    p.set_content(HTML,wait_until='load')
    p.locator('[data-league="nhl"] .score-card').wait_for(timeout=18000)
    p.locator('[data-league="nba"] .score-card').wait_for(timeout=18000)
    assert p.locator('#live-filter-main').get_attribute('aria-pressed')=='false'
    p.locator('[data-league="nhl"] .pin-game-button').first.click()
    p.locator('.featured-pinned .score-card').wait_for()
    assert p.locator('.featured-pinned .score-card').count()==1
    assert p.locator('[data-league="nhl"] .score-card').count()==1
    # Clicking WNBA team star duplicates WNBA game without removing original.
    p.locator('[data-league="wnba"] .favorite-team-button').first.click()
    p.locator('.featured-favorites .score-card').wait_for()
    assert p.locator('.featured-favorites .score-card').count()==1
    assert p.locator('[data-league="wnba"] .score-card').count()==1
    p.screenshot(path=f"/mnt/data/sb32/preview_{width}.png")
    # Same game cannot appear twice in featured rows even when favorite and pinned.
    p.locator('[data-league="nhl"] .favorite-team-button').first.click()
    assert p.locator('.featured-pinned .score-card').count()==1
    assert p.locator('.featured-favorites .score-card').count()==1
    # Duplicate cards must expand independently, not produce duplicate IDs.
    pinned=p.locator('.featured-pinned .score-card').first
    pinned.locator('[data-expand]').click()
    assert pinned.locator('[data-expand]').get_attribute('aria-expanded')=='true'
    assert p.locator('[data-league="nhl"] [data-expand]').get_attribute('aria-expanded')=='false'
    assert p.locator('.score-card [id^="details-"]').count()==1
    # NHL view still shows cross-sport favorite WNBA at the top.
    p.locator('[data-sport="sport:hockey"]').click()
    assert p.locator('.featured-favorites .score-card').count()==1
    # Live-only filters regular and featured cards, not their underlying counts.
    p.locator('#live-filter-main').click()
    assert p.locator('#live-filter-main').get_attribute('aria-pressed')=='true'
    assert p.locator('#live-filter-sticky').get_attribute('aria-pressed')=='true'
    assert p.locator('[data-league="nhl"] .score-card').count()==1
    # NBA is scheduled; favorite team must be hidden in live-only filter.
    p.locator('[data-sport="all"]').click()
    p.locator('[data-league="nba"] .favorite-team-button').first.click() if p.locator('[data-league="nba"] .favorite-team-button').count() else None
    assert p.locator('[data-league="nba"] .score-card').count()==0
    assert p.locator('[data-league="mlb"] .score-card').count()==0
    p.evaluate('scrollTo(0,document.body.scrollHeight)');p.wait_for_timeout(350)
    if p.locator('#live-filter-sticky').is_visible():
      p.locator('#live-filter-sticky').click()
      assert p.locator('#live-filter-main').get_attribute('aria-pressed')=='false'
    else:p.locator('#live-filter-main').click()
    assert p.locator('[data-league="nba"] .score-card').count()==1
    assert p.locator('[data-league="mlb"] .score-card').count()==1
    # Persist after a fresh navigation in the same browser profile.
    state=p.evaluate('Object.fromEntries(["scoreboard-favorites-v1","scoreboard-sort-v1","scoreboard-layout-v1"].map(k=>[k,localStorage.getItem(k)]))')
    p.close()
    p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
    p.evaluate("""(state) => {
       Object.defineProperty(window,'localStorage',{configurable:true,value:{
         getItem:k=>state[k]??null,setItem:(k,v)=>state[k]=String(v),removeItem:k=>delete state[k]
       }});
    }""",state)
    p.set_content(HTML,wait_until='load')
    p.locator('[data-league="nhl"] .score-card').wait_for(timeout=12000)
    p.locator('.featured-pinned .score-card').wait_for(timeout=12000)
    p.locator('.featured-favorites .score-card').wait_for(timeout=12000)
    assert p.locator('.featured-pinned .score-card').count()==1
    assert p.locator('.featured-favorites .score-card').count()==1
    assert len(p.evaluate('JSON.parse(localStorage.getItem("scoreboard-favorites-v1")).teams'))==2
    # Pins are date-scoped, whereas team favorites persist across dates.
    p.locator('#next').click()
    assert p.locator('.featured-pinned').count()==0
    assert len(p.evaluate('JSON.parse(localStorage.getItem("scoreboard-favorites-v1")).teams'))==2
    p.locator('#previous').click()
    p.locator('.featured-pinned .score-card').wait_for(timeout=12000)
    # Team pages provide the same favorite action, in addition to card stars.
    p.locator('[data-league="wnba"] .team-link').first.click()
    team_star=p.locator('.team-page-favorite')
    team_star.wait_for(timeout=5000)
    assert team_star.get_attribute('aria-pressed')=='true'
    team_star.click()
    assert p.locator('.team-page-favorite').get_attribute('aria-pressed')=='false'
    p.locator('[data-team-back]').click()
    assert p.locator('.featured-favorites .score-card').count()==0
    assert not p.evaluate('document.documentElement.scrollWidth>window.innerWidth+5')
    assert not errors,errors
    browser.close()

if __name__=='__main__':
    run(1280);run(390);print('0_32 passed desktop and mobile')
