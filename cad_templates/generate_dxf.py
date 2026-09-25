"""
Factory ERP - High-Precision CAD STRETCH Engine (V13)
Operates directly on the proven CAD template entities using multi-zone AutoCAD STRETCH
operations to guarantee 100% mathematical and dimensional accuracy without re-approximating
micro-notches, relief cuts, miter angles, or hole positions.
"""

import math
import ezdxf
from ezdxf.enums import TextEntityAlignment
from rectpack import newPacker, PackingMode, PackingBin, SORT_AREA

def generate_full_project_cad_dxf(template_path, output_path, doors, sheet_sizes_1_5=None, sheet_sizes_1_2=None, sheet_sizes_4_0=None, project_number=""):
    if sheet_sizes_1_5 is None:
        sheet_sizes_1_5 = [(1000.0, 2300.0), (1250.0, 2300.0)]
    if sheet_sizes_1_2 is None:
        sheet_sizes_1_2 = [(1000.0, 2300.0), (1250.0, 2300.0)]
    if sheet_sizes_4_0 is None:
        sheet_sizes_4_0 = [(1250.0, 2500.0)]
        
    sheet_sizes_1_5 = sorted(sheet_sizes_1_5, key=lambda s: s[0] * s[1])
    sheet_sizes_1_2 = sorted(sheet_sizes_1_2, key=lambda s: s[0] * s[1])
    sheet_sizes_4_0 = sorted(sheet_sizes_4_0, key=lambda s: s[0] * s[1])
        
    doc_in = ezdxf.readfile(template_path)
    msp_in = doc_in.modelspace()
    
    # -----------------------------------------------------------------
    # EXTRACT ORIGINAL ENTITIES DIRECTLY FROM CAD TEMPLATE
    # -----------------------------------------------------------------
    p17_min_x = 833.416
    p32_min_x = 1394.834
    head_min_x = 777.086
    head_min_y = 3888.477
    l1_min_x = 0.0
    l1_min_y = -4159.567
    l2_min_x = 1499.259
    l2_min_y = -4159.567

    hpost_ents = []
    lpost_ents = []
    header_ents = []
    l1_ents = []
    l2_ents = []

    for e in msp_in:
        t = e.dxftype()
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
            
        if 800 <= mx <= 1250 and -10 <= my <= 2200:
            hpost_ents.append(e)
        elif 1350 <= mx <= 1820 and -10 <= my <= 2200:
            # Exclude alternative lock strike cutouts: keep only the standard 170.5 x 32.8 mm strike (Index 200)
            if t == 'LWPOLYLINE' and 850 <= my <= 1200 and len(pts) != 44:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                w = max(xs) - min(xs)
                h = max(ys) - min(ys)
                if round(w, 1) != 32.8 or round(h, 1) != 170.5:
                    continue
            lpost_ents.append(e)
        elif 750 <= mx <= 1900 and 3800 <= my <= 4350:
            header_ents.append(e)
        elif -50 <= mx <= 1200 and -4200 <= my <= -2000:
            # Exclude duplicate shifted cylinder cutout (keep only the one aligned with handle at x=1000)
            if t == 'LWPOLYLINE' and -3250 <= my <= -3150 and mx > 800.0:
                if abs(mx - 1000.0) > 3.0:
                    continue
            l1_ents.append(e)
        elif 1400 <= mx <= 2600 and -4200 <= my <= -2000:
            # Exclude duplicate shifted cylinder cutout (keep only the one aligned with handle at x=1572.9)
            if t == 'LWPOLYLINE' and -3250 <= my <= -3150 and mx < 2000.0:
                if abs(mx - 1572.897) > 3.0:
                    continue
            l2_ents.append(e)

    # Extract Double Rabbit Template entities if available
    import os
    cad_dir = os.path.dirname(os.path.abspath(template_path))
    dr_template_path = os.path.join(cad_dir, "Doubble_rabbit_with_rubber_test.dxf")

    dr_hp_min_x = 831701.371
    dr_hp_min_y = 345380.862
    dr_lp_min_x = 832139.752
    dr_lp_min_y = 345380.862
    dr_hd_min_x = 832837.371
    dr_hd_min_y = 346759.880

    dr_hpost_ents = []
    dr_lpost_ents = []
    dr_header_ents = []

    if os.path.exists(dr_template_path):
        doc_dr = ezdxf.readfile(dr_template_path)
        msp_dr = doc_dr.modelspace()
        for e in msp_dr:
            if e.dxf.layer != '0' or e.dxftype() not in ('LINE', 'LWPOLYLINE', 'CIRCLE'):
                continue
            if e.dxftype() == 'LWPOLYLINE':
                pts = e.get_points()
                mx = sum(p[0] for p in pts) / len(pts)
                my = sum(p[1] for p in pts) / len(pts)
            elif e.dxftype() == 'LINE':
                mx = (e.dxf.start.x + e.dxf.end.x) / 2.0
                my = (e.dxf.start.y + e.dxf.end.y) / 2.0
            elif e.dxftype() == 'CIRCLE':
                mx = e.dxf.center.x
                my = e.dxf.center.y
            else:
                continue

            if 831650 <= mx <= 832050 and 345350 <= my <= 347500:
                dr_hpost_ents.append(e)
            elif 832100 <= mx <= 832500 and 345350 <= my <= 347500:
                dr_lpost_ents.append(e)
            elif 832800 <= mx <= 833850 and 346700 <= my <= 347150:
                dr_header_ents.append(e)

    # Extract Single Rabbet Without Rubber Template entities if available
    srnr_template_path = os.path.join(cad_dir, "single_rabbet_Without_rubber.dxf")

    srnr_hp_min_x = 5814.55885
    srnr_hp_min_y = 14.10000
    srnr_lp_min_x = 6488.46684
    srnr_lp_min_y = 14.10000
    srnr_hd_min_x = 7096.98800
    srnr_hd_min_y = 448.70300

    srnr_hpost_ents = []
    srnr_lpost_ents = []
    srnr_header_ents = []

    if os.path.exists(srnr_template_path):
        doc_srnr = ezdxf.readfile(srnr_template_path)
        msp_srnr = doc_srnr.modelspace()
        for e in msp_srnr:
            if e.dxf.layer != '0' or e.dxftype() not in ('LINE', 'LWPOLYLINE', 'CIRCLE'):
                continue
            if e.dxftype() == 'LWPOLYLINE':
                pts = e.get_points()
                mx = sum(p[0] for p in pts) / len(pts)
                my = sum(p[1] for p in pts) / len(pts)
            elif e.dxftype() == 'LINE':
                mx = (e.dxf.start.x + e.dxf.end.x) / 2.0
                my = (e.dxf.start.y + e.dxf.end.y) / 2.0
            elif e.dxftype() == 'CIRCLE':
                mx = e.dxf.center.x
                my = e.dxf.center.y
            else:
                continue

            if 5800 <= mx <= 6100 and 10 <= my <= 2120:
                srnr_hpost_ents.append(e)
            elif 6450 <= mx <= 6800 and 10 <= my <= 2120:
                srnr_lpost_ents.append(e)
            elif 7090 <= mx <= 7380 and 440 <= my <= 1450:
                srnr_header_ents.append(e)

        # Synthesize the 4 wall anchor holes (radius 3.5mm) in HP and LP from template definition
        anchor_ys = [150.0, 731.7, 1313.3, 1895.0]
        for ay in anchor_ys:
            c_hp = msp_srnr.new_entity('CIRCLE', dxfattribs={'layer': '0', 'center': (srnr_hp_min_x + 160.03, srnr_hp_min_y + ay, 0.0), 'radius': 3.5})
            srnr_hpost_ents.append(c_hp)
            c_lp = msp_srnr.new_entity('CIRCLE', dxfattribs={'layer': '0', 'center': (srnr_lp_min_x + 115.77, srnr_lp_min_y + ay, 0.0), 'radius': 3.5})
            srnr_lpost_ents.append(c_lp)

    # Extract Double Rabbet Without Rubber Template entities if available
    drnr_template_path = os.path.join(cad_dir, "Double_rabbet_Without_rubber.dxf")

    drnr_hp_min_x = 8726.800
    drnr_hp_min_y = 14.100
    drnr_lp_min_x = 9337.622
    drnr_lp_min_y = 14.100
    drnr_hd_min_x = 10302.740
    drnr_hd_min_y = 289.700

    drnr_hpost_ents = []
    drnr_lpost_ents = []
    drnr_header_ents = []

    if os.path.exists(drnr_template_path):
        doc_drnr = ezdxf.readfile(drnr_template_path)
        msp_drnr = doc_drnr.modelspace()
        for e in msp_drnr:
            if e.dxf.layer != '0' or e.dxftype() not in ('LINE', 'LWPOLYLINE', 'CIRCLE'):
                continue
            if e.dxftype() == 'LWPOLYLINE':
                pts = e.get_points()
                mx = sum(p[0] for p in pts) / len(pts)
                my = sum(p[1] for p in pts) / len(pts)
            elif e.dxftype() == 'LINE':
                mx = (e.dxf.start.x + e.dxf.end.x) / 2.0
                my = (e.dxf.start.y + e.dxf.end.y) / 2.0
            elif e.dxftype() == 'CIRCLE':
                mx = e.dxf.center.x
                my = e.dxf.center.y
            else:
                continue

            if 8700 <= mx <= 9020 and 10 <= my <= 2120:
                drnr_hpost_ents.append(e)
            elif 9300 <= mx <= 9630 and 10 <= my <= 2120:
                drnr_lpost_ents.append(e)
            elif 10290 <= mx <= 10590 and 280 <= my <= 1300:
                drnr_header_ents.append(e)

        # Synthesize the 4 wall anchor holes (radius 3.5mm) in HP and LP from template definition
        anchor_ys = [150.0, 731.7, 1313.3, 1895.0]
        for ay in anchor_ys:
            c_hp = msp_drnr.new_entity('CIRCLE', dxfattribs={'layer': '0', 'center': (drnr_hp_min_x + 136.47, drnr_hp_min_y + ay, 0.0), 'radius': 3.5})
            drnr_hpost_ents.append(c_hp)
            c_lp = msp_drnr.new_entity('CIRCLE', dxfattribs={'layer': '0', 'center': (drnr_lp_min_x + 136.47, drnr_lp_min_y + ay, 0.0), 'radius': 3.5})
    # Extract Double Leaf Template entities if available
    dl_template_path = os.path.join(cad_dir, "Double_leaf.dxf")
    dl_a4_ents = []
    dl_a3_ents = []
    dl_a2_ents = []
    dl_a1_ents = []

    if os.path.exists(dl_template_path):
        doc_dl = ezdxf.readfile(dl_template_path)
        msp_dl = doc_dl.modelspace()
        for e in msp_dl:
            t = e.dxftype()
            if t not in ('LWPOLYLINE', 'LINE', 'CIRCLE'):
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

            if my > 2350:
                continue
            if -10 <= mx <= 1300:
                dl_a4_ents.append(e)
            elif 1300 < mx <= 2650:
                dl_a3_ents.append(e)
            elif 2650 < mx <= 3980:
                dl_a2_ents.append(e)
            elif 3980 < mx <= 5300:
                dl_a1_ents.append(e)

    doc_out = ezdxf.new('R2018')
    msp = doc_out.modelspace()
    
    doc_out.layers.add('OUTLINE', color=7)
    doc_out.layers.add('CUTOUTS', color=3)
    doc_out.layers.add('HOLES', color=4)
    doc_out.layers.add('NOTCHES', color=6)
    doc_out.layers.add('SHEETS_1_5', color=4)
    doc_out.layers.add('SHEETS_1_2', color=3)
    doc_out.layers.add('SHEETS_4_0', color=1)
    doc_out.layers.add('PART_LABELS', color=7)
    doc_out.layers.add('TEXT', color=2)
    
    nesting_parts_1_5 = []
    nesting_parts_1_2 = []
    nesting_parts_4_0 = []
    current_x = 0.0

    for door_idx, door in enumerate(doors):
        d_name = door.get("name", f"A{door_idx+1}")
        p_num = door.get("project_number") or project_number or ""
        clean_p_num = str(p_num).replace("PRJ-", "").strip() if str(p_num).startswith("PRJ-") else str(p_num).strip()
        if clean_p_num and d_name:
            piece_label = f"{clean_p_num}-{d_name}"
        elif clean_p_num:
            piece_label = clean_p_num
        else:
            piece_label = str(d_name)

        d_w = float(door["width"])
        d_h = float(door["height"])
        d_d = float(door["depth"])
        
        profile_type = str(door.get("profile_type") or "").strip().lower()
        is_drnr = ("double" in profile_type or "مزدوج" in profile_type) and ("without" in profile_type or "بدون" in profile_type) and len(drnr_hpost_ents) > 0
        is_double_rabbit = ("double" in profile_type or "مزدوج" in profile_type) and not is_drnr and len(dr_hpost_ents) > 0
        is_srnr = ("without" in profile_type or "بدون" in profile_type or profile_type == "single rabbit") and not is_drnr and len(srnr_hpost_ents) > 0

        direction = str(door.get("direction") or "RH").strip().upper()
        is_rh = (direction == "RH" or "يمين" in str(door.get("direction", "")))
        is_double = (direction == "DOUBLE" or "D/" in direction or "دبل" in str(door.get("direction", "")) or "double" in str(door.get("door_type", "")).lower()) and len(dl_a4_ents) > 0
        is_double_la = is_double and ("LA" in direction or "يسار" in str(door.get("direction", "")))

        custom_p = door.get("custom_profile") or {}
        s1 = float(custom_p.get("S1") or custom_p.get("s1") or door.get("s1") or 15.0)
        s2 = float(custom_p.get("S2") or custom_p.get("s2") or door.get("s2") or 15.0)

        if is_drnr:
            default_a1 = 40.0
            default_a2 = 40.0
        elif is_double_rabbit:
            default_a1 = 50.0
            default_a2 = 50.0
        elif is_srnr:
            default_a1 = 55.0
            default_a2 = 40.0
        else:
            default_a1 = 40.0
            default_a2 = 62.0

        a1 = float(custom_p.get("A1") or custom_p.get("arch1") or door.get("architrave") or default_a1)
        if a1 < 15.0: a1 *= 10.0
        a2 = float(custom_p.get("A2") or custom_p.get("arch2") or door.get("architrave_2") or default_a2)
        if a2 < 15.0: a2 *= 10.0

        r2 = float(custom_p.get("R2") or custom_p.get("r2") or door.get("r2") or 10.5)

        # -----------------------------------------------------------------
        # COMPUTE CAD STRETCH DELTAS RELATIVE TO BASE TEMPLATE
        # -----------------------------------------------------------------
        if is_double_rabbit:
            # DOUBLE RABBIT WITH RUBBER PARAMETRIC STRETCH
            # Template base: D=160, A1=50, A2=50, S1=15, S2=15, Post_H=2098.5, Head_Len=998.0
            delta_s1 = s1 - 15.0
            delta_a1 = a1 - 50.0
            delta_d = d_d - 160.0
            delta_a2 = a2 - 50.0
            delta_s2 = s2 - 15.0

            actual_post_h = d_h - 1.5
            delta_h_post = actual_post_h - 2098.5
            delta_w = d_w - 1000.0
            # Leaf height = Door Height - Architrave (A1) - 3mm (top gap) - 7mm (floor gap) = d_h - a1 - 10.0 mm
            delta_h_leaf = (d_h - a1 - 10.0) - 2050.0

            dr_total_w = 338.337 + delta_s1 + delta_a1 + delta_d + delta_a2 + delta_s2

            def stretch_hpost(x, y):
                dx = 0.0
                if x > 13.6: dx += delta_s1
                if x > 60.8: dx += delta_a1
                if x > 211.4: dx += delta_d
                if x > 277.7: dx += delta_a2
                if x > 324.8: dx += delta_s2

                dy = 0.0
                if y > 2000.0:
                    if x <= 15.2:
                        dy = delta_h_post
                    elif x <= 276.1:
                        dy = delta_h_post - delta_a1
                    else:
                        dy = delta_h_post - delta_a1 + delta_a2
                elif y > 1300.0:
                    if x <= 150.0:
                        dy = delta_h_post - delta_a1
                    elif 160.0 <= x <= 200.0:
                        if y > 1600.0:
                            dy = delta_h_post - delta_a1
                        else:
                            dy = ((1879.04 + (delta_h_post - delta_a1) - 150.0) * (2.0 / 3.0) + 150.0) - 1302.71
                elif 500.0 <= y <= 1200.0:
                    if x <= 150.0:
                        dy = (delta_h_post - delta_a1) / 2.0
                    elif 160.0 <= x <= 200.0:
                        dy = ((1879.04 + (delta_h_post - delta_a1) - 150.0) * (1.0 / 3.0) + 150.0) - 726.37

                fx = x + dx
                fy = y + dy
                if is_rh:
                    fx = dr_total_w - fx
                return fx, fy

            def stretch_lpost(x, y):
                dx = 0.0
                if x > 13.6: dx += delta_s2
                if x > 60.7: dx += delta_a2
                if x > 105.7: dx += delta_d
                if x > 277.7: dx += delta_a1
                if x > 324.8: dx += delta_s1

                dy = 0.0
                if y > 2000.0:
                    if x <= 15.2:
                        dy = delta_h_post - delta_a1 + delta_a2
                    elif x <= 60.7:
                        dy = delta_h_post - delta_a1
                    elif x <= 277.7:
                        dy = delta_h_post - delta_a1
                    else:
                        dy = delta_h_post
                elif y > 1300.0:
                    if 130.0 <= x <= 180.0:
                        if y > 1600.0:
                            dy = delta_h_post - delta_a1
                        else:
                            dy = ((1879.04 + (delta_h_post - delta_a1) - 150.0) * (2.0 / 3.0) + 150.0) - 1302.71
                elif 500.0 <= y <= 1200.0:
                    if 130.0 <= x <= 180.0:
                        dy = ((1879.04 + (delta_h_post - delta_a1) - 150.0) * (1.0 / 3.0) + 150.0) - 726.37

                fx = x + dx
                fy = y + dy
                if is_rh:
                    fx = dr_total_w - fx
                return fx, fy

            def stretch_header(x, y):
                dx = delta_w if x > 500.0 else 0.0
                if y > 277.7:
                    if x < 100.0: dx -= delta_a1
                    elif x > 800.0: dx += delta_a1
                elif y < 60.7:
                    if x < 100.0: dx -= delta_a2
                    elif x > 800.0: dx += delta_a2

                dy = 0.0
                if y > 13.6: dy += delta_s2
                if y > 60.7: dy += delta_a2
                if y > 105.7: dy += delta_d
                if y > 277.7: dy += delta_a1
                if y > 324.8: dy += delta_s1

                fx = x + dx
                fy = y + dy
                if is_rh:
                    fx = (998.0 + delta_w) - fx
                return fx, fy

            cur_hpost_ents = dr_hpost_ents
            cur_lpost_ents = dr_lpost_ents
            cur_header_ents = dr_header_ents
            cur_hp_ox, cur_hp_oy = dr_hp_min_x, dr_hp_min_y
            cur_lp_ox, cur_lp_oy = dr_lp_min_x, dr_lp_min_y
            cur_hd_ox, cur_hd_oy = dr_hd_min_x, dr_hd_min_y
            cur_is_outline_post = lambda pts: len(pts) == 49
            cur_is_outline_head = lambda pts: len(pts) == 52
            cur_flip_bulge_post = is_rh
            cur_flip_bulge_head = is_rh

        elif is_srnr:
            # SINGLE RABBIT WITHOUT RUBBER PARAMETRIC STRETCH
            # Template base: D=150, A1=55, A2=40, S1=15, S2=15, Post_H=2098.5, Head_Len=998.0
            delta_s1 = s1 - 15.0
            delta_a1 = a1 - 55.0
            delta_d = d_d - 150.0
            delta_a2 = a2 - 40.0
            delta_s2 = s2 - 15.0

            actual_post_h = d_h - 1.5
            delta_h_post = actual_post_h - 2098.5
            delta_w = d_w - 1000.0
            # Leaf height = Door Height - Architrave (A1) - 3mm (top gap) - 7mm (floor gap) = d_h - a1 - 10.0 mm
            delta_h_leaf = (d_h - a1 - 10.0) - 2050.0

            srnr_total_w = 275.802 + delta_s1 + delta_a1 + delta_d + delta_a2 + delta_s2
            dy_top = delta_h_post - delta_a1

            def stretch_hpost(x, y):
                dx = 0.0
                if x > 13.6: dx += delta_s1
                if x > 40.0: dx += delta_a1
                if x > 180.0: dx += delta_d
                if x > 220.0: dx += delta_a2
                if x > 262.0: dx += delta_s2

                dy = 0.0
                if y > 2000.0:
                    if x <= 15.0:
                        dy = delta_h_post
                    elif x <= 260.0:
                        dy = dy_top
                    else:
                        dy = delta_h_post - delta_a1 + delta_a2
                elif y > 1300.0:
                    if x <= 140.0:
                        dy = dy_top
                    elif 140.0 <= x <= 180.0:
                        if y > 1600.0:
                            dy = dy_top
                        else:
                            dy = dy_top * (2.0 / 3.0)
                elif 500.0 <= y <= 1200.0:
                    if x <= 140.0:
                        dy = dy_top / 2.0
                    elif 140.0 <= x <= 180.0:
                        dy = dy_top * (1.0 / 3.0)

                fx = x + dx
                fy = y + dy
                if is_rh:
                    fx = srnr_total_w - fx
                return fx, fy

            def stretch_lpost(x, y):
                dx = 0.0
                if x > 13.6: dx += delta_s2
                if x > 65.0: dx += delta_a2
                if x > 130.0: dx += delta_d
                if x > 235.0: dx += delta_a1
                if x > 262.0: dx += delta_s1

                dy = 0.0
                if y > 2000.0:
                    if x <= 15.0:
                        dy = delta_h_post - delta_a1 + delta_a2
                    elif x <= 260.0:
                        dy = dy_top
                    else:
                        dy = delta_h_post
                elif y > 1300.0:
                    if 95.0 <= x <= 135.0:
                        if y > 1600.0:
                            dy = dy_top
                        else:
                            dy = dy_top * (2.0 / 3.0)
                elif 500.0 <= y <= 1200.0:
                    if 95.0 <= x <= 135.0:
                        dy = dy_top * (1.0 / 3.0)

                fx = x + dx
                fy = y + dy
                if is_rh:
                    fx = srnr_total_w - fx
                return fx, fy

            def stretch_header(x, y):
                dy_len = delta_w if y > 500.0 else 0.0
                if x < 70.0:
                    if y < 100.0: dy_len -= delta_a1
                    elif y > 800.0: dy_len += delta_a1
                elif x > 200.0:
                    if y < 100.0: dy_len -= delta_a2
                    elif y > 800.0: dy_len += delta_a2

                dx_w = 0.0
                if x > 13.6: dx_w += delta_s1
                if x > 40.0: dx_w += delta_a1
                if x > 130.0: dx_w += delta_d
                if x > 220.0: dx_w += delta_a2
                if x > 262.0: dx_w += delta_s2

                flen = y + dy_len
                fwidth = x + dx_w
                if is_rh:
                    flen = (998.0 + delta_w) - flen
                return flen, fwidth

            cur_hpost_ents = srnr_hpost_ents
            cur_lpost_ents = srnr_lpost_ents
            cur_header_ents = srnr_header_ents
            cur_hp_ox, cur_hp_oy = srnr_hp_min_x, srnr_hp_min_y
            cur_lp_ox, cur_lp_oy = srnr_lp_min_x, srnr_lp_min_y
            cur_hd_ox, cur_hd_oy = srnr_hd_min_x, srnr_hd_min_y
            cur_is_outline_post = lambda pts: len(pts) == 35
            cur_is_outline_head = lambda pts: len(pts) == 30
            cur_flip_bulge_post = is_rh
            cur_flip_bulge_head = not is_rh

        elif is_drnr:
            # DOUBLE RABBIT WITHOUT RUBBER PARAMETRIC STRETCH
            # Template base: D=150, A1=40, A2=40, S1=15, S2=15, Post_H=2098.5, Head_Len=998.0
            delta_s1 = s1 - 15.0
            delta_a1 = a1 - 40.0
            delta_d = d_d - 150.0
            delta_a2 = a2 - 40.0
            delta_s2 = s2 - 15.0

            actual_post_h = d_h - 1.5
            delta_h_post = actual_post_h - 2098.5
            delta_w = d_w - 1000.0
            # Leaf height = Door Height - Architrave (A1) - 3mm (top gap) - 7mm (floor gap) = d_h - a1 - 10.0 mm
            delta_h_leaf = (d_h - a1 - 10.0) - 2050.0

            drnr_total_w = 272.939 + delta_s1 + delta_a1 + delta_d + delta_a2 + delta_s2
            dy_top = delta_h_post - delta_a1

            def stretch_hpost(x, y):
                dx = 0.0
                if x > 13.56: dx += delta_s1
                if x > 40.0:  dx += delta_a1
                if x > 140.0: dx += delta_d
                if x > 220.0: dx += delta_a2
                if x > 260.0: dx += delta_s2

                dy = 0.0
                if y > 2000.0:
                    if x <= 15.0:
                        dy = delta_h_post
                    elif x <= 260.0:
                        dy = dy_top
                    else:
                        dy = delta_h_post - delta_a1 + delta_a2
                elif y > 1300.0:
                    if x <= 100.0:
                        dy = dy_top
                    elif 120.0 <= x <= 160.0:
                        if y > 1600.0:
                            dy = dy_top
                        else:
                            dy = dy_top * (2.0 / 3.0)
                elif 500.0 <= y <= 1200.0:
                    if x <= 100.0:
                        dy = dy_top / 2.0
                    elif 120.0 <= x <= 160.0:
                        dy = dy_top * (1.0 / 3.0)

                fx = x + dx
                fy = y + dy
                if is_rh:
                    fx = drnr_total_w - fx
                return fx, fy

            def stretch_lpost(x, y):
                dx = 0.0
                if x > 13.56: dx += delta_s2
                if x > 45.0:  dx += delta_a2
                if x > 130.0: dx += delta_d
                if x > 230.0: dx += delta_a1
                if x > 260.0: dx += delta_s1

                dy = 0.0
                if y > 2000.0:
                    if x <= 15.0:
                        dy = delta_h_post - delta_a1 + delta_a2
                    elif x <= 260.0:
                        dy = dy_top
                    else:
                        dy = delta_h_post
                elif y > 1300.0:
                    if 120.0 <= x <= 160.0:
                        if y > 1600.0:
                            dy = dy_top
                        else:
                            dy = dy_top * (2.0 / 3.0)
                elif 500.0 <= y <= 1200.0:
                    if 120.0 <= x <= 160.0:
                        dy = dy_top * (1.0 / 3.0)

                fx = x + dx
                fy = y + dy
                if is_rh:
                    fx = drnr_total_w - fx
                return fx, fy

            def stretch_header(x, y):
                dy_len = delta_w if y > 500.0 else 0.0
                if x < 70.0:
                    if y < 100.0: dy_len -= delta_a1
                    elif y > 800.0: dy_len += delta_a1
                elif x > 200.0:
                    if y < 100.0: dy_len -= delta_a2
                    elif y > 800.0: dy_len += delta_a2

                dx_w = 0.0
                if x > 13.56: dx_w += delta_s1
                if x > 40.0:  dx_w += delta_a1
                if x > 130.0: dx_w += delta_d
                if x > 220.0: dx_w += delta_a2
                if x > 260.0: dx_w += delta_s2

                flen = y + dy_len
                fwidth = x + dx_w
                if is_rh:
                    flen = (998.0 + delta_w) - flen
                return flen, fwidth

            cur_hpost_ents = drnr_hpost_ents
            cur_lpost_ents = drnr_lpost_ents
            cur_header_ents = drnr_header_ents
            cur_hp_ox, cur_hp_oy = drnr_hp_min_x, drnr_hp_min_y
            cur_lp_ox, cur_lp_oy = drnr_lp_min_x, drnr_lp_min_y
            cur_hd_ox, cur_hd_oy = drnr_hd_min_x, drnr_hd_min_y
            cur_is_outline_post = lambda pts: len(pts) == 34
            cur_is_outline_head = lambda pts: len(pts) == 26
            cur_flip_bulge_post = is_rh
            cur_flip_bulge_head = is_rh

        else:
            # SINGLE RABBIT WITH RUBBER PARAMETRIC STRETCH (Base Template)
            delta_s1 = s1 - 15.0
            delta_a1 = a1 - 40.0
            delta_r2 = r2 - 10.5
            delta_d = d_d - 240.0
            delta_a2 = a2 - 62.0
            delta_s2 = s2 - 15.0
            
            actual_post_h = d_h - 1.5
            delta_h_post = actual_post_h - 2162.0
            delta_w = d_w - 1000.0
            # Header length = door width - 2mm (exact rule: W - 2.0 mm)
            target_head_len = d_w - 2.0
            delta_w_head = target_head_len - 1075.0
            # Leaf height = Door Height - Architrave (A1) - 3mm (top gap) - 7mm (floor gap) = d_h - a1 - 10.0 mm
            # In base template: 2100 - 40 - 10 = 2050 mm
            delta_h_leaf = (d_h - a1 - 10.0) - 2050.0

            # Ground-truth multi-zone vertical shifts derived from Hind_Jamb_test.dxf
            dy_zone1 = delta_h_post
            dy_zone2 = delta_h_post - delta_a1
            dy_zone3 = delta_h_post - delta_a1 - delta_r2
            dy_zone4 = delta_h_post - delta_a1 - delta_r2 + delta_a2

            def stretch_hpost(x, y):
                dx = 0.0
                if x > 6.0:   dx += delta_s1
                if x > 30.0:  dx += delta_a1
                if x > 139.0: dx += delta_r2
                if x > 200.0: dx += delta_d / 2.0
                if x > 270.0: dx += delta_d / 2.0
                if x > 355.0: dx += delta_a2
                if x > 394.0: dx += delta_s2
                
                dy = 0.0
                if y > 2000.0:
                    if x <= 15.5:
                        dy = dy_zone1
                    elif x <= 139.0:
                        dy = dy_zone2
                    elif x <= 355.0:
                        dy = dy_zone3
                    else:
                        dy = dy_zone4
                elif y > 1300.0:
                    if x <= 139.0:
                        # Upper hinges H3, H4 and screw holes (aligned with rabbet top drop)
                        dy = dy_zone2
                    elif 200.0 <= x <= 250.0:
                        # Wall anchor holes on web MD
                        if y > 1600.0:
                            dy = dy_zone3
                        else:
                            dy = ((1951.5 + dy_zone3 - 150.0) * (2.0 / 3.0) + 150.0) - 1351.0
                elif 500.0 <= y <= 1200.0:
                    if x <= 139.0:
                        # Middle hinge H3 (exact midpoint between H2 and H4)
                        dy = dy_zone2 / 2.0
                    elif 200.0 <= x <= 250.0:
                        # Wall anchor hole 2 (proportional 1/3 spacing)
                        dy = ((1951.5 + dy_zone3 - 150.0) * (1.0 / 3.0) + 150.0) - 750.5
                return x + dx, y + dy

            def stretch_lpost(x, y):
                dx = 0.0
                if x > 6.0:   dx += delta_s2
                if x > 40.0:  dx += delta_a2
                if x > 130.0: dx += delta_d / 2.0
                if x > 200.0: dx += delta_d / 2.0
                if x > 261.0: dx += delta_r2
                if x > 368.0: dx += delta_a1
                if x > 394.0: dx += delta_s1
                
                dy = 0.0
                if y > 2000.0:
                    if x <= 46.0:
                        dy = dy_zone4
                    elif x <= 261.0:
                        dy = dy_zone3
                    elif x <= 385.0:
                        dy = dy_zone2
                    else:
                        dy = dy_zone1
                elif y > 1300.0:
                    if 140.0 <= x <= 190.0:
                        if y > 1600.0:
                            dy = dy_zone3
                        else:
                            dy = ((1951.5 + dy_zone3 - 150.0) * (2.0 / 3.0) + 150.0) - 1351.0
                elif 500.0 <= y <= 1200.0:
                    if 140.0 <= x <= 190.0:
                        dy = ((1951.5 + dy_zone3 - 150.0) * (1.0 / 3.0) + 150.0) - 750.5
                return x + dx, y + dy

            def stretch_header(x, y):
                dx = delta_w_head if x > 500.0 else 0.0
                if y >= 385.5:
                    if x < 50.0:
                        dx -= delta_a1
                    elif x > 1025.0:
                        dx += delta_a1
                elif y <= 15.5:
                    if x < 50.0:
                        dx -= delta_a2
                    elif x > 1025.0:
                        dx += delta_a2
                elif 261.0 <= y <= 275.0:
                    # R2 miter expansion on Header (preserving 45.00° angle):
                    if x < 70.0:
                        dx -= delta_r2
                    elif x > 1000.0:
                        dx += delta_r2

                dy = 0.0
                if y > 6.0:   dy += delta_s2
                if y > 40.0:  dy += delta_a2
                if y > 130.0: dy += delta_d / 2.0
                if y > 200.0: dy += delta_d / 2.0
                if y > 261.0: dy += delta_r2
                if y > 368.0: dy += delta_a1
                if y > 394.0: dy += delta_s1
                fx = x + dx
                fy = y + dy
                if is_rh:
                    fx = (1075.0 + delta_w_head) - fx
                return fx, fy

            cur_hpost_ents = hpost_ents
            cur_lpost_ents = lpost_ents
            cur_header_ents = header_ents
            cur_hp_ox, cur_hp_oy = p17_min_x, 0.0
            cur_lp_ox, cur_lp_oy = p32_min_x, 0.0
            cur_hd_ox, cur_hd_oy = head_min_x, head_min_y
            cur_is_outline_post = lambda pts: len(pts) == 44
            cur_is_outline_head = lambda pts: len(pts) == 44
            cur_flip_bulge_post = False
            cur_flip_bulge_head = is_rh

        # Drop seal option
        has_drop_seal = bool(door.get("drop_seal")) or (str(door.get("qashatah") or "").upper() in ("YES", "TRUE", "1", "نعم"))

        # Single Leaf Stretch Parameters (exact rules: width = frame - 2*A1 - 7mm, unfolded = width + 140.12mm, height = door - A1 - 10mm)
        target_single_leaf_w = d_w - (2.0 * a1) - 7.0
        target_single_leaf_unfolded = target_single_leaf_w + 140.12
        target_single_leaf_h = d_h - a1 - 10.0
        delta_w_leaf1 = target_single_leaf_unfolded - 1129.926
        delta_w_leaf2 = delta_w_leaf1
        delta_h_single_leaf = target_single_leaf_h - 2113.500

        def stretch_leaf1(x, y):
            dx = delta_w_leaf1 if x > 500.0 else 0.0
            dy = 0.0
            if y > 1500.0:
                dy = delta_h_single_leaf
            elif 500.0 <= y <= 1400.0 and x < 200.0:
                # Hinge #3 is exactly centered between Hinge #2 and Hinge #4
                dy = delta_h_single_leaf / 2.0
            fx = x + dx
            fy = y + dy
            if is_rh:
                fx = (1129.926 + delta_w_leaf1) - fx
            return fx, fy

        def stretch_leaf2(x, y):
            dx = delta_w_leaf2 if x > 500.0 else 0.0
            dy = delta_h_single_leaf if y > 1500.0 else 0.0
            fx = x + dx
            fy = y + dy
            if is_rh:
                fx = (1016.810 + delta_w_leaf2) - fx
            return fx, fy

        # Double Leaf Stretch Parameters (exact rules from Double_leaf.dxf: base leaf w = 1052.50, h = 2190.00)
        target_dl_w = (d_w - (2.0 * a1) - 15.0) / 2.0
        target_dl_h = d_h - a1 - 10.0
        delta_w_dl = target_dl_w - 1052.50
        delta_h_dl = target_dl_h - 2190.00

        def stretch_dl_a4(x, y):
            dx = delta_w_dl if x > 500.0 else 0.0
            dy = 0.0
            if y > 1500.0:
                dy = delta_h_dl
            elif 500.0 <= y <= 1400.0 and x < 200.0:
                dy = delta_h_dl / 2.0
            fx = x + dx
            fy = y + dy
            if is_double_la:
                fx = (1186.835 + delta_w_dl) - fx
            return fx, fy

        def stretch_dl_a3(x, y):
            dx = delta_w_dl if x > 500.0 else 0.0
            dy = delta_h_dl if y > 1500.0 else 0.0
            fx = x + dx
            fy = y + dy
            if is_double_la:
                fx = (1104.363 + delta_w_dl) - fx
            return fx, fy

        def stretch_dl_a2(x, y):
            dx = delta_w_dl if x > 500.0 else 0.0
            dy = delta_h_dl if y > 1500.0 else 0.0
            fx = x + dx
            fy = y + dy
            if is_double_la:
                fx = (1132.149 + delta_w_dl) - fx
            return fx, fy

        def stretch_dl_a1(x, y):
            dx = delta_w_dl if x > 500.0 else 0.0
            dy = 0.0
            if y > 1500.0:
                dy = delta_h_dl
            elif 500.0 <= y <= 1400.0 and x > 900.0:
                dy = delta_h_dl / 2.0
            fx = x + dx
            fy = y + dy
            if is_double_la:
                fx = (1157.800 + delta_w_dl) - fx
            return fx, fy

        def populate_block(block, ents, ox, oy, stretch_fn, is_outline_fn, flip_bulge=False, is_leaf=False):
            seen = set()
            for e in ents:
                # If leaf and drop seal is NOT requested, skip bottom drop seal cutouts and degenerate corner lines
                if is_leaf and not has_drop_seal:
                    t = e.dxftype()
                    if t == 'LWPOLYLINE':
                        pts = e.get_points()
                        xs = [p[0] - ox for p in pts]
                        ys = [p[1] - oy for p in pts]
                        w = max(xs) - min(xs)
                        h = max(ys) - min(ys)
                        min_y = min(ys)
                        if 10.0 <= w <= 20.0 and 25.0 <= h <= 35.0 and min_y < 50.0:
                            continue
                    elif t == 'LINE':
                        y1 = e.dxf.start.y - oy
                        y2 = e.dxf.end.y - oy
                        if y1 < 10.0 and y2 < 10.0:
                            if abs(e.dxf.start.x - e.dxf.end.x) < 0.1 and abs(e.dxf.start.y - e.dxf.end.y) < 0.1:
                                continue

                t = e.dxftype()
                if t == 'LWPOLYLINE':
                    pts = e.get_points()
                    new_pts = []
                    for p in pts:
                        nx, ny = stretch_fn(p[0] - ox, p[1] - oy)
                        if len(p) >= 5:
                            b = -p[4] if flip_bulge else p[4]
                            new_pts.append((nx, ny, p[2], p[3], b))
                        else:
                            new_pts.append((nx, ny))
                    is_out = is_outline_fn(pts)
                    if not is_out:
                        k = ('LWPOLYLINE', tuple((round(p[0], 2), round(p[1], 2)) for p in new_pts))
                        if k in seen:
                            continue
                        seen.add(k)
                    layer = 'OUTLINE' if is_out else ('CUTOUTS' if len(pts) in (4, 8, 12, 14, 24) and max(abs(p[0]-pts[0][0]) for p in pts) > 10 else 'NOTCHES')
                    block.add_lwpolyline(new_pts, close=e.closed, dxfattribs={'layer': layer})
                elif t == 'LINE':
                    nx1, ny1 = stretch_fn(e.dxf.start.x - ox, e.dxf.start.y - oy)
                    nx2, ny2 = stretch_fn(e.dxf.end.x - ox, e.dxf.end.y - oy)
                    p1 = (round(nx1, 2), round(ny1, 2))
                    p2 = (round(nx2, 2), round(ny2, 2))
                    k = ('LINE', tuple(sorted([p1, p2])))
                    if k in seen:
                        continue
                    seen.add(k)
                    block.add_line((nx1, ny1), (nx2, ny2), dxfattribs={'layer': 'NOTCHES'})
                elif t == 'CIRCLE':
                    ncx, ncy = stretch_fn(e.dxf.center.x - ox, e.dxf.center.y - oy)
                    k = ('CIRCLE', (round(ncx, 2), round(ncy, 2)), round(e.dxf.radius, 2))
                    if k in seen:
                        continue
                    seen.add(k)
                    block.add_circle((ncx, ncy), radius=e.dxf.radius, dxfattribs={'layer': 'HOLES'})

        def normalize_block(block):
            xs, ys = [], []
            for ent in block:
                if ent.dxftype() == 'LWPOLYLINE' and ent.dxf.layer == 'OUTLINE':
                    for p in ent.get_points():
                        xs.append(p[0])
                        ys.append(p[1])
            if not xs:
                for ent in block:
                    if ent.dxftype() == 'LWPOLYLINE':
                        for p in ent.get_points():
                            xs.append(p[0])
                            ys.append(p[1])
            if not xs:
                return 0.0, 100.0, 0.0, 100.0
            shift_x = min(xs)
            shift_y = min(ys)
            if abs(shift_x) > 1e-4 or abs(shift_y) > 1e-4:
                for ent in block:
                    t = ent.dxftype()
                    if t == 'LWPOLYLINE':
                        new_pts = []
                        for p in ent.get_points():
                            if len(p) >= 5:
                                new_pts.append((p[0] - shift_x, p[1] - shift_y, p[2], p[3], p[4]))
                            else:
                                new_pts.append((p[0] - shift_x, p[1] - shift_y))
                        ent.set_points(new_pts)
                    elif t == 'LINE':
                        ent.dxf.start = (ent.dxf.start.x - shift_x, ent.dxf.start.y - shift_y, ent.dxf.start.z)
                        ent.dxf.end = (ent.dxf.end.x - shift_x, ent.dxf.end.y - shift_y, ent.dxf.end.z)
                    elif t == 'CIRCLE':
                        ent.dxf.center = (ent.dxf.center.x - shift_x, ent.dxf.center.y - shift_y, ent.dxf.center.z)
            w = max(xs) - shift_x
            h = max(ys) - shift_y
            return 0.0, w, 0.0, h

        if is_double:
            # -----------------
            # DOUBLE DOOR FRAME: 2 HINGE POSTS (LH and RH) + 1 HEADER
            # -----------------
            b_hpost_name = f"B_{d_name}_HINGE_POST_LH"
            b_hpost = doc_out.blocks.new(name=b_hpost_name)
            populate_block(b_hpost, cur_hpost_ents, cur_hp_ox, cur_hp_oy, stretch_hpost, cur_is_outline_post, flip_bulge=cur_flip_bulge_post)
            min_x, hpost_w, min_y, hpost_h = normalize_block(b_hpost)
            lbl = b_hpost.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 28.0})
            lbl.set_placement((hpost_w / 2.0, hpost_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_lpost_name = f"B_{d_name}_HINGE_POST_RH"
            b_lpost = doc_out.blocks.new(name=b_lpost_name)
            def stretch_hpost_rh(x, y):
                sx, sy = stretch_hpost(x, y)
                return (hpost_w - sx), sy
            populate_block(b_lpost, cur_hpost_ents, cur_hp_ox, cur_hp_oy, stretch_hpost_rh, cur_is_outline_post, flip_bulge=True)
            min_x, lpost_w, min_y, lpost_h = normalize_block(b_lpost)
            lbl = b_lpost.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 28.0})
            lbl.set_placement((lpost_w / 2.0, lpost_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_head_name = f"B_{d_name}_HEADER"
            b_head = doc_out.blocks.new(name=b_head_name)
            populate_block(b_head, cur_header_ents, cur_hd_ox, cur_hd_oy, stretch_header, cur_is_outline_head, flip_bulge=cur_flip_bulge_head)
            min_x, head_len, min_y, head_unfolded_w = normalize_block(b_head)
            lbl = b_head.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 28.0})
            lbl.set_placement((head_len / 2.0, head_unfolded_w / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            # -----------------
            # DOUBLE LEAF 4 PIECES: A4, A3, A2, A1
            # -----------------
            is_dl_outline = lambda pts: len(pts) >= 4 and (max(p[1] for p in pts) - min(p[1] for p in pts)) > 2000

            b_a4_name = f"B_{d_name}_LEAF_A4"
            b_a4 = doc_out.blocks.new(name=b_a4_name)
            populate_block(b_a4, dl_a4_ents, 0.0, 0.0, stretch_dl_a4, is_dl_outline, flip_bulge=is_double_la, is_leaf=True)
            min_x, a4_w, min_y, a4_h = normalize_block(b_a4)
            lbl = b_a4.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 35.0})
            lbl.set_placement((a4_w / 2.0, a4_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_a3_name = f"B_{d_name}_LEAF_A3"
            b_a3 = doc_out.blocks.new(name=b_a3_name)
            populate_block(b_a3, dl_a3_ents, 1418.723, 0.0, stretch_dl_a3, is_dl_outline, flip_bulge=is_double_la, is_leaf=True)
            min_x, a3_w, min_y, a3_h = normalize_block(b_a3)
            lbl = b_a3.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 35.0})
            lbl.set_placement((a3_w / 2.0, a3_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_a2_name = f"B_{d_name}_LEAF_A2"
            b_a2 = doc_out.blocks.new(name=b_a2_name)
            populate_block(b_a2, dl_a2_ents, 2777.520, 0.0, stretch_dl_a2, is_dl_outline, flip_bulge=is_double_la, is_leaf=True)
            min_x, a2_w, min_y, a2_h = normalize_block(b_a2)
            lbl = b_a2.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 35.0})
            lbl.set_placement((a2_w / 2.0, a2_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_a1_name = f"B_{d_name}_LEAF_A1"
            b_a1 = doc_out.blocks.new(name=b_a1_name)
            populate_block(b_a1, dl_a1_ents, 4031.566, 0.0, stretch_dl_a1, is_dl_outline, flip_bulge=is_double_la, is_leaf=True)
            min_x, a1_w, min_y, a1_h = normalize_block(b_a1)
            lbl = b_a1.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 35.0})
            lbl.set_placement((a1_w / 2.0, a1_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            # UPPER SECTION INSERTS (Side-by-side door preview)
            msp.add_blockref(b_hpost_name, (current_x, 0.0))
            offset_x = current_x + hpost_w + 150.0
            msp.add_blockref(b_lpost_name, (offset_x, 0.0))
            offset_x += lpost_w + 150.0
            msp.add_blockref(b_head_name, (offset_x, 0.0))
            offset_x += head_len + 250.0
            msp.add_blockref(b_a4_name, (offset_x, 0.0))
            offset_x += a4_w + 200.0
            msp.add_blockref(b_a3_name, (offset_x, 0.0))
            offset_x += a3_w + 200.0
            msp.add_blockref(b_a2_name, (offset_x, 0.0))
            offset_x += a2_w + 200.0
            msp.add_blockref(b_a1_name, (offset_x, 0.0))
            offset_x += a1_w

            current_x = offset_x + 500.0

            # Register for Nesting
            nesting_parts_1_5.append({"w": hpost_w, "h": hpost_h, "orig_w": hpost_w, "orig_h": hpost_h, "block": b_hpost_name, "door": d_name})
            nesting_parts_1_5.append({"w": lpost_w, "h": lpost_h, "orig_w": lpost_w, "orig_h": lpost_h, "block": b_lpost_name, "door": d_name})
            nesting_parts_1_5.append({"w": head_len, "h": head_unfolded_w, "orig_w": head_len, "orig_h": head_unfolded_w, "block": b_head_name, "door": d_name})

            nesting_parts_1_2.append({"w": a4_w, "h": a4_h, "orig_w": a4_w, "orig_h": a4_h, "block": b_a4_name, "door": d_name})
            nesting_parts_1_2.append({"w": a3_w, "h": a3_h, "orig_w": a3_w, "orig_h": a3_h, "block": b_a3_name, "door": d_name})
            nesting_parts_1_2.append({"w": a2_w, "h": a2_h, "orig_w": a2_w, "orig_h": a2_h, "block": b_a2_name, "door": d_name})
            nesting_parts_1_2.append({"w": a1_w, "h": a1_h, "orig_w": a1_w, "orig_h": a1_h, "block": b_a1_name, "door": d_name})
        else:
            # -----------------
            # SINGLE DOOR: HINGE POST + LOCK POST + HEADER + LEAF 1 + LEAF 2
            # -----------------
            b_hpost_name = f"B_{d_name}_HINGE_POST"
            b_hpost = doc_out.blocks.new(name=b_hpost_name)
            populate_block(b_hpost, cur_hpost_ents, cur_hp_ox, cur_hp_oy, stretch_hpost, cur_is_outline_post, flip_bulge=cur_flip_bulge_post)
            min_x, hpost_w, min_y, hpost_h = normalize_block(b_hpost)
            lbl = b_hpost.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 28.0})
            lbl.set_placement((hpost_w / 2.0, hpost_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_lpost_name = f"B_{d_name}_LOCK_POST"
            b_lpost = doc_out.blocks.new(name=b_lpost_name)
            populate_block(b_lpost, cur_lpost_ents, cur_lp_ox, cur_lp_oy, stretch_lpost, cur_is_outline_post, flip_bulge=cur_flip_bulge_post)
            min_x, lpost_w, min_y, lpost_h = normalize_block(b_lpost)
            lbl = b_lpost.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 28.0})
            lbl.set_placement((lpost_w / 2.0, lpost_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_head_name = f"B_{d_name}_HEADER"
            b_head = doc_out.blocks.new(name=b_head_name)
            populate_block(b_head, cur_header_ents, cur_hd_ox, cur_hd_oy, stretch_header, cur_is_outline_head, flip_bulge=cur_flip_bulge_head)
            min_x, head_len, min_y, head_unfolded_w = normalize_block(b_head)
            lbl = b_head.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 28.0})
            lbl.set_placement((head_len / 2.0, head_unfolded_w / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_l1_name = f"B_{d_name}_LEAF1"
            b_l1 = doc_out.blocks.new(name=b_l1_name)
            populate_block(b_l1, l1_ents, l1_min_x, l1_min_y, stretch_leaf1, lambda pts: len(pts) == 4 and (max(p[0] for p in pts) - min(p[0] for p in pts)) > 500, flip_bulge=is_rh, is_leaf=True)
            min_x, leaf1_w, min_y, leaf1_h = normalize_block(b_l1)
            lbl = b_l1.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 35.0})
            lbl.set_placement((leaf1_w / 2.0, leaf1_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            b_l2_name = f"B_{d_name}_LEAF2"
            b_l2 = doc_out.blocks.new(name=b_l2_name)
            populate_block(b_l2, l2_ents, l2_min_x, l2_min_y, stretch_leaf2, lambda pts: len(pts) == 4 and (max(p[0] for p in pts) - min(p[0] for p in pts)) > 500, flip_bulge=is_rh, is_leaf=True)
            min_x, leaf2_w, min_y, leaf2_h = normalize_block(b_l2)
            lbl = b_l2.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 35.0})
            lbl.set_placement((leaf2_w / 2.0, leaf2_h / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

            # UPPER SECTION INSERTS (Side-by-side door preview)
            msp.add_blockref(b_hpost_name, (current_x, 0.0))
            lock_offset_x = current_x + hpost_w + 150.0
            msp.add_blockref(b_lpost_name, (lock_offset_x, 0.0))
            header_offset_x = lock_offset_x + lpost_w + 150.0
            msp.add_blockref(b_head_name, (header_offset_x, 0.0))
            leaf1_offset_x = header_offset_x + head_len + 250.0
            msp.add_blockref(b_l1_name, (leaf1_offset_x, 0.0))
            leaf2_offset_x = leaf1_offset_x + leaf1_w + 250.0
            msp.add_blockref(b_l2_name, (leaf2_offset_x, 0.0))
            
            current_x = leaf2_offset_x + leaf2_w + 500.0

            # Register for Nesting (exact bounding boxes for zero gap between pieces)
            nesting_parts_1_5.append({"w": hpost_w, "h": hpost_h, "orig_w": hpost_w, "orig_h": hpost_h, "block": b_hpost_name, "door": d_name})
            nesting_parts_1_5.append({"w": lpost_w, "h": lpost_h, "orig_w": lpost_w, "orig_h": lpost_h, "block": b_lpost_name, "door": d_name})
            nesting_parts_1_5.append({"w": head_len, "h": head_unfolded_w, "orig_w": head_len, "orig_h": head_unfolded_w, "block": b_head_name, "door": d_name})
            
            nesting_parts_1_2.append({"w": leaf1_w, "h": leaf1_h, "orig_w": leaf1_w, "orig_h": leaf1_h, "block": b_l1_name, "door": d_name})
            nesting_parts_1_2.append({"w": leaf2_w, "h": leaf2_h, "orig_w": leaf2_w, "orig_h": leaf2_h, "block": b_l2_name, "door": d_name})

        # -------------------------------------------------------------
        # FABRICATED ACCESSORIES (Anchor Support, Leaf U Channel, Frame Support)
        # -------------------------------------------------------------
        fr = str(door.get("fire_resistance") or "").strip().lower()
        is_fire_rated = bool(fr) and fr not in ("no", "none", "false", "0", "غير مقاوم", "لا", "")

        # 1. ANCHOR SUPPORT (8 pieces per frame)
        # Width = frame depth - 13mm, Height = 58.267mm
        # Circle diam 12mm at distance (depth / 2) + 19.5mm from end
        w_anchor = d_d - 13.0
        h_anchor = 58.267477
        b_anchor_name = f"B_{d_name}_ANCHOR_SUPPORT"
        b_anchor = doc_out.blocks.new(name=b_anchor_name)
        b_anchor.add_lwpolyline([(0.0, 0.0), (0.0, h_anchor), (w_anchor, h_anchor), (w_anchor, 0.0)], close=True, dxfattribs={'layer': 'OUTLINE'})
        b_anchor.add_circle(((d_d / 2.0) + 19.5, h_anchor / 2.0), radius=6.0, dxfattribs={'layer': 'HOLES'})
        lbl_as = b_anchor.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 12.0})
        lbl_as.set_placement((w_anchor / 2.0, h_anchor / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

        # 2. LEAF U CHANNEL (3 pieces per leaf: 2 with holes, 1 plain)
        # Length = leaf width - 4mm, Height = 72.066mm
        if is_double:
            leaf_net_w = (d_w - (2.0 * a1) - 15.0) / 2.0
            num_uchannel_sets = 2
        else:
            leaf_net_w = d_w - (2.0 * a1) - 7.0
            num_uchannel_sets = 1
        
        l_uchannel = leaf_net_w - 4.0
        delta_lc = l_uchannel - 909.10
        h_uchannel = 72.0661

        uchannel_base_pts = [
            (909.1, 51.5331), (887.85, 51.5331), (885.85, 53.5331), (885.85, 72.0661),
            (23.25, 72.0661), (23.25, 53.5331), (21.25, 51.5331), (0.0, 51.5331),
            (0.0, 18.0331), (1.05, 18.0331), (1.05, 0.0), (908.05, 0.0),
            (908.05, 18.0331), (909.1, 18.0331)
        ]
        s_uchannel_pts = [(p[0] + delta_lc if p[0] > 500.0 else p[0], p[1]) for p in uchannel_base_pts]

        b_uch_name = f"B_{d_name}_LEAF_UCHANNEL_H"
        b_uch = doc_out.blocks.new(name=b_uch_name)
        b_uch.add_lwpolyline(s_uchannel_pts, close=True, dxfattribs={'layer': 'OUTLINE'})
        b_uch.add_circle((95.0, 36.0331), radius=11.0, dxfattribs={'layer': 'HOLES'})
        b_uch.add_circle((817.3658 + delta_lc, 36.0331), radius=11.0, dxfattribs={'layer': 'HOLES'})
        lbl_uch = b_uch.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 20.0})
        lbl_uch.set_placement((l_uchannel / 2.0, h_uchannel / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

        b_ucp_name = f"B_{d_name}_LEAF_UCHANNEL_P"
        b_ucp = doc_out.blocks.new(name=b_ucp_name)
        b_ucp.add_lwpolyline(s_uchannel_pts, close=True, dxfattribs={'layer': 'OUTLINE'})
        lbl_ucp = b_ucp.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 20.0})
        lbl_ucp.set_placement((l_uchannel / 2.0, h_uchannel / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

        # 3. FRAME SUPPORT (1 set = 2 pieces per frame)
        # Width = door width - 54mm
        l_framesup = d_w - 54.0
        delta_w_fs = d_w - 1000.0
        
        fs1_base_pts = [
            (943.0, 28.6337), (933.0, 28.6337), (933.0, 31.1337), (923.0, 31.1337),
            (923.0, 34.1337), (23.0, 34.1337), (23.0, 31.1337), (13.0, 31.1337),
            (13.0, 28.6337), (3.0, 28.6337), (0.0, 25.6337), (0.0, 21.6337),
            (3.0, 18.6337), (13.0, 18.6337), (13.0, 16.1337), (23.0, 16.1337),
            (23.0, 0.0), (923.0, 0.0), (923.0, 16.1337), (933.0, 16.1337),
            (933.0, 18.6337), (943.0, 18.6337), (946.0, 21.6337), (946.0, 25.6337)
        ]
        s_fs1_pts = [(p[0] + delta_w_fs if p[0] > 500.0 else p[0], p[1]) for p in fs1_base_pts]

        b_fs1_name = f"B_{d_name}_FRAME_SUPPORT_1"
        b_fs1 = doc_out.blocks.new(name=b_fs1_name)
        b_fs1.add_lwpolyline(s_fs1_pts, close=True, dxfattribs={'layer': 'OUTLINE'})
        lbl_fs1 = b_fs1.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 15.0})
        lbl_fs1.set_placement((l_framesup / 2.0, 34.1337 / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

        fs2_base_pts = [
            (943.0, 43.6337), (933.0, 43.6337), (933.0, 41.1337), (923.0, 41.1337),
            (923.0, 25.1337), (901.0, 25.1337), (901.0, 0.0), (45.0, 0.0),
            (45.0, 25.1337), (23.0, 25.1337), (23.0, 41.1337), (13.0, 41.1337),
            (13.0, 43.6337), (3.0, 43.6337), (0.0, 46.6337), (0.0, 50.6337),
            (3.0, 53.6337), (13.0, 53.6337), (13.0, 56.1337), (933.0, 56.1337),
            (933.0, 53.6337), (943.0, 53.6337), (946.0, 50.6337), (946.0, 46.6337)
        ]
        s_fs2_pts = [(p[0] + delta_w_fs if p[0] > 500.0 else p[0], p[1]) for p in fs2_base_pts]

        b_fs2_name = f"B_{d_name}_FRAME_SUPPORT_2"
        b_fs2 = doc_out.blocks.new(name=b_fs2_name)
        b_fs2.add_lwpolyline(s_fs2_pts, close=True, dxfattribs={'layer': 'OUTLINE'})
        lbl_fs2 = b_fs2.add_text(piece_label, dxfattribs={'layer': 'PART_LABELS', 'height': 16.0})
        lbl_fs2.set_placement((l_framesup / 2.0, 56.1337 / 2.0), align=TextEntityAlignment.MIDDLE_CENTER)

        # Place accessories in upper preview
        # Frame Support
        msp.add_blockref(b_fs1_name, (current_x, 0.0))
        msp.add_blockref(b_fs2_name, (current_x, 60.0))
        current_x += l_framesup + 200.0

        # Leaf U Channels
        for s_i in range(num_uchannel_sets):
            msp.add_blockref(b_uch_name, (current_x, 0.0))
            msp.add_blockref(b_uch_name, (current_x, 90.0))
            msp.add_blockref(b_ucp_name, (current_x, 180.0))
            current_x += l_uchannel + 200.0

        # Anchor Supports (8 pieces in 2 cols x 4 rows)
        for i in range(8):
            c_col = i // 4
            c_row = i % 4
            msp.add_blockref(b_anchor_name, (current_x + c_col * (w_anchor + 30.0), c_row * 75.0))
        current_x += 2 * (w_anchor + 30.0) + 400.0

        # Register accessories for Nesting
        # 1. Anchor Support: 8 pieces
        for _ in range(8):
            as_dict = {"w": w_anchor, "h": h_anchor, "orig_w": w_anchor, "orig_h": h_anchor, "block": b_anchor_name, "door": d_name}
            if is_fire_rated:
                nesting_parts_4_0.append(as_dict)
            else:
                nesting_parts_1_5.append(as_dict)

        # 2. Leaf U Channel: 3 pieces per leaf (2 with holes, 1 plain)
        for _ in range(num_uchannel_sets):
            for _ in range(2):
                uch_dict = {"w": l_uchannel, "h": h_uchannel, "orig_w": l_uchannel, "orig_h": h_uchannel, "block": b_uch_name, "door": d_name}
                if is_fire_rated:
                    nesting_parts_1_5.append(uch_dict)
                else:
                    nesting_parts_1_2.append(uch_dict)
            ucp_dict = {"w": l_uchannel, "h": h_uchannel, "orig_w": l_uchannel, "orig_h": h_uchannel, "block": b_ucp_name, "door": d_name}
            if is_fire_rated:
                nesting_parts_1_5.append(ucp_dict)
            else:
                nesting_parts_1_2.append(ucp_dict)

        # 3. Frame Support: 2 pieces (34.13 and 56.13)
        nesting_parts_1_2.append({"w": l_framesup, "h": 34.1337, "orig_w": l_framesup, "orig_h": 34.1337, "block": b_fs1_name, "door": d_name})
        nesting_parts_1_2.append({"w": l_framesup, "h": 56.1337, "orig_w": l_framesup, "orig_h": 56.1337, "block": b_fs2_name, "door": d_name})

    # -----------------------------------------------------------------
    # MINIMUM AREA NESTING OPTIMIZER (0.000 mm gap between parts)
    # -----------------------------------------------------------------
    def pack_parts_min_area(parts, bin_sizes):
        import itertools
        best_sheets = None
        min_total_area = float('inf')
        
        for num_bins in range(1, 7):
            combos = list(itertools.combinations_with_replacement(bin_sizes, num_bins))
            combos.sort(key=lambda c: sum(b[0]*b[1] for b in c))
            
            for combo in combos:
                combo_area = sum(b[0]*b[1] for b in combo)
                if combo_area >= min_total_area:
                    continue
                    
                packer = newPacker(mode=PackingMode.Offline, bin_algo=PackingBin.BBF, rotation=True, sort_algo=SORT_AREA)
                for p in parts:
                    packer.add_rect(p["orig_w"], p["orig_h"], rid=p)
                for bw, bh in combo:
                    packer.add_bin(bw, bh)
                packer.pack()
                
                if sum(len(b) for b in packer) == len(parts):
                    packed_sheets = []
                    for b in packer:
                        if len(b) == 0: continue
                        s_data = {"width": b.width, "height": b.height, "rects": []}
                        for rect in b:
                            s_data["rects"].append({
                                "x": rect.x,
                                "y": rect.y,
                                "w": rect.width,
                                "h": rect.height,
                                "part": rect.rid
                            })
                        packed_sheets.append(s_data)
                    best_sheets = packed_sheets
                    min_total_area = combo_area
                    break
            if best_sheets is not None:
                break
                
        return best_sheets if best_sheets is not None else []

    sheets_1_5 = pack_parts_min_area(nesting_parts_1_5, sheet_sizes_1_5)
    sheets_1_2 = pack_parts_min_area(nesting_parts_1_2, sheet_sizes_1_2)
    sheets_4_0 = pack_parts_min_area(nesting_parts_4_0, sheet_sizes_4_0) if nesting_parts_4_0 else []

    # -----------------------------------------------------------------
    # DRAW NESTED SHEETS (0.000 mm gap, clean labels)
    # -----------------------------------------------------------------
    nest_y_1_5 = -3500.0
    nest_x = 0.0
    
    for s_idx, sheet in enumerate(sheets_1_5):
        sw = sheet["width"]
        sh = sheet["height"]
        
        msp.add_lwpolyline([(nest_x, nest_y_1_5), (nest_x + sw, nest_y_1_5), (nest_x + sw, nest_y_1_5 + sh), (nest_x, nest_y_1_5 + sh)], close=True, dxfattribs={'layer': 'SHEETS_1_5'})
        
        for r in sheet["rects"]:
            part = r["part"]
            px = nest_x + r["x"]
            py = nest_y_1_5 + r["y"]
            
            is_rotated = abs(r["w"] - part["orig_h"]) < abs(r["w"] - part["orig_w"])
            if is_rotated:
                msp.add_blockref(part["block"], (px + r["w"], py), dxfattribs={'rotation': 90.0})
            else:
                msp.add_blockref(part["block"], (px, py), dxfattribs={'rotation': 0.0})
                
        s_label = f"Sheet 1.5mm #{s_idx+1} ({int(sw/10)}x{int(sh/10)} cm)"
        msp.add_text(s_label, dxfattribs={'layer': 'TEXT', 'height': 40.0, 'insert': (nest_x, nest_y_1_5 - 80.0)})
        
        nest_x += sw + 250.0

    # DRAW 1.2mm SHEETS
    nest_y_1_2 = nest_y_1_5 - 3200.0
    nest_x_1_2 = 0.0
    
    for s_idx, sheet in enumerate(sheets_1_2):
        sw = sheet["width"]
        sh = sheet["height"]
        
        msp.add_lwpolyline([(nest_x_1_2, nest_y_1_2), (nest_x_1_2 + sw, nest_y_1_2), (nest_x_1_2 + sw, nest_y_1_2 + sh), (nest_x_1_2, nest_y_1_2 + sh)], close=True, dxfattribs={'layer': 'SHEETS_1_2'})
        
        for r in sheet["rects"]:
            part = r["part"]
            px = nest_x_1_2 + r["x"]
            py = nest_y_1_2 + r["y"]
            is_rotated = abs(r["w"] - part["orig_h"]) < abs(r["w"] - part["orig_w"])
            if is_rotated:
                msp.add_blockref(part["block"], (px + r["w"], py), dxfattribs={'rotation': 90.0})
            else:
                msp.add_blockref(part["block"], (px, py), dxfattribs={'rotation': 0.0})
                
        s_label = f"Sheet 1.2mm #{s_idx+1} ({int(sw/10)}x{int(sh/10)} cm)"
        msp.add_text(s_label, dxfattribs={'layer': 'TEXT', 'height': 40.0, 'insert': (nest_x_1_2, nest_y_1_2 - 80.0)})
        
        nest_x_1_2 += sw + 250.0

    # DRAW 4.0mm SHEETS (if any fire-rated doors)
    if sheets_4_0:
        nest_y_4_0 = nest_y_1_2 - 3200.0
        nest_x_4_0 = 0.0
        for s_idx, sheet in enumerate(sheets_4_0):
            sw = sheet["width"]
            sh = sheet["height"]
            msp.add_lwpolyline([(nest_x_4_0, nest_y_4_0), (nest_x_4_0 + sw, nest_y_4_0), (nest_x_4_0 + sw, nest_y_4_0 + sh), (nest_x_4_0, nest_y_4_0 + sh)], close=True, dxfattribs={'layer': 'SHEETS_4_0'})
            for r in sheet["rects"]:
                part = r["part"]
                px = nest_x_4_0 + r["x"]
                py = nest_y_4_0 + r["y"]
                is_rotated = abs(r["w"] - part["orig_h"]) < abs(r["w"] - part["orig_w"])
                if is_rotated:
                    msp.add_blockref(part["block"], (px + r["w"], py), dxfattribs={'rotation': 90.0})
                else:
                    msp.add_blockref(part["block"], (px, py), dxfattribs={'rotation': 0.0})
            s_label = f"Sheet 4.0mm #{s_idx+1} ({int(sw/10)}x{int(sh/10)} cm)"
            msp.add_text(s_label, dxfattribs={'layer': 'TEXT', 'height': 40.0, 'insert': (nest_x_4_0, nest_y_4_0 - 80.0)})
            nest_x_4_0 += sw + 250.0

    doc_out.saveas(output_path)
    print(f"Generated V13 DXF with 100% Pure CAD STRETCH Engine: {output_path}")

if __name__ == '__main__':
    doors_from_erp = [
        {"name": "A1", "width": 1000.0, "height": 2100.0, "depth": 170.0, "direction": "RH", "architrave": 50.0, "architrave_2": 50.0, "s1": 20.0, "s2": 25.0, "r2": 14.5}
    ]
    available_sheets_1_5 = [(1000.0, 2300.0), (1250.0, 2300.0)]
    available_sheets_1_2 = [(1000.0, 2300.0), (1250.0, 2300.0)]
    
    generate_full_project_cad_dxf(
        template_path='cad_templates/single_rabbet_rubber_single.dxf',
        output_path='cad_templates/door_1000x2100x170_RH_45deg_v2.dxf',
        doors=doors_from_erp,
        sheet_sizes_1_5=available_sheets_1_5,
        sheet_sizes_1_2=available_sheets_1_2,
        project_number='PRJ-101'
    )

