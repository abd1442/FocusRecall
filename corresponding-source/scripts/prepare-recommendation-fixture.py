"""Extend the guarded NEW statistical QA fixture; never accept a personal profile."""
from pathlib import Path
import subprocess, sys, sqlite3, json
root = Path(sys.argv[1]).resolve()
allowed = (Path.cwd() / 'out/qa-temp').resolve()
assert root.is_relative_to(allowed) and root != allowed
assert (root / 'QA-FICTIONAL.txt').read_text().strip() == 'FocusRecall fictional profile only'
subprocess.check_call([sys.executable, 'scripts/prepare-statistical-fixture.py', str(root), 'known'])
c = sqlite3.connect(root / 'learnalyt-demo.db')
with c:
    fields = dict(c.execute('SELECT key,id FROM log_fields'))
    for block, place in c.execute('SELECT block_id,value FROM block_log_values WHERE field_id=?', (fields['place'],)).fetchall():
        method = 're-reading' if json.loads(place) == 'library' else 'self-testing'
        c.execute('INSERT OR REPLACE INTO block_log_values(block_id,field_id,value,touched) VALUES(?,?,?,1)', (block,fields['methods'],json.dumps([method])))
    c.execute('UPDATE blocks SET recall_rating=(SELECT value FROM block_log_values WHERE block_id=blocks.id AND field_id=?),recall_rating_touched=1', (fields['focus'],))
    assert c.execute('PRAGMA foreign_key_check').fetchone() is None
c.close()
(root / 'RECOMMENDATION-FIXTURE.txt').write_text('Fictional fluency-inflated method ratings; no assessed learning outcomes.')
