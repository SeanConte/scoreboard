import subprocess,concurrent.futures,time
from pathlib import Path
paths=sorted(Path('tests').glob('test_*.py'))
def run(p):
 try:
  r=subprocess.run(['python',str(p)],capture_output=True,text=True,timeout=90)
  return p.name,r.returncode,(r.stdout+r.stderr)[-3000:]
 except subprocess.TimeoutExpired as e:return p.name,124,'TIMEOUT'
start=time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for future in concurrent.futures.as_completed([pool.submit(run,p) for p in paths]):
  name,rc,out=future.result()
  print(('PASS' if rc==0 else 'FAIL')+' '+name+' '+(out.splitlines()[-1] if out.splitlines() else ''),flush=True)
  if rc:Path('/mnt/data/scoreboard_0_31_'+name+'.log').write_text(out)
print('Completed',len(paths),'in',round(time.time()-start,1),'seconds',flush=True)
