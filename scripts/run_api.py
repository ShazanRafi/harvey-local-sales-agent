import uvicorn
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> None:
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000)

if __name__ == "__main__":
    main()
