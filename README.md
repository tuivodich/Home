# Nhà Gỗ Homestay Manager

Phần mềm quản lý homestay (React + Vite + Firebase), giao diện song ngữ Việt/Anh, tiền VNĐ kèm quy đổi USD.

## Đã có (Giai đoạn 1)
- Đăng nhập email/mật khẩu hoặc Google; phân quyền: chủ, quản lý, lễ tân, buồng phòng, bảo vệ, khách hàng (bảng quyền chi tiết: [`docs/phan-quyen.md`](docs/phan-quyen.md))
- Trang **Lịch sử** thống kê các đặt phòng đã trả phòng / đã hủy (doanh thu, lọc theo tháng, tìm kiếm; chỉ **chủ** được hoàn tác trả phòng / khôi phục đặt phòng đã hủy)
- Quản lý phòng, đặt/hủy/nhận/trả phòng (chặn trùng lịch), lịch phòng 14 ngày
- Khách hàng (menu *Khách hàng → Quản lý khách hàng*) + ảnh CCCD/hộ chiếu/bằng lái (Firebase Storage, chỉ chủ/quản lý/lễ tân xem)

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

## Khách hàng thân thiết, báo cáo, dọn phòng, chi phí, sao lưu
- **Khách hàng thân thiết** (*Khách hàng → Khách hàng thân thiết*): hạng (mặc định Đồng/Bạc/Vàng/Kim cương) tự thăng theo số lần ở (đặt phòng online đã trả phòng) do chủ/quản lý đặt; chỉ **chủ** đặt tay hạng cho từng khách được (quản lý chỉ xem); khách xem hạng của mình ở mục cuối trang *Tài khoản của tôi* (không tự đổi được). Mỗi hạng có huy hiệu màu sau tên (header, đặt phòng của nhân viên) và **mã giảm giá riêng** (hạn 90 ngày, một lần, chỉ chủ mã dùng được) khách tự nhận ở *Đặt phòng của tôi* — hạng và mã do Cloud Functions (`loyaltyClaim`) kiểm tra ở máy chủ.
- **Báo cáo doanh thu** (*Tài chính*): theo tháng/năm — doanh thu (ghi nhận khi trả phòng), lợi nhuận, công suất, giá bình quân, theo phòng/nguồn, tiền thu trong kỳ, chi phí; xuất CSV.
- **Chi phí & công nợ**: ghi chi phí theo loại; khoản phải trả chưa thanh toán; khoản khách còn nợ (nút Thu tiền).
- **Dọn phòng** (*Quản lý dọn phòng*): trạng thái Cần dọn / Đang dọn / Sẵn sàng; khách trả phòng thì phòng tự "Cần dọn" (kèm tin Telegram).
- **Sao lưu** (chỉ chủ): tải JSON về máy; sao lưu ngay lên Cloud Storage; tự động mỗi ngày/tuần lúc 02:00 (giữ N bản). Cần Cloud Scheduler (xem `docs/telegram-bot.md`). Google Drive: tải file về rồi tải lên Drive (chưa tự động).

## Giá, đặt cọc QR, chính sách hủy, dịch vụ, hóa đơn
- **Giá & chính sách** (*Đặt phòng → Giá & chính sách*, chủ/quản lý): tăng giá cuối tuần, mùa, ngày lễ (thay giá cuối tuần), giảm giá ở dài ngày; % tiền cọc, giờ nhận/trả phòng, mức hoàn cọc khi hủy, phụ thu thêm khách / nhận sớm / trả muộn, dịch vụ đi kèm (đón đưa, thuê xe máy, ăn sáng, BBQ, tour…). Mã giảm giá vẫn áp thêm cho tiền ở. Công thức: `src/lib/pricing.ts` (có kiểm thử `scripts/pricing.test.mts`).
- **Tài khoản ngân hàng** do **chủ** thiết lập cùng trang. Khi đặt phòng (có cọc), khách thấy mã **VietQR** (ảnh từ img.vietqr.io) + nội dung chuyển khoản `NHAGO <mã đặt phòng>`; hãy quét thử mã trong trang để chắc đúng tài khoản.
- Nhân viên bấm **Đã nhận cọc / Thu thêm / Hoàn tiền** ở *Đặt phòng* (hoặc nút 💰 trong Telegram); công nợ còn lại và nhật ký thanh toán lưu trong đặt phòng. **Hóa đơn / phiếu thu** (`/invoice/<id>`) in hoặc lưu PDF bằng hộp thoại in.
- Giá tính ở máy khách; nhân viên luôn kiểm tra trước khi xác nhận (trang Đặt phòng hiện chi tiết giá và mã đặt phòng).

## Tài khoản của tôi, check-in online, khám phá khu vực
- Người dùng (Google hoặc email) vào menu *Tài khoản → Tài khoản của tôi* để lưu họ tên, loại/số giấy tờ, quốc tịch, ngày sinh, điện thoại, email. Hộp thoại **Xác nhận đặt phòng** điền sẵn từ đây (vẫn sửa được); chỉ **chủ** sửa được hồ sơ của người khác (*Nhân sự → Tài khoản nhân viên → Hồ sơ*).
- **Check-in online**: khi đặt phòng (hoặc sau đó ở trang *Đặt phòng của tôi*) khách điền giấy tờ và giờ đến dự kiến; nhân viên thấy ở *Khách lưu trú → Check-in online chờ xử lý*, bấm "Tạo hồ sơ" để điền sẵn vào biểu mẫu rồi lưu (ảnh giấy tờ vẫn chụp tại quầy).
- Trang **Khám phá khu vực** (`/explore`): bản đồ nhúng theo địa chỉ ở *Thông tin liên hệ*, hướng dẫn đường đi, địa điểm gợi ý theo nhóm; chủ/quản lý chỉnh ngay trên trang (đang là nội dung mẫu).

## Chấm công và ca làm nhân viên
- **Nhân viên** (mọi vai trò nhân viên): *Nhân sự → Chấm công*: bấm **Vào ca / Ra ca** (giờ lấy từ máy chủ, không lùi giờ được), xem ca hôm nay, lịch 7 ngày tới và các lượt gần đây (có báo đi muộn).
- **Chủ/quản lý**: *Nhân sự → Lịch ca* (danh mục ca kể cả ca qua đêm, xếp ca theo tuần, sao chép từ tuần trước) và *Bảng chấm công* (tổng hợp tháng: ngày công, giờ làm, đi muộn, vắng; chi tiết từng lượt; sửa/thêm/xóa; xuất CSV mở bằng Excel). Đi muộn = vào ca trễ hơn 10 phút so với giờ bắt đầu ca (`GRACE_MIN` trong `src/lib/hr.ts`).
- Chưa tính lương; chưa xác minh vị trí (GPS) nên nhân viên có thể bấm hộ nhau — chủ/quản lý đối chiếu khi cần.

## Bot Telegram
Thông báo yêu cầu đặt phòng / khách hủy / cảm nhận mới, nút Xác nhận–Từ chối ngay trong Telegram, lệnh nhân viên `/homnay` `/cho` `/doanhthu` `/tra`, nút "Đã dọn xong" buồng phòng, cảnh báo đi muộn/quên ra ca và nhắc khách chưa cọc/chưa có hồ sơ; khách dùng `/trong` `/gia` `/phong` `/tiennghi` `/chinhsach` `/diachi` `/tra MÃ` `/lienhe` (có chống spam) và bấm sang website đặt phòng. Hướng dẫn thiết lập: [`docs/telegram-bot.md`](docs/telegram-bot.md).

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

