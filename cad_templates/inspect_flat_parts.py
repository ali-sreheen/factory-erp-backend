import ezdxf

doc = ezdxf.readfile('cad_templates/Doubble_rabbit_with_rubber_test.dxf')
msp = doc.modelspace()

print('=== THREE UNFOLDED FLAT PARTS IN MODELSPACE ===')

parts = [
    ('Hinge Post', msp[33]),
    ('Lock Post', msp[87]),
    ('Header', msp[63])
]

for name, poly in parts:
    pts = poly.get_points()
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max_x - min_x
    h = max_y - min_y
    print(f'\n--- {name} ---')
    print(f'Bounding Box: W={w:.3f} mm, H={h:.3f} mm (min_x={min_x:.1f}, min_y={min_y:.1f})')
    print(f'Outline points count: {len(pts)}')
    
    # Check what else is inside or near this bounding box
    contained_ents = []
    for e in msp:
        if e is poly: continue
        t = e.dxftype()
        if t == 'LWPOLYLINE':
            e_pts = e.get_points()
            if all(min_x - 10 <= p[0] <= max_x + 10 and min_y - 10 <= p[1] <= max_y + 10 for p in e_pts):
                contained_ents.append(f'LWPOLYLINE (pts={len(e_pts)}, w={max(p[0] for p in e_pts)-min(p[0] for p in e_pts):.1f}, h={max(p[1] for p in e_pts)-min(p[1] for p in e_pts):.1f}, at y_mid={(max(p[1] for p in e_pts)+min(p[1] for p in e_pts))/2 - min_y:.1f})')
        elif t == 'LINE':
            x1, y1 = e.dxf.start.x, e.dxf.start.y
            x2, y2 = e.dxf.end.x, e.dxf.end.y
            if min_x - 10 <= x1 <= max_x + 10 and min_x - 10 <= x2 <= max_x + 10 and min_y - 10 <= y1 <= max_y + 10 and min_y - 10 <= y2 <= max_y + 10:
                l_len = ((x2-x1)**2 + (y2-y1)**2)**0.5
                if l_len < 50:
                    contained_ents.append(f'LINE (len={l_len:.1f}, at y={y1-min_y:.1f})')
        elif t == 'CIRCLE':
            cx, cy = e.dxf.center.x, e.dxf.center.y
            if min_x - 10 <= cx <= max_x + 10 and min_y - 10 <= cy <= max_y + 10:
                contained_ents.append(f'CIRCLE (r={e.dxf.radius:.1f}, at x={cx-min_x:.1f}, y={cy-min_y:.1f})')
    
    print(f'Contained/Internal features ({len(contained_ents)} items):')
    for feat in contained_ents:
        print(f'   {feat}')
