import os, sys
import ezdxf

# Add workspace to path
sys.path.insert(0, r'c:\Users\hassa\Documents\ali\Factory-ERP')

from cad_templates.generate_dxf import generate_full_project_cad_dxf

doors = [
    {
        "name": "D_SR_LH",
        "width": 1000.0,
        "height": 2100.0,
        "depth": 150.0,
        "direction": "LH",
        "architrave": 40.0,
        "architrave_2": 62.0,
        "profile_type": "single rabbit with rubber",
        "door_type": "Single leaf metal"
    },
    {
        "name": "D_DR_LH",
        "width": 1000.0,
        "height": 2100.0,
        "depth": 160.0,
        "direction": "LH",
        "architrave": 50.0,
        "architrave_2": 50.0,
        "profile_type": "double rabbit with rubber",
        "door_type": "Single leaf metal"
    },
    {
        "name": "D_DR_RH_VAR",
        "width": 1100.0,
        "height": 2200.0,
        "depth": 180.0,
        "direction": "RH",
        "architrave": 50.0,
        "architrave_2": 50.0,
        "profile_type": "double rabbit with rubber",
        "door_type": "Single leaf metal"
    },
    {
        "name": "D_SRNR_LH",
        "width": 1000.0,
        "height": 2100.0,
        "depth": 150.0,
        "direction": "LH",
        "architrave": 55.0,
        "architrave_2": 40.0,
        "profile_type": "single rabbit without rubber",
        "door_type": "Single leaf metal"
    },
    {
        "name": "D_SRNR_RH_VAR",
        "width": 1150.0,
        "height": 2250.0,
        "depth": 175.0,
        "direction": "RH",
        "architrave": 60.0,
        "architrave_2": 45.0,
        "profile_type": "single rabbit without rubber",
        "door_type": "Single leaf metal"
    },
    {
        "name": "D_DRNR_LH_BASE",
        "width": 1000.0,
        "height": 2100.0,
        "depth": 150.0,
        "direction": "LH",
        "architrave": 40.0,
        "architrave_2": 40.0,
        "profile_type": "double rabbit without rubber",
        "door_type": "Single leaf metal"
    },
    {
        "name": "D_DRNR_RH_CUSTOM",
        "width": 1100.0,
        "height": 2200.0,
        "depth": 170.0,
        "direction": "RH",
        "architrave": 45.0,
        "architrave_2": 45.0,
        "profile_type": "double rabbit without rubber",
        "door_type": "Single leaf metal"
    },
    {
        "name": "D_DOUBLE_RA_BASE",
        "width": 2200.0,
        "height": 2240.0,
        "depth": 150.0,
        "direction": "D/RA",
        "architrave": 40.0,
        "architrave_2": 40.0,
        "profile_type": "double rabbit without rubber",
        "door_type": "Double leaf metal"
    },
    {
        "name": "D_DOUBLE_LA_CUSTOM",
        "width": 2000.0,
        "height": 2100.0,
        "depth": 160.0,
        "direction": "D/LA",
        "architrave": 40.0,
        "architrave_2": 50.0,
        "profile_type": "double rabbit with rubber",
        "door_type": "Double leaf metal"
    }
]

out_dxf = 'cad_templates/test_multi_profile_output.dxf'
print('Testing generate_full_project_cad_dxf with multi-profile and double leaf...')
generate_full_project_cad_dxf(
    template_path='cad_templates/single_rabbet_rubber_single.dxf',
    output_path=out_dxf,
    doors=doors,
    project_number="TEST-PRJ-01"
)
print('Generated successfully! File size:', os.path.getsize(out_dxf))

# Inspect generated blocks
doc = ezdxf.readfile(out_dxf)

print("\n--- SINGLE LEAF FIX VERIFICATION ---")
for bname in ["B_D_DRNR_LH_BASE_LEAF1", "B_D_DRNR_LH_BASE_LEAF2"]:
    if bname in doc.blocks:
        blk = doc.blocks[bname]
        polys = [e for e in blk if e.dxftype() == 'LWPOLYLINE']
        for p in polys:
            pts = p.get_points('xy')
            if len(pts) == 4 and (max(pt[0] for pt in pts) - min(pt[0] for pt in pts)) > 500:
                xs = [pt[0] for pt in pts]
                ys = [pt[1] for pt in pts]
                print(f"Block {bname}: width={max(xs)-min(xs):.3f}, height={max(ys)-min(ys):.3f}")

print("\n--- DOUBLE LEAF VERIFICATION ---")
for dname in ["D_DOUBLE_RA_BASE", "D_DOUBLE_LA_CUSTOM"]:
    print(f"\n=================== DOOR: {dname} ===================")
    for part in ["HINGE_POST_LH", "HINGE_POST_RH", "HEADER", "LEAF_A4", "LEAF_A3", "LEAF_A2", "LEAF_A1"]:
        bname = f"B_{dname}_{part}"
        if bname in doc.blocks:
            blk = doc.blocks[bname]
            ents = list(blk)
            # Find bounding box of outline
            all_pts = []
            for e in ents:
                if e.dxftype() == 'LWPOLYLINE':
                    all_pts.extend(e.get_points('xy'))
                elif e.dxftype() == 'LINE':
                    all_pts.append((e.dxf.start.x, e.dxf.start.y))
                    all_pts.append((e.dxf.end.x, e.dxf.end.y))
            if all_pts:
                xs = [pt[0] for pt in all_pts]
                ys = [pt[1] for pt in all_pts]
                print(f"  {part:14s}: width={max(xs)-min(xs):8.3f}, height={max(ys)-min(ys):8.3f}, ents={len(ents)}")



