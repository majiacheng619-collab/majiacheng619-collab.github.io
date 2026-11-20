"""Read the shared content source for the portfolio and its alternate views."""

from pathlib import Path
import json

PROFILE = json.loads((Path(__file__).resolve().parents[1] / 'data/profile.json').read_text())
