import re
from rectpack import newPacker, PackingMode, PackingBin, SORT_AREA
import models

def parse_dimension(dim_str):
    if not dim_str:
        return 0.0
    # Find the first floating point number in the string
    match = re.search(r'[-+]?\d*\.\d+|\d+', str(dim_str))
    if match:
        return float(match.group())
    return 0.0

def calculate_sheets(db, project_details):
    """
    Calculate the sheet metal requirements based on project details (doors).
    """
    rects_1_5 = [] # For 1.5mm thickness (Rec 1, 2, 3)
    rects_1_2 = [] # For 1.2mm thickness (Rec 4, 5)

    for detail in project_details:
        height = parse_dimension(detail.get('height', 0))
        width = parse_dimension(detail.get('width', 0))
        depth = parse_dimension(detail.get('depth', 0))
        
        arch_raw = detail.get('architrave')
        architrave = parse_dimension(arch_raw)
        if architrave == 0.0:
            architrave = 4.0

        arch2_raw = detail.get('architrave_2')
        architrave_2 = parse_dimension(arch2_raw)
        if architrave_2 == 0.0:
            architrave_2 = architrave + 2.2

        if height == 0 or width == 0:
            continue

        qty = detail.get('quantity')
        try:
            qty = int(qty) if qty is not None else 1
        except (ValueError, TypeError):
            qty = 1
        if qty < 1:
            qty = 1

        for _ in range(qty):
            # Rec 1, 2 (vertical posts) and Rec 3 (horizontal head) (1.5mm)
            # w_halaq is now depth + architrave + architrave_2 + 5.9
            w_halaq = depth + architrave + architrave_2 + 5.9
            if w_halaq > 0:
                if height > 0:
                    rects_1_5.extend([(w_halaq, height), (w_halaq, height)])
                if width > 0:
                    rects_1_5.append((w_halaq, width))

            # Rec 4, 5 (1.2mm)
            l4_5 = height - architrave - 1
            w4 = width + 5.2
            w5 = width - 6.1
            if l4_5 > 0:
                if w4 > 0:
                    rects_1_2.append((w4, l4_5))
                if w5 > 0:
                    rects_1_2.append((w5, l4_5))

    # Load sizes from DB
    db_sizes_1_5 = db.query(models.SheetSize).filter(models.SheetSize.thickness == 1.5).all()
    db_sizes_1_2 = db.query(models.SheetSize).filter(models.SheetSize.thickness == 1.2).all()
    
    # Convert to list of tuples (width, height)
    sizes_1_5 = [(s.width, s.height) for s in db_sizes_1_5]
    sizes_1_2 = [(s.width, s.height) for s in db_sizes_1_2]
    
    # Fallback to default if empty
    if not sizes_1_5:
        sizes_1_5 = [(100.0, 230.0), (125.0, 230.0), (125.0, 250.0)]
    if not sizes_1_2:
        sizes_1_2 = [(100.0, 230.0), (125.0, 230.0), (125.0, 250.0)]

    def pack_rectangles(rectangles, bin_sizes):
        if not rectangles:
            return {}

        # 1. Run baseline packing with all bins (Smallest first) to find a baseline limit K
        packer_base = newPacker(mode=PackingMode.Offline, bin_algo=PackingBin.Global, rotation=False, sort_algo=SORT_AREA)
        for w, h in rectangles:
            packer_base.add_rect(w, h)
        
        for bin_w, bin_h in bin_sizes:
            for _ in range(500):
                packer_base.add_bin(bin_w, bin_h)
        packer_base.pack()
        
        base_used = [b for b in packer_base if len(b) > 0]
        K = len(base_used)
        if K == 0:
            return {}
            
        # 2. Generate combinations of count list
        # Cap max_k to keep combinations below 15,000
        max_k = min(K, 40)
        import math
        n_vars = len(bin_sizes)
        while max_k > 1:
            num_combos = math.comb(max_k + n_vars, n_vars) - 1
            if num_combos <= 15000:
                break
            max_k -= 1

        def get_combinations(n, target_sum):
            if n == 1:
                yield (target_sum,)
                return
            for i in range(target_sum + 1):
                for sub in get_combinations(n - 1, target_sum - i):
                    yield (i,) + sub

        combos = []
        for s in range(1, max_k + 1):
            for c in get_combinations(n_vars, s):
                total_area = sum(count * bin_sizes[i][0] * bin_sizes[i][1] for i, count in enumerate(c))
                combos.append((total_area, c))
                    
        combos.sort(key=lambda x: x[0])
        
        # 3. Find the first mixture that successfully packs all rectangles
        optimal_mix = None
        for area, c in combos:
            packer = newPacker(mode=PackingMode.Offline, bin_algo=PackingBin.Global, rotation=False, sort_algo=SORT_AREA)
            for w, h in rectangles:
                packer.add_rect(w, h)
            for i, count in enumerate(c):
                bin_w, bin_h = bin_sizes[i]
                for _ in range(count):
                    packer.add_bin(bin_w, bin_h)
            packer.pack()
            
            if sum(len(b) for b in packer) == len(rectangles):
                optimal_mix = {f"{int(bin_sizes[i][0])}*{int(bin_sizes[i][1])}": count for i, count in enumerate(c) if count > 0}
                break
                
        # Fallback to baseline if optimal search failed
        if not optimal_mix:
            used_bins = {}
            for abin in base_used:
                size_str = f"{int(abin.width)}*{int(abin.height)}"
                used_bins[size_str] = used_bins.get(size_str, 0) + 1
            return used_bins
            
        return optimal_mix

    bins_1_5 = pack_rectangles(rects_1_5, sizes_1_5)
    bins_1_2 = pack_rectangles(rects_1_2, sizes_1_2)

    return {
        "thickness_1_5": [{"size": k, "count": v} for k, v in bins_1_5.items()],
        "thickness_1_2": [{"size": k, "count": v} for k, v in bins_1_2.items()]
    }
