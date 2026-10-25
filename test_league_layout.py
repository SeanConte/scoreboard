"""0.20 settings, sport navigation, browser persistence, sort migration, sticky UI."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
WHEN=datetime.now(ZoneInfo('America/Denver')).replace(hour=13,minute=0,second=0,microsecond=0).isoformat()

def fixture(name):
    return {'id':'424242','date':WHEN,'name':'Away at Home','season':{'type':2},'competitions':[{'id':'424242','date':WHEN,'status':{'type':{'state':'pre','description':'Scheduled'}},'competitors':[{'homeAway':'away','team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'}},{'homeAway':'home','team':{'id':'2','displayName':'Home Team','abbreviation':'HME'}}]}]}

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':900},timezone_id='America/Denver')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def route(r):
        body={'events':[fixture('NBA')]} if '/basketball/nba/scoreboard?' in r.request.url else {'events':[]}
        r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
    page.route('https://site.api.espn.com/**',route)
    def open_board(saved=None):
        page.goto('about:blank')
        page.evaluate("""store=>{window.__prefs=store;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(window.__prefs,k)?window.__prefs[k]:null,setItem:(k,v)=>window.__prefs[k]=String(v),removeItem:k=>delete window.__prefs[k]}})}""",saved or {})
        page.set_content(HTML,wait_until='load')
        page.locator('.league-section[data-league="nba"]').first.wait_for(timeout=15000)
    def order():return page.locator('.league-section[data-league]').evaluate_all('(els)=>els.map(e=>e.dataset.league)')
    open_board()
    page.locator('.league-section[data-league="nba"] .score-card').first.wait_for(timeout=15000)
    assert len(order())==10
    assert page.locator('[data-move-league],[data-drag-league]').count()==0
    assert page.locator('#sort option').count()==5
    assert page.locator('.edition').count()==0
    page.locator('[data-collapse-league="nba"]').click()
    assert page.locator('[data-collapse-league="nba"]').get_attribute('aria-expanded')=='false'
    assert not page.locator('#league-content-nba').is_visible()
    page.locator('#settings-open').click()
    assert page.locator('#league-settings').evaluate('(el)=>el.open')
    page.locator('[data-settings-move="wnba"][data-direction="1"]').click()
    assert order()[:2]==['nba','wnba'],order()
    page.locator('[data-league-visible="mlb"]').uncheck()
    assert 'mlb' not in order(),order()
    saved=page.evaluate('JSON.parse(localStorage.getItem("scoreboard-layout-v1"))')
    assert saved['order'][:2]==['nba','wnba'] and 'nba' in saved['collapsed'] and 'mlb' in saved['hidden'],saved
    page.locator('#settings-done').click()
    # Selecting the basketball family opens NBA/WNBA alongside an ALL-family control.
    page.locator('.sport-family[data-family="basketball"] .sport-family-trigger').click()
    assert set(order())=={'nba','wnba'}
    assert page.locator('.sport-family[data-family="basketball"] .family-all-choice').inner_text()=='ALL'
    page.locator('[data-sport="nba"]').click()
    assert order()==['nba']
    page.locator('.sport-family[data-family="basketball"] .family-all-choice').click()
    assert set(order())=={'nba','wnba'}
    page.locator('[data-sport="all"]').click()
    assert len(order())==9
    # Current selected sport icon expands to inline leagues; other sports remain icon-only.
    assert page.locator('#sport-tabs [data-sport="sport:baseball"]').count()==0, 'Hidden MLB should remove baseball family'
    # Live date controls move with sticky sport navigation.
    page.evaluate('window.scrollTo(0,1200)')
    page.wait_for_timeout(100)
    assert abs(page.locator('#sticky-score-nav').bounding_box()['y'])<1.1
    # Browser reload keeps layout and collapsed sections.
    previous_prefs=page.evaluate('window.__prefs')
    open_board(previous_prefs)
    assert order()[:2]==['nba','wnba'] and 'mlb' not in order()
    assert page.locator('[data-collapse-league="nba"]').get_attribute('aria-expanded')=='false'
    # Sorting previously saved modes should migrate without obsolete menu options.
    page.evaluate('localStorage.setItem("scoreboard-sort-v1", JSON.stringify({sort:"gap-time",grouped:true}))')
    open_board(page.evaluate('window.__prefs'))
    assert page.locator('#sort').input_value()=='close-late'
    page.locator('#settings-open').click()
    # Drag from NBA (first) past WNBA; settings only, not main board.
    page.locator('[data-settings-drag="nba"]').drag_to(page.locator('[data-settings-league="wnba"]'),target_position={'x':320,'y':38})
    assert order().index('nba')>order().index('wnba')
    page.locator('#settings-reset').click()
    assert order()==['wnba','nba','mlb','nwsl','mls','nhl','nfl','cfb','atp','wta']
    assert page.locator('[data-collapse-league="nba"]').get_attribute('aria-expanded')=='true'
    assert page.locator('[data-league-visible="mlb"]').is_checked()
    page.locator('#settings-done').click()
    page.set_viewport_size({'width':390,'height':844})
    assert page.locator('#sticky-score-nav').is_visible()
    page.locator('#settings-open').click()
    assert page.locator('[data-settings-move="nba"][data-direction="1"]').is_visible()
    assert not errors,errors
    print('LEAGUE SETTINGS/NAV/SORT/PERSISTENCE/STICKY TEST PASSED')
    browser.close()
