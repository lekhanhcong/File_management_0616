
import os
import sys
import json
import uuid
import hashlib
import datetime
import secrets
import logging
from functools import wraps
from pathlib import Path
from typing import Dict, List, Optional, Any
import mimetypes
import zipfile
import io
import tempfile
import shutil

# Flask and extensions
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, send_file, abort
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_wtf import FlaskForm, CSRFProtect
from flask_wtf.file import FileField, FileAllowed, FileRequired
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from flask_caching import Cache
from flask_mail import Mail, Message

# Security and encryption
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from cryptography.fernet import Fernet
import jwt
import pyotp
import qrcode
from PIL import Image

# File processing
import textract
from elasticsearch import Elasticsearch
import redis

# Form handling
from wtforms import StringField, PasswordField, BooleanField, TextAreaField, SelectField, HiddenField
from wtforms.validators import DataRequired, Email, Length, ValidationError

# Background tasks
from celery import Celery

# Monitoring and logging
from logging.handlers import RotatingFileHandler
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_urlsafe(32))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///efms.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'connect_args': {'timeout': 20}
}

# File Upload Configuration - Enterprise limits
app.config['UPLOAD_FOLDER'] = 'enterprise_files'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 * 1024  # 50GB max file size
app.config['ALLOWED_EXTENSIONS'] = {
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt',
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'svg', 'webp',
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm',
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a',
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
    'csv', 'json', 'xml', 'yaml', 'sql',
    'py', 'js', 'html', 'css', 'java', 'cpp', 'c', 'php', 'rb', 'go'
}

# Security Configuration
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = datetime.timedelta(hours=12)

# Redis Configuration
app.config['REDIS_URL'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
app.config['CACHE_TYPE'] = 'redis'
app.config['CACHE_REDIS_URL'] = app.config['REDIS_URL']

# Email Configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'localhost')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')

# Elasticsearch Configuration
app.config['ELASTICSEARCH_URL'] = os.environ.get('ELASTICSEARCH_URL', 'http://localhost:9200')

# Compliance Configuration
app.config['RETENTION_POLICY_DAYS'] = int(os.environ.get('RETENTION_POLICY_DAYS', 2555))  # 7 years
app.config['AUDIT_LOG_RETENTION_DAYS'] = int(os.environ.get('AUDIT_LOG_RETENTION_DAYS', 3650))  # 10 years

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
csrf = CSRFProtect(app)
cache = Cache(app)
cors = CORS(app, supports_credentials=True)
mail = Mail(app)

# Rate Limiting with enterprise configuration
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["1000 per day", "200 per hour", "50 per minute"],
    storage_uri=app.config['REDIS_URL']
)

# Celery Configuration for background tasks
celery = Celery(
    app.import_name,
    backend=os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1'),
    broker=os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
)

# Encryption setup
encryption_key = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key())
if isinstance(encryption_key, str):
    encryption_key = encryption_key.encode()
cipher_suite = Fernet(encryption_key)

# Elasticsearch client
try:
    es = Elasticsearch([app.config['ELASTICSEARCH_URL']])
except:
    es = None

# Redis client
try:
    redis_client = redis.from_url(app.config['REDIS_URL'])
except:
    redis_client = None

# Create necessary directories
directories = [
    app.config['UPLOAD_FOLDER'], 'thumbnails', 'file_versions', 
    'temp_uploads', 'logs', 'encrypted_files', 'audit_exports',
    'quarantine', 'backups'
]
for directory in directories:
    os.makedirs(directory, exist_ok=True)

