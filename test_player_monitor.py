"""Player box scores and player-over-time visualization use attributed ESPN-like plays."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright
import json

HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
WHEN=datetime.now(ZoneInfo('America/Denver')).replace(hour=13,minute=0,second=0,microsecond=0).isoformat()

def scoreboard():
    return {'events':[{'id':'424242','date':WHEN,'name':'Away Team at Home Team','season':{'type':2},'competitions':[{
        'id':'424242','date':WHEN,'status':{'type':{'state':'in','shortDetail':'Q3 8:23','description':'In Progress'},'period':3,'displayClock':'8:23'},
        'competitors':[{'homeAway':'away','score':'22','team':{'id':'1','displayName':'Away Team','abbreviation':'AWY'},'linescores':[{'value':18},{'value':4},{'value':0}]},
                       {'homeAway':'home','score':'24','team':{'id':'2','displayName':'Home Team','abbreviation':'HME'},'linescores':[{'value':20},{'value':4},{'value':0}]}]}]}]}

def summary():
    plays=[];a=b=0
    for i in range(20):
        side=i%2;name='Alpha Guard' if side==0 else 'Beta Forward';id='101' if side==0 else '202';
        if side==0:a+=2
        else:b+=2
        plays.append({'id':str(100+i),'scoringPlay':True,'scoreValue':2,'shootingPlay':True,'pointsAttempted':2,
                      'text':f'{name} makes two point layup', 'type':{'text':'Layup'},
                      'period':{'number':1},'clock':{'displayValue':f'{11-i//2:02d}:{50 if side==0 else 30:02d}'},
                      'team':{'id':str(side+1)},'participants':[{'athlete':{'id':id,'displayName':name}}],
                      'awayScore':a,'homeScore':b})
    categories=[]
    for team,name,id in [('AWY','Alpha Guard','101'),('HME','Beta Forward','202')]:
        teammates=[{'athlete':{'id':id,'displayName':name},'starter':True,'stats':['32','5','20']},
                   {'athlete':{'id':'303' if team=='AWY' else '404','displayName':'Bench Player'},'stats':['16','3','9']},
                   {'athlete':{'id':'405' if team=='AWY' else '406','displayName':'Not Played'},'didNotPlay':True,'stats':[]}]
        categories.append({'team':{'id': '1' if team=='AWY' else '2','abbreviation':team},'statistics':[{'name':'Statistics','labels':['MIN','REB','PTS'],'athletes':teammates}]})
    return {'plays':plays,'header':{'competitions':[{'status':{'type':{'state':'in'}},'competitors':[{'homeAway':'away','team':{'id':'1','abbreviation':'AWY'}},{'homeAway':'home','team':{'id':'2','abbreviation':'HME'}}]}]},
            'boxscore':{'players':categories,'teams':[{'team':{'id':'1','abbreviation':'AWY'},'statistics':[{'name':'assists','label':'Assists','displayValue':'12'},{'name':'rebounds','label':'Rebounds','displayValue':'20'}]},
                                      {'team':{'id':'2','abbreviation':'HME'},'statistics':[{'name':'assists','label':'Assists','displayValue':'9'},{'name':'rebounds','label':'Rebounds','displayValue':'23'}]}]}}

def run(width,height):
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=(width==390),timezone_id='America/Denver',reduced_motion='reduce')
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        def route(r):
            body=summary() if '/summary?' in r.request.url else scoreboard() if '/basketball/nba/scoreboard?' in r.request.url else {'events':[]}
            r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
        page.route('https://site.api.espn.com/**',route)
        page.goto('about:blank');page.set_content(HTML,wait_until='load')
        card=page.locator('.league-section[data-league="nba"] .score-card').first;card.wait_for(timeout=15000)
        card.locator('[data-expand]').click();page.locator('[data-monitor-open]').first.click()
        dialog=page.locator('#game-monitor');picker=dialog.locator('[data-monitor-player]')
        picker.wait_for(timeout=15000)
        assert picker.locator('option').count()==3,picker.locator('option').all_text_contents()
        picker.select_option('101');assert dialog.locator('.player-score-point').count()==10,dialog.locator('.player-score-point').count()
        assert 'Alpha Guard' in picker.locator('option:checked').inner_text()
        assert dialog.locator('.monitor-player-summary').count()==0
        assert dialog.locator('.monitor-overview').count()==1
        assert not dialog.evaluate('(e)=>e.scrollWidth>e.clientWidth+4'),('monitor should not overflow horizontally',dialog.evaluate('(e)=>[e.scrollWidth,e.clientWidth]'))
        dialog.locator('[data-monitor-view="box"]').click()
        assert dialog.locator('.box-player-table').count()==3
        assert dialog.get_by_text('Bench Player').count()==2
        assert dialog.get_by_text('Not Played').count()==2
        table=dialog.locator('.monitor-team-box:not(.monitor-full-team-stats) .box-player-table').first
        assert table.locator('tbody tr').count()==3
        table.locator('[data-box-column="2"]').click()
        assert table.locator('tbody tr').count()==3
        dialog.locator('[data-monitor-view="overview"]').click()
        assert dialog.locator('[data-monitor-player]').input_value()=='101'
        assert dialog.locator('.player-score-point').count()==10
        # The event inspector snaps to a verified play, showing the running
        # score and the actual play description instead of quarter-only totals.
        svg=dialog.locator('.monitor-interactive-chart')
        pos=svg.bounding_box()
        point_x=(46+(1/6)/48*616)/680
        page.mouse.move(pos['x']+point_x*pos['width'],pos['y']+pos['height']*.52)
        event_text=dialog.locator('[data-chart-tooltip]').inner_text()
        assert 'Alpha Guard makes two point layup' in event_text,event_text
        assert 'AWY' in event_text and 'HME' in event_text,event_text
        page.mouse.click(pos['x']+point_x*pos['width'],pos['y']+pos['height']*.52)
        assert svg.get_attribute('data-chart-pinned')=='true'
        assert dialog.locator('.monitor-player-periods').count()==0
        if width==390:
            page.touchscreen.tap(pos['x']+point_x*pos['width'],pos['y']+pos['height']*.52)
            assert svg.get_attribute('data-chart-pinned')=='true'
        if width==1280:page.screenshot(path='/mnt/data/scoreboard24_overview.png')
        if width==390:page.screenshot(path='/mnt/data/scoreboard24_mobile.png')
        assert not errors,errors
        browser.close();print('PLAYER MONITOR PASS',width,height)

run(1280,900)
run(390,844)
