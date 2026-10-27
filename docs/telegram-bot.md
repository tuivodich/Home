# Bot Telegram

Bot chạy bằng Cloud Functions (thư mục `functions/`, Node 22, vùng `us-central1`). Cần gói Blaze.

## Bot làm gì
- **Thông báo** tới chat nhân viên đã liên kết: yêu cầu đặt phòng mới (kèm nút **✅ Xác nhận / ❌ Từ chối**), khách tự hủy, cảm nhận mới chờ duyệt.
- **Lệnh**: `/homnay` (nhận/trả phòng hôm nay), `/cho` (yêu cầu đang chờ, có nút xử lý), `/trong 25/12` (phòng còn trống đêm đó), `/huylienket`.
- Nút Xác nhận kiểm tra trùng lịch như trên web; Xác nhận/Từ chối cập nhật luôn lịch bận công khai và nhả "khe" giới hạn yêu cầu chờ.

## Khách dùng bot (không cần đăng nhập)
Bất kỳ ai nhắn bot cũng dùng được các lệnh dưới đây (dữ liệu công khai giống trang web, không lộ thông tin khách):
- `/trong` (đêm nay), `/trong 25/12` (1 đêm), `/trong 25/12 27/12` (nhận → trả): phòng còn trống, giá, tạm tính, kèm nút **Đặt phòng trên website** mở sẵn ngày đã chọn. Không ghi năm thì lấy lần tới của ngày đó; tối đa 30 đêm.
- `/phong` (các phòng và giá), `/lienhe` (liên hệ), `/dat [ngày]` (nút mở trang đặt phòng).
- Đặt phòng vẫn làm trên website (cần đăng nhập, có giới hạn số yêu cầu chờ).
- Thông tin `/lienhe` do chủ/quản lý nhập ở **Cài đặt → Thông tin liên hệ** (lưu ở `settings/contact`), cùng nguồn với chân trang website; mục nào để trống thì bỏ qua. Tên homestay và địa chỉ website của bot nằm ở `functions/site.js`.

### Chống spam
- Chat chưa liên kết (khách): tối đa **6 tin/phút** và **80 tin/ngày**; vượt thì bot báo **một lần** rồi im lặng cho tới khi hết giới hạn.
- Mọi chat: lớp chặn trong bộ nhớ **20 tin/phút** (bỏ qua hẳn, không tốn lượt đọc/ghi cơ sở dữ liệu). Chat nhân viên đã liên kết chỉ chịu lớp này.
- Bộ đếm lưu ở `tgRate/{chatId}` (có trường `expireAt`; có thể bật chính sách TTL ở Firestore → TTL để tự dọn).
- Chỉnh số trong `LIMITS` ở `functions/bot.js`.

## Thiết lập (một lần)
1. **Token bot**: dùng token mới của bot (BotFather → `/token` hoặc `/revoke` để lấy cái mới; token cũ đã lộ thì phải thu hồi). Vào GitHub → Settings → Secrets and variables → Actions → thêm secret **`TELEGRAM_BOT_TOKEN`**. Không dán token vào chat/mã nguồn.
2. **Quyền cho service account** (Google Cloud → IAM → tài khoản trong secret `FIREBASE_SERVICE_ACCOUNT`), thêm các vai trò: *Cloud Functions Admin*, *Service Account User*, *Secret Manager Admin*, *Cloud Build Editor*, *Artifact Registry Administrator*. Nếu deploy báo thiếu quyền, đọc tên quyền trong log và thêm tương ứng.
3. Chạy workflow **Deploy Cloud Functions** (Actions → chạy tay) hoặc đẩy thay đổi vào `functions/`. Lần đầu Firebase tự bật các API cần thiết.
4. Trên web: **Cài đặt → Bot Telegram → Kết nối bot** (chỉ chủ; đăng ký webhook, chỉ cần một lần hoặc khi đổi token).
5. **Liên kết Telegram của tôi** → bấm đường dẫn mở Telegram → Start. Mỗi chủ/quản lý tự liên kết chat của mình. Có thể liên kết một **nhóm** nhân viên: thêm bot vào nhóm rồi gửi `/start MÃ` trong nhóm (ai trong nhóm cũng bấm được nút, nên chỉ lập nhóm với người tin cậy).

## Bảo mật
- Token nằm trong Secret Manager (`TELEGRAM_BOT_TOKEN`), không có trong mã hay Firestore.
- Webhook chỉ nhận yêu cầu có header `X-Telegram-Bot-Api-Secret-Token` đúng (suy ra từ token).
- Khách chỉ dùng được lệnh công khai; nút Xác nhận/Từ chối và lệnh `/homnay` `/cho` chỉ chạy trong chat đã liên kết.
- Chat chỉ nhận thông báo/bấm nút khi đã liên kết bằng mã dùng một lần (hết hạn 30 phút) do tài khoản có vai trò chủ/quản lý/lễ tân tạo; **vai trò được kiểm tra lại mỗi lần** (bị hạ quyền thì chat bị ngắt).
- Khách chỉ gọi được hàm thông báo cho đặt phòng/cảm nhận **của chính họ**, mỗi sự kiện gửi tối đa một lần.
- Chủ/quản lý xem và gỡ các chat đã liên kết ở Cài đặt (bộ sưu tập `tgChats`; mã liên kết và nhật ký gửi chỉ Cloud Functions truy cập).

## Phát triển / kiểm thử
```bash
npm ci --prefix functions
npx firebase-tools emulators:exec --only firestore "npm test --prefix functions"
```
