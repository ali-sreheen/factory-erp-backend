import ezdxf

doc = ezdxf.readfile('cad_templates/Doubble_rabbit_with_rubber_test.dxf')
msp = doc.modelspace()

hpost_poly = msp[33]
pts = hpost_poly.get_points()
ox = 831701.37
oy = 345380.86

print('--- HINGE POST OUTLINE POINTS RELATIVE TO (ox, oy) ---')
for idx, p in enumerate(pts):
    x = p[0] - ox
    y = p[1] - oy
    b = p[4] if len(p) >= 5 else 0.0
    print(f'pt[{idx:02d}]: ({x:7.2f}, {y:7.2f}) b={b:.4f}')

xs = sorted(list(set(round(p[0] - ox, 1) for p in pts)))
ys = sorted(list(set(round(p[1] - oy, 1) for p in pts)))
print('Unique X:', xs)
print('Unique Y:', ys)
