import sys
from pathlib import Path

_BACKEND_DIR = Path(r"c:\Users\mrrac\OneDrive\Рабочий стол\HACKATHON_IT-MED-main\backend")
sys.path.insert(0, str(_BACKEND_DIR))

from services.neural_service import _start_orchestrator, _ANALYZER_SCRIPT, _WEIGHTS_FILE, _ANALYZER_18_SCRIPT, _WEIGHTS_18_FILE
import queue

print("Testing 6-point orchestrator...")
handle6 = _start_orchestrator(_ANALYZER_SCRIPT, _WEIGHTS_FILE, "6")
print(f"Process poll: {handle6['proc'].poll()}")

try:
    while True:
        err = handle6["err_q"].get_nowait()
        print("STDERR 6:", err)
except queue.Empty:
    print("End of stderr 6")

print("Testing 18-point orchestrator...")
handle18 = _start_orchestrator(_ANALYZER_18_SCRIPT, _WEIGHTS_18_FILE, "")
print(f"Process poll: {handle18['proc'].poll()}")

try:
    while True:
        err = handle18["err_q"].get_nowait()
        print("STDERR 18:", err)
except queue.Empty:
    print("End of stderr 18")
