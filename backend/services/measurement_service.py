import math
from typing import List, Optional, Tuple
from models.schemas import Point, Measurements, Diagnosis


def calculate_measurements(
    points: List[Point], 
    points_18: List[Point],
    image_width: int = 512, 
    image_height: int = 512,
    pixel_spacing: Optional[Tuple[float, float]] = None,
    age_months: Optional[int] = None,
    gender: Optional[str] = None
) -> Tuple[Measurements, Diagnosis, List[str], Dict[str, float]]:
    """
    Calculate hip dysplasia measurements from 6 keypoints.
    
    # Point mapping (from neural net, 0-indexed):
    # - p0 (id="p1"): Left acetabular roof edge (outer)
    # - p1 (id="p2"): Right acetabular roof edge (outer)
    # - p2 (id="p3"): Left Y-cartilage (Hilgenreiner left)
    # - p3 (id="p4"): Right Y-cartilage (Hilgenreiner right)  
    # - p4 (id="p5"): Left femoral head top (highest point)
    # - p5 (id="p6"): Right femoral head top (highest point)
    """

    pts = {p.id: p for p in points}
    
    # Get the six points (fallback to sequential if ids not matching)
    ordered = sorted(points, key=lambda p: p.id)
    
    def get_pt(pid: str, fallback_idx: int) -> Point:
        if pid in pts:
            return pts[pid]
        if fallback_idx < len(ordered):
            return ordered[fallback_idx]
        return Point(id=pid, x=0, y=0)
    
    roof_left = get_pt("p1", 0)  
    roof_right = get_pt("p2", 1) 
    y_left = get_pt("p3", 2)  
    y_right = get_pt("p4", 3)  
    head_left = get_pt("p5", 4)  
    head_right = get_pt("p6", 5)  

    # --- Scale Factor Calculation ---
    if pixel_spacing:
        # pixel_spacing is (row_spacing, col_spacing)
        row_s, col_s = pixel_spacing
    else:
        # Fallback heuristic: 150mm / image_width
        s = 150.0 / image_width if image_width > 0 else 1.0
        row_s, col_s = s, s

    # Helper to convert Point to (x_mm, y_mm)
    def to_mm(p: Point):
        return p.x * col_s, p.y * row_s

    rl_mm = to_mm(roof_left)
    rr_mm = to_mm(roof_right)
    yl_mm = to_mm(y_left)
    yr_mm = to_mm(y_right)
    hl_mm = to_mm(head_left)
    hr_mm = to_mm(head_right)

    # --- Hilgenreiner line Vector in MM ---
    hx = yr_mm[0] - yl_mm[0]
    hy = yr_mm[1] - yl_mm[1]
    hlen = math.sqrt(hx * hx + hy * hy)
    if hlen == 0:
        hx, hy = 1.0, 0.0
        hlen = 1.0
    
    ux = hx / hlen
    uy = hy / hlen

    # --- Distance d & h: using vector projections in MM space ---
    vl_x = hl_mm[0] - yl_mm[0]
    vl_y = hl_mm[1] - yl_mm[1]
    d_left_mm = abs(vl_x * ux + vl_y * uy)
    h_left_mm = abs(ux * vl_y - uy * vl_x)

    vr_x = hr_mm[0] - yr_mm[0]
    vr_y = hr_mm[1] - yr_mm[1]
    d_right_mm = abs(vr_x * ux + vr_y * uy)
    h_right_mm = abs(ux * vr_y - uy * vr_x)

    # --- Acetabular angle ---
    def vector_angle(ax: float, ay: float, bx: float, by: float) -> float:
        dot = ax * bx + ay * by
        mag_a = math.sqrt(ax*ax + ay*ay)
        mag_b = math.sqrt(bx*bx + by*by)
        if mag_a == 0 or mag_b == 0:
            return 0.0
        val = dot / (mag_a * mag_b)
        val = max(-1.0, min(1.0, val))
        return math.degrees(math.acos(val))

    # Angle between Hilgenreiner line and acetabular roof
    # Use roof point - Y point vector in MM
    rl_vec_x = rl_mm[0] - yl_mm[0]
    rl_vec_y = rl_mm[1] - yl_mm[1]
    angle_left = vector_angle(-ux, -uy, rl_vec_x, rl_vec_y)

    rr_vec_x = rr_mm[0] - yr_mm[0]
    rr_vec_y = rr_mm[1] - yr_mm[1]
    angle_right = vector_angle(ux, uy, rr_vec_x, rr_vec_y)

    # --- Diagnosis and Abnormal Parameter Detection ---
    abnormal_parameters = []
    
    # Thresholds (upper limits for "normal")
    alpha_thresholds = {
        0: (34.0, 36.0),    # Newborn
        3: (30.0, 32.0),
        6: (27.0, 29.0),
        12: (24.0, 25.0),
        24: (22.0, 23.0),
        36: (20.0, 21.0),
        60: (18.0, 19.0)
    }
    
    # age_months: (min_h, max_d)
    hd_thresholds = {
        6: (9.0, 15.0),
        12: (10.0, 14.0),
        24: (11.0, 13.0),
        36: (12.0, 12.0),
        60: (13.0, 11.0)
    }
    
    def get_alpha_limit(months, p_gender):
        ages = sorted(alpha_thresholds.keys(), reverse=True)
        for a in ages:
            if months >= a:
                boy_t, girl_t = alpha_thresholds[a]
                return boy_t if p_gender != "girl" else girl_t
        return 34.0
        
    def get_hd_limit(months):
        ages = sorted(hd_thresholds.keys(), reverse=True)
        for a in ages:
            if months >= a:
                return hd_thresholds[a]
        return (9.0, 15.0)
    
    effective_age = age_months if age_months is not None else 6
    effective_gender = gender if gender else "boy"
    
    max_alpha = get_alpha_limit(effective_age, effective_gender)
    min_h, max_d = get_hd_limit(effective_age)
    
    # Check Left Side
    left_status = "normal"
    if angle_left > max_alpha:
        abnormal_parameters.append("acetabular_angle_left")
        left_status = "pre_subluxation"
    
    if h_left_mm < min_h:
        abnormal_parameters.append("h_distance_left")
        left_status = "subluxation"
        
    if d_left_mm > max_d:
        abnormal_parameters.append("d_distance_left")
        if left_status == "normal": left_status = "pre_subluxation"
        elif left_status == "pre_subluxation": left_status = "subluxation"

    if h_left_mm < min_h / 2 or d_left_mm > max_d + 5:
        left_status = "dislocation"

    # Check Right Side
    right_status = "normal"
    if angle_right > max_alpha:
        abnormal_parameters.append("acetabular_angle_right")
        right_status = "pre_subluxation"
    
    if h_right_mm < min_h:
        abnormal_parameters.append("h_distance_right")
        right_status = "subluxation"
        
    if d_right_mm > max_d:
        abnormal_parameters.append("d_distance_right")
        if right_status == "normal": right_status = "pre_subluxation"
        elif right_status == "pre_subluxation": right_status = "subluxation"

    if h_right_mm < min_h / 2 or d_right_mm > max_d + 5:
        right_status = "dislocation"

    measurements = Measurements(
        acetabular_angle_left=round(angle_left, 1),
        acetabular_angle_right=round(angle_right, 1),
        h_distance_left=round(h_left_mm, 1),
        h_distance_right=round(h_right_mm, 1),
        d_distance_left=round(d_left_mm, 1),
        d_distance_right=round(d_right_mm, 1),
    )

    # --- 18-point lines analysis (Shenton, Calve) ---
    def check_smooth_curve(point_ids: List[str], threshold_degrees=45.0) -> str:
        pts_map = {p.id: p for p in points_18}
        curve_pts = [pts_map[pid] for pid in point_ids if pid in pts_map]
        if len(curve_pts) < 3:
            return "normal"
            
        for i in range(len(curve_pts) - 2):
            pA, pB, pC = curve_pts[i], curve_pts[i+1], curve_pts[i+2]
            vx1, vy1 = pB.x - pA.x, pB.y - pA.y
            vx2, vy2 = pC.x - pB.x, pC.y - pB.y
            mag1 = math.sqrt(vx1*vx1 + vy1*vy1)
            mag2 = math.sqrt(vx2*vx2 + vy2*vy2)
            if mag1 == 0 or mag2 == 0: continue
            dot = (vx1*vx2 + vy1*vy2) / (mag1*mag2)
            dot = max(-1.0, min(1.0, dot))
            angle = math.degrees(math.acos(dot))
            if angle > threshold_degrees:
                return "subluxation" # 'ступенька' или прерывание
        return "normal"

    shenton_left = check_smooth_curve(["ШН-Л", "ШП-Л", "ТН-Л"], 40.0)
    shenton_right = check_smooth_curve(["ШН-П", "ШЛ-П", "ТН-П"], 40.0) # Assumed ШЛ-П or similar acts as middle
    calve_left = check_smooth_curve(["ТВ-Л", "ТБ-Л", "ШЛВ-Л"], 40.0)
    calve_right = check_smooth_curve(["ТВ-П", "ТБ-П", "ШЛВ-П"], 40.0)

    diagnosis = Diagnosis(
        left=left_status, 
        right=right_status,
        shenton_left=shenton_left,
        shenton_right=shenton_right,
        calve_left=calve_left,
        calve_right=calve_right
    )
    
    thresholds = {
        "max_alpha": round(max_alpha, 1),
        "min_h": round(min_h, 1),
        "max_d": round(max_d, 1)
    }

    return measurements, diagnosis, abnormal_parameters, thresholds
