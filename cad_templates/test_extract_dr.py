import ezdxf
from ezdxf.enums import TextEntityAlignment

doc_dr = ezdxf.readfile('cad_templates/Doubble_rabbit_with_rubber_test.dxf')
msp_dr = doc_dr.modelspace()

hpost_ents = []
lpost_ents = []
header_ents = []

for e in msp_dr:
    t = e.dxftype()
    if t not in ('LINE', 'LWPOLYLINE', 'CIRCLE'):
        continue
    if e.dxf.layer != '0':
        continue
    if t == 'LWPOLYLINE':
        pts = e.get_points()
        mx = sum(p[0] for p in pts) / len(pts)
        my = sum(p[1] for p in pts) / len(pts)
    elif t == 'LINE':
        mx = (e.dxf.start.x + e.dxf.end.x) / 2.0
        my = (e.dxf.start.y + e.dxf.end.y) / 2.0
    elif t == 'CIRCLE':
        mx = e.dxf.center.x
        my = e.dxf.center.y
    else:
        continue

    if 831650 <= mx <= 832050 and 345350 <= my <= 347500:
        hpost_ents.append(e)
    elif 832100 <= mx <= 832500 and 345350 <= my <= 347500:
        lpost_ents.append(e)
    elif 832800 <= mx <= 833850 and 346700 <= my <= 347150:
        header_ents.append(e)

print(f'Found: {len(hpost_ents)} Hinge Post ents, {len(lpost_ents)} Lock Post ents, {len(header_ents)} Header ents')
