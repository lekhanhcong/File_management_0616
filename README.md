# 🚀 FileFlowMaster - Advanced File Management System

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-8%2F8%20passing-brightgreen)
![Local Storage](https://img.shields.io/badge/local%20storage-✅%20implemented-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue)
![React](https://img.shields.io/badge/React-18.3.1-blue)

> Enterprise-grade file management system with dual-mode uploads (Server/Local Storage), real-time progress tracking, and comprehensive file validation.

## ✨ Features

### 🎯 **Core Functionality**
- **Dual Upload Mode**: Switch between Server and Local Storage uploads
- **Local Storage Manager**: Complete CRUD operations for browser storage
- **File Validation**: Comprehensive size, type, and format validation
- **Progress Tracking**: Real-time upload progress with visual indicators
- **Storage Monitoring**: Usage tracking and quota management
- **Error Handling**: User-friendly error messages and recovery

### 🎨 **User Interface**
- **Enhanced Upload Modal**: Mode switching with storage indicators
- **Local File Manager**: Dedicated UI for local storage management
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Theme**: Adaptive UI design
- **Drag & Drop**: Intuitive file upload interface

### 🔧 **Technical Features**
- **TypeScript**: Full type safety and IntelliSense
- **React 18**: Modern React with hooks and concurrent features
- **Playwright Testing**: Comprehensive E2E test suite
- **Drizzle ORM**: Type-safe database operations
- **Vite**: Fast development and build tooling

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/lekhanhcong/File_management_0616.git
cd File_management_0616

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
node working-server.mjs
```

### Access the Application
- **Main App**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health

## 🧪 Testing

### Run All Tests
```bash
# Simple Local Storage Tests (6/6 PASSING ✅)
npx playwright test tests/simple-local-storage.spec.js --project=chromium

# Manual Demo Tests (2/2 PASSING ✅)
npx playwright test tests/manual-demo.spec.js --project=chromium

# All tests together
npm test
```

### Test Coverage
- ✅ localStorage functionality
- ✅ File validation logic
- ✅ Base64 conversion
- ✅ Storage quota management
- ✅ Upload progress tracking
- ✅ Error handling

## 📁 Project Structure

```
├── client/src/
│   ├── lib/
│   │   ├── localStorage.ts      # 🆕 LocalStorage manager
│   │   └── fileUtils.ts         # File utilities
│   ├── hooks/
│   │   └── useLocalStorage.ts   # 🆕 React hook for localStorage
│   ├── components/
│   │   ├── FileUploadModal.tsx  # ✨ Enhanced upload modal
│   │   └── LocalFileManager.tsx # 🆕 Local storage UI
│   └── pages/
│       └── Home.tsx             # ✨ Integrated dashboard
├── server/
│   ├── storage.ts               # Database operations
│   └── routes.ts                # API endpoints
├── tests/
│   ├── simple-local-storage.spec.js  # Core functionality tests
│   ├── manual-demo.spec.js           # Integration tests
│   └── fixtures/                     # Test files
└── shared/
    ├── schema.ts                # Database schema
    └── validation.ts            # Input validation
```

## 🎯 Local Storage Features

### **LocalStorage Manager Class**
```typescript
// Store file in browser
const result = await localStorageManager.storeFile(file);

// Get all stored files
const files = localStorageManager.getAllFiles();

// Download file
localStorageManager.exportFile(fileId);

// Storage info
const info = localStorageManager.getStorageInfo();
```

### **React Hook Integration**
```typescript
const {
  files,
  storageInfo,
  uploadFile,
  deleteFile,
  downloadFile
} = useLocalStorage();
```

### **Validation & Limits**
- **File Types**: JPG, PNG, GIF, PDF, DOC, TXT, etc.
- **Size Limit**: 5MB per file (configurable)
- **Storage Quota**: 50MB total browser storage
- **Validation**: Real-time file type and size checking

## 🔧 API Endpoints

### Files
- `GET /api/files` - List files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id/download` - Download file
- `DELETE /api/files/:id` - Delete file

### Health
- `GET /api/health` - System health check

## 🛠️ Development

### Development Server
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run check

# Database operations
npm run db:push
npm run db:studio
```

### Testing Setup
```bash
# Install Playwright browsers
npx playwright install

# Run tests in headed mode
npx playwright test --headed

# Generate test report
npx playwright show-report
```

## 🎨 UI Components

### Upload Modal Features
- **Mode Toggle**: Server/Local storage switching
- **Progress Bar**: Visual upload progress
- **File Preview**: Name, size, type display
- **Error Messages**: Clear validation feedback
- **Storage Info**: Local storage usage display

### Local File Manager Features
- **File List**: All locally stored files
- **Actions**: Download, delete individual files
- **Storage Stats**: Usage percentage and limits
- **Bulk Actions**: Clear all files with confirmation

## 🔐 Security

- **File Validation**: Strict type and size checking
- **Storage Isolation**: Browser-based localStorage security
- **Input Sanitization**: All inputs validated and sanitized
- **Error Handling**: Secure error messages without data leakage

## 📊 Performance

- **Optimized Storage**: Efficient base64 encoding/decoding
- **Lazy Loading**: Components loaded on demand
- **Caching**: Smart caching for frequently accessed data
- **Bundle Size**: Optimized with Vite bundling

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Claude Code](https://claude.ai/code)
- Testing powered by [Playwright](https://playwright.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Database operations with [Drizzle ORM](https://orm.drizzle.team/)

---

**⭐ Star this repository if you find it helpful!**

**🔗 GitHub Repository**: [File Management System](https://github.com/lekhanhcong/File_management_0616)