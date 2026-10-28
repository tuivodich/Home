# Nhà Gỗ Homestay Manager

Phần mềm quản lý homestay (React + Vite + Firebase), giao diện song ngữ Việt/Anh, tiền VNĐ kèm quy đổi USD.

## Đã có (Giai đoạn 1)
- Đăng nhập email/mật khẩu hoặc Google; phân quyền: chủ, quản lý, lễ tân, buồng phòng, bảo vệ, khách hàng (bảng quyền chi tiết: [`docs/phan-quyen.md`](docs/phan-quyen.md))
- Trang **Lịch sử** thống kê các đặt phòng đã trả phòng / đã hủy (doanh thu, lọc theo tháng, tìm kiếm; chỉ **chủ** được hoàn tác trả phòng / khôi phục đặt phòng đã hủy)
- Quản lý phòng, đặt/hủy/nhận/trả phòng (chặn trùng lịch), lịch phòng 14 ngày
- Khách lưu trú + ảnh CCCD/hộ chiếu/bằng lái (Firebase Storage, chỉ chủ/quản lý/lễ tân xem)

## Trang giới thiệu và đặt phòng công khai
- `/` trang giới thiệu (hero, phòng, tiện nghi, lịch phòng trống). Ai cũng xem được lịch, **không cần đăng nhập**; chỉ cần đăng nhập (Google hoặc email) khi bấm *Đặt phòng*.
- `/account` khách xem/hủy yêu cầu đặt phòng của mình. `/app` khu quản lý cho nhân viên.
- Yêu cầu đặt phòng online ở trạng thái **Chờ xác nhận** và giữ chỗ ngay; nhân viên xác nhận hoặc từ chối ở mục *Đặt phòng*.
- Lịch công khai đọc từ bộ sưu tập `busy` (chỉ phòng + ngày + trạng thái, không có dữ liệu cá nhân). Khi nhân viên lễ tân trở lên mở khu quản lý, `busy` tự được đồng bộ với `bookings`.
- **Mã giảm giá dùng 1 lần** (chủ/quản lý tạo ở mục *Mã giảm giá*): khách nhập ở bước Đặt phòng; mã được đánh dấu đã dùng ngay trong cùng lần ghi với đặt phòng nên không thể dùng 2 lần.
- **Tự từ chối** yêu cầu online còn "Chờ xác nhận" khi đã qua ngày nhận phòng (bật/tắt ở *Cài đặt*; chạy khi có nhân viên lễ tân trở lên mở trang quản lý).
- **Giới hạn yêu cầu đang chờ**: mỗi tài khoản chỉ có tối đa N yêu cầu "Chờ xác nhận" cùng lúc (mặc định 3, chủ/quản lý chỉnh ở *Cài đặt*, 1–20). Luật Firestore ép bằng "khe" `pend/{uid}_{n}`; khe tự nhả khi yêu cầu được xác nhận/từ chối/hủy (khi nhân viên mở khu quản lý). Yêu cầu đã xác nhận không tính.
- Thông tin liên hệ (điện thoại, Zalo, email, địa chỉ, Facebook, bản đồ) do chủ/quản lý nhập ở *Tổng quan → Cài đặt → Thông tin liên hệ* (Lịch phòng và Cài đặt nằm ngay dưới bảng Tổng quan; *Nhân sự → Tài khoản nhân viên* để phân quyền); hiện ở footer website và trong lệnh `/lienhe` của bot Telegram. Tên homestay chỉnh trong `src/lib/siteConfig.ts`.

## Giao diện website
- Trang công khai có 4 giao diện: **Đêm rừng thông** (mặc định), **Sương mai**, **Hoàng hôn tím sương** và **Đêm Noel tuyết trắng** (dây đèn, tuyết rơi, cây thông Noel, người tuyết, nút đỏ). Bật "Tự chuyển sang Noel" ở Cài đặt để trang tự dùng giao diện Noel từ 01/12 đến 05/01 mỗi năm.
- Chỉ **chủ/quản lý** đổi được ở *Cài đặt → Giao diện website* (lưu trong `settings/app`: `theme`, `themeAuto`, `effects`; luật Firestore kiểm tra giá trị hợp lệ). Khu quản lý của nhân viên giữ nguyên giao diện.
- Tranh nhà gỗ giữa rừng thông là SVG tự sinh (`src/landing/forest.ts`); hiệu ứng đom đóm/khói tắt được và tự tắt khi người dùng chọn giảm chuyển động.

## Chấm công và ca làm nhân viên
- **Nhân viên** (mọi vai trò nhân viên): *Nhân sự → Chấm công*: bấm **Vào ca / Ra ca** (giờ lấy từ máy chủ, không lùi giờ được), xem ca hôm nay, lịch 7 ngày tới và các lượt gần đây (có báo đi muộn).
- **Chủ/quản lý**: *Nhân sự → Lịch ca* (danh mục ca kể cả ca qua đêm, xếp ca theo tuần, sao chép từ tuần trước) và *Bảng chấm công* (tổng hợp tháng: ngày công, giờ làm, đi muộn, vắng; chi tiết từng lượt; sửa/thêm/xóa; xuất CSV mở bằng Excel). Đi muộn = vào ca trễ hơn 10 phút so với giờ bắt đầu ca (`GRACE_MIN` trong `src/lib/hr.ts`).
- Chưa tính lương; chưa xác minh vị trí (GPS) nên nhân viên có thể bấm hộ nhau — chủ/quản lý đối chiếu khi cần.

## Bot Telegram
Thông báo yêu cầu đặt phòng / khách hủy / cảm nhận mới, nút Xác nhận–Từ chối ngay trong Telegram, lệnh nhân viên `/homnay` `/cho`; khách tra `/trong` `/phong` `/lienhe` (có chống spam) và bấm sang website đặt phòng. Hướng dẫn thiết lập: [`docs/telegram-bot.md`](docs/telegram-bot.md).

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
