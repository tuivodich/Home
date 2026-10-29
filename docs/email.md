# Email thông báo cho khách

Khách nhận email khi: **đã nhận yêu cầu**, **đã xác nhận** (kèm số tiền cọc, tài khoản ngân hàng và mã VietQR nếu còn thiếu cọc), **không còn hiệu lực** (homestay từ chối hoặc hết hạn) và **nhắc lịch** vào ngày trước khi nhận phòng. Mỗi loại chỉ gửi một lần cho mỗi đặt phòng. Nếu khách đã liên kết Telegram thì cùng nội dung cũng được gửi qua Telegram.

## Thiết lập (một lần)
1. Dùng một Gmail của homestay (hoặc dịch vụ SMTP khác). Với Gmail: bật xác minh 2 bước, rồi tạo **Mật khẩu ứng dụng** (Tài khoản Google → Bảo mật → Mật khẩu ứng dụng). Không dùng mật khẩu đăng nhập thường.
2. GitHub → Settings → Secrets and variables → Actions → New repository secret:
   - `SMTP_USER` = địa chỉ Gmail (vd `nhago.homestay@gmail.com`)
   - `SMTP_PASS` = mật khẩu ứng dụng (16 ký tự)
3. Actions → *Deploy Cloud Functions* → Run workflow (secrets được lưu vào Secret Manager, không nằm trong mã nguồn).
4. Quản trị → *Quản lý email → Cài đặt email*: tích **Gửi email cho khách**, bấm Lưu lại, nhập email của bạn rồi **Gửi thử**.

Lần chạy đầu của bộ quét (mỗi 15 phút) ghi nhận các đặt phòng đang có là "đã báo" nên khách cũ không bị gửi hàng loạt.

## Ghi chú
- Gmail giới hạn khoảng 500 email/ngày (đủ cho homestay). Nếu cần địa chỉ gửi riêng/độ tin cậy cao hơn, dùng dịch vụ SMTP như Resend, Brevo (đổi `host` trong `functions/guest.js` → `createMailer`).
- Email chỉ gửi cho đặt phòng khách tự đặt trên website (`source = online`).

## Gửi email khuyến mãi / thông báo cho nhiều khách
*Quản lý email → Gửi email khách hàng* (chủ và quản lý): nhập tiêu đề, nội dung, tìm khách theo tên hoặc email, bấm **Chọn tất cả** (hoặc tích từng người) rồi **Gửi**. Nên bấm **Gửi thử cho tôi** trước: thư thử chỉ gửi tới email của chính bạn (email trong *Tài khoản của tôi*, email tài khoản quản trị hoặc email đăng nhập — chọn ở ô *Gửi thử tới*), trang báo rõ đã gửi tới địa chỉ nào. Mỗi lô tối đa 100 địa chỉ (giao diện tự chia lô); chỉ gửi tới địa chỉ đã có trong hệ thống (tài khoản khách, email trong đặt phòng); thư có dòng cuối mời khách trả lời nếu không muốn nhận thêm. Lịch sử gửi nằm cuối trang. Gmail giới hạn khoảng 500 thư mỗi ngày.
