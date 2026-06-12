import re
from rectpack import newPacker, PackingMode, PackingBin, SORT_AREA

def parse_dimension(dim_str):
    if not dim_str:
        return 0.0
    # Find the first floating point number in the string
    match = re.search(r'[-+]?\d*\.\d+|\d+', str(dim_str))
    if match:
        return float(match.group())
    return 0.0

def calculate_sheets(project_details):
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
            w_halaq = depth + 12.1 + architrave
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

    def pack_rectangles(rectangles):
        if not rectangles:
            return {}

        # 1. Run baseline packing with all bins (Smallest first) to find a baseline limit K
        packer_base = newPacker(mode=PackingMode.Offline, bin_algo=PackingBin.Global, rotation=False, sort_algo=SORT_AREA)
        for w, h in rectangles:
            packer_base.add_rect(w, h)
        
        # Available bin sizes: 100*230 (2.3m²), 125*230 (2.875m²), 125*250 (3.125m²)
        bin_sizes = [(100, 230), (125, 230), (125, 250)]
        for bin_w, bin_h in bin_sizes:
            for _ in range(500):
                packer_base.add_bin(bin_w, bin_h)
        packer_base.pack()
        
        base_used = [b for b in packer_base if len(b) > 0]
        K = len(base_used)
        if K == 0:
            return {}
            
        # 2. Generate combinations of (c1, c2, c3) where c1 + c2 + c3 <= K
        # Cap K to 40 to prevent any performance hit
        max_k = min(K, 40)
        combos = []
        for c1 in range(max_k + 1):
            for c2 in range(max_k + 1 - c1):
                for c3 in range(max_k + 1 - c1 - c2):
                    if c1 + c2 + c3 == 0:
                        continue
                    # Calculate total sheet area in cm²
                    area = c1 * 23000 + c2 * 28750 + c3 * 31250
                    combos.append((area, c1, c2, c3))
                    
        # Sort combinations by total area ascending
        combos.sort(key=lambda x: x[0])
        
        # 3. Find the first mixture that successfully packs all rectangles
        optimal_mix = None
        for area, c1, c2, c3 in combos:
            packer = newPacker(mode=PackingMode.Offline, bin_algo=PackingBin.Global, rotation=False, sort_algo=SORT_AREA)
            for w, h in rectangles:
                packer.add_rect(w, h)
            for _ in range(c1):
                packer.add_bin(100, 230)
            for _ in range(c2):
                packer.add_bin(125, 230)
            for _ in range(c3):
                packer.add_bin(125, 250)
            packer.pack()
            
            if sum(len(b) for b in packer) == len(rectangles):
                optimal_mix = {"100*230": c1, "125*230": c2, "125*250": c3}
                break
                
        # Fallback to baseline if optimal search failed
        if not optimal_mix:
            used_bins = {}
            for abin in base_used:
                size_str = f"{int(abin.width)}*{int(abin.height)}"
                used_bins[size_str] = used_bins.get(size_str, 0) + 1
            return used_bins
            
        return {k: v for k, v in optimal_mix.items() if v > 0}

    bins_1_5 = pack_rectangles(rects_1_5)
    bins_1_2 = pack_rectangles(rects_1_2)

    return {
        "thickness_1_5": [{"size": k, "count": v} for k, v in bins_1_5.items()],
        "thickness_1_2": [{"size": k, "count": v} for k, v in bins_1_2.items()]
    }
