"""Create a known-effect or null history in a NEW marked QA copy only."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import sqlite3, sys, json, random
root = Path(sys.argv[1]).resolve()
allowed = (Path.cwd() / 'out/qa-temp').resolve()
assert root.is_relative_to(allowed) and root != allowed
assert (root / 'QA-FICTIONAL.txt').read_text().strip() == 'FocusRecall fictional profile only'
assert not (root / 'STATISTICAL-FIXTURE.txt').exists()
scenario = sys.argv[2]
assert scenario in ('known', 'null')
c = sqlite3.connect(root / 'learnalyt-demo.db')
c.execute('PRAGMA foreign_keys=ON')
item = c.execute('SELECT id FROM items ORDER BY id LIMIT 1').fetchone()[0]
fields = dict(c.execute('SELECT key,id FROM log_fields'))
rng = random.Random(91735)
with c:
    c.execute('DELETE FROM blocks')
    c.execute('DELETE FROM sessions')
    c.execute('DELETE FROM sittings')
    c.execute('DELETE FROM day_log_values')
    for i in range(180):
        start = datetime(2026, 4, 20, 12, tzinfo=timezone.utc) + timedelta(days=i)
        end = start + timedelta(minutes=25)
        a, b = (x.isoformat().replace('+00:00', 'Z') for x in (start, end))
        c.execute('INSERT INTO sittings(id,started_at,ended_at) VALUES(?,?,?)', (i+1,a,b))
        c.execute('INSERT INTO sessions(id,sitting_id,started_at,ended_at,longest_stretch_seconds) VALUES(?,?,?,?,1500)', (i+1,i+1,a,b))
        c.execute("INSERT INTO blocks(id,sitting_id,item_id,ended_by,log_status,timer_mode,target_seconds,focus_started_at,focus_ended_at,focus_seconds,session_id) VALUES(?,?,?,'finish','done','flow',1500,?,?,1500,?)", (i+1,i+1,item,a,b,i+1))
        rating = 3 if scenario == 'null' else (4 if i%2 == 0 else 1) + rng.randrange(2)
        for key, value in [('activity','problems'),('focus',rating),('place','library' if i%2 == 0 else 'desk-at-home')]:
            c.execute('INSERT INTO block_log_values(block_id,field_id,value,touched) VALUES(?,?,?,1)', (i+1,fields[key],json.dumps(value)))
    assert c.execute('PRAGMA foreign_key_check').fetchone() is None
c.close()
(root / 'STATISTICAL-FIXTURE.txt').write_text(json.dumps({'scenario':scenario,'sessions':180,'fictional':True}))
print(scenario, '180 fictional sessions')