## Điểm tham quan đẹp, bản đồ và SEO
- Trang `/explore` (menu Khám phá → *Điểm tham quan đẹp*): bản đồ nhúng mặc định là **ảnh vệ tinh**. Vị trí lấy theo thứ tự: ô *Tọa độ bản đồ nhúng* ở Cài đặt → Thông tin liên hệ (vd `11.9404, 108.4583`: bấm chuột phải vào điểm trên Google Maps rồi chọn dòng số đầu tiên để sao chép), tọa độ có sẵn trong đường dẫn bản đồ dài, hoặc tìm theo địa chỉ. Link rút gọn `maps.app.goo.gl` không chứa tọa độ nên chỉ dùng cho nút chỉ đường.
- `/sitemap` (Sơ đồ trang web, có ở menu Thông tin và chân trang, liệt kê cả từng phòng), `/sitemap.xml` (do Cloud Function `sitemap` tạo động qua hosting rewrite, mỗi phòng một địa chỉ `/phong/:id` nên phòng mới tự có), `public/robots.txt`, thẻ canonical/Open Graph và dữ liệu có cấu trúc (`LodgingBusiness`) trong `index.html`. Khi thêm trang công khai mới nhớ thêm vào `functions/sitemap.js`.

## Kiểm thử tự động (CI)
`npm test` chạy: tính giá và báo cáo (`scripts/*.test.mts`), luật Firestore (`tests/rules.test.mjs`) và bot/Cloud Functions (`functions/test`) trên Firestore Emulator (cần JDK 21). Workflow *Kiểm thử* chạy ở mỗi pull request; hai workflow deploy chạy `npm test` trước khi đăng nên lỗi sẽ chặn deploy.

## Ảnh và trang chi tiết phòng
*Đặt phòng → Thiết lập phòng → Sửa*: thêm giới thiệu (Việt/Anh), tiện nghi riêng (mỗi dòng một mục) và tối đa 8 ảnh (tự thu nhỏ còn cạnh dài 1600px, tải lên Firebase Storage `rooms/{id}/…`, ai cũng xem được; ảnh đầu tiên là ảnh bìa). Mỗi phòng có trang `/phong/:id` (thư viện ảnh, giá, sức chứa, dữ liệu có cấu trúc `HotelRoom` cho Google) và thẻ phòng ở trang chủ hiện ảnh bìa. Lưu phòng trước rồi bấm Sửa mới thêm ảnh được.

## Kiểm tra giá phía máy chủ, email và Telegram cho khách
- **Giá không còn tin vào trình duyệt**: mỗi yêu cầu đặt phòng online được Cloud Functions tính lại theo bảng giá hiện hành (`functions/pricing.js`, có test so khớp với `src/lib/pricing.ts`) ngay khi khách báo bot (`tgNotify`), trước khi nhân viên xác nhận trên Telegram và mỗi 15 phút (`bookingSweep`). Nếu lệch, `total`/`deposit`/`lines` được sửa, đặt phòng ghi `priceCorrected` và quản lý nhận cảnh báo Telegram. Khách chọn nhận sớm/trả muộn/dịch vụ được lưu ở trường `opts`.
- **Email cho khách** (đã nhận yêu cầu / xác nhận / không còn hiệu lực / nhắc lịch): xem [`docs/email.md`](docs/email.md). Bật ở *Quản lý email → Cài đặt email*. Thư khuyến mãi/thông báo gửi nhiều khách ở *Quản lý email → Gửi email khách hàng* (tìm kiếm, chọn tất cả, mỗi lô tối đa 100 địa chỉ, chỉ gửi tới địa chỉ đã có trong hệ thống, lưu lịch sử gửi).
- **Telegram cho khách**: ở *Đặt phòng của tôi* khách bấm *Nhận thông báo qua Telegram* để liên kết; từ đó nhận cùng thông báo và dùng `/cuatoi`, `/huylienket` trong bot.

