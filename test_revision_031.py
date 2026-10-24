"""0_31 regression: two view destinations, sticky live counter, team page fixtures."""
import json
from datetime import datetime,timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
now=datetime.now(ZoneInfo('America/Denver'))
TODAY=now.replace(hour=17,minute=0,second=0,microsecond=0).isoformat()
YESTERDAY=(now-timedelta(days=1)).replace(hour=18,minute=0,second=0,microsecond=0).isoformat()

def competition(eid,date,state='pre',a='0',b='0',win=False):
    return {'id':eid,'date':date,'name':'Away at Home','season':{'type':2,'year':2026},'competitions':[{'id':eid,'date':date,'status':{'type':{'state':state,'shortDetail':'In progress' if state=='in' else 'Final' if state=='post' else 'Scheduled'}},'competitors':[
        {'homeAway':'away','score':a if state!='pre' else '', 'winner':win,'team':{'id':'1','displayName':'Away Team','abbreviation':'AWY','color':'0066aa','logo':'https://a.espncdn.com/i/teamlogos/nhl/500/away.png'}},
        {'homeAway':'home','score':b if state!='pre' else '', 'winner':not win if state=='post' else False,'team':{'id':'2','displayName':'Home Team','abbreviation':'HME','color':'dd3311','logo':'https://a.espncdn.com/i/teamlogos/nhl/500/home.png'}}]}]}

def run(width):
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':width,'height':900},timezone_id='America/Denver',has_touch=width<500)
        page=context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
        def route(r):
            u=r.request.url
            if '/hockey/nhl/teams/1/schedule?' in u:
                body={'events':[competition('424200',YESTERDAY,'post','5','3',True),competition('424201',TODAY,'in','2','1'),competition('424202',TODAY,'pre')]}
            elif '/hockey/nhl/scoreboard?' in u:
                body={'events':[competition('424201',TODAY,'in','2','1')]}
            elif '/hockey/nhl/summary?' in u:
                body={'plays':[],'header':{'competitions':[{'competitors':[]} ]},'boxscore':{'teams':[],'players':[]}}
            elif 'sports.core.api' in u:
                body={'splits':{'categories':[]}}
            else: body={'events':[]}
            r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
        page.route('https://site.api.espn.com/**',route)
        page.route('https://sports.core.api.espn.com/**',route)
        page.route('https://a.espncdn.com/**',lambda r:r.fulfill(status=404,body=''))
        page.set_content(HTML,wait_until='load')
        card=page.locator('.league-section[data-league="nhl"] .score-card').first
        card.wait_for(timeout=15000)
        assert card.locator('.card-bottom .game-flow-toggle').count()==1
        assert card.locator('.card-bottom .monitor-launch').count()==1
        assert card.locator('.expanded-tools .monitor-launch').count()==0
        assert not page.locator('.sticky-score-nav').evaluate('(e)=>e.classList.contains("has-sticky-count")')
        # Fullscreen directly from a collapsed card is supported, then closes without opening details.
        card.locator('.monitor-launch').click()
        page.locator('#game-monitor[open]').wait_for(timeout=4000)
        page.locator('#game-monitor-close').click()
        assert card.locator('[data-expand]').get_attribute('aria-expanded')=='false'
        card.locator('[data-expand]').click()
        assert card.locator('[data-expand]').get_attribute('aria-expanded')=='true'
        assert card.locator('.expanded-tools .monitor-launch').count()==0
        card.screenshot(path=f'/mnt/data/scoreboard0_31_card_{width}.png')
        page.evaluate('scrollTo(0,1000)')
        page.wait_for_timeout(250)
        # Header can be beyond the top at very small pages; force additional space if needed.
        page.evaluate('scrollTo(0,document.body.scrollHeight)')
        page.wait_for_timeout(250)
        if page.locator('.sticky-score-nav').evaluate('(e)=>e.getBoundingClientRect().top<=1&&document.querySelector(".day-heading").getBoundingClientRect().bottom<=0'):
            assert page.locator('.sticky-live-summary').is_visible()
            assert page.locator('#sticky-live-count').inner_text()==page.locator('#live-count').inner_text()
            page.screenshot(path=f'/mnt/data/scoreboard0_31_sticky_{width}.png',full_page=False)
        page.locator('.league-section[data-league="nhl"] .team-link').first.click()
        page.locator('.team-schedule-game').first.wait_for(timeout=8000)
        assert page.locator('.schedule-live').count()==1
        assert page.locator('.schedule-today').count()==1
        assert 'LIVE' in page.locator('.schedule-live').inner_text()
        page.locator('[data-team-tab="stats"]').click()
        chart=page.locator('.team-season-chart')
        chart.wait_for(timeout=8000)
        assert chart.locator('.team-season-bar image').count()>=1
        assert page.locator('.team-view').evaluate('(e)=>getComputedStyle(e).getPropertyValue("--team-accent").trim()')!='#e4bb76'
        page.locator('.team-season-bar').first.hover(force=True)
        assert 'Home Team' in page.locator('[data-team-chart-tooltip]').inner_text()
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+5')
        page.screenshot(path=f'/mnt/data/scoreboard0_31_team_{width}.png',full_page=False)
        assert not errors,errors
        browser.close()
if __name__=='__main__':
    run(1280);run(390);print('0_31 passed desktop and mobile')