# Enhanced logging configuration
if not app.debug:
    # Configure structured logging for enterprise
    file_handler = RotatingFileHandler('logs/efms.log', maxBytes=100*1024*1024, backupCount=30)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s [%(name)s] [%(funcName)s:%(lineno)d] %(message)s'
    ))
    file_handler.setLevel(logging.INFO)
    
    # Security log handler
    security_handler = RotatingFileHandler('logs/security.log', maxBytes=100*1024*1024, backupCount=30)
    security_handler.setFormatter(logging.Formatter(
        '%(asctime)s SECURITY [%(name)s] %(message)s'
    ))
    security_handler.setLevel(logging.WARNING)
    
    app.logger.addHandler(file_handler)
    app.logger.addHandler(security_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Enterprise File Management System startup')

# Database Models - Enterprise Schema

class Organization(db.Model):
    """Multi-tenant organization model"""
    __tablename__ = 'organizations'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    domain = db.Column(db.String(255), unique=True, nullable=False)
    subscription_tier = db.Column(db.String(20), default='enterprise')
    settings = db.Column(db.JSON, default={})
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    users = db.relationship('User', backref='organization', lazy='dynamic')
    files = db.relationship('FileMetadata', backref='organization', lazy='dynamic')

class User(db.Model):
    """Enhanced user model with enterprise features"""
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    username = db.Column(db.String(80), nullable=False, index=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    display_name = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    department = db.Column(db.String(100), nullable=False, default='general')
    status = db.Column(db.String(20), default='active')
    
    # Security fields
    two_factor_secret = db.Column(db.String(32))
    two_factor_enabled = db.Column(db.Boolean, default=False)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime)
    last_login = db.Column(db.DateTime)
    password_changed_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    # Profile fields
    avatar_url = db.Column(db.String(500))
    phone = db.Column(db.String(20))
    timezone = db.Column(db.String(50), default='UTC')
    language = db.Column(db.String(10), default='en')
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    uploaded_files = db.relationship('FileMetadata', foreign_keys='FileMetadata.created_by_id', backref='creator', lazy='dynamic')
    audit_logs = db.relationship('AuditLog', backref='user', lazy='dynamic')
    
    @property
    def is_admin(self):
        return self.role in ['admin', 'super_admin']
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def generate_totp_secret(self):
        if not self.two_factor_secret:
            self.two_factor_secret = pyotp.random_base32()
            db.session.commit()
        return self.two_factor_secret
    
    def verify_totp(self, token):
        if not self.two_factor_secret:
            return False
        totp = pyotp.TOTP(self.two_factor_secret)
        return totp.verify(token, valid_window=2)

class FileMetadata(db.Model):
    """Enhanced file metadata with enterprise features"""
    __tablename__ = 'file_metadata'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    name = db.Column(db.String(500), nullable=False)
    original_name = db.Column(db.String(500), nullable=False)
    file_path = db.Column(db.String(1000), nullable=False)
    file_type = db.Column(db.String(100), nullable=False)
    mime_type = db.Column(db.String(200))
    size = db.Column(db.BigInteger, nullable=False)
    checksum = db.Column(db.String(64), nullable=False)  # SHA-256
    
    # Hierarchy
    parent_folder_id = db.Column(db.String(36), db.ForeignKey('file_metadata.id'))
    is_folder = db.Column(db.Boolean, default=False)
    folder_path = db.Column(db.String(2000))
    
    # Classification
    classification = db.Column(db.String(50), default='internal')  # public, internal, confidential, restricted
    category = db.Column(db.String(100))
    tags = db.Column(db.JSON, default=[])
    
    # Version control
    version_number = db.Column(db.Integer, default=1)
    is_latest_version = db.Column(db.Boolean, default=True)
    parent_version_id = db.Column(db.String(36), db.ForeignKey('file_metadata.id'))
    
    # Security
    is_encrypted = db.Column(db.Boolean, default=False)
    encryption_key_id = db.Column(db.String(100))
    is_quarantined = db.Column(db.Boolean, default=False)
    quarantine_reason = db.Column(db.Text)
    
    # Compliance
    retention_until = db.Column(db.DateTime)
    legal_hold = db.Column(db.Boolean, default=False)
    compliance_flags = db.Column(db.JSON, default={})
    
    # Metadata
    metadata = db.Column(db.JSON, default={})
    custom_fields = db.Column(db.JSON, default={})
    
    # Tracking
    created_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    updated_by_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    accessed_at = db.Column(db.DateTime)
    
    # Relationships
    children = db.relationship('FileMetadata', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')
    versions = db.relationship('FileMetadata', 
                             primaryjoin='FileMetadata.id == FileMetadata.parent_version_id',
                             backref='original_file', lazy='dynamic')
    permissions = db.relationship('FilePermission', backref='file', lazy='dynamic', cascade='all, delete-orphan')
    shares = db.relationship('FileShare', backref='file', lazy='dynamic', cascade='all, delete-orphan')
    comments = db.relationship('FileComment', backref='file', lazy='dynamic', cascade='all, delete-orphan')
    
    def calculate_checksum(self, file_path):
        """Calculate SHA-256 checksum"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

class FilePermission(db.Model):
    """Granular file permissions"""
    __tablename__ = 'file_permissions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = db.Column(db.String(36), db.ForeignKey('file_metadata.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    department = db.Column(db.String(100))
    role = db.Column(db.String(50))
    
    # Permission types
    can_read = db.Column(db.Boolean, default=False)
    can_write = db.Column(db.Boolean, default=False)
    can_delete = db.Column(db.Boolean, default=False)
    can_share = db.Column(db.Boolean, default=False)
    can_admin = db.Column(db.Boolean, default=False)
    
    # Constraints
    granted_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    granted_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    conditions = db.Column(db.JSON, default={})  # IP restrictions, time constraints, etc.

class FileShare(db.Model):
    """Secure file sharing"""
    __tablename__ = 'file_shares'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = db.Column(db.String(36), db.ForeignKey('file_metadata.id'), nullable=False)
    share_token = db.Column(db.String(128), unique=True, nullable=False)
    created_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    # Access control
    password_hash = db.Column(db.String(255))
    expires_at = db.Column(db.DateTime)
    max_downloads = db.Column(db.Integer)
    download_count = db.Column(db.Integer, default=0)
    allowed_ips = db.Column(db.JSON, default=[])
    
    # Settings
    allow_preview = db.Column(db.Boolean, default=True)
    allow_download = db.Column(db.Boolean, default=True)
    notify_on_access = db.Column(db.Boolean, default=False)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_accessed = db.Column(db.DateTime)

class FileComment(db.Model):
    """File comments and annotations"""
    __tablename__ = 'file_comments'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = db.Column(db.String(36), db.ForeignKey('file_metadata.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    parent_comment_id = db.Column(db.String(36), db.ForeignKey('file_comments.id'))
    
    content = db.Column(db.Text, nullable=False)
    comment_type = db.Column(db.String(50), default='general')  # general, approval, suggestion, issue
    position = db.Column(db.JSON)  # For positional comments (page, coordinates, etc.)
    
    # Status
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_by_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    resolved_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id])
    resolver = db.relationship('User', foreign_keys=[resolved_by_id])
    replies = db.relationship('FileComment', backref=db.backref('parent_comment', remote_side=[id]), lazy='dynamic')

class AuditLog(db.Model):
    """Comprehensive audit logging"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    
    # Event details
    event_type = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(100))
    resource_id = db.Column(db.String(36))
    action = db.Column(db.String(100), nullable=False)
    
    # Context
    details = db.Column(db.JSON, default={})
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    session_id = db.Column(db.String(100))
    
    # Classification
    severity = db.Column(db.String(20), default='info')  # info, warning, error, critical
    compliance_relevant = db.Column(db.Boolean, default=False)
    
    # Metadata
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    indexed = db.Column(db.Boolean, default=False)

class WorkflowTemplate(db.Model):
    """Workflow templates for document processes"""
    __tablename__ = 'workflow_templates'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = db.Column(db.String(36), db.ForeignKey('organizations.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100), nullable=False)
    
    # Configuration
    steps = db.Column(db.JSON, nullable=False)  # Workflow steps definition
    triggers = db.Column(db.JSON, default=[])  # Auto-trigger conditions
    sla_hours = db.Column(db.Integer, default=72)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    created_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class WorkflowInstance(db.Model):
    """Active workflow instances"""
    __tablename__ = 'workflow_instances'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = db.Column(db.String(36), db.ForeignKey('workflow_templates.id'), nullable=False)
    file_id = db.Column(db.String(36), db.ForeignKey('file_metadata.id'), nullable=False)
    
    # Status
    status = db.Column(db.String(50), default='pending')  # pending, in_progress, completed, cancelled
    current_step = db.Column(db.Integer, default=0)
    
    # Participants
    initiated_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    current_assignee_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    
    # Tracking
    step_history = db.Column(db.JSON, default=[])
    comments = db.Column(db.JSON, default=[])
    due_date = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    completed_at = db.Column(db.DateTime)

# Form Classes
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=80)])
    password = PasswordField('Password', validators=[DataRequired()])
    totp_code = StringField('2FA Code', validators=[Length(min=0, max=6)])
    remember_me = BooleanField('Remember Me')

