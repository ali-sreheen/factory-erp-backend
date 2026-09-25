import math

pts_v2 = [
    (137.461, 962.382, 0.0),
    (137.461, 950.929, 1.0),
    (122.461, 950.929, 0.0),
    (122.461, 962.382, 2.539565)
]
pts_fixed = [
    (137.461, 962.382, 0.0),
    (137.461, 950.929, -1.0),
    (122.461, 950.929, 0.0),
    (122.461, 962.382, -2.539565)
]

def make_svg(pts, col, fname):
    # Viewbox centered on the cylinder: X in [110, 150], Y in [935, 990]
    # In SVG, Y increases downward. In DXF Y increases upward.
    # To view it right side up (as in AutoCAD/Nest): svg_y = 1000 - dxf_y
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 10 40 70" width="300" height="500">']
    svg.append('<rect width="100%" height="100%" fill="#1e1e1e"/>')
    # dxf_y 1043 -> svg_y = 1000 - 1043 = -43 (outside)
    # let's map svg_y = 990 - dxf_y
    # dxf_y = 981 -> svg_y = 9
    # dxf_y = 943 -> svg_y = 47
    def to_svg(x, y):
        return x, 990.0 - y

    p0 = to_svg(pts[0][0], pts[0][1])
    d_str = f'M {p0[0]:.3f} {p0[1]:.3f} '
    for i in range(len(pts)):
        p1 = pts[i]
        p2 = pts[(i+1)%len(pts)]
        b = p1[2]
        p2_svg = to_svg(p2[0], p2[1])
        if abs(b) < 1e-6:
            d_str += f'L {p2_svg[0]:.3f} {p2_svg[1]:.3f} '
        else:
            theta = 4.0 * math.atan(b)
            d = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
            r = abs(d / (2.0 * math.sin(theta / 2.0)))
            large_arc = 1 if abs(theta) > math.pi else 0
            # DXF Y up to SVG Y down inverts arc orientation:
            sweep = 1 if b < 0 else 0
            d_str += f'A {r:.3f} {r:.3f} 0 {large_arc} {sweep} {p2_svg[0]:.3f} {p2_svg[1]:.3f} '
    svg.append(f'<path d="{d_str}" fill="none" stroke="{col}" stroke-width="1.2"/>')
    svg.append('</svg>')
    with open(fname, 'w') as f:
        f.write('\n'.join(svg))

make_svg(pts_v2, 'red', 'test_cylinder_buggy.svg')
make_svg(pts_fixed, 'lime', 'test_cylinder_fixed.svg')
print('SVGs written successfully')
