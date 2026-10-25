"""0_33: live count/filter never diverge; independent polling, collapsed leagues, transitions."""
import asyncio,json
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright
HTML=Path(__file__).resolve().parents[1]/'index.html'
DATE=datetime.now(ZoneInfo('America/Denver')).replace(hour=18,minute=0,second=0,microsecond=0).isoformat()


def fixture(id,league,status):
    return {'id':id,'date':DATE,'name':league+' example','competitions':[{'id':id,'date':DATE,
        'status':{'type':{'state':status,'shortDetail':'Q3 4:12' if status=='in' else 'Final' if status=='post' else 'Scheduled'}},
        'competitors':[
          {'homeAway':'away','score':'23','team':{'id':'10','displayName':league+' Away','abbreviation':'AWY'}},
          {'homeAway':'home','score':'28','team':{'id':'20','displayName':league+' Home','abbreviation':'HME'}}]}]}

async def run(width):
    phases={'wnba':'in','nhl':'pre'}
    delays={'wnba':0.0,'nhl':0.0}
    calls={'wnba':0,'nhl':0}
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=await browser.new_context(viewport={'width':width,'height':900},timezone_id='America/Denver')
        hidden=['nba','mlb','nwsl','mls','nfl','cfb','atp','wta']
        settings=json.dumps({'order':['wnba','nba','mlb','nwsl','mls','nhl','nfl','cfb','atp','wta'],'hidden':hidden,'collapsed':['wnba'],'orderRevision':30})

        page=await context.new_page()
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        async def route(r):
            url=r.request.url
            league='wnba' if '/basketball/wnba/scoreboard?' in url else 'nhl' if '/hockey/nhl/scoreboard?' in url else ''
            if league:
                calls[league]+=1
                state=phases[league]
                await asyncio.sleep(delays[league])
                data={'events':[fixture('1301' if league=='wnba' else '2301',league.upper(),state)]}
            else:data={'events':[]}
            await r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(data))
        await context.route('https://site.api.espn.com/**',route)
        await context.route('https://sports.core.api.espn.com/**',route)
        await context.route('https://a.espncdn.com/**',lambda r:r.fulfill(status=404,body=''))
        await page.evaluate("(settings)=>{const store={'scoreboard-layout-v1':JSON.stringify(settings)};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}}})}",json.loads(settings))
        await page.set_content(HTML.read_text(),wait_until='load')
        await page.wait_for_function("document.querySelector('#live-count').textContent==='1'",timeout=15000)
        assert await page.locator('[data-league="wnba"] .league-content').get_attribute('hidden') is not None
        await page.locator('#live-filter-main').click()
        assert await page.locator('#live-filter-main').get_attribute('aria-pressed')=='true'
        assert await page.locator('[data-league="wnba"] .score-card').count()==1,'live card must not be hidden by collapsed group'
        assert await page.locator('[data-league="wnba"] .league-content').get_attribute('hidden') is None
        assert await page.locator('[data-league="nhl"] .score-card').count()==0
        await page.locator('#live-filter-main').click()
        assert await page.locator('[data-league="wnba"] .league-content').get_attribute('hidden') is not None
        # WNBA finishes as hockey starts; a page reload must not be needed.
        phases.update(wnba='post',nhl='in')
        delays.update(wnba=2.0,nhl=0.02)
        before=calls['nhl']
        await page.locator('#refresh').click()
        try:
            await page.wait_for_function("document.querySelector('[data-league=\"nhl\"] .live-label')",timeout=4000)
        except Exception:
            print('DEBUG',width,'counts',calls,'DOM',await page.evaluate("({live:document.querySelector('#live-count').textContent,nhl:document.querySelector('[data-league=\"nhl\"]')?.innerText,refresh:document.querySelector('#refresh-status').textContent})"),'errors',errors)
            raise
        assert calls['nhl']>before,'Fast NHL updates must apply before delayed WNBA finishes'
        # A second click is accepted during the in-flight request.
        assert await page.locator('#refresh').is_enabled()
        await page.locator('#refresh').click()  # queues exactly one follow-up for the slow league
        # Let the slow request finish and ensure the finished WNBA is gone from live-only.
        await page.locator('[data-collapse-league="wnba"]').click()
        await page.wait_for_function("document.querySelector('[data-league=\"wnba\"] .game-status')?.textContent.includes('Final')",timeout=12000)
        await page.locator('#live-filter-main').click()
        assert await page.locator('[data-league="nhl"] .score-card').count()==1
        assert await page.locator('[data-league="wnba"] .score-card').count()==0
        assert await page.locator('#live-count').text_content()=='1'
        await page.wait_for_function('() => !document.querySelector("#refresh-icon").classList.contains("spin")',timeout=15000)
        await asyncio.sleep(0.35)
        assert calls['wnba']<=12 and calls['nhl']<=12, ('refresh storm',calls)
        await page.locator('#live-filter-main').click()
        assert await page.locator('[data-league="wnba"] .score-card').count()==1
        assert not errors,errors
        await browser.close()

if __name__=='__main__':
    asyncio.run(run(1280));asyncio.run(run(390))
    print('0_33 passes desktop/mobile collapsed live view, independent updates, transitions')
