import ezdxf

doc = ezdxf.readfile('cad_templates/Doubble_rabbit_with_rubber_test.dxf')
msp = doc.modelspace()

print('=== ENTITIES IN MODELSPACE BY LAYER AND BOUNDS ===')
for idx, e in enumerate(msp):
    t = e.dxftype()
    layer = e.dxf.layer
    if t == 'LWPOLYLINE':
        pts = e.get_points()
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        print(f'#{idx:03d} {t:10} layer={layer:12} pts={len(pts):2d} X=[{min(xs):9.1f}, {max(xs):9.1f}] Y=[{min(ys):9.1f}, {max(ys):9.1f}]')
    elif t == 'LINE':
        x1, y1 = e.dxf.start.x, e.dxf.start.y
        x2, y2 = e.dxf.end.x, e.dxf.end.y
        l = ((x2-x1)**2 + (y2-y1)**2)**0.5
        if l > 20:
            print(f'#{idx:03d} {t:10} layer={layer:12} len={l:7.1f} X=[{min(x1,x2):9.1f}, {max(x1,x2):9.1f}] Y=[{min(y1,y2):9.1f}, {max(y1,y2):9.1f}]')
    elif t == 'CIRCLE':
        cx, cy = e.dxf.center.x, e.dxf.center.y
        r = e.dxf.radius
        print(f'#{idx:03d} {t:10} layer={layer:12} r={r:4.1f} cx={cx:9.1f} cy={cy:9.1f}')
