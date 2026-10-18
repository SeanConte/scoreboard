from pathlib import Path
import json
from playwright.sync_api import sync_playwright
s=(Path(__file__).resolve().parents[1]/'index.html').read_text()
assert s.rfind('})();')>0
s=s[:s.rfind('})();')]+'''window.__sbTest={officialMetricTotal,metricHistory,cachedMetricHistory,availableGraphMetrics,selectedChartSeries,summaryTTL,summaryFinal,basketballEvent,eventSamples,loadExpanded,getSummary,preferences};
'''+s[s.rfind('})();'):]


def game(state):
 return dict(id='wnba-1',eventId='1',league='wnba',state=state,postseason=True,sides=[{'id':'1','short':'ATL','name':'Atlanta'}, {'id':'2','short':'GSV','name':'Golden State'}],tennis=False)

def plays():
 raw=[];eid=0
 def add(period,clock,team,ty,text,scoring=False):
  nonlocal eid
  eid+=1;raw.append({'id':str(eid),'period':{'number':period},'clock':{'displayValue':clock},'team':{'id':str(team)},'type':{'text':ty},'text':text,'scoringPlay':scoring,'shootingPlay':ty in ('3pt shot','2pt shot')})
 for p in range(1,5):
  add(p,'8:59',1,'3pt shot','A makes 3-pt jumper',True)
  add(p,'8:10',2,'3pt shot','B misses 3-pt jumper')
  add(p,'7:50',1,'2pt shot','A makes layup',True)
  add(p,'6:59',2,'2pt shot','B misses layup')
  add(p,'6:30',1,'Free Throw','A makes free throw',True)
  add(p,'6:05',2,'Free Throw','B misses free throw')
  add(p,'5:30',1,'Rebound','A defensive rebound')
  add(p,'5:20',2,'Turnover','B turnover')
 return raw

def data(post=False):
 s=[dict(name='fieldGoalsMade-fieldGoalsAttempted',displayValue=v) for v in ['8-8','0-8']]
 def mk(fg,thr,ft,reb,tov):
  return [dict(name='fieldGoalsMade-fieldGoalsAttempted',displayValue=fg),dict(name='threePointFieldGoalsMade-threePointFieldGoalsAttempted',displayValue=thr),dict(name='freeThrowsMade-freeThrowsAttempted',displayValue=ft),dict(name='totalRebounds',displayValue=reb),dict(name='turnovers',displayValue=tov)]
 return {'header':{'competitions':[{'status':{'type':{'state':'post' if post else 'in','completed':post}},'competitors':[{'team':{'id':'1','abbreviation':'ATL'},'homeAway':'away'}, {'team':{'id':'2','abbreviation':'GSV'},'homeAway':'home'}]}]}, 'boxscore':{'teams':[{'team':{'id':'1','abbreviation':'ATL'},'statistics':mk('8-8','4-4','4-4','4','0')},{'team':{'id':'2','abbreviation':'GSV'},'statistics':mk('0-8','0-4','0-4','0','4')}]},'plays':plays()}

with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1280,'height':850})
 errors=[];p.on('pageerror',lambda x:errors.append(str(x)))
 p.route('https://site.api.espn.com/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"events":[]}'))
 p.goto('about:blank');p.set_content(s, wait_until='load')
 payload={'live':game('in'),'post':game('post'),'during':data(),'final':data(True)}
 result=p.evaluate('''v=>{
 let T=window.__sbTest;
 let fields=['fgMade','fgAttempted','ftMade','ftAttempted','threesMade','threesAttempted','rebounds','turnovers'];
 let expected=Object.fromEntries(fields.map(k=>[k,[T.officialMetricTotal(v.post,v.final,0,k),T.officialMetricTotal(v.post,v.final,1,k)]]));
 let live=fields.map(k=>[k,Boolean(T.cachedMetricHistory(v.live,v.during,k))]);
 let final=fields.map(k=>[k,Boolean(T.cachedMetricHistory(v.post,v.final,k))]);
 let sameDataLive=fields.map(k=>[k,Boolean(T.cachedMetricHistory(v.live,v.final,k))]);
 let sameDataFinal=fields.map(k=>[k,Boolean(T.cachedMetricHistory(v.post,v.final,k))]);
 return {expected,live,final,sameDataLive,sameDataFinal,liveOptions:T.availableGraphMetrics(v.live,v.during),postOptions:T.availableGraphMetrics(v.post,v.final),complete:T.summaryFinal(v.final),incomplete:T.summaryFinal(v.during),ttl:[T.summaryTTL(v.post,{sourceFinal:false}),T.summaryTTL(v.post,{sourceFinal:true})]};
}''',payload)
 print(json.dumps(result,indent=2))
 # A wrong official final total must reject that particular metric, not all metrics.
 mismatch=p.evaluate('''v=>{const t=window.__sbTest;const bad=structuredClone(v.final);bad.boxscore.teams[0].statistics.find(r=>r.name==='freeThrowsMade-freeThrowsAttempted').displayValue='99-99';return {invalid:t.availableGraphMetrics(v.post,bad).map(x=>x[0]),valid:t.availableGraphMetrics(v.post,v.final).map(x=>x[0])};}''',payload)
 print('Mismatch safety:',mismatch)
 assert 'ftMade' not in mismatch['invalid'] and 'ftAttempted' not in mismatch['invalid'] and 'fgMade' in mismatch['invalid'] and 'ftMade' in mismatch['valid']
 # Separate single-value ESPN schemas should also be read correctly.
 split=p.evaluate('''v=>{const t=window.__sbTest;let d=structuredClone(v.final);d.boxscore.teams[0].statistics=[{name:'fieldGoalsMade',displayValue:'8'},{name:'fieldGoalsAttempted',displayValue:'8'},{name:'freeThrowsMade',displayValue:'4'},{name:'freeThrowsAttempted',displayValue:'4'},{name:'threePointFieldGoalsMade',displayValue:'4'},{name:'threePointFieldGoalsAttempted',displayValue:'4'}];return ['fgMade','fgAttempted','ftMade','ftAttempted','threesMade','threesAttempted'].map(k=>t.officialMetricTotal(v.post,d,0,k));}''',payload)
 print('Split values:',split)
 assert split==[8,8,4,4,4,4]
 print('browser errors:',errors)
 assert not errors
 assert set(k for k,ok in result['final'] if ok)>={'threesMade','threesAttempted','fgMade','fgAttempted','ftMade','ftAttempted','rebounds','turnovers'}
 assert result['ttl']==[20000,3600000]
 b.close()
