
const express = require('express');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Directories
const UPLOAD_DIR = 'uploads';
const DATA_DIR = 'data';
const VERSIONS_DIR = 'file_versions';
const TRASH_DIR = 'trash';

// Data files
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FILES_METADATA = path.join(DATA_DIR, 'files_metadata.json');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit_log.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');

// Create directories
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(VERSIONS_DIR);
fs.ensureDirSync(TRASH_DIR);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = req.body.folder ? 
      path.join(UPLOAD_DIR, req.body.folder) : UPLOAD_DIR;
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|png|jpg|jpeg|zip|csv)$/;
    if (allowedTypes.test(file.originalname.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Helper functions
function initializeData() {
  // Initialize users
  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = {
      "admin": {
        id: uuidv4(),
        password: bcrypt.hashSync("admin123", 10),
        role: "admin",
        name: "Administrator",
        email: "admin@company.com",
        department: "IT",
        avatar: "/assets/avatars/admin.png",
        permissions: ["read", "write", "delete", "admin", "create_project", "manage_team"]
      },
      "freya": {
        id: uuidv4(),
        password: bcrypt.hashSync("freya123", 10),
        role: "manager",
        name: "Freya Browning",
        email: "freya@untitledui.com",
        department: "Design",
        avatar: "/assets/avatars/freya.png",
        permissions: ["read", "write", "create_project", "manage_team"]
      },
      "olivia": {
        id: uuidv4(),
        password: bcrypt.hashSync("olivia123", 10),
        role: "user",
        name: "Olivia Rhye",
        email: "olivia@untitledui.com",
        department: "Marketing",
        avatar: "/assets/avatars/olivia.png",
        permissions: ["read", "write"]
      }
    };
    fs.writeJsonSync(USERS_FILE, defaultUsers);
  }

  // Initialize other data files
  if (!fs.existsSync(FILES_METADATA)) fs.writeJsonSync(FILES_METADATA, {});
  if (!fs.existsSync(AUDIT_LOG_FILE)) fs.writeJsonSync(AUDIT_LOG_FILE, []);
  if (!fs.existsSync(PROJECTS_FILE)) fs.writeJsonSync(PROJECTS_FILE, {});
  if (!fs.existsSync(TEAMS_FILE)) fs.writeJsonSync(TEAMS_FILE, {});
}

function loadData(file) {
  try {
    return fs.readJsonSync(file);
  } catch {
    return file === AUDIT_LOG_FILE ? [] : {};
  }
}

function saveData(file, data) {
  try {
    fs.writeJsonSync(file, data, { spaces: 2 });
  } catch (error) {
    console.error(`Error saving ${file}:`, error);
  }
}

function logAuditEvent(action, details, req) {
  const auditLog = loadData(AUDIT_LOG_FILE);
  const event = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    user: req.session.user?.name || 'Unknown',
    userId: req.session.user?.id || 'unknown',
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    details
  };
  auditLog.push(event);
  saveData(AUDIT_LOG_FILE, auditLog);
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
  const ext = path.extname(filename).toLowerCase();
  const icons = {
    '.pdf': '📄',
    '.doc': '📝', '.docx': '📝',
    '.xls': '📊', '.xlsx': '📊',
    '.ppt': '📊', '.pptx': '📊',
    '.txt': '📃',
    '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️',
    '.zip': '📦'
  };
  return icons[ext] || '📎';
}

// Routes
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Authentication routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = loadData(USERS_FILE);
    
    const user = users[username];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
      id: user.id,
      username,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      permissions: user.permissions
    };

    logAuditEvent('login', { username }, req);
    res.json({ success: true, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  logAuditEvent('logout', {}, req);
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/user', requireAuth, (req, res) => {
  res.json(req.session.user);
});

