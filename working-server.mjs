import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting FileFlowMaster server...');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: {
      local_storage: true,
      file_upload: true,
      dual_mode: true
    }
  });
});

// Mock authentication middleware
app.use('/api', (req, res, next) => {
  // Mock user for development
  req.user = {
    claims: {
      sub: 'dev-user-123',
      email: 'dev@fileflowmaster.local',
      name: 'Dev User'
    }
  };
  next();
});

// Files API (mocked)
app.get('/api/files', (req, res) => {
  res.json({
    files: [],
    total: 0,
    page: 1,
    totalPages: 0
  });
});

app.post('/api/files/upload', (req, res) => {
  // Mock successful upload
  setTimeout(() => {
    res.json({
      id: `file_${Date.now()}`,
      name: 'uploaded-file.txt',
      size: 1024,
      mimeType: 'text/plain',
      uploadedAt: new Date().toISOString()
    });
  }, 1000); // Simulate upload time
});

// Projects API (mocked)
app.get('/api/projects', (req, res) => {
  res.json({
    projects: [{
      id: 'default-project',
      name: 'Default Project',
      description: 'Default project for file uploads',
      createdAt: new Date().toISOString()
    }],
    total: 1,
    page: 1,
    totalPages: 1
  });
});

// Authentication endpoints
app.get('/api/auth/user', (req, res) => {
  res.json({
    id: 'dev-user-123',
    email: 'dev@fileflowmaster.local',
    firstName: 'Dev',
    lastName: 'User',
    profileImageUrl: null
  });
});

// Legacy user endpoint
app.get('/api/user', (req, res) => {
  res.json({
    id: 'dev-user-123',
    email: 'dev@fileflowmaster.local',
    firstName: 'Dev',
    lastName: 'User',
    profileImageUrl: null
  });
});

// Login endpoint (mock)
app.get('/api/login', (req, res) => {
  res.redirect('/');
});

// Serve static files (built React app)
const distPath = path.join(__dirname, 'dist', 'public');
console.log('📁 Serving static files from:', distPath);

app.use(express.static(distPath));

// Catch-all handler: send back React's index.html file for SPA
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log('📄 Serving index.html for route:', req.path);
  res.sendFile(indexPath);
});

const server = createServer(app);
const port = 3001;
const host = 'localhost';

server.listen(port, host, () => {
  console.log(`🌐 Server running on http://${host}:${port}`);
  console.log('✨ Features enabled:');
  console.log('   • Local Storage upload/management');
  console.log('   • Dual mode (Server/Local) uploads');
  console.log('   • File validation & progress tracking');
  console.log('   • Mock authentication for development');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});