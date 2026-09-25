import math
import ezdxf

doc = ezdxf.readfile('cad_templates/door_955x2000x175_RH_test_v3.dxf')
b = doc.blocks.get('B_TEST_DOOR_LEAF1')

# Handle hole is at x=129.961, y=1043. Screw holes are at x=110.961 and 148.961
# Cylinder cutout is around x=122 to 138, y=940 to 985
# Let's render everything between x in [80, 180] and y in [920, 1080]

svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="70 0 120 180" width="360" height="540">']
svg.append('<rect width="100%" height="100%" fill="#1a1a24"/>')
# Grid
svg.append('<defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2a2a3a" stroke-width="0.5"/></pattern></defs>')
svg.append('<rect width="100%" height="100%" fill="url(#grid)"/>')

def to_svg(x, y):
    # map y from [920, 1100] to SVG [180, 0]
    return x, 1100.0 - y

for e in b:
    t = e.dxftype()
    if t == 'CIRCLE':
        cx, cy = to_svg(e.dxf.center.x, e.dxf.center.y)
        r = e.dxf.radius
        if 60 <= cx <= 200 and -20 <= cy <= 200:
            col = '#00ffff' if r > 10 else '#ffcc00'
            svg.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="none" stroke="{col}" stroke-width="1"/>')
            svg.append(f'<text x="{cx:.2f}" y="{cy+18:.2f}" font-size="7" fill="{col}" text-anchor="middle">R{r:.1f} ({cx:.1f},{cy:.1f})</text>')
    elif t == 'LWPOLYLINE':
        pts = e.get_points()
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        if min(xs) > 60 and max(xs) < 200 and min(ys) > 900 and max(ys) < 1100:
            p0 = to_svg(pts[0][0], pts[0][1])
            d_str = f'M {p0[0]:.3f} {p0[1]:.3f} '
            for i in range(len(pts)):
                p1 = pts[i]
                p2 = pts[(i+1)%len(pts)]
                b_val = p1[4] if len(p1) >= 5 else 0.0
                p2_svg = to_svg(p2[0], p2[1])
                if abs(b_val) < 1e-6:
                    d_str += f'L {p2_svg[0]:.3f} {p2_svg[1]:.3f} '
                else:
                    theta = 4.0 * math.atan(b_val)
                    d = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                    r = abs(d / (2.0 * math.sin(theta / 2.0)))
                    large_arc = 1 if abs(theta) > math.pi else 0
                    sweep = 1 if b_val < 0 else 0
                    d_str += f'A {r:.3f} {r:.3f} 0 {large_arc} {sweep} {p2_svg[0]:.3f} {p2_svg[1]:.3f} '
            svg.append(f'<path d="{d_str}" fill="rgba(0,255,100,0.15)" stroke="#00ff66" stroke-width="1.2"/>')
            svg.append(f'<text x="{(min(xs)+max(xs))/2:.1f}" y="{1100 - (min(ys)+max(ys))/2:.1f}" font-size="7" fill="#00ff66" text-anchor="middle">Cylinder Cutout (Corrected)</text>')

svg.append('</svg>')
with open(r'C:\Users\hassa\.gemini\antigravity\brain\49248a07-09e3-4cff-a99a-50659f81cf3a\leaf1_handle_cylinder_preview.svg', 'w') as f:
    f.write('\n'.join(svg))
print('Preview SVG created successfully!')
