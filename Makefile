.PHONY: install api ui test offline
install:
	python -m pip install -e .
	cd frontend && npm install
api:
	python scripts/run_api.py
ui:
	cd frontend && npm run dev
test:
	python -m pytest tests backend/tests -q
offline:
	python scripts/offline_acceptance.py
