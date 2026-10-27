# Phân quyền người dùng

Bảng này khớp với quy tắc bảo mật Firestore/Storage (`firestore.rules`, `storage.rules`) và giao diện hiện tại.
Quyền được kiểm soát ở **tầng dữ liệu** (không chỉ ẩn nút trên giao diện), trừ những chỗ ghi chú "chỉ chặn ở giao diện".

Vai trò: **Chủ** (`owner`), **Quản lý** (`manager`), **Lễ tân** (`reception`), **Buồng phòng** (`housekeeping`),
**Bảo vệ** (`security`), **Khách hàng** (`customer`). Người tự đăng ký luôn là Khách hàng; chỉ Chủ/Quản lý cấp quyền nhân viên ở *Cài đặt*.

| Chức năng | Chủ | Quản lý | Lễ tân | Buồng phòng | Bảo vệ | Khách hàng |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Vào khu quản lý (`/app`) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (về `/account`) |
| Tổng quan (số phòng, khách đến/đi hôm nay) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lịch phòng: xem, bấm tên để xem chi tiết đặt phòng | ✅ | ✅ | ✅ | ✅ (*) | ✅ (*) | ❌ |
| Lịch phòng: xem hồ sơ khách + ảnh CCCD trong chi tiết | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Đặt phòng: tạo mới, chuyển Chờ xác nhận ⇄ Đã xác nhận ⇄ Nhận phòng, Trả phòng, Hủy/Từ chối | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Đặt phòng: **Sửa giá**, áp **mã giảm giá** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Lịch sử & thống kê (Đã trả phòng, Đã hủy) — chỉ xem | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Hoàn tác trả phòng, khôi phục đặt phòng đã hủy (luật Firestore chặn cả quản lý) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Khách lưu trú: xem, thêm, sửa, tải ảnh giấy tờ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Khách lưu trú: **xóa** hồ sơ (kèm ảnh) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mã giảm giá: tạo, xem danh sách, xóa | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Phòng: thêm, sửa giá, bảo trì, xóa | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cài đặt: tỷ giá USD, bật/tắt tự từ chối yêu cầu quá hạn | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cài đặt: số yêu cầu đang chờ tối đa mỗi tài khoản | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cài đặt: giao diện website (chọn giao diện, bật/tắt hiệu ứng, tự chuyển Noel) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cài đặt: cấp/đổi vai trò tài khoản | ✅ | ✅ (không đụng tài khoản Chủ, không cấp quyền Chủ) | ❌ | ❌ | ❌ | ❌ |
| Xem trang giới thiệu, lịch phòng trống (không cần đăng nhập) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gửi yêu cầu đặt phòng online, đổi ngày/phòng trước khi gửi, dùng mã giảm giá | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Xem các đặt phòng **của chính mình** (`/account`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tự hủy đặt phòng online của mình khi còn "Chờ xác nhận" hoặc "Đã xác nhận" (có hộp thoại hỏi lại); không hủy được khi đã "Nhận phòng" | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Xem Chính sách quyền riêng tư, Hỏi & Đáp, Cảm nhận đã duyệt (không cần đăng nhập) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sửa nội dung** Chính sách quyền riêng tư và Hỏi & Đáp (ngay trên trang) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gửi cảm nhận (mỗi tài khoản một cảm nhận, tự sửa/xóa của mình; sửa thì phải duyệt lại) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Duyệt / từ chối / xóa** cảm nhận của khách (mục Nội dung → Cảm nhận khách) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Xem đặt phòng / hồ sơ khách của người khác | theo vai trò ở trên | | | | | ❌ |

(*) Buồng phòng và Bảo vệ đọc được dữ liệu đặt phòng (tên, điện thoại, email, giá) vì cần biết khách đến/đi. Nếu muốn họ chỉ thấy tên + phòng + ngày thì cần tách dữ liệu; hãy báo để làm.

## Ghi chú
- **Lễ tân** chỉ đổi được *trạng thái* đặt phòng. Giá, mã giảm giá, ngày, phòng chỉ Chủ/Quản lý sửa (chặn ở quy tắc dữ liệu).
- **Bắt buộc có hồ sơ khách mới được Nhận phòng**: chặn ở giao diện (Chủ/Quản lý/Lễ tân đều chịu cùng quy tắc).
- **Buồng phòng và Bảo vệ** hiện chỉ xem (Tổng quan, Lịch phòng). Chia ca, chấm công, giao việc dọn phòng sẽ làm ở Giai đoạn 3.
- **Khách hàng** không đọc được danh sách mã giảm giá; chỉ kiểm tra được từng mã khi biết đúng mã, và mỗi mã dùng được một lần.
- Lịch phòng công khai chỉ dùng bản sao `busy` (phòng + ngày + trạng thái), không có thông tin cá nhân.
