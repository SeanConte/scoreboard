"""0.25 layout geometry, opt-in player highlighting, and expanded top performers."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
exec(Path(__file__).with_name('test_player_monitor.py').read_text().split('run(1280,900)')[0].split('def run(width,height):')[0])

def enriched_summary():
  payload=summary()
  for side,group in enumerate(payload['boxscore']['players']):
    athletes=group['statistics'][0]['athletes']
    athletes[0]['athlete']['headshot']={'href':'https://a.espncdn.com/i/headshots/nba/players/full/101.png'}
    athletes.extend({'athlete':{'id':f'{side}9{i}', 'displayName':f'Additional Player {side}-{i}'},'stats':['15','2',str(8-i)]} for i in range(5))
  return payload

def run(width,height):
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':width,'height':height},has_touch=(width==390),timezone_id='America/Denver',reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://site.api.espn.com/**', lambda r:r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(enriched_summary() if '/summary?' in r.request.url else scoreboard() if '/basketball/nba/scoreboard?' in r.request.url else {'events':[]})))
    page.set_content(HTML,wait_until='load')
    card=page.locator('.league-section[data-league="nba"] .score-card').first
    card.wait_for(timeout=15000)
    card.locator('[data-expand]').click()
    page.locator('[data-monitor-open]').first.click()
    dialog=page.locator('#game-monitor')
    picker=dialog.locator('[data-monitor-player]');picker.wait_for(timeout=15000)
    assert picker.input_value()==''
    assert dialog.locator('.player-score-point').count()==0
    assert dialog.locator('.monitor-player-summary').count()==0
    assert dialog.locator('.monitor-player-periods').count()==0
    assert dialog.locator('.monitor-chart-controls select').count()==2
    assert dialog.locator('.monitor-chart-controls').evaluate('el=>{const a=el.querySelectorAll("select");return a[1].getBoundingClientRect().top-a[0].getBoundingClientRect().top}') < 5
    svg=dialog.locator('.monitor-interactive-chart')
    geom=svg.evaluate('el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,ratio:el.getBoundingClientRect().width/el.getBoundingClientRect().height,par:el.getAttribute("preserveAspectRatio")})')
    assert abs(geom['ratio']-(680/264))<.035,geom
    assert geom['par']!='none',geom
    # The player layer is opt-in and can be switched off again.
    picker.select_option('101')
    assert dialog.locator('.monitor-player-avatar').count()==1
    assert dialog.locator('.player-score-point').count()==10
    assert dialog.locator('[data-monitor-player]').input_value()=='101'
    dialog.locator('[data-monitor-player]').select_option('')
    assert dialog.locator('.player-score-point').count()==0
    box=dialog.locator('.monitor-stats-area .performers-panel')
    assert box.count()==1
    # With more than two roster leaders, no CSS rule should hide rows.
    allRows=box.locator('.performer-row');visible=allRows.count()
    assert visible==10,(visible,box.inner_text())
    assert allRows.nth(4).is_visible() and allRows.nth(9).is_visible()
    assert box.locator('.performer-avatar').count()==2
    assert allRows.first.is_visible()
    # Browser layout must not cause horizontal viewport overflow.
    assert not dialog.evaluate('e=>e.scrollWidth>e.clientWidth+3'),(width,dialog.evaluate('e=>[e.scrollWidth,e.clientWidth]'))
    dialog.screenshot(path=f'/mnt/data/scoreboard0_25_{width}.png')
    assert not errors,errors
    print('PASS 0.25',width,height,geom,'performer rows',visible,'scroll height',dialog.evaluate('e=>[e.scrollHeight,e.clientHeight]'))
    browser.close()

run(1280,900)
run(390,844)
