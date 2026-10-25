"""Saved favorites created before labels existed resolve by ESPN team identity."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
HTML=Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 p=browser.new_page(viewport={'width':390,'height':850},timezone_id='America/Denver');errs=[];p.on('pageerror',lambda e:errs.append(str(e)))
 def route(r):
  u=r.request.url
  if '/basketball/nba/teams/7' in u: body={'team':{'id':'7','displayName':'Denver Nuggets','logo':'https://a.espncdn.com/i/teamlogos/nba/500/den.png'}}
  else: body={'events':[]}
  r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(body))
 p.context.route('https://site.api.espn.com/**',route)
 p.context.route('https://sports.core.api.espn.com/**',route)
 p.evaluate('''() => {const memory={'scoreboard-favorites-v1':JSON.stringify({teams:['nba:7'],pins:{}})};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=String(v),removeItem:k=>delete memory[k]}})}''')
 p.set_content(HTML,wait_until='load')
 p.locator('#settings-open').click();p.locator('#settings-tab-favorites').click()
 p.get_by_text('Denver Nuggets').wait_for(timeout=15000)
 assert p.locator('#settings-favorites-count').inner_text()=='1'
 result=p.evaluate('JSON.parse(localStorage.getItem("scoreboard-favorites-v1"))')
 assert result['details']['nba:7']['name']=='Denver Nuggets',result
 assert not errs,errs
 browser.close()
print('old favorite metadata migration passed')
