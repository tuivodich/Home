# Nhà Gỗ Homestay Manager

Phần mềm quản lý homestay (React + Vite + Firebase), giao diện song ngữ Việt/Anh, tiền VNĐ kèm quy đổi USD.

## Đã có (Giai đoạn 1)
- Đăng nhập email/mật khẩu, phân quyền: chủ, quản lý, lễ tân, buồng phòng, bảo vệ
- Quản lý phòng, đặt/hủy/nhận/trả phòng (chặn trùng lịch), lịch phòng 14 ngày
- Khách lưu trú + ảnh CCCD/hộ chiếu/bằng lái (Firebase Storage, chỉ chủ/quản lý/lễ tân xem)

## Chạy thử
```bash
npm install
npm run dev
```

## Thiết lập Firebase (một lần)
1. Firebase Console → project `sisterhome` → bật **Authentication → Email/Password**.
2. Tạo **Firestore Database** và **Storage**.
3. Deploy rules + giao diện: `npx firebase-tools login && npm run build && npx firebase-tools deploy`.
4. **Đăng ký tài khoản đầu tiên ngay sau khi deploy** – tài khoản đó sẽ là Chủ. Nhân viên đăng ký sau sẽ ở trạng thái "Chờ duyệt" cho đến khi chủ phân quyền ở **Cài đặt**.

## Tự động deploy từ GitHub
Workflow `.github/workflows/deploy.yml` chạy khi push vào `main`. Cần tạo secret `FIREBASE_SERVICE_ACCOUNT` (JSON service account của project) trong GitHub → Settings → Secrets.

## Bảo mật
Không commit token bot Telegram hay service account. Token bot sẽ lưu bằng Firebase Secret ở Giai đoạn 2.
