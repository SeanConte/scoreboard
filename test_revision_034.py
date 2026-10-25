"""0_34 missing-CFB-game regression: Ole Miss @ Texas, rank/SEC rescue, partial FBS feeds."""
from pathlib import Path
import asyncio, json
from playwright.async_api import async_playwright

HTML=Path(__file__).resolve().parents[1]/'index.html'
KICKOFF='2026-10-24T23:30:00Z'  # 5:30 p.m. Mountain; Saturday Oct 24

def game(eid,away,home,aid,hid,state='pre'):
    c={'id':str(eid),'date':KICKOFF,'status':{'type':{'state':state,'shortDetail':'Q1 10:15' if state=='in' else '7:30 PM'}},
       'competitors':[{'homeAway':'away','score':'7' if state=='in' else '0', 'team':{'id':str(aid),'displayName':away,'abbreviation':'MISS' if 'Ole' in away else 'OHIO'}},
         {'homeAway':'home','score':'3' if state=='in' else '0','team':{'id':str(hid),'displayName':home,'abbreviation':'TEX' if 'Texas' in home else 'IU'}}]}
    # away/home are team names but the homeAway keys must be literal home/away
    c['competitors'][0]['homeAway']='away';c['competitors'][1]['homeAway']='home'
    return {'id':str(eid),'date':KICKOFF,'name':f'{away} at {home}','season':{'type':2,'year':2026},'competitions':[c]}

async def check(width,ranked=False,fbs_failure=False):
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=await browser.new_context(viewport={'width':width,'height':900},timezone_id='America/Denver')
        page=await context.new_page()
        errors=[];calls=[];phase={'state':'in' if fbs_failure else 'pre'}
        page.on('pageerror',lambda e:errors.append(str(e)))
        async def route(r):
            u=r.request.url;calls.append(u)
            status=200
            if '/standings?' in u:
                await asyncio.sleep(2)
                data={'children':[{'standings':{'entries':[{'team':{'id':str(i)}} for i in range(100,231)]}}]}
            elif 'football/college-football/scoreboard?' in u:
                if 'groups=80' in u:
                    if fbs_failure:
                        status=503;data={'message':'temporary feed failure'}
                    else:data={'events':[game('9001','Ohio State','Indiana',194,84)]}
                elif 'groups=81' in u:
                    await asyncio.sleep(2)
                    data={'events':[]}
                elif 'groups=8' in u or (ranked and 'groups=' not in u):
                    data={'events':[game('9002','Ole Miss Rebels','Texas Longhorns',145,251,phase['state'])]}
                else:data={'events':[]}
            else:data={'events':[]}
            await r.fulfill(status=status,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(data))
        await context.route('https://site.api.espn.com/**',route)
        await context.route('https://sports.core.api.espn.com/**',route)
        await context.route('https://a.espncdn.com/**',lambda r:r.fulfill(status=404,body=''))
        await page.goto('about:blank')
        await page.set_content(HTML.read_text(),wait_until='load')
        await page.locator('#date').fill('2026-10-24')
        await page.locator('#date').dispatch_event('change')
        await page.locator('[data-sport="sport:football"]').click()
        await page.locator('[data-sport="cfb"]').click()
        await page.get_by_text('Ole Miss Rebels',exact=False).first.wait_for(timeout=18000)
        cards=await page.locator('[data-league="cfb"] .score-card').all_text_contents()
        assert sum('Ole Miss' in x and 'Texas' in x for x in cards)==1, cards
        assert any('groups=8' in u for u in calls),'SEC fallback should have been requested'
        if not fbs_failure:assert any('Ohio State' in x for x in cards),cards
        if ranked:assert any('scoreboard?' in u and 'groups=' not in u for u in calls)
        if not fbs_failure:
            phase['state']='in'
            await page.locator('#refresh').click()
        await page.wait_for_function('''() => {
          const item=[...document.querySelectorAll('[data-league="cfb"] .score-card')].find(x=>x.textContent.includes('Ole Miss'));
          return item && item.classList.contains('live-card');
        }''',timeout=15000)
        await page.locator('#live-filter-main').click()
        text=await page.locator('[data-league="cfb"] .score-card').all_text_contents()
        assert len(text)==1 and 'Ole Miss' in text[0],text
        assert await page.locator('body').evaluate('(el)=>el.scrollWidth<=innerWidth+2'),width
        assert not errors,errors
        await browser.close()
        print(f'0_34 passed {width}px, ranked={ranked} fbs_failure={fbs_failure}, requests={len(calls)}')

if __name__=='__main__':
    asyncio.run(check(390,ranked=False,fbs_failure=False))
    asyncio.run(check(1280,ranked=True,fbs_failure=False))
    asyncio.run(check(390,ranked=False,fbs_failure=True))
