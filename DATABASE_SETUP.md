# 🗄️ Database Setup - FileFlowMaster

## 🚀 Cách tạo Database miễn phí

### Bước 1: Tạo tài khoản Neon (Miễn phí)

1. Truy cập: https://neon.tech
2. Đăng ký bằng GitHub/Google/Email
3. Tạo project mới:
   - **Database name**: `fileflowmaster`
   - **Region**: Singapore (gần Việt Nam nhất)
   - **Postgresql version**: 15 (mặc định)

### Bước 2: Lấy Connection String

1. Sau khi tạo project, vào **Dashboard**
2. Click **Connection Details**
3. Copy **Connection String** có dạng:
   ```
   postgresql://username:password@ep-xxx-xxx.ap-southeast-1.aws.neon.tech/fileflowmaster?sslmode=require
   ```

### Bước 3: Cấu hình ứng dụng

1. **Mở file `.env.production`**
2. **Thay thế** `DATABASE_URL` bằng connection string từ Neon:
   ```bash
   DATABASE_URL=postgresql://your-username:your-password@ep-xxx-xxx.ap-southeast-1.aws.neon.tech/fileflowmaster?sslmode=require
   ```

3. **Thay đổi SESSION_SECRET** thành chuỗi bảo mật:
   ```bash
   SESSION_SECRET=your-very-secure-random-string-here
   ```

### Bước 4: Chạy Migration

```bash
# Copy cấu hình production
cp .env.production .env

# Tạo bảng trong database
npm run db:push

# Hoặc chạy script tự động
npm run setup:cloud
```

### Bước 5: Khởi động với Cloud Database

```bash
# Chạy ở chế độ production với cloud database
npm run prod
```

## 🎯 Lệnh hữu ích

```bash
# Xem database trong browser
npm run db:studio

# Tạo migration mới
npm run db:generate

# Đẩy schema lên database
npm run db:push

# Quay lại SQLite local
cp .env.backup .env
```

## 📊 Kiểm tra kết nối

Sau khi setup xong, truy cập: http://localhost:8000

Nếu thấy:
- ✅ Đăng nhập thành công
- ✅ Upload file hoạt động
- ✅ Dữ liệu được lưu

➡️ **Database cloud đã sẵn sàng!**

## 🔄 Backup và Restore

```bash
# Backup database hiện tại
pg_dump $DATABASE_URL > backup.sql

# Restore từ backup
psql $DATABASE_URL < backup.sql
```

## 🆘 Troubleshooting

### Lỗi connection refused:
- Kiểm tra DATABASE_URL có đúng format
- Đảm bảo có `?sslmode=require` ở cuối URL

### Lỗi "no such table":
- Chạy lại: `npm run db:push`
- Kiểm tra schema trong `shared/schema.ts`

### Performance chậm:
- Neon free tier có limit
- Xem xét upgrade plan hoặc tối ưu query