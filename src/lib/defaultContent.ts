/**
 * Nội dung mặc định của các trang Chính sách quyền riêng tư và Hỏi & Đáp.
 * Khi chủ/quản lý chưa sửa (chưa có tài liệu trong Firestore) thì trang hiện nội dung này.
 * Cú pháp: dòng bắt đầu bằng "## " là tiêu đề mục, "- " là gạch đầu dòng, dòng trống ngăn cách đoạn, **chữ đậm**.
 */
export interface FaqItem { qVi: string; aVi: string; qEn: string; aEn: string }

export const DEFAULT_PRIVACY = {
  vi: `Nhà Gỗ Homestay ("chúng tôi") tôn trọng quyền riêng tư của bạn. Trang này giải thích chúng tôi thu thập, dùng và bảo vệ thông tin của bạn như thế nào khi bạn truy cập website và đặt phòng.

## 1. Thông tin chúng tôi thu thập
- **Khi tạo tài khoản:** email, tên hiển thị (nếu đăng nhập bằng Google).
- **Khi đặt phòng:** họ và tên, số điện thoại, email, ngày nhận và trả phòng, số khách, ghi chú và mã giảm giá (nếu có).
- **Khi nhận phòng:** thông tin giấy tờ tùy thân (CCCD, hộ chiếu hoặc bằng lái xe) gồm loại giấy tờ, số giấy tờ, quốc tịch, ngày sinh và ảnh giấy tờ, để đăng ký lưu trú theo quy định.
- **Khi gửi cảm nhận:** tên hiển thị, số sao và nội dung bạn viết.

## 2. Mục đích sử dụng
- Xử lý yêu cầu đặt phòng, liên hệ xác nhận, hỗ trợ trong thời gian lưu trú.
- Đăng ký lưu trú và thực hiện các nghĩa vụ theo quy định của pháp luật.
- Hiển thị cảm nhận của bạn trên website sau khi chúng tôi duyệt.
- Cải thiện chất lượng dịch vụ.

## 3. Ai nhìn thấy thông tin của bạn
- Người khác chỉ thấy phòng nào đã được đặt, **không** thấy tên, điện thoại hay email của bạn.
- Ảnh và số giấy tờ chỉ chủ, quản lý và lễ tân của homestay xem được.
- Chúng tôi không bán thông tin cá nhân. Chúng tôi chỉ cung cấp cho cơ quan có thẩm quyền khi pháp luật yêu cầu.
- Cảm nhận bạn gửi chỉ hiển thị công khai kèm tên bạn đã nhập, sau khi được duyệt.

## 4. Lưu trữ và bảo mật
- Dữ liệu được lưu trên nền tảng Google Firebase (Google Cloud) và truyền qua kết nối mã hóa.
- Quyền truy cập được phân theo vai trò của nhân viên.
- Chúng tôi lưu thông tin trong thời gian cần thiết cho các mục đích nêu trên và theo quy định của pháp luật.

## 5. Quyền của bạn
Bạn có quyền yêu cầu xem, chỉnh sửa hoặc xóa thông tin cá nhân của mình, hoặc rút lại sự đồng ý đã cho. Hãy liên hệ homestay theo thông tin ở cuối trang. Bạn cũng có thể tự hủy đặt phòng và xóa cảm nhận của mình trên website.

## 6. Lưu trữ cục bộ trên thiết bị
Website dùng bộ nhớ của trình duyệt để ghi nhớ ngôn ngữ bạn chọn và trạng thái đăng nhập.

## 7. Thay đổi chính sách
Chúng tôi có thể cập nhật trang này. Ngày cập nhật gần nhất được ghi ở đầu trang.`,
  en: `Nhà Gỗ Homestay ("we") respects your privacy. This page explains how we collect, use and protect your information when you visit the website and book a room.

## 1. Information we collect
- **When you create an account:** email and display name (if you sign in with Google).
- **When you book:** full name, phone number, email, check-in and check-out dates, number of guests, notes and a discount code (if any).
- **At check-in:** identity document details (national ID, passport or driver's license): document type, number, nationality, date of birth and a photo of the document, to register your stay as required by law.
- **When you leave a review:** display name, star rating and the text you write.

## 2. How we use it
- To process booking requests, confirm with you and support you during your stay.
- To register your stay and meet our legal obligations.
- To show your review on the website after we approve it.
- To improve our service.

## 3. Who can see your information
- Other visitors only see which rooms are booked. They do **not** see your name, phone or email.
- Document photos and numbers are visible only to the homestay's owner, managers and front-desk staff.
- We do not sell personal information. We only share it with competent authorities when the law requires.
- A review you submit is shown publicly with the name you entered, after approval.

## 4. Storage and security
- Data is stored on Google Firebase (Google Cloud) and transmitted over encrypted connections.
- Access is limited by staff role.
- We keep information for as long as needed for the purposes above and as required by law.

## 5. Your rights
You may ask to view, correct or delete your personal information, or withdraw your consent. Please contact the homestay using the details at the bottom of the page. You can also cancel your own booking and delete your own review on the website.

## 6. Local storage on your device
The website uses your browser's storage to remember the language you chose and your sign-in state.

## 7. Changes to this policy
We may update this page. The latest update date is shown at the top.`,
};

