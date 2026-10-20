"""Compare a native-size vector render with the owner's supplied raster."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

root=Path(__file__).resolve().parent.parent
load=lambda name: np.asarray(Image.open(root/'docs/branding'/name).convert('RGB'),dtype=float)
original=load('FocusRecall-approved-detail.png')
rendered=load('FocusRecall-traced-native.png')
assert original.shape == rendered.shape
def masks(p):
    return [(253-p[:,:,0])/233>.5,(p[:,:,0]-p[:,:,2]-6)/150>.5]
rows=[]
for name,a,b in zip(['Ink F/R outline','Amber page'],masks(original),masks(rendered)):
    edge_a=a^ndimage.binary_erosion(a); edge_b=b^ndimage.binary_erosion(b)
    overlap=float(np.sum(a&b)/np.sum(a|b))
    distance=float(max(ndimage.distance_transform_edt(~edge_a)[edge_b].max(),ndimage.distance_transform_edt(~edge_b)[edge_a].max()))
    assert overlap>.995 and distance<=1.5, (name,overlap,distance)
    rows.append({'part':name,'intersectionOverUnion':overlap,'maxBoundaryDistanceInSourcePixels':distance})
result={'sourceDimensions':[original.shape[1],original.shape[0]],'uniformScalingOnly':True,
        'comparison':'Raster edge sampling, not a claim of recovering the unavailable original vector. Flat approved brand fills replace source texture.','results':rows}
(root/'docs/branding/trace-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
