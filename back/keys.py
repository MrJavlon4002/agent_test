import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
FRONTEND_ORIGIN  = os.getenv("FRONTEND_ORIGIN", "*")
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY", "")