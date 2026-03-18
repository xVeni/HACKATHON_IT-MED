from pydantic import BaseModel
from typing import List, Optional, Tuple, Dict


class Point(BaseModel):
    id: str
    x: float
    y: float


class Measurements(BaseModel):
    acetabular_angle_left: float
    acetabular_angle_right: float
    h_distance_left: float
    h_distance_right: float
    d_distance_left: float
    d_distance_right: float


class Diagnosis(BaseModel):
    left: str   # "normal" | "pre_subluxation" | "subluxation" | "dislocation"
    right: str
    shenton_left: str = "normal"
    shenton_right: str = "normal"
    calve_left: str = "normal"
    calve_right: str = "normal"


class AnalysisResponse(BaseModel):
    image: str              # base64 PNG
    points: List[Point]
    points_18: List[Point] = []
    measurements: Measurements
    diagnosis: Diagnosis
    image_width: int
    image_height: int
    pixel_spacing: Optional[Tuple[float, float]] = None
    warning: Optional[str] = None
    abnormal_parameters: List[str] = []
    thresholds: Dict[str, float] = {}


class ConvertResponse(BaseModel):
    image: str
    pixel_spacing: Optional[Tuple[float, float]] = None
    warning: Optional[str] = None


class RecalculateRequest(BaseModel):
    points: List[Point]
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    pixel_spacing: Optional[Tuple[float, float]] = None
    age_months: Optional[int] = None
    gender: Optional[str] = None # "boy" | "girl"


class RecalculateResponse(BaseModel):
    measurements: Measurements
    diagnosis: Diagnosis
    abnormal_parameters: List[str] = []
    thresholds: Dict[str, float] = {}
