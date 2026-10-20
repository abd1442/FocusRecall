"""Trace the owner's raster contours without redrawing or changing proportions.

One-off authoring utility; numpy/scipy/Pillow are not application dependencies.
The original reference remains alongside the output for comparison.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage, interpolate

root = Path(__file__).resolve().parent.parent
reference = root / 'docs/branding/FocusRecall-approved-detail.png'
rgb = np.asarray(Image.open(reference).convert('RGB'), dtype=float)
ink = np.clip((253 - rgb[:, :, 0]) / 233, 0, 1)
amber = np.clip((rgb[:, :, 0] - rgb[:, :, 2] - 6) / 150, 0, 1)

def contour(field):
    a = np.pad(field, 1)
    level = .500123  # Avoid a contour passing exactly through quantized pixels.
    segments = []
    for y in range(a.shape[0] - 1):
        for x in range(a.shape[1] - 1):
            values = [a[y,x], a[y,x+1], a[y+1,x+1], a[y+1,x]]
            vertices = [(x-1,y-1),(x,y-1),(x,y),(x-1,y)]
            cuts = []
            for i in range(4):
                j = (i+1) % 4
                if (values[i] >= level) != (values[j] >= level):
                    t = (level-values[i])/(values[j]-values[i])
                    cuts.append(tuple(round(vertices[i][k] + t*(vertices[j][k]-vertices[i][k]), 6) for k in range(2)))
            if len(cuts) == 2:
                segments.append(cuts)
            elif cuts:
                raise ValueError('Ambiguous contour; inspect reference')
    links = {}
    for p, q in segments:
        links.setdefault(p, []).append(q)
        links.setdefault(q, []).append(p)
    assert all(len(set(v))==2 for v in links.values()), 'Degenerate contour junction'
    remaining, loops = set(links), []
    while remaining:
        start = min(remaining)
        points, previous, current = [], None, start
        while True:
            assert len(points)<=len(links), 'Contour did not close'
            points.append(current); remaining.discard(current)
            nxt = next(p for p in links[current] if p != previous)
            previous, current = current, nxt
            if current == start:
                break
        loops.append(np.array(points))
    loops.sort(key=len,reverse=True)
    assert all(len(p)<12 for p in loops[1:]), 'Unexpected large secondary contour'
    return loops[0]

def trace(field, index):
    print('Tracing component',index,flush=True)
    labels, _ = ndimage.label(field >= .5)
    areas = np.bincount(labels.ravel()); areas[0] = 0
    ids = sorted(range(1,len(areas)), key=lambda n: areas[n], reverse=True)
    label = ids[index]
    component = ndimage.binary_dilation(labels == label, iterations=2)
    points = contour(np.where(component, field, 0))
    print('Fitting',len(points),'edge samples',flush=True)
    # Fit the sampled antialiased edge, with a total squared residual of just
    # 1 pixel across the whole perimeter. Geometry is never stretched.
    tck, _ = interpolate.splprep(points.T, s=1.0, per=True)
    knots = sorted(set(float(t) for t in tck[0] if 0 <= t <= 1))
    fmt = lambda p: ' '.join(f'{v:.4f}'.rstrip('0').rstrip('.') for v in p)
    path = 'M' + fmt(interpolate.splev(knots[0],tck))
    for lo, hi in zip(knots, knots[1:]):
        p0=np.array(interpolate.splev(lo,tck)); p3=np.array(interpolate.splev(hi,tck))
        d0=np.array(interpolate.splev(lo,tck,der=1)); d1=np.array(interpolate.splev(hi,tck,der=1))
        path += 'C' + ' '.join(fmt(p) for p in [p0+d0*(hi-lo)/3,p3-d1*(hi-lo)/3,p3])
    return path+'Z'

# Largest ink component is the F; the disconnected right-hand component is R.
result={'source':'docs/branding/FocusRecall-approved-detail.png',
        'width':rgb.shape[1], 'height':rgb.shape[0],
        'spine':trace(ink,0), 'recall':trace(ink,1), 'page':trace(amber,0)}
(root/'resources/focusrecall-traced-paths.json').write_text(json.dumps(result,indent=2)+'\n')
print('Traced original reference at its native dimensions:',result['width'],result['height'])