class UploadForm(FlaskForm):
    files = FileField('Files', validators=[FileRequired()])
    folder_path = StringField('Folder Path')
    classification = SelectField('Classification', 
                               choices=[('public', 'Public'), ('internal', 'Internal'), 
                                      ('confidential', 'Confidential'), ('restricted', 'Restricted')],
                               default='internal')
    category = StringField('Category')
    tags = StringField('Tags (comma separated)')
    description = TextAreaField('Description')

# Utility Functions
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def get_file_icon(file_type):
    """Get appropriate icon for file type"""
    icons = {
        'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📄',
        'xls': '📊', 'xlsx': '📊', 'csv': '📊',
        'ppt': '📊', 'pptx': '📊',
        'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️',
        'mp4': '🎥', 'avi': '🎥', 'mov': '🎥',
        'mp3': '🎵', 'wav': '🎵',
        'zip': '📦', 'rar': '📦', '7z': '📦',
        'py': '🐍', 'js': '📜', 'html': '🌐', 'css': '🎨'
    }
    return icons.get(file_type.lower(), '📄')

def log_audit_event(user_id, event_type, action, resource_type=None, resource_id=None, details=None):
    """Log audit events for compliance"""
    try:
        audit_log = AuditLog(
            organization_id=session.get('organization_id'),
            user_id=user_id,
            event_type=event_type,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent'),
            session_id=session.get('session_id'),
            compliance_relevant=True
        )
        db.session.add(audit_log)
        db.session.commit()
        
        # Index in Elasticsearch for search
        if es:
            try:
                es.index(
                    index='audit-logs',
                    body={
                        'timestamp': audit_log.timestamp.isoformat(),
                        'user_id': user_id,
                        'event_type': event_type,
                        'action': action,
                        'resource_type': resource_type,
                        'resource_id': resource_id,
                        'details': details,
                        'ip_address': audit_log.ip_address
                    }
                )
            except Exception as e:
                app.logger.warning(f"Failed to index audit log: {e}")
                
    except Exception as e:
        app.logger.error(f"Failed to log audit event: {e}")

