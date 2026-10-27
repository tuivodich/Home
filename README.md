# Nhà Gỗ Homestay Manager

Phần mềm quản lý homestay (React + Vite + Firebase), giao diện song ngữ Việt/Anh, tiền VNĐ kèm quy đổi USD.

## Đã có (Giai đoạn 1)
- Đăng nhập email/mật khẩu hoặc Google; phân quyền: chủ, quản lý, lễ tân, buồng phòng, bảo vệ, khách hàng (bảng quyền chi tiết: [`docs/phan-quyen.md`](docs/phan-quyen.md))
- Trang **Lịch sử** thống kê các đặt phòng đã trả phòng / đã hủy (doanh thu, lọc theo tháng, tìm kiếm, hoàn tác / khôi phục)
- Quản lý phòng, đặt/hủy/nhận/trả phòng (chặn trùng lịch), lịch phòng 14 ngày
- Khách lưu trú + ảnh CCCD/hộ chiếu/bằng lái (Firebase Storage, chỉ chủ/quản lý/lễ tân xem)

## Trang giới thiệu và đặt phòng công khai
- `/` trang giới thiệu (hero, phòng, tiện nghi, lịch phòng trống). Ai cũng xem được lịch, **không cần đăng nhập**; chỉ cần đăng nhập (Google hoặc email) khi bấm *Đặt phòng*.
- `/account` khách xem/hủy yêu cầu đặt phòng của mình. `/app` khu quản lý cho nhân viên.
- Yêu cầu đặt phòng online ở trạng thái **Chờ xác nhận** và giữ chỗ ngay; nhân viên xác nhận hoặc từ chối ở mục *Đặt phòng*.
- Lịch công khai đọc từ bộ sưu tập `busy` (chỉ phòng + ngày + trạng thái, không có dữ liệu cá nhân). Khi nhân viên lễ tân trở lên mở khu quản lý, `busy` tự được đồng bộ với `bookings`.
- **Mã giảm giá dùng 1 lần** (chủ/quản lý tạo ở mục *Mã giảm giá*): khách nhập ở bước Đặt phòng; mã được đánh dấu đã dùng ngay trong cùng lần ghi với đặt phòng nên không thể dùng 2 lần.
- **Tự từ chối** yêu cầu online còn "Chờ xác nhận" khi đã qua ngày nhận phòng (bật/tắt ở *Cài đặt*; chạy khi có nhân viên lễ tân trở lên mở trang quản lý).
- Thông tin liên hệ hiển thị ở footer chỉnh trong `src/lib/siteConfig.ts`.

## Chạy thử
```bash
npm install
npm run dev
```

## Thiết lập Firebase (một lần)
1. Firebase Console → project `sisterhome` → **Authentication → Sign-in method**: bật **Email/Password** và **Google**.
   Ở **Authentication → Settings → Authorized domains** thêm `nhago.web.app` (nếu chưa có) để đăng nhập Google hoạt động.
2. Tạo **Firestore Database** và **Storage**.
3. Deploy rules + giao diện: `npx firebase-tools login && npm run build && npx firebase-tools deploy`.
4. **Đăng ký tài khoản đầu tiên ngay sau khi deploy** – tài khoản đó sẽ là Chủ. Nhân viên đăng ký sau sẽ ở trạng thái "Chờ duyệt" cho đến khi chủ phân quyền ở **Cài đặt**.

## Tự động deploy từ GitHub
Workflow `.github/workflows/deploy.yml` chạy khi push vào `main`. Cần tạo secret `FIREBASE_SERVICE_ACCOUNT` (JSON service account của project) trong GitHub → Settings → Secrets.

## Bảo mật
Không commit token bot Telegram hay service account. Token bot sẽ lưu bằng Firebase Secret ở Giai đoạn 2.
