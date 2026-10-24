"""Offline integration test for FBS/FCS discovery, card UI, and screen width."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
HTML=(Path(__file__).resolve().parents[1]/'index.html').read_text()

def event(eid,away_id,home_id,away,home):
    date='2026-10-17T17:00:00Z'
    return {'id':str(eid),'date':date,'name':f'{away} at {home}','season':{'type':2},'competitions':[{'id':str(eid),'date':date,'status':{'type':{'state':'post','shortDetail':'Final'}},'competitors':[{'homeAway':'away','team':{'id':str(away_id),'abbreviation':away[:3].upper(),'displayName':away},'score':'20'},{'homeAway':'home','team':{'id':str(home_id),'abbreviation':home[:3].upper(),'displayName':home},'score':'41'}]}]}

def run(width):
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':width,'height':820},timezone_id='America/Denver')
        errors=[];calls=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        def route(r):
            url=r.request.url;calls.append(url)
            if '/standings?' in url:
                teams=[{'team':{'id':str(i)}} for i in range(100,230)]+[{'team':{'id':'245'}}]
                payload={'children':[{'standings':{'entries':teams}}]}
            elif 'football/college-football/scoreboard' in url:
                if 'groups=81' in url:
                    payload={'events':[event(800,'501','245','Citadel','Texas A&M'),event(802,'501','502','FCS East','FCS West')]}
                else:
                    payload={'events':[event(801,'200','201','Ohio State','Indiana')]}
            else:payload={'events':[]}
            r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(payload))
        page.route('https://site.api.espn.com/**',route)
        page.route('https://sports.core.api.espn.com/**',lambda r:r.fulfill(status=404,body=''))
        page.goto('about:blank');page.set_content(HTML,wait_until='load')
        page.locator('#date').fill('2026-10-17');page.locator('#date').dispatch_event('change')
        page.locator('[data-sport="sport:football"]').click()
        page.locator('[data-sport="cfb"]').click()
        page.get_by_text('Texas A&M',exact=False).first.wait_for(timeout=20000)
        cards=page.locator('.score-card').all_text_contents()
        assert len(cards)==2,cards
        assert any('Texas A&M' in c and 'Citadel' in c for c in cards)
        assert any('Ohio State' in c for c in cards)
        assert not any('FCS East' in c for c in cards)
        assert page.locator('body').evaluate('(el)=>el.scrollWidth<=innerWidth+1'),width
        assert page.get_by_text('FBS–FCS games may be missing').count()==0
        assert not errors,errors
        browser.close()
        print(f'CFB browser integration passed at {width}px, {len([x for x in calls if "college-football" in x])} CFB requests')

if __name__=='__main__':
    run(390);run(1280)