export const DEFAULT_FAQ: FaqItem[] = [
  {
    qVi: "Làm sao để đặt phòng?",
    aVi: "Vào mục Đặt phòng, chọn ngày nhận phòng, ngày trả phòng và phòng, rồi bấm “Đặt phòng” ở phòng còn trống. Bạn chỉ cần đăng nhập (Google hoặc email) ở bước này. Điền họ tên, số điện thoại, email rồi gửi yêu cầu.",
    qEn: "How do I book a room?",
    aEn: "Open the Book section, choose your check-in date, check-out date and room, then press “Book” on an available room. You only need to sign in (Google or email) at this step. Fill in your name, phone and email, then send the request.",
  },
  {
    qVi: "Tôi có cần đăng nhập để xem phòng trống không?",
    aVi: "Không. Bạn xem lịch phòng trống và giá mà không cần tài khoản. Chỉ khi bấm “Đặt phòng” bạn mới cần đăng nhập.",
    qEn: "Do I need to sign in to see availability?",
    aEn: "No. You can see availability and prices without an account. You only sign in when you press “Book”.",
  },
  {
    qVi: "Khi nào đặt phòng của tôi được xác nhận?",
    aVi: "Sau khi bạn gửi, yêu cầu ở trạng thái “Chờ xác nhận” và phòng được giữ chỗ cho bạn. Homestay sẽ xem yêu cầu và liên hệ xác nhận. Khi được xác nhận, trạng thái đổi thành “Đã xác nhận” trong mục “Đặt phòng của tôi”.",
    qEn: "When will my booking be confirmed?",
    aEn: "After you send it, the request shows as “Pending” and the room is held for you. The homestay reviews it and contacts you to confirm. Once confirmed, the status changes to “Confirmed” under “My bookings”.",
  },
  {
    qVi: "Yêu cầu của tôi vẫn “Chờ xác nhận” sau ngày nhận phòng thì sao?",
    aVi: "Nếu homestay chưa xác nhận mà ngày nhận phòng đã qua, yêu cầu sẽ tự động chuyển sang “Hết hạn” và phòng được nhả cho khách khác. Bạn có thể đặt lại với ngày mới hoặc liên hệ homestay.",
    qEn: "What if my request is still “Pending” after the check-in date?",
    aEn: "If the homestay has not confirmed it and the check-in date has passed, the request automatically becomes “Expired” and the room is released. You can book again with new dates or contact the homestay.",
  },
  {
    qVi: "Tôi có thể đổi ngày hoặc đổi phòng không?",
    aVi: "Bạn có thể đổi ngày ngay trong hộp thoại “Xác nhận đặt phòng” trước khi gửi. Sau khi đã gửi, hãy hủy đặt phòng rồi đặt lại, hoặc liên hệ homestay để được hỗ trợ.",
    qEn: "Can I change my dates or room?",
    aEn: "You can change the dates in the “Confirm booking” window before sending. After sending, cancel the booking and book again, or contact the homestay for help.",
  },
  {
    qVi: "Làm sao để hủy đặt phòng?",
    aVi: "Vào “Đặt phòng của tôi”, bấm “Hủy đặt phòng” và xác nhận. Bạn hủy được khi đặt phòng còn “Chờ xác nhận” hoặc “Đã xác nhận”. Khi đã nhận phòng thì không hủy trên website được; vui lòng liên hệ homestay. Nếu bạn đã đặt cọc, hãy liên hệ homestay để được hướng dẫn.",
    qEn: "How do I cancel a booking?",
    aEn: "Go to “My bookings”, press “Cancel booking” and confirm. You can cancel while the booking is “Pending” or “Confirmed”. Once you have checked in it cannot be cancelled on the website; please contact the homestay. If you paid a deposit, contact the homestay for guidance.",
  },
  {
    qVi: "Thanh toán và đặt cọc như thế nào?",
    aVi: "Website hiện chưa thu tiền trực tuyến. Giá hiển thị là giá tạm tính. Khi xác nhận đặt phòng, homestay sẽ liên hệ để thống nhất giá cuối cùng và hướng dẫn hình thức thanh toán, đặt cọc.",
    qEn: "How do payment and deposits work?",
    aEn: "The website does not take online payments yet. The price shown is an estimate. When confirming your booking, the homestay will contact you to agree the final price and explain how to pay and any deposit.",
  },
  {
    qVi: "Mã giảm giá dùng như thế nào?",
    aVi: "Nhập mã vào ô “Mã giảm giá” trong hộp thoại đặt phòng rồi bấm “Áp dụng”. Mỗi mã chỉ dùng được một lần và có thể có hạn dùng. Giá sau giảm hiển thị ngay trước khi bạn gửi yêu cầu.",
    qEn: "How do discount codes work?",
    aEn: "Enter the code in the “Discount code” field of the booking window and press “Apply”. Each code can be used once and may have an expiry date. The discounted price is shown before you send the request.",
  },
  {
    qVi: "Khi nhận phòng tôi cần mang giấy tờ gì?",
    aVi: "Vui lòng mang giấy tờ tùy thân (CCCD, hộ chiếu hoặc bằng lái xe) để homestay đăng ký lưu trú theo quy định. Thông tin này được bảo mật; xem thêm trong Chính sách quyền riêng tư.",
    qEn: "What documents do I need at check-in?",
    aEn: "Please bring an identity document (national ID, passport or driver's license) so the homestay can register your stay as required. This information is kept private; see the Privacy Policy for details.",
  },
  {
    qVi: "Tôi gửi cảm nhận về homestay ở đâu?",
    aVi: "Vào mục Thông tin, chọn “Cảm nhận của khách”, đăng nhập và viết cảm nhận. Cảm nhận sẽ hiển thị công khai sau khi homestay duyệt.",
    qEn: "Where can I leave a review?",
    aEn: "Open the Info menu, choose “Guest reviews”, sign in and write your review. It will appear publicly once the homestay approves it.",
  },
];