## Bot nhân viên, mã QR nhận phòng, thông báo đẩy
- Bot: `/taodat`, `/phongban`, `/baocao` và báo cáo ngày tự động 21:00 — xem `docs/telegram-bot.md`.
- **Mã QR nhận phòng**: đặt phòng đã xác nhận của khách có mục *Mã QR nhận phòng* (Đặt phòng của tôi). Nhân viên quét bằng camera điện thoại (đã đăng nhập quản lý) sẽ mở `/app/bookings?b=ID` với đặt phòng đó nổi bật ở đầu danh sách, từ đó xác nhận/nhận phòng như thường. QR tạo ngay trong trình duyệt, không gọi dịch vụ ngoài.
- **Thông báo đẩy** (Firebase Cloud Messaging): nhân viên bật ở Cài đặt → *Thông báo đẩy trên thiết bị này*. Cùng nội dung các thông báo Telegram gửi nhân viên (yêu cầu mới, khách hủy, cảm nhận, phòng cần dọn) được đẩy tới các thiết bị đã bật; token lưu ở `fcmTokens` và tự dọn khi hết hiệu lực hoặc người dùng bị hạ quyền. Service worker ở `public/sw.js`. iPhone cần thêm trang vào Màn hình chính (iOS 16.4+). Cần bật *Firebase Cloud Messaging API* của dự án.

## Sức chứa và phụ thu thêm khách
Mỗi phòng có **sức chứa tối đa** (khách nhiều nhất được đặt) và **số khách đã gồm trong giá** (mặc định bằng sức chứa tối đa, tức không phụ thu). Đặt số đã gồm nhỏ hơn sức chứa thì khách từ người thứ (đã gồm + 1) đến người thứ (tối đa) phụ thu thêm theo mức *Thêm khách* ở Giá & chính sách. Ví dụ tối đa 4, đã gồm 2 → khách thứ 3 và 4 phụ thu mỗi người mỗi đêm. Biểu mẫu phòng hiện ví dụ này và không cho lưu khi số đã gồm lớn hơn sức chứa tối đa.

## Đặt phòng bị treo: hết hạn và khách không đến
- **Chờ xác nhận** mà đã qua ngày nhận phòng → tự **Hết hạn** (Cài đặt → "Tự động từ chối…"; khách nhận email "không còn hiệu lực").
- **Đã xác nhận** mà đã qua cả ngày trả phòng và khách chưa nhận phòng → tự **Đã hủy – Khách không đến** (Cài đặt → "Tự động đánh dấu Khách không đến…", mặc định bật). Phòng được nhả; tiền cọc đã nhận **giữ nguyên trong sổ** (`paid`), việc giữ hay hoàn xử lý theo chính sách (nút Hoàn tiền vẫn dùng được); khách không bị gửi email; chủ/quản lý nhận tin Telegram.
- Trong khoảng từ ngày nhận phòng đến hết ngày trả phòng, đặt phòng đã xác nhận mà chưa đến chỉ hiện cảnh báo "Đã quá ngày nhận phòng" + nút **Khách không đến** để lễ tân chốt sớm; 08:00 và 18:00 bot nhắc chủ/quản lý (kèm nút) và cũng nhắc đặt phòng đang ở nhưng quá ngày trả phòng (không tự xử lý vì có thể khách gia hạn).
- Việc tự động chạy ở Cloud Functions `bookingSweep` (mỗi 2 giờ từ 06:00 đến 22:00 giờ Việt Nam, không cần ai mở trang quản lý) và cả khi nhân viên mở trang quản lý.

## Lịch chạy tự động, quốc tịch, ô chọn
- **Lịch Cloud Scheduler** (giờ Việt Nam): `bookingSweep` mỗi 2 giờ từ 06:00 đến 22:00 (dọn đặt phòng treo, kiểm giá, email còn sót — các việc cần tức thời đã chạy ngay khi xảy ra); `tgStaffAlerts` mỗi 30 phút trong 05:00–23:59 (nhân viên chưa vào ca/quên ra ca); `tgReminders` 08:00 và 18:00; `tgDailyReport` 21:00; `backupScheduled` 02:00.
- **Quốc tịch** là danh sách quốc gia (tên tiếng Anh quốc tế, `src/lib/countries.ts`) kèm mục *Khác* để tự nhập; dữ liệu nhập tay cũ như "Việt Nam" được nhận ra là Vietnam.
- Danh sách thả xuống của ô chọn luôn có nền đặc và chữ tương phản theo giao diện (trước đây nền ô trong suốt nên trình duyệt vẽ nền trắng với chữ sáng).
