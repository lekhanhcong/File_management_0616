"""
FileFlowMaster Backend Configuration
"""
import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # App settings
    app_name: str = "FileFlowMaster"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 5000
    
    # Database
    database_url: str
    database_pool_size: int = 20
    database_max_overflow: int = 0
    
    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # File storage
    upload_dir: Path = Path("./uploads")
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    allowed_extensions: set[str] = {
        # Documents
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".txt", ".rtf", ".odt", ".ods", ".odp",
        # Images
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp",
        # Archives
        ".zip", ".rar", ".7z", ".tar", ".gz",
        # Code
        ".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".xml", ".yaml", ".yml",
        ".html", ".css", ".scss", ".sass", ".less",
        ".java", ".cpp", ".c", ".h", ".cs", ".php", ".rb", ".go", ".rs",
        ".sql", ".sh", ".bash", ".ps1",
        # Media
        ".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv",
        ".mp3", ".wav", ".flac", ".aac", ".ogg",
    }
    
    # CORS
    cors_origins: list[str] = ["*"]
    cors_credentials: bool = True
    cors_methods: list[str] = ["*"]
    cors_headers: list[str] = ["*"]
    
    # Redis (optional, for caching)
    redis_url: Optional[str] = None
    
    # Email (optional)
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    
    # Replit Auth (if using Replit)
    replit_domains: Optional[str] = None
    issuer_url: str = "https://replit.com/oidc"
    repl_id: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        
    def get_upload_path(self, subfolder: str = "") -> Path:
        """Get upload path, creating it if necessary"""
        path = self.upload_dir / subfolder
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Create necessary directories on import
settings = get_settings()
settings.get_upload_path("temp")
settings.get_upload_path("files")
