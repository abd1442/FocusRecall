"""Trim a NEW, marked QA copy before Electron opens it. Never accepts user paths."""
from pathlib import Path
import json, sqlite3, sys
from datetime import datetime, timedelta, timezone
root=Path(sys.argv[1]).resolve()
allowed=(Path.cwd()/'out/qa-temp').resolve()
assert root.is_relative_to(allowed) and root!=allowed
assert (root/'QA-FICTIONAL.txt').read_text().strip()=='FocusRecall fictional profile only'
assert not (root/'VISUAL-FIXTURE.txt').exists()
count=int(sys.argv[2]); assert count in (0,4,40,400)
db=sqlite3.connect(root/'learnalyt-demo.db')
db.execute('PRAGMA foreign_keys=ON')
with db:
    ids=[r[0] for r in db.execute('SELECT s.id FROM sessions s JOIN blocks b ON b.session_id=s.id GROUP BY s.id HAVING SUM(b.focus_seconds)>600 ORDER BY s.started_at DESC LIMIT ?', (count,))]
    if ids:
        placeholders=','.join('?' for _ in ids)
        db.execute(f'DELETE FROM blocks WHERE session_id IS NULL OR session_id NOT IN ({placeholders})',ids)
        db.execute(f'DELETE FROM sessions WHERE id NOT IN ({placeholders})',ids)
    else:
        # NOT IN (NULL) would retain every row; zero must be genuinely empty.
        db.execute('DELETE FROM blocks')
        db.execute('DELETE FROM sessions')
    if count==4:
        for i,id in enumerate(ids):
            start=datetime(2026,10,14+i//2,12+2*(i%2),tzinfo=timezone.utc)
            blockids=[r[0] for r in db.execute('SELECT id FROM blocks WHERE session_id=? ORDER BY id',(id,))]
            for j,blockid in enumerate(blockids):
                a=start+timedelta(minutes=25*j);b=a+timedelta(minutes=25)
                db.execute('UPDATE blocks SET focus_started_at=?,focus_ended_at=?,focus_seconds=1500 WHERE id=?',(a.isoformat().replace('+00:00','Z'),b.isoformat().replace('+00:00','Z'),blockid))
            db.execute('UPDATE sessions SET started_at=?,ended_at=? WHERE id=?',(start.isoformat().replace('+00:00','Z'),(start+timedelta(minutes=25*len(blockids))).isoformat().replace('+00:00','Z'),id))
    # Keep page startup free of the onboarding overlay in these fictional profiles.
    db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('starterGuideCompleted','true')")
    assert db.execute('PRAGMA foreign_key_check').fetchone() is None
result={'requested':count,'sessions':db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0],'blocks':db.execute('SELECT COUNT(*) FROM blocks').fetchone()[0]}
assert result['sessions']==count if count<400 else result['sessions']>=100
db.close()
(root/'VISUAL-FIXTURE.txt').write_text(json.dumps(result))
print(json.dumps(result))
