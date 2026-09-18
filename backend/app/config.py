import os
from functools import lru_cache


class Settings:
    def __init__(self):
        self.allowed_emails = [
            e.strip().lower()
            for e in os.getenv("ALLOWED_EMAILS", "").split(",")
            if e.strip()
        ]
        self.google_credentials_file = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.firebase_credentials_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
        self.cors_origins = [
            o.strip()
            for o in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:3000,https://depto-playa.vercel.app",
            ).split(",")
            if o.strip()
        ]


@lru_cache
def get_settings():
    return Settings()
