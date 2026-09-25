import ezdxf

doc = ezdxf.readfile('cad_templates/single_rabbet_Without_rubber.dxf')
msp = doc.modelspace()

print('=== Cross section DIMENSIONS ===')
for e in msp:
    if e.dxftype() == 'DIMENSION':
        p1 = e.dxf.defpoint
        p2 = getattr(e.dxf, 'defpoint2', None)
        p3 = getattr(e.dxf, 'defpoint3', None)
        p4 = getattr(e.dxf, 'defpoint4', None)
        meas = getattr(e.dxf, 'actual_measurement', None)
        print(f'DIM: text="{e.dxf.text}", meas={meas}, p1={p1}, p2={p2}, p3={p3}, p4={p4}')

print('\n=== Cross section geometry (Y > 2300) ===')
lines = []
for e in msp:
    t = e.dxftype()
    if t == 'LINE':
        if e.dxf.start.y > 2300:
            lines.append((round(e.dxf.start.x, 2), round(e.dxf.start.y, 2), round(e.dxf.end.x, 2), round(e.dxf.end.y, 2)))
    elif t == 'ARC':
        if e.dxf.center.y > 2300:
            print(f'ARC: center=({e.dxf.center.x:.2f}, {e.dxf.center.y:.2f}), r={e.dxf.radius:.2f}, angles=({e.dxf.start_angle:.1f}, {e.dxf.end_angle:.1f})')
    elif t == 'LWPOLYLINE':
        pts = e.get_points()
        if pts[0][1] > 2300:
            print(f'LWPOLYLINE: {len(pts)} pts: {[(round(p[0], 2), round(p[1], 2)) for p in pts]}')

for l in sorted(lines):
    print(f'LINE: ({l[0]}, {l[1]}) -> ({l[2]}, {l[3]})')
