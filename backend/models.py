"""
Database Models for FileFlowMaster
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, DateTime, 
    ForeignKey, Text, JSON, Index, UniqueConstraint, Enum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import uuid
import enum

Base = declarative_base()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


class FilePermissionType(str, enum.Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    profile_image_url = Column(String(500))
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True))
    
    # Relationships
    uploaded_files = relationship("File", back_populates="uploader", foreign_keys="File.uploaded_by")
    created_projects = relationship("Project", back_populates="creator")
    file_permissions = relationship("FilePermission", back_populates="user", foreign_keys="FilePermission.user_id")
    granted_permissions = relationship("FilePermission", back_populates="grantor", foreign_keys="FilePermission.granted_by")
    audit_logs = relationship("AuditLog", back_populates="user")
    share_links = relationship("ShareLink", back_populates="creator")
    file_versions = relationship("FileVersion", back_populates="uploader")
    
    def __repr__(self):
        return f"<User {self.username}>"


class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    projects = relationship("Project", back_populates="organization", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Organization {self.name}>"


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="projects")
    creator = relationship("User", back_populates="created_projects")
    files = relationship("File", back_populates="project", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_project_org", "organization_id"),
        Index("idx_project_creator", "created_by"),
    )
    
    def __repr__(self):
        return f"<Project {self.name}>"


class File(Base):
    __tablename__ = "files"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size = Column(BigInteger, nullable=False)
    path = Column(Text, nullable=False)
    hash = Column(String(64), index=True)  # SHA-256 hash
    
    # Metadata
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"))
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    description = Column(Text)
    tags = Column(JSON, default=list)
    metadata = Column(JSON, default=dict)  # Additional metadata
    
    # Version control
    version = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_offline_available = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="files")
    uploader = relationship("User", back_populates="uploaded_files", foreign_keys=[uploaded_by])
    versions = relationship("FileVersion", back_populates="file", cascade="all, delete-orphan")
    permissions = relationship("FilePermission", back_populates="file", cascade="all, delete-orphan")
    share_links = relationship("ShareLink", back_populates="file", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_file_project", "project_id"),
        Index("idx_file_uploader", "uploaded_by"),
        Index("idx_file_active", "is_active"),
        Index("idx_file_hash", "hash"),
    )
    
    def __repr__(self):
        return f"<File {self.name}>"


class FileVersion(Base):
    __tablename__ = "file_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    path = Column(Text, nullable=False)
    size = Column(BigInteger, nullable=False)
    hash = Column(String(64))
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    comment = Column(Text)  # Version comment
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    file = relationship("File", back_populates="versions")
    uploader = relationship("User", back_populates="file_versions")
    
    # Indexes
    __table_args__ = (
        UniqueConstraint("file_id", "version", name="uq_file_version"),
        Index("idx_file_version_file", "file_id"),
    )
    
    def __repr__(self):
        return f"<FileVersion {self.file_id} v{self.version}>"


class FilePermission(Base):
    __tablename__ = "file_permissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission = Column(Enum(FilePermissionType), nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True))  # Optional expiration
    
    # Relationships
    file = relationship("File", back_populates="permissions")
    user = relationship("User", back_populates="file_permissions", foreign_keys=[user_id])
    grantor = relationship("User", back_populates="granted_permissions", foreign_keys=[granted_by])
    
    # Indexes
    __table_args__ = (
        UniqueConstraint("file_id", "user_id", name="uq_file_user_permission"),
        Index("idx_permission_file", "file_id"),
        Index("idx_permission_user", "user_id"),
    )
    
    def __repr__(self):
        return f"<FilePermission {self.file_id} -> {self.user_id}: {self.permission}>"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(255))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    ip_address = Column(String(45))
    user_agent = Column(Text)
    details = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    # Indexes
    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
        Index("idx_audit_created", "created_at"),
    )
    
    def __repr__(self):
        return f"<AuditLog {self.action} on {self.resource_type}>"


class ShareLink(Base):
    __tablename__ = "share_links"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String(255), unique=True, nullable=False, index=True)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Settings
    expires_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True, nullable=False)
    download_count = Column(Integer, default=0, nullable=False)
    max_downloads = Column(Integer)  # Null = unlimited
    password_hash = Column(String(255))  # Optional password protection
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_accessed_at = Column(DateTime(timezone=True))
    
    # Relationships
    file = relationship("File", back_populates="share_links")
    creator = relationship("User", back_populates="share_links")
    
    # Indexes
    __table_args__ = (
        Index("idx_share_link_token", "token"),
        Index("idx_share_link_file", "file_id"),
        Index("idx_share_link_active", "is_active"),
    )
    
    def __repr__(self):
        return f"<ShareLink {self.token}>"


class Session(Base):
    """Session storage for authentication"""
    __tablename__ = "sessions"
    
    sid = Column(String, primary_key=True)
    sess = Column(JSON, nullable=False)
    expire = Column(DateTime(timezone=True), nullable=False, index=True)
    
    def __repr__(self):
        return f"<Session {self.sid}>"