// File management routes
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const { type = 'all', search = '', project = '', limit = 50 } = req.query;
    const metadata = loadData(FILES_METADATA);
    const files = [];

    function scanDirectory(dir, basePath = '') {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isFile()) {
          const ext = path.extname(item).toLowerCase();
          
          // Filter by type
          if (type !== 'all') {
            const typeFilters = {
              documents: ['.pdf', '.doc', '.docx'],
              spreadsheets: ['.xls', '.xlsx', '.csv'],
              presentations: ['.ppt', '.pptx'],
              images: ['.png', '.jpg', '.jpeg', '.gif', '.svg']
            };
            
            if (typeFilters[type] && !typeFilters[type].includes(ext)) {
              continue;
            }
          }
          
          // Search filter
          if (search && !item.toLowerCase().includes(search.toLowerCase())) {
            continue;
          }
          
          const fileMetadata = metadata[relativePath] || {};
          
          files.push({
            id: fileMetadata.id || uuidv4(),
            name: item,
            path: relativePath,
            size: formatFileSize(stats.size),
            sizeBytes: stats.size,
            modified: stats.mtime.toISOString(),
            type: ext.substring(1) || 'file',
            icon: getFileIcon(item),
            uploadedBy: fileMetadata.uploadedBy || 'Unknown',
            uploaderAvatar: fileMetadata.uploaderAvatar || '/assets/avatars/default.png',
            department: fileMetadata.department || 'General',
            project: fileMetadata.project || '',
            description: fileMetadata.description || '',
            tags: fileMetadata.tags || [],
            version: fileMetadata.version || 1,
            isStarred: fileMetadata.isStarred || false,
            lastAccessed: fileMetadata.lastAccessed || stats.mtime.toISOString()
          });
        } else if (stats.isDirectory()) {
          scanDirectory(fullPath, relativePath);
        }
      }
    }

    if (fs.existsSync(UPLOAD_DIR)) {
      scanDirectory(UPLOAD_DIR);
    }

    // Sort by modification date (newest first)
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    // Apply limit
    const limitedFiles = files.slice(0, parseInt(limit));
    
    res.json({
      files: limitedFiles,
      total: files.length,
      hasMore: files.length > parseInt(limit)
    });
  } catch (error) {
    console.error('Error loading files:', error);
    res.status(500).json({ error: 'Failed to load files' });
  }
});