def requires_auth(f):
    """Enhanced authentication decorator"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({'error': 'Authentication required'}), 401
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('login'))
        
        # Check if user is still active
        user = User.query.get(session['user_id'])
        if not user or user.status != 'active':
            session.clear()
            if request.is_json:
                return jsonify({'error': 'Account inactive'}), 401
            flash('Your account is no longer active.', 'error')
            return redirect(url_for('login'))
        
        return f(*args, **kwargs)
    return decorated_function

def requires_role(required_role):
    """Role-based access control decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401
            
            user = User.query.get(session['user_id'])
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            role_hierarchy = {
                'user': 0,
                'manager': 1,
                'admin': 2,
                'super_admin': 3
            }
            
            user_level = role_hierarchy.get(user.role, 0)
            required_level = role_hierarchy.get(required_role, 99)
            
            if user_level < required_level:
                log_audit_event(user.id, 'access_denied', 'insufficient_role', 
                              details={'required_role': required_role, 'user_role': user.role})
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Background Tasks
@celery.task
def process_file_content(file_id):
    """Extract and index file content"""
    try:
        file_meta = FileMetadata.query.get(file_id)
        if not file_meta:
            return {'error': 'File not found'}
        
        # Extract text content based on file type
        content = ""
        try:
            if file_meta.file_type.lower() in ['pdf', 'doc', 'docx', 'txt', 'rtf']:
                content = textract.process(file_meta.file_path).decode('utf-8')
        except Exception as e:
            app.logger.warning(f"Failed to extract content from {file_meta.name}: {e}")
        
        # Index in Elasticsearch
        if es and content:
            try:
                es.index(
                    index='file-content',
                    id=file_id,
                    body={
                        'file_id': file_id,
                        'organization_id': file_meta.organization_id,
                        'name': file_meta.name,
                        'content': content,
                        'file_type': file_meta.file_type,
                        'classification': file_meta.classification,
                        'tags': file_meta.tags,
                        'created_at': file_meta.created_at.isoformat(),
                        'created_by': file_meta.created_by_id
                    }
                )
            except Exception as e:
                app.logger.error(f"Failed to index file content: {e}")
        
        return {'status': 'completed', 'content_length': len(content)}
    
    except Exception as e:
        app.logger.error(f"Error processing file {file_id}: {e}")
        return {'error': str(e)}

