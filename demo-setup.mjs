#!/usr/bin/env node

/**
 * FileFlowMaster - Demo Setup với dữ liệu test
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';

async function setupDemo() {
  console.log('🚀 FileFlowMaster Demo Setup\n');

  try {
    // 1. Tạo các thư mục cần thiết
    console.log('📁 Tạo thư mục uploads...');
    await fs.mkdir('./uploads/files', { recursive: true });
    await fs.mkdir('./uploads/temp', { recursive: true });
    console.log('✅ Thư mục đã sẵn sàng\n');

    // 2. Push schema to database
    console.log('📊 Tạo database schema...');
    try {
      execSync('npm run db:push', { stdio: 'inherit' });
      console.log('✅ Database schema tạo thành công\n');
    } catch (error) {
      console.log('ℹ️ Database schema có thể đã tồn tại\n');
    }

    // 3. Tạo demo files
    console.log('📄 Tạo demo files...');
    const demoFiles = [
      {
        name: 'company-profile.pdf',
        content: `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Demo Company Profile) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000103 00000 n 
0000000178 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
270
%%EOF`
      },
      {
        name: 'presentation.txt',
        content: `FileFlowMaster Demo Presentation

=== Slide 1: Giới thiệu ===
- Hệ thống quản lý file doanh nghiệp
- Tính năng upload, share, version control
- Bảo mật cao với authentication

=== Slide 2: Tính năng chính ===
- Drag & Drop upload
- Real-time collaboration  
- Advanced search & filtering
- Project organization
- Audit logs & analytics

=== Slide 3: Công nghệ ===
- Frontend: React 18 + TypeScript
- Backend: Node.js + Express
- Database: PostgreSQL/SQLite + Drizzle ORM
- Security: Helmet + Rate limiting
- Performance: Caching + Virtualization

=== Slide 4: Demo ===
Đã setup thành công FileFlowMaster!`
      },
      {
        name: 'data-export.csv',
        content: `ID,Name,Email,Role,Organization,CreatedAt
1,Dev User,dev@fileflowmaster.local,admin,Demo Company,2025-01-16
2,Manager User,manager@demo.com,manager,Demo Company,2025-01-16
3,Staff User,staff@demo.com,user,Startup Team,2025-01-16

Project Statistics:
- Total Projects: 3
- Active Files: 3  
- Total Storage: 15KB
- Users Online: 1`
      }
    ];

    for (const [index, file] of demoFiles.entries()) {
      const filePath = `./uploads/files/demo-${index + 1}-${file.name}`;
      await fs.writeFile(filePath, file.content);
      console.log(`   ✅ ${file.name} (${file.content.length} bytes)`);
    }

    console.log(`\n📈 Demo Summary:`);
    console.log(`   📊 3 Demo files created`);
    console.log(`   💾 Total size: ${demoFiles.reduce((sum, f) => sum + f.content.length, 0)} bytes`);
    console.log(`   📁 Stored in: ./uploads/files/\n`);

    // 4. Instructions
    console.log('🎯 Hoàn thành! Bạn có thể:');
    console.log('   1. Chạy: npm run dev');
    console.log('   2. Mở: http://localhost:8000');
    console.log('   3. Test upload files mới');
    console.log('   4. Search và filter files');
    console.log('   5. Kiểm tra các tính năng bảo mật\n');

    console.log('🔗 Để setup Cloud Database:');
    console.log('   1. Đăng ký miễn phí tại: https://neon.tech');
    console.log('   2. Copy connection string');
    console.log('   3. Update DATABASE_URL trong .env.production');
    console.log('   4. Chạy: npm run setup:cloud\n');

    console.log('✅ Demo setup thành công!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupDemo();