import os
import platform
import psutil
import subprocess


def detect_hardware() -> dict:
    memory_gib = round(psutil.virtual_memory().total / (1024**3), 1)
    cpu_count = os.cpu_count() or 1
    gpu_detected = False
    gpu_name = ""

    try:
        if platform.system() == "Windows":
            import shutil
            if shutil.which("nvidia-smi"):
                output = subprocess.check_output(
                    ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
                    text=True,
                    timeout=5,
                )
                gpu_detected = bool(output.strip())
                gpu_name = output.strip().splitlines()[0] if gpu_detected else ""
    except (OSError, subprocess.SubprocessError):
        gpu_detected = False

    if memory_gib < 8:
        recommendation = "qwen3:1.7b"
        profile = "low-memory"
    elif memory_gib < 16:
        recommendation = "qwen3:8b"
        profile = "standard-laptop"
    elif gpu_detected or memory_gib >= 32:
        recommendation = "qwen3:14b"
        profile = "high-performance"
    else:
        recommendation = "qwen3:8b"
        profile = "high-memory-no-gpu"

    return {
        "platform": platform.system(),
        "cpu_count": cpu_count,
        "memory_gib": memory_gib,
        "gpu_detected": gpu_detected,
        "gpu_name": gpu_name,
        "recommended_model": recommendation,
        "configuration": profile,
    }