@celery.task
def apply_retention_policies():
    """Apply data retention policies"""
    try:
        # Find files that should be deleted based on retention policy
        cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=app.config['RETENTION_POLICY_DAYS'])
        
        expired_files = FileMetadata.query.filter(
            FileMetadata.retention_until < datetime.datetime.utcnow(),
            FileMetadata.legal_hold == False
        ).all()
        
        for file_meta in expired_files:
            try:
                # Move to archive or delete based on classification
                if file_meta.classification in ['confidential', 'restricted']:
                    # Secure deletion
                    if os.path.exists(file_meta.file_path):
                        os.remove(file_meta.file_path)
                
                # Log deletion
                log_audit_event(None, 'data_retention', 'file_deleted', 
                              'file', file_meta.id, 
                              {'reason': 'retention_policy', 'file_name': file_meta.name})
                
                db.session.delete(file_meta)
            
            except Exception as e:
                app.logger.error(f"Failed to delete expired file {file_meta.id}: {e}")
        
        db.session.commit()
        return {'processed': len(expired_files)}
    
    except Exception as e:
        app.logger.error(f"Error in retention policy task: {e}")
        return {'error': str(e)}

# Routes

@app.route('/')
@requires_auth
def index():
    """Enhanced dashboard with analytics"""
    user = User.query.get(session['user_id'])
    
    # Get user's accessible files
    if user.is_admin:
        files = FileMetadata.query.filter_by(
            organization_id=session['organization_id'],
            is_folder=False
        ).order_by(FileMetadata.updated_at.desc()).limit(50).all()
    else:
        # Files user has permission to or created
        files = db.session.query(FileMetadata).join(FilePermission).filter(
            FileMetadata.organization_id == session['organization_id'],
            FileMetadata.is_folder == False,
            db.or_(
                FilePermission.user_id == user.id,
                FileMetadata.created_by_id == user.id
            )
        ).order_by(FileMetadata.updated_at.desc()).limit(50).all()
    
    # Analytics data
    analytics = {
        'total_files': FileMetadata.query.filter_by(
            organization_id=session['organization_id'], 
            is_folder=False
        ).count(),
        'total_size': db.session.query(db.func.sum(FileMetadata.size)).filter_by(
            organization_id=session['organization_id'],
            is_folder=False
        ).scalar() or 0,
        'uploads_this_week': FileMetadata.query.filter(
            FileMetadata.organization_id == session['organization_id'],
            FileMetadata.created_at >= datetime.datetime.utcnow() - datetime.timedelta(days=7)
        ).count(),
        'total_users': User.query.filter_by(organization_id=session['organization_id']).count()
    }
    
    return render_template('index.html', 
                         files=files, 
                         analytics=analytics,
                         user=user)

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("10 per minute")
def login():
    """Enhanced login with 2FA support"""
    form = LoginForm()
    
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        
        if user and user.check_password(form.password.data):
            # Check if account is locked
            if user.locked_until and user.locked_until > datetime.datetime.utcnow():
                flash('Account is temporarily locked. Please try again later.', 'error')
                return render_template('login.html', form=form)
            
            # Check 2FA if enabled
            if user.two_factor_enabled:
                if not form.totp_code.data or not user.verify_totp(form.totp_code.data):
                    flash('Invalid 2FA code.', 'error')
                    log_audit_event(user.id, 'authentication', 'login_failed_2fa')
                    return render_template('login.html', form=form)
            
            # Reset failed attempts
            user.failed_login_attempts = 0
            user.locked_until = None
            user.last_login = datetime.datetime.utcnow()
            
            # Create session
            session['user_id'] = user.id
            session['organization_id'] = user.organization_id
            session['session_id'] = str(uuid.uuid4())
            session.permanent = form.remember_me.data
            
            db.session.commit()
            
            log_audit_event(user.id, 'authentication', 'login_success')
            flash(f'Welcome back, {user.display_name}!', 'success')
            return redirect(url_for('index'))
        
        else:
            # Handle failed login
            if user:
                user.failed_login_attempts += 1
                if user.failed_login_attempts >= 5:
                    user.locked_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
                db.session.commit()
                log_audit_event(user.id if user else None, 'authentication', 'login_failed')
            
            flash('Invalid username or password.', 'error')
    
    return render_template('login.html', form=form)

