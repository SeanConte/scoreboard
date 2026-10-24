"""0.21 regression: focus mode, live updates, mobile fit, closing and shared details."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import json
from playwright.sync_api import sync_playwright

HTML=(Path(__file__).resolve().parents[1]/'index.html').read_text()
WHEN=datetime.now(ZoneInfo('America/Denver')).replace(hour=13,minute=0,second=0,microsecond=0).isoformat()
scores=[61,59]

def fixture():
    return {'id':'424242','date':WHEN,'name':'Away Team at Home Team','season':{'type':2},'competitions':[{'id':'424242','date':WHEN,'status':{'type':{'state':'in','shortDetail':'Q3 8:23','description':'In Progress'},'period':3,'displayClock':'8:23'},'competitors':[{'homeAway':'away','score':str(scores[0]),'team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'},'linescores':[{'value':20},{'value':21},{'value':scores[0]-41}]},{'homeAway':'home','score':str(scores[1]),'team':{'id':'2','displayName':'Home Team','abbreviation':'HME'},'linescores':[{'value':22},{'value':20},{'value':scores[1]-42}]}]}]}

SUMMARY={'header':{'competitions':[{'status':{'type':{'state':'in'}},'competitors':[{'homeAway':'away','team':{'id':'1','abbreviation':'AWY'}},{'homeAway':'home','team':{'id':'2','abbreviation':'HME'}}]}]}, 'boxscore':{'teams':[{'team':{'abbreviation':'AWY'},'statistics':[{'name':'assists','label':'Assists','displayValue':'14'},{'name':'rebounds','label':'Rebounds','displayValue':'25'}]},{'team':{'abbreviation':'HME'},'statistics':[{'name':'assists','label':'Assists','displayValue':'13'},{'name':'rebounds','label':'Rebounds','displayValue':'23'}]}]}}

def run_test(viewport):
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport=viewport,timezone_id='America/Denver',reduced_motion='reduce')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        def route(r):
            content=SUMMARY if '/summary?' in r.request.url else {'events':[fixture()]} if '/basketball/nba/scoreboard?' in r.request.url else {'events':[]}
            r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(content))
        page.route('https://site.api.espn.com/**',route)
        page.goto('about:blank');page.set_content(HTML,wait_until='load')
        page.locator('.league-section[data-league="nba"] .score-card').first.wait_for(timeout=15000)
        page.locator('.league-section[data-league="nba"] [data-expand]').first.click()
        launch=page.locator('[data-monitor-open]').first;launch.wait_for(timeout=10000)
        assert page.locator('#game-monitor').get_attribute('open') is None
        launch.click()
        dialog=page.locator('#game-monitor');assert dialog.evaluate('(e)=>e.open')
        assert page.locator('body').evaluate('(e)=>e.classList.contains("monitor-open")')
        assert dialog.locator('.monitor-matchup').count()==1
        assert dialog.locator('[data-monitor-view]').count()==2
        assert dialog.locator('.chart-panel').count()==1
        assert dialog.locator('.stats-panel').count()==1
        assert dialog.locator('.monitor-score').all_text_contents()==[str(scores[0]),str(scores[1])]
        assert dialog.locator('.monitor-overview').count()==1
        assert page.locator('#details-nba-424242').count()==1
        bounds=dialog.bounding_box();assert bounds['x']==0 and bounds['y']==0 and abs(bounds['width']-viewport['width'])<2 and abs(bounds['height']-viewport['height'])<2,bounds
        # Don't allow the overlay to cause horizontal overflow on narrow screens.
        assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+2'),('modal overflow',viewport)
        # Simulate the game's scores changing with the next live refresh.
        scores[:]=[68,65]
        page.locator('#game-monitor-body .monitor-score').first.wait_for()
        # Trigger same refresh path while modal is active.
        page.evaluate('Date.now = (() => { const start=Date.now(); return () => start+31000; })(); window.dispatchEvent(new Event("online"))')
        page.wait_for_function("document.querySelector('#game-monitor-body .monitor-score')?.textContent==='68'",timeout=15000)
        assert dialog.locator('.monitor-score').all_text_contents()==['68','65']
        assert dialog.locator('.stats-panel').count()==1
        dialog.locator('[data-monitor-view=box]').click()
        assert dialog.locator('.monitor-box').count()==1
        dialog.locator('[data-monitor-view=overview]').click()
        assert dialog.locator('.monitor-overview').count()==1
        # Escape returns to the same expanded game and restores scrolling.
        page.keyboard.press('Escape');assert not dialog.evaluate('(e)=>e.open')
        assert page.locator('#details-nba-424242').is_visible()
        assert not page.locator('body').evaluate('(e)=>e.classList.contains("monitor-open")')
        # Reopening and pressing the visible close button uses the same path.
        page.locator('[data-monitor-open]').first.click(); assert dialog.evaluate('(e)=>e.open')
        page.locator('#game-monitor-close').click();assert not dialog.evaluate('(e)=>e.open')
        assert not errors,errors
        print('GAME MONITOR PASS',viewport)
        browser.close()

run_test({'width':1280,'height':900})
run_test({'width':390,'height':844})
