"""
Neural service: interfaces with the existing neuromodule and new 18-point orchestrator
via subprocess JSON stdin/stdout protocol.
"""
import json
import os
import subprocess
import sys
import threading
import queue
import time
from pathlib import Path
from typing import List, Optional, Tuple

from models.schemas import Point

# Paths relative to this file's location
_BACKEND_DIR = Path(__file__).parent.parent
_ROOT_DIR = _BACKEND_DIR.parent

_NEUROMODULE_DIR = _ROOT_DIR / "neuromodule"
_ANALYZER_SCRIPT = _NEUROMODULE_DIR / "submodules" / "stdA" / "AnalyzerA.py"
_WEIGHTS_FILE = _NEUROMODULE_DIR / "submodules" / "stdA" / "weights.pth"

_NEUROMODULE_18_DIR = _ROOT_DIR / "neuro_module_18_points"
_ANALYZER_18_SCRIPT = _NEUROMODULE_18_DIR / "18pA.py"
_WEIGHTS_18_FILE = _NEUROMODULE_18_DIR / "weights.pth"

# Global orchestrator process handles
_orchestrator: Optional[dict] = None
_orchestrator_18: Optional[dict] = None
_init_lock = threading.Lock()

POINT_NAMES_18 = [      
    "ТВ-Л", "ТБ-Л", "ТН-Л", "БВК-Л", "ББК-Л", "ШЛВ-Л", "ШН-Л", "ШПВ-Л", "ШП-Л",
    "ШЛ-П", "ШЛВ-П", "ТН-П", "ШПВ-П", "ШН-П", "ТБ-П", "ТВ-П", "БВК-П", "ББК-П"
]


def _stream_reader(stream, q: queue.Queue):
    try:
        for line in stream:
            stripped = line.strip()
            if stripped:
                q.put(stripped)
    except Exception:
        pass


def _start_orchestrator(script_path: Path, weights_path: Path, keypoints: str) -> dict:
    """Start an Analyzer orchestrator as a subprocess."""
    creationflags = 0
    if sys.platform == "win32":
        try:
            creationflags = subprocess.CREATE_NO_WINDOW
        except AttributeError:
            pass

    cmd = [sys.executable, str(script_path), "--mode", "run"]
    # 18pA doesn't strictly need --keypoints argument, but stdA does.
    if keypoints:
        cmd.extend(["--keypoints", keypoints])
    cmd.extend(["--weights", str(weights_path)])

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        creationflags=creationflags,
        cwd=str(script_path.parent),
    )

    out_q: queue.Queue = queue.Queue()
    err_q: queue.Queue = queue.Queue()

    threading.Thread(target=_stream_reader, args=(proc.stdout, out_q), daemon=True).start()
    threading.Thread(target=_stream_reader, args=(proc.stderr, err_q), daemon=True).start()

    handle = {"proc": proc, "out_q": out_q, "err_q": err_q}

    deadline = time.time() + 90.0
    while time.time() < deadline:
        try:
            line = out_q.get(timeout=0.2)
            try:
                msg = json.loads(line)
                if msg.get("status") in ("running", "ready", "alive"):
                    break
            except json.JSONDecodeError:
                pass
        except queue.Empty:
            continue

    return handle


def _send(handle: dict, message: dict, timeout: float = 60.0) -> Optional[dict]:
    """Send JSON command and await response."""
    try:
        proc = handle["proc"]
        if proc.poll() is not None:
            return None
        proc.stdin.write(json.dumps(message, ensure_ascii=False) + "\n")
        proc.stdin.flush()

        start = time.time()
        while time.time() - start < timeout:
            try:
                line = handle["out_q"].get(timeout=0.2)
                resp = json.loads(line)
                # Ignore lingering startup/ping messages
                if "status" in resp and resp["status"] in ("running", "ready", "alive"):
                    continue
                return resp
            except queue.Empty:
                continue
            except json.JSONDecodeError:
                continue
        return None
    except Exception:
        return None


