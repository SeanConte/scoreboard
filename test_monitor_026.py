"""0.26: linked player cards/dropdown, extended visual comparisons, larger player portraits."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ns={'__file__':str(Path(__file__).with_name('test_player_monitor.py'))}
src=Path(__file__).with_name('test_player_monitor.py').read_text().split('def run(width,height):')[0]
exec(src,ns)
HTML=ns['HTML'];scoreboard=ns['scoreboard'];summary=ns['summary']

def fixture():
  s=summary()
  for idx,team in enumerate(s['boxscore']['teams']):
    team['statistics'].extend([{'name':f'extra{j}', 'label':f'Extra measure {j}', 'displayValue':str(30+j+idx)} for j in range(9)])
    team['statistics'].append({'name':'composite', 'label':'Made/attempts', 'displayValue':'8-13' if idx==0 else '9-21'})
  for p in s['boxscore']['players']:
    for athlete in p['statistics'][0]['athletes'][:2]:
      athlete['athlete']['headshot']={'href':'https://a.espncdn.com/i/headshots/nba/players/full/101.png'}
  return s

def run(width,height):
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=width==390,reduced_motion='reduce')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://site.api.espn.com/**',lambda r:r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(fixture() if '/summary?' in r.request.url else scoreboard() if '/basketball/nba/scoreboard?' in r.request.url else {'events':[]})))
  page.set_content(HTML,wait_until='load')
  card=page.locator('.league-section[data-league="nba"] .score-card').first
  card.wait_for(timeout=15000);card.locator('[data-expand]').click()
  regularStats=card.locator('.stats-panel .stat-match');assert regularStats.count()==5,regularStats.count()
  regularBars=card.locator('.stats-panel .stat-match-bars');assert regularBars.count()==5
  page.locator('[data-monitor-open]').first.click()
  dialog=page.locator('#game-monitor');picker=dialog.locator('[data-monitor-player]');picker.wait_for()
  assert picker.input_value()==''
  stats=dialog.locator('.monitor-stats-area .stats-panel .stat-match')
  assert stats.count()>regularStats.count(),stats.count()
  assert stats.count()>=12
  bars=dialog.locator('.monitor-stats-area .stats-panel .stat-match-bars')
  assert bars.count()>=11,bars.count()
  assert dialog.locator('.stats-panel').get_by_text('Made/attempts').count()==1
  # Non-numeric box-score value is preserved without a deceptive comparison bar.
  assert dialog.locator('.stats-panel .stat-match').filter(has_text='Made/attempts').locator('.stat-match-bars').count()==0
  first=dialog.locator('.performer-button[data-player-id="101"]');first.wait_for()
  assert first.get_attribute('aria-pressed')=='false'
  first.click();assert picker.input_value()=='101'
  assert dialog.locator('.performer-button[data-player-id="101"]').get_attribute('aria-pressed')=='true'
  assert dialog.locator('.player-score-point').count()==10
  picker.select_option('202')
  assert dialog.locator('.performer-button[data-player-id="202"]').get_attribute('aria-pressed')=='true'
  assert dialog.locator('.performer-button[data-player-id="101"]').get_attribute('aria-pressed')=='false'
  dialog.locator('.performer-button[data-player-id="202"]').click()
  assert picker.input_value()==''
  assert dialog.locator('.player-score-point').count()==0
  image=dialog.locator('.performer-avatar').first
  assert image.evaluate('e=>e.getBoundingClientRect().width')>=37
  dialog.locator('.monitor-stats-area').screenshot(path=f'/mnt/data/scoreboard0_26_stats_{width}.png')
  assert not dialog.evaluate('e=>e.scrollWidth>e.clientWidth+5'),(width,dialog.evaluate('e=>[e.scrollWidth,e.clientWidth]'))
  assert not errors,errors
  print('PASS 0.26',width, 'extra metrics',stats.count(),'bars',bars.count(),'athlete size',image.evaluate('e=>e.getBoundingClientRect().width'))
  browser.close()
run(1280,900)
run(390,844)
