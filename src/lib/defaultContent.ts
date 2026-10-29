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

/** Nội dung mẫu của trang Nội quy & Quy định; chủ/quản lý sửa trực tiếp trên trang (lưu ở pages/rules). */
export const DEFAULT_RULES = {
  vi: `Cảm ơn bạn đã chọn Nhà Gỗ Homestay. Để kỳ nghỉ của bạn và của mọi người xung quanh được an toàn, thoải mái, vui lòng đọc và tuân thủ các quy định dưới đây. Việc đặt phòng hoặc nhận phòng đồng nghĩa với việc bạn đã đọc, hiểu và đồng ý với nội quy này.

## 1. Chấp hành pháp luật, an ninh trật tự
- Tuyệt đối chấp hành quy định của pháp luật Việt Nam về lưu trú, cư trú, an ninh trật tự và phòng cháy chữa cháy.
- Mọi khách lưu trú (kể cả trẻ em và người nước ngoài) phải xuất trình giấy tờ tùy thân hợp lệ (CCCD, hộ chiếu hoặc giấy tờ tương đương) để homestay khai báo lưu trú theo quy định.
- Hợp tác với cơ quan chức năng khi có yêu cầu kiểm tra.

## 2. Hành vi nghiêm cấm
- Tuyệt đối không thực hiện các hành vi vi phạm pháp luật dưới mọi hình thức.
- Nghiêm cấm sử dụng, tàng trữ, mua bán **ma túy** và các chất cấm.
- Nghiêm cấm **mại dâm**, môi giới mại dâm và các hoạt động đồi trụy.
- Nghiêm cấm cờ bạc, đánh bạc dưới mọi hình thức.
- Nghiêm cấm mang vũ khí, chất nổ, chất cháy, hóa chất độc hại vào homestay.
- Nghiêm cấm gây gổ, đánh nhau, xúc phạm, quấy rối người khác.
- Homestay có quyền từ chối phục vụ hoặc chấm dứt lưu trú ngay, **không hoàn tiền**, và báo cơ quan chức năng khi phát hiện vi phạm.

## 3. Nhận phòng và trả phòng
- Giờ nhận phòng và trả phòng được ghi trong phần chính sách khi đặt phòng. Nhận sớm hoặc trả muộn tùy tình trạng phòng và có thể phát sinh phụ thu; vui lòng báo trước cho homestay.
- Số khách ở không vượt quá sức chứa của phòng. Khách thêm so với số khách tiêu chuẩn có thể phải trả phụ thu và phải được đăng ký trước.
- Vui lòng kiểm tra phòng khi nhận và báo ngay cho homestay nếu có điều chưa đúng.

## 4. An toàn phòng cháy chữa cháy
- **Không nấu ăn trong phòng ngủ.** Vui lòng dùng khu bếp chung của homestay.
- Không hút thuốc, đốt nến, đốt hương, đốt than hoặc dùng lửa trần trong phòng và trên các tầng của nhà gỗ (vật liệu dễ cháy).
- Không tự ý sử dụng thiết bị điện công suất lớn (bếp điện, nồi cơm, ấm đun, bàn ủi…) ngoài các thiết bị homestay cung cấp. Tắt điện, quạt, điều hòa khi ra ngoài.
- Chỉ nướng đồ ăn ở khu vực được homestay cho phép và có người trông coi.
- Khi phát hiện cháy hoặc sự cố, báo ngay cho homestay và gọi **114** (cứu hỏa).

## 5. Vật nuôi
- **Không mang thú cưng và các con vật vào trong phòng** và trong nhà gỗ.
- Nếu bạn cần mang theo vật nuôi, vui lòng liên hệ homestay trước khi đặt để được hướng dẫn (nếu có thể sắp xếp).

## 6. Giữ yên tĩnh, tôn trọng xung quanh
- Giờ yên tĩnh từ **22:00 đến 06:00**. Không mở nhạc, loa, karaoke với âm lượng lớn.
- Không tổ chức tiệc, sự kiện hoặc tụ tập đông người khi chưa được homestay đồng ý.
- Tôn trọng hàng xóm và những khách lưu trú khác.

## 7. Khách thăm và người ngoài
- Khách thăm cần đăng ký với homestay khi đến và chỉ ở trong khu vực chung, trong khung giờ cho phép.
- Người chưa đăng ký lưu trú **không được ở lại qua đêm**.

## 8. Giữ gìn tài sản và đền bù thiệt hại
- Vui lòng giữ gìn trang thiết bị, đồ đạc, cây cối và cảnh quan của homestay.
- Nếu làm **mất, hư hỏng** tài sản, đồ đạc, khách phải **đền bù theo giá hiện hành** (giá mua mới hoặc chi phí sửa chữa thực tế). Homestay có quyền trừ vào tiền đặt cọc và thu phần còn thiếu.
- Các trường hợp làm bẩn nặng (vết bẩn khó tẩy trên ga, khăn, thảm, nệm…) hoặc phải xử lý mùi có thể phát sinh phí vệ sinh.
- Mất thẻ, chìa khóa phòng phải báo ngay và bồi thường chi phí làm lại.

## 9. Vệ sinh chung và bảo vệ môi trường
- Bỏ rác đúng nơi quy định; không xả rác, khăn giấy, vật lạ vào bồn cầu và đường thoát nước.
- Tiết kiệm điện, nước; sử dụng nguồn nước tự nhiên hợp lý.
- Không tự ý hái trái cây, bẻ cành, đào bới trong vườn khi chưa được cho phép.

## 10. Trẻ em và an toàn cá nhân
- Trẻ em phải luôn có người lớn đi cùng và giám sát, đặc biệt ở cầu thang, ban công, khu vực nước và vườn.
- Khách tự chịu trách nhiệm về sức khỏe và hoạt động của bản thân trong thời gian lưu trú.

## 11. Tài sản cá nhân và bãi xe
- Khách tự bảo quản tiền, giấy tờ, trang sức và đồ có giá trị. Homestay không chịu trách nhiệm đối với tài sản không gửi giữ hoặc không khai báo.
- Xe cộ đậu trong khuôn viên do chủ xe tự khóa và bảo quản; vui lòng không để tài sản có giá trị trên xe.
- Đồ quên lại sẽ được cố gắng liên hệ trả lại; đồ không có người nhận sau **30 ngày** có thể được xử lý.

## 12. Thanh toán, đặt cọc và hủy phòng
- Tiền đặt cọc, chính sách hủy và hoàn tiền được hiển thị khi đặt phòng và trong hóa đơn; vui lòng xem kỹ trước khi xác nhận.
- Khách không đến, hủy sát ngày hoặc hủy không đúng quy định có thể không được hoàn cọc theo chính sách.

## 13. Xử lý vi phạm
- Khi vi phạm nội quy, homestay sẽ nhắc nhở. Trường hợp vi phạm nghiêm trọng hoặc tái phạm, homestay có quyền lập biên bản, yêu cầu rời đi ngay không hoàn tiền, yêu cầu bồi thường và báo cơ quan chức năng.

## 14. Liên hệ và trường hợp khẩn cấp
- Mọi thắc mắc, góp ý hoặc sự cố, vui lòng liên hệ homestay qua mục **Liên hệ** trên website.
- Số khẩn cấp: Công an **113** · Cứu hỏa **114** · Cấp cứu **115**.

Chúc bạn có một kỳ nghỉ thật thoải mái và trọn vẹn!`,
  en: `Thank you for choosing Nhà Gỗ Homestay. To keep your stay and everyone around you safe and comfortable, please read and follow the rules below. Booking or checking in means you have read, understood and agreed to these house rules.

## 1. Compliance with the law, security and order
- Strictly comply with Vietnamese law on accommodation, residence registration, public security and fire safety.
- Every guest (including children and foreign nationals) must present valid identification (national ID, passport or equivalent) so that the homestay can register the stay as required.
- Cooperate with the authorities during any inspection.

## 2. Prohibited conduct
- Any activity that violates the law is strictly forbidden.
- Using, possessing or dealing **drugs** or other prohibited substances is strictly forbidden.
- **Prostitution**, solicitation and any indecent activity are strictly forbidden.
- Gambling of any kind is strictly forbidden.
- Bringing weapons, explosives, flammable or hazardous chemicals onto the premises is strictly forbidden.
- Fighting, insulting or harassing others is strictly forbidden.
- On any violation the homestay may refuse service or end the stay immediately **without a refund**, and report to the authorities.

## 3. Check-in and check-out
- Check-in and check-out times are shown in the policy section when you book. Early check-in or late check-out depends on availability and may incur a surcharge; please tell us in advance.
- The number of guests must not exceed the room's capacity. Guests above the standard occupancy may be charged a surcharge and must be registered in advance.
- Please inspect your room on arrival and tell us at once if anything is not as expected.

## 4. Fire safety
- **No cooking in the bedrooms.** Please use the shared kitchen.
- No smoking, candles, incense, charcoal or open flames in the rooms and on the floors of the wooden house (flammable materials).
- Do not use high-power electrical appliances (hot plates, rice cookers, kettles, irons…) other than those provided. Switch off lights, fans and air conditioning when you go out.
- Barbecue only in the area designated by the homestay and under supervision.
- If you notice a fire or an incident, tell the homestay immediately and call **114** (fire brigade).

## 5. Pets
- **No pets or other animals are allowed in the rooms** or the wooden house.
- If you need to bring a pet, please contact the homestay before booking to see whether an arrangement is possible.

## 6. Quiet hours and respect for others
- Quiet hours are **22:00 to 06:00**. Please do not play loud music, speakers or karaoke.
- Do not hold parties, events or large gatherings without the homestay's consent.
- Please respect our neighbours and other guests.

## 7. Visitors and outsiders
- Visitors must register with the homestay on arrival and may stay in common areas only, during permitted hours.
- Anyone who has not registered for the stay **may not stay overnight**.

## 8. Care of property and compensation
- Please take care of the equipment, furniture, plants and grounds.
- If you **lose or damage** any property, you must **pay compensation at the current price** (replacement cost or actual repair cost). The homestay may deduct it from your deposit and charge any shortfall.
- Heavy soiling (stains that cannot be removed from linen, towels, carpets, mattresses…) or odour treatment may incur a cleaning fee.
- Report a lost key or card immediately; the replacement cost will be charged.

## 9. Cleanliness and environment
- Put waste in the designated places; do not flush tissues or foreign objects, or block drains.
- Save electricity and water; use the natural water supply sensibly.
- Do not pick fruit, break branches or dig in the garden without permission.

## 10. Children and personal safety
- Children must always be accompanied and supervised by an adult, especially on stairs, balconies, near water and in the garden.
- Guests are responsible for their own health and activities during the stay.

## 11. Personal belongings and parking
- Please keep cash, documents, jewellery and valuables safe. The homestay is not responsible for items that were not handed over for safekeeping or declared.
- Vehicles are parked at the owner's risk; please lock them and do not leave valuables inside.
- We will try to contact you about forgotten items; items unclaimed after **30 days** may be disposed of.

## 12. Payment, deposit and cancellation
- The deposit, cancellation and refund policy is shown when you book and on your invoice; please read it carefully before confirming.
- No-shows, last-minute cancellations or cancellations outside the policy may not be refunded.

## 13. Handling violations
- If a rule is broken, the homestay will first give a reminder. For serious or repeated violations the homestay may draw up a report, ask you to leave immediately without a refund, claim compensation and report to the authorities.

## 14. Contact and emergencies
- For questions, feedback or any problem, please contact us through the **Contact** section of the website.
- Emergency numbers: Police **113** · Fire **114** · Ambulance **115**.

We wish you a comfortable and memorable stay!`,
};