def ensure_orchestrator():
    """Ensure orchestrators are running."""
    global _orchestrator, _orchestrator_18
    with _init_lock:
        if _orchestrator is None or _orchestrator["proc"].poll() is not None:
            try:
                _orchestrator = _start_orchestrator(_ANALYZER_SCRIPT, _WEIGHTS_FILE, "6")
            except Exception as e:
                print(f"[ERROR] Failed to start 6-point orchestrator: {e}")
                
        if _orchestrator_18 is None or _orchestrator_18["proc"].poll() is not None:
            try:
                _orchestrator_18 = _start_orchestrator(_ANALYZER_18_SCRIPT, _WEIGHTS_18_FILE, "")
            except Exception as e:
                print(f"[ERROR] Failed to start 18-point orchestrator: {e}")


def stop_orchestrator():
    """Stop orchestrators."""
    global _orchestrator, _orchestrator_18
    for handle, name in [(_orchestrator, "std"), (_orchestrator_18, "18p")]:
        if handle is not None:
            proc = handle["proc"]
            try:
                proc.stdin.write(json.dumps({"cmd": "stop"}) + "\n")
                proc.stdin.flush()
            except:
                pass
            try:
                proc.terminate()
                proc.wait(timeout=3.0)
            except:
                pass
    _orchestrator = None
    _orchestrator_18 = None


def parse_coords(raw_coords: List[str], max_points: int, point_names: List[str] = None) -> List[Point]:
    """Parse coord strings like '0 -- {x: 120.5, y: 350.2}' into Point objects."""
    points = []
    default_ids = [f"p{i+1}" for i in range(max_points)]
    
    for i, item in enumerate(raw_coords):
        if i >= max_points: break
        try:
            if isinstance(item, dict):
                x, y = float(item.get("x", 0)), float(item.get("y", 0))
            else:
                parts = str(item).split("--", 1)
                if len(parts) == 2:
                    coord_str = parts[1].strip()
                    coord_str = coord_str.replace("x:", '"x":').replace("y:", '"y":')
                    coord_data = json.loads(coord_str)
                    x, y = float(coord_data["x"]), float(coord_data["y"])
                else:
                    continue

            pid = point_names[i] if (point_names and i < len(point_names)) else default_ids[i]
            points.append(Point(id=pid, x=x, y=y))
        except Exception:
            continue
    return points


def run_inference(image_path: str) -> Tuple[List[Point], List[Point]]:
    """
    Run neural network inference on an image file for BOTH models.
    Returns (points_6, points_18).
    """
    global _orchestrator, _orchestrator_18

    # Ensure processes are alive
    ensure_orchestrator()

    # 1) Run 6-point model
    points_6 = []
    if _orchestrator and _orchestrator["proc"].poll() is None:
        resp6 = _send(_orchestrator, {"cmd": "analyze", "image_path": image_path}, timeout=60.0)
        if resp6 and "coords" in resp6:
            points_6 = parse_coords(resp6["coords"], 6, ["p1", "p2", "p3", "p4", "p5", "p6"])
            
    # Ensure exactly 6 points
    while len(points_6) < 6:
        demo6 = _demo_points()
        points_6.append(demo6[len(points_6)])

    # 2) Run 18-point model
    points_18 = []
    if _orchestrator_18 and _orchestrator_18["proc"].poll() is None:
        resp18 = _send(_orchestrator_18, {"cmd": "analyze", "image_path": image_path}, timeout=60.0)
        if resp18 and "coords" in resp18:
            points_18 = parse_coords(resp18["coords"], 18, POINT_NAMES_18)

    return points_6[:6], points_18


def _demo_points() -> List[Point]:
    """Return plausible demo points for testing without the neural net."""
    return [
        Point(id="p1", x=145, y=220), Point(id="p2", x=367, y=218),
        Point(id="p3", x=180, y=260), Point(id="p4", x=332, y=258),
        Point(id="p5", x=195, y=195), Point(id="p6", x=317, y=193),
    ]