app.get('/api/recent-files', requireAuth, (req, res) => {
  try {
    const metadata = loadData(FILES_METADATA);
    const recentFiles = [];

    for (const [filePath, fileData] of Object.entries(metadata)) {
      if (fileData.lastAccessed) {
        const fullPath = path.join(UPLOAD_DIR, filePath);
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          recentFiles.push({
            name: path.basename(filePath),
            path: filePath,
            size: formatFileSize(stats.size),
            modified: fileData.lastAccessed,
            type: path.extname(filePath).substring(1),
            icon: getFileIcon(filePath),
            uploadedBy: fileData.uploadedBy || 'Unknown',
            uploaderAvatar: fileData.uploaderAvatar || '/assets/avatars/default.png'
          });
        }
      }
    }

    // Sort by last accessed (newest first) and take top 5
    recentFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json(recentFiles.slice(0, 5));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load recent files' });
  }
});

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { folder = '', description = '', project = '', tags = '' } = req.body;
    const metadata = loadData(FILES_METADATA);
    const relativePath = path.relative(UPLOAD_DIR, req.file.path);
    
    const fileMetadata = {
      id: uuidv4(),
      uploadedBy: req.session.user.name,
      uploaderAvatar: req.session.user.avatar,
      uploadDate: new Date().toISOString(),
      department: req.session.user.department,
      description,
      project,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      version: 1,
      lastAccessed: new Date().toISOString()
    };

    metadata[relativePath] = fileMetadata;
    saveData(FILES_METADATA, metadata);

    logAuditEvent('file_uploaded', {
      filename: req.file.originalname,
      size: formatFileSize(req.file.size),
      project
    }, req);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: fileMetadata.id,
        name: req.file.originalname,
        path: relativePath,
        size: formatFileSize(req.file.size)
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/download/:fileId', requireAuth, (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = loadData(FILES_METADATA);
    
    // Find file by ID
    let filePath = null;
    for (const [path, data] of Object.entries(metadata)) {
      if (data.id === fileId) {
        filePath = path;
        break;
      }
    }

    if (!filePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fullPath = path.join(UPLOAD_DIR, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Update last accessed
    metadata[filePath].lastAccessed = new Date().toISOString();
    saveData(FILES_METADATA, metadata);

    logAuditEvent('file_downloaded', { filename: path.basename(filePath) }, req);
    res.download(fullPath);
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

app.delete('/api/files/:fileId', requireAuth, (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = loadData(FILES_METADATA);
    
    // Find file by ID
    let filePath = null;
    for (const [path, data] of Object.entries(metadata)) {
      if (data.id === fileId) {
        filePath = path;
        break;
      }
    }

    if (!filePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fullPath = path.join(UPLOAD_DIR, filePath);
    const trashPath = path.join(TRASH_DIR, `${Date.now()}_${path.basename(filePath)}`);

    // Move to trash instead of permanent delete
    if (fs.existsSync(fullPath)) {
      fs.moveSync(fullPath, trashPath);
    }

    // Update metadata
    metadata[filePath].deletedAt = new Date().toISOString();
    metadata[filePath].deletedBy = req.session.user.name;
    metadata[filePath].trashPath = trashPath;

    saveData(FILES_METADATA, metadata);

    logAuditEvent('file_deleted', { 
      filename: path.basename(filePath),
      movedToTrash: true 
    }, req);

    res.json({ success: true, message: 'File moved to trash' });
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Project management routes
app.get('/api/projects', requireAuth, (req, res) => {
  try {
    const projects = loadData(PROJECTS_FILE);
    const projectList = Object.entries(projects).map(([id, project]) => ({
      id,
      ...project
    }));
    res.json(projectList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

app.post('/api/projects', requireAuth, (req, res) => {
  try {
    const { name, description, type = 'general' } = req.body;
    const projects = loadData(PROJECTS_FILE);
    
    const projectId = uuidv4();
    const project = {
      name,
      description,
      type,
      createdBy: req.session.user.name,
      createdAt: new Date().toISOString(),
      members: [req.session.user.id],
      status: 'active'
    };

    projects[projectId] = project;
    saveData(PROJECTS_FILE, projects);

    logAuditEvent('project_created', { projectName: name }, req);
    res.json({ success: true, project: { id: projectId, ...project } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Dashboard stats
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const metadata = loadData(FILES_METADATA);
    const projects = loadData(PROJECTS_FILE);
    const users = loadData(USERS_FILE);

    const stats = {
      totalFiles: Object.keys(metadata).length,
      totalProjects: Object.keys(projects).length,
      totalUsers: Object.keys(users).length,
      storageUsed: 0,
      recentActivity: 0
    };

    // Calculate storage used
    for (const [filePath] of Object.entries(metadata)) {
      try {
        const fullPath = path.join(UPLOAD_DIR, filePath);
        if (fs.existsSync(fullPath)) {
          const stats_file = fs.statSync(fullPath);
          stats.storageUsed += stats_file.size;
        }
      } catch (error) {
        // Skip files that can't be accessed
      }
    }

    stats.storageUsed = formatFileSize(stats.storageUsed);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Audit log
app.get('/api/audit-log', requireAuth, requireRole(['admin', 'manager']), (req, res) => {
  try {
    const auditLog = loadData(AUDIT_LOG_FILE);
    const recentLogs = auditLog.slice(-100).reverse(); // Last 100 entries, newest first
    res.json({ logs: recentLogs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

// Error handler
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize data and start server
initializeData();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 File Management System running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
  console.log(`💾 Data directory: ${DATA_DIR}`);
});
