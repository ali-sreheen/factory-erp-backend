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
        architrave = parse_dimension(detail.get('architrave', 0))

        if height == 0 or width == 0:
            continue

        # Rec 1, 2, 3 (1.5mm)
        w1_2_3 = depth + 16.1
        l1_2_3 = height
        if w1_2_3 > 0 and l1_2_3 > 0:
            rects_1_5.extend([(w1_2_3, l1_2_3), (w1_2_3, l1_2_3), (w1_2_3, l1_2_3)])

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
            return []

        # Available bin sizes (width, height)
        # We will add 1000 of each to ensure enough capacity
        bin_sizes = [(100, 230), (125, 230), (125, 250)]
        
        # Sort bins by area so Global bin_algo prefers smaller bins if equally good? 
        # Actually rectpack's Global checks all bins and finds best fit.
        packer = newPacker(mode=PackingMode.Offline, bin_algo=PackingBin.Global, rotation=False, sort_algo=SORT_AREA)
        
        for w, h in rectangles:
            packer.add_rect(w, h)
            
        for bin_w, bin_h in bin_sizes:
            for _ in range(500):
                packer.add_bin(bin_w, bin_h)
                
        packer.pack()
        
        # Collect results
        used_bins = {}
        for abin in packer:
            bin_w, bin_h = abin.width, abin.height
            size_str = f"{int(bin_w)}*{int(bin_h)}"
            if size_str not in used_bins:
                used_bins[size_str] = 0
            used_bins[size_str] += 1
            
        return used_bins

    bins_1_5 = pack_rectangles(rects_1_5)
    bins_1_2 = pack_rectangles(rects_1_2)

    return {
        "thickness_1_5": [{"size": k, "count": v} for k, v in bins_1_5.items()],
        "thickness_1_2": [{"size": k, "count": v} for k, v in bins_1_2.items()]
    }
