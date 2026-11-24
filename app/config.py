import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Homologador de Atributos"
    database_url: str = "postgresql+psycopg://homologador:homologador123@db:5432/homologador"
    jwt_secret_key: str = secrets.token_hex(32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    admin_email: str = "homologador@sistema.com"
    admin_password: str = "Homologador@123"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
