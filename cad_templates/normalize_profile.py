import ezdxf

doc = ezdxf.readfile('cad_templates/Doubble_rabbit_with_rubber_test.dxf')
msp = doc.modelspace()
poly = msp[70]
pts = poly.get_points()

min_x = min(p[0] for p in pts)
min_y = min(p[1] for p in pts)

print('=== NORMALIZE CROSS-SECTION COORDINATES (Origin at bottom-left) ===')
for idx, p in enumerate(pts):
    x = p[0] - min_x
    y = p[1] - min_y
    b = p[4] if len(p) >= 5 else 0.0
    print(f'pt[{idx:02d}]: X={x:7.2f}, Y={y:7.2f}, bulge={b:.4f}')

xs = sorted(list(set(round(p[0] - min_x, 1) for p in pts)))
ys = sorted(list(set(round(p[1] - min_y, 1) for p in pts)))
print('\nUnique X levels:', xs)
print('Unique Y levels:', ys)
