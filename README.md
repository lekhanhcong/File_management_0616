# FileFlowMaster

A modern file management system built with React, TypeScript, and Express.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
cd /Users/lekhanhcong/05_AI_Code/Replit/FileFlowMaster-2
```

2. Make the setup script executable:
```bash
chmod +x setup.sh
```

3. Run the setup script:
```bash
./setup.sh
```

This will:
- Install all dependencies
- Create necessary directories
- Generate a .env file with secure defaults
- Initialize the database

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to:
```
http://localhost:5000
```

### Manual Setup (if setup.sh doesn't work)

1. Install dependencies:
```bash
npm install
```

2. Create .env file:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Create upload directories:
```bash
mkdir -p uploads/temp uploads/files
```

4. Initialize database:
```bash
npm run db:push
```

5. Start development server:
```bash
npm run dev
```

## 🔧 Troubleshooting

### Common Issues

1. **Port 5000 already in use**
   - Kill the process using port 5000: `lsof -ti:5000 | xargs kill -9`
   - Or change the port in server/index.ts

2. **Database connection errors**
   - Make sure DATABASE_URL in .env is correct
   - For SQLite (default): `DATABASE_URL=sqlite:./dev.db`
   - For PostgreSQL: `DATABASE_URL=postgresql://user:password@localhost:5432/fileflowmaster`

3. **Authentication issues in development**
   - The app uses mock authentication in development mode
   - Click "Login" to auto-login as a dev user

4. **Module not found errors**
   - Delete node_modules and package-lock.json
   - Run `npm install` again

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **UI Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Query (TanStack Query)
- **Routing**: Wouter
- **File Upload**: react-dropzone
- **WebSocket**: Native WebSocket API

### Backend (Express + TypeScript)
- **Framework**: Express.js
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js (with mock auth for dev)
- **File Storage**: Local filesystem
- **WebSocket**: ws library

### Features
- ✅ File upload/download
- ✅ File versioning
- ✅ Project organization
- ✅ User permissions
- ✅ Audit logging
- ✅ Real-time updates via WebSocket
- ✅ Share links
- ✅ Search and filtering

## 📝 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:push` - Push database schema changes
- `npm run check` - TypeScript type checking

### Project Structure

```
FileFlowMaster-2/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities
│   │   └── pages/       # Page components
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API routes
│   ├── db.ts           # Database connection
│   └── storage.ts       # Storage layer
├── shared/              # Shared types and schemas
└── uploads/             # File storage
```

## 🔒 Security Notes

- In development, the app uses mock authentication
- For production, configure proper authentication (Replit Auth or custom)
- Always use HTTPS in production
- Set strong SESSION_SECRET in production
- Configure proper CORS settings

## 📄 License

MIT