@app.route('/logout')
@requires_auth
def logout():
    """Secure logout with audit logging"""
    user_id = session.get('user_id')
    log_audit_event(user_id, 'authentication', 'logout')
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('login'))

@app.route('/api/upload', methods=['POST'])
@requires_auth
@limiter.limit("100 per hour")
def upload_file():
    """Enhanced file upload with enterprise features"""
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        user = User.query.get(session['user_id'])
        files = request.files.getlist('files')
        folder_path = request.form.get('folder_path', '')
        classification = request.form.get('classification', 'internal')
        category = request.form.get('category', '')
        tags = request.form.get('tags', '').split(',') if request.form.get('tags') else []
        
        uploaded_files = []
        
        for file in files:
            if file.filename == '':
                continue
            
            if not allowed_file(file.filename):
                return jsonify({'error': f'File type not allowed: {file.filename}'}), 400
            
            # Generate secure filename
            original_name = file.filename
            secure_name = secure_filename(original_name)
            file_id = str(uuid.uuid4())
            file_extension = secure_name.rsplit('.', 1)[1].lower() if '.' in secure_name else ''
            stored_filename = f"{file_id}.{file_extension}"
            
            # Create folder structure
            upload_path = os.path.join(app.config['UPLOAD_FOLDER'], folder_path.strip('/'))
            os.makedirs(upload_path, exist_ok=True)
            
            file_path = os.path.join(upload_path, stored_filename)
            
            # Save file
            file.save(file_path)
            
            # Calculate file properties
            file_size = os.path.getsize(file_path)
            mime_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
            
            # Create metadata record
            file_meta = FileMetadata(
                id=file_id,
                organization_id=session['organization_id'],
                name=secure_name,
                original_name=original_name,
                file_path=file_path,
                file_type=file_extension,
                mime_type=mime_type,
                size=file_size,
                checksum='',  # Will be calculated
                folder_path=folder_path,
                classification=classification,
                category=category,
                tags=tags,
                created_by_id=user.id
            )
            
            # Calculate checksum
            file_meta.checksum = file_meta.calculate_checksum(file_path)
            
            # Set retention policy
            retention_days = app.config.get('RETENTION_POLICY_DAYS', 2555)
            file_meta.retention_until = datetime.datetime.utcnow() + datetime.timedelta(days=retention_days)
            
            db.session.add(file_meta)
            db.session.commit()
            
            # Grant creator full permissions
            permission = FilePermission(
                file_id=file_meta.id,
                user_id=user.id,
                can_read=True,
                can_write=True,
                can_delete=True,
                can_share=True,
                can_admin=True,
                granted_by_id=user.id
            )
            db.session.add(permission)
            db.session.commit()
            
            # Background processing
            process_file_content.delay(file_meta.id)
            
            # Log upload
            log_audit_event(user.id, 'file_management', 'file_uploaded', 
                          'file', file_meta.id, 
                          {'file_name': original_name, 'file_size': file_size})
            
            uploaded_files.append({
                'id': file_meta.id,
                'name': file_meta.name,
                'size': file_meta.size,
                'type': file_meta.file_type
            })
        
        return jsonify({
            'message': f'Successfully uploaded {len(uploaded_files)} files',
            'files': uploaded_files
        })
    
    except Exception as e:
        app.logger.error(f"Upload error: {e}")
        return jsonify({'error': 'Upload failed'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        # Create default organization if not exists
        if not Organization.query.first():
            default_org = Organization(
                name='Default Organization',
                domain='default.local'
            )
            db.session.add(default_org)
            db.session.commit()
            
            # Create default admin user
            admin_user = User(
                organization_id=default_org.id,
                username='admin',
                email='admin@default.local',
                password_hash=generate_password_hash('admin123'),
                display_name='System Administrator',
                role='super_admin',
                department='IT'
            )
            db.session.add(admin_user)
            db.session.commit()
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
