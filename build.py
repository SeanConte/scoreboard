#!/usr/bin/env python3
"""Build index.html as a single offline-viewable file (live scores still need internet)."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
template=(ROOT/'src/template.html').read_text()
css=(ROOT/'src/styles.css').read_text()
js=''.join((ROOT/'src'/name).read_text() for name in ('core.js','progression.js','ui.js'))
assert template.count('__SB_INLINE_CSS__')==1
assert template.count('__SB_INLINE_JS__')==1
html=template.replace('__SB_INLINE_CSS__',css).replace('__SB_INLINE_JS__',js)
html=html.replace('__SB_TEAM_JS__',(ROOT/'src/team.js').read_text().replace('__SB_TEAM_STATS_JS__',(ROOT/'src/team-stats.js').read_text()))
(ROOT/'index.html').write_text(html)
print('Built index.html ('+str(len(html))+' characters)')
