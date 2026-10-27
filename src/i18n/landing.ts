const vi = {
  nav: { home: "Trang chủ", about: "Giới thiệu", rooms: "Phòng nghỉ", features: "Tiện nghi", booking: "Đặt phòng", contact: "Liên hệ" },
  signIn: "Đăng nhập", myBookings: "Đặt phòng của tôi", manage: "Quản lý", signOut: "Đăng xuất",
  hero: {
    eyebrow: "Homestay nhà gỗ giữa vườn trái cây",
    title1: "Chậm lại một nhịp,", title2: "sống giữa vườn xanh",
    sub: "Nhà gỗ ấm cúng, vườn trái cây thoáng mát, nước giếng đào tự nhiên — nơi cả nhà tìm lại những ngày nghỉ bình yên.",
    cta1: "Xem phòng trống", cta2: "Khám phá nơi nghỉ",
    badge1: "Nhà gỗ 3 phòng trên lầu", badge2: "Vườn trái cây riêng",
  },
  search: { checkIn: "Nhận phòng", checkOut: "Trả phòng", room: "Phòng", allRooms: "Tất cả các phòng", guests: "Số khách", go: "Kiểm tra phòng trống" },
  stats: [
    { n: "5", l: "phòng nghỉ riêng biệt" },
    { n: "400m²", l: "khu nhà gỗ truyền thống" },
    { n: "5", l: "phòng vệ sinh riêng" },
    { n: "1", l: "bếp lớn cho cả nhà" },
  ],
  about: {
    eyebrow: "Giới thiệu", title: "Một góc quê yên bình dành cho bạn",
    p1: "Khu nhà gỗ gồm 3 phòng ngủ trên lầu cùng phòng khách và bếp rộng ở tầng trệt. Cạnh đó là 2 phòng bê tông cốt thép độc lập, yên tĩnh và kín đáo.",
    p2: "Khuôn viên rộng rãi với vườn trái cây, hàng rào chắc chắn và bãi đậu xe thoải mái — phù hợp cho gia đình, nhóm bạn hay những chuyến nghỉ dưỡng cuối tuần.",
    points: ["Mỗi phòng có phòng vệ sinh riêng", "Bếp lớn để cả nhà cùng nấu nướng", "Không gian xanh, thoáng và riêng tư"],
  },
  rooms: {
    eyebrow: "Phòng nghỉ", title: "Chọn không gian của bạn", sub: "Giá hiển thị theo đêm. Bấm vào phòng để xem lịch trống.",
    wood: "Nhà gỗ · Trên lầu", concrete: "Nhà bê tông · Riêng biệt", perNight: "/ đêm", capacity: "Sức chứa", up: "người", view: "Xem lịch & đặt", empty: "Danh sách phòng đang được cập nhật.",
  },
  features: {
    eyebrow: "Tiện nghi", title: "Mọi thứ bạn cần cho một kỳ nghỉ nhẹ nhàng",
    items: [
      { i: "🏡", t: "Nhà gỗ truyền thống", d: "3 phòng ngủ trên lầu, phòng khách rộng và bếp ở tầng trệt." },
      { i: "🛏️", t: "Phòng bê tông riêng tư", d: "2 phòng độc lập cạnh nhà gỗ, yên tĩnh và thoải mái." },
      { i: "🚿", t: "Vệ sinh riêng từng phòng", d: "5 phòng vệ sinh cho 5 phòng nghỉ, tiện nghi và sạch sẽ." },
      { i: "🍳", t: "Bếp lớn", d: "Tự tay nấu bữa cơm gia đình trong căn bếp rộng rãi." },
      { i: "🌳", t: "Vườn trái cây", d: "Dạo vườn, hít thở không khí trong lành giữa không gian xanh." },
      { i: "💧", t: "Nước giếng đào", d: "Nguồn nước giếng đào tự nhiên cho sinh hoạt hằng ngày." },
      { i: "🚗", t: "Bãi đậu xe rộng", d: "Chỗ để ô tô và xe máy thoải mái cho cả đoàn." },
      { i: "📶", t: "Wifi & điện lưới", d: "Wifi sẵn sàng, điện lưới quốc gia ổn định." },
      { i: "🛡️", t: "Hàng rào chắc chắn", d: "Khuôn viên có hàng rào, an tâm cho gia đình có trẻ nhỏ." },
    ],
  },
  how: {
    eyebrow: "Đặt phòng dễ dàng", title: "Ba bước để giữ chỗ",
    steps: [
      { t: "Chọn ngày & phòng", d: "Xem lịch trống ngay, không cần đăng nhập." },
      { t: "Đăng nhập & gửi yêu cầu", d: "Đăng nhập bằng Google hoặc email chỉ khi bạn bấm Đặt phòng." },
      { t: "Nhận xác nhận", d: "Homestay xem yêu cầu và liên hệ xác nhận với bạn." },
    ],
  },
  booking: {
    eyebrow: "Lịch phòng", title: "Kiểm tra phòng trống & đặt phòng",
    sub: "Xem lịch hoàn toàn miễn phí, không cần tài khoản. Bạn chỉ cần đăng nhập khi bấm “Đặt phòng”.",
    free: "Còn trống", booked: "Đã đặt", held: "Đang giữ chỗ", maintenance: "Bảo trì",
    available: "Còn trống", unavailable: "Không còn trống", maintNote: "Đang bảo trì", heldNote: "Có người đang giữ chỗ",
    book: "Đặt phòng", estimate: "Tạm tính", nights: "đêm", fullCap: "Vượt sức chứa",
    errDates: "Ngày trả phòng phải sau ngày nhận phòng.", errPast: "Ngày nhận phòng không được ở quá khứ.", errLong: "Vui lòng đặt tối đa 30 đêm mỗi lần.",
    prev: "‹ Tuần trước", next: "Tuần sau ›", today: "Hôm nay", calendarFor: "Lịch 14 ngày",
    final: "Giá cuối cùng do homestay xác nhận.",
  },
  modal: {
    title: "Xác nhận đặt phòng", name: "Họ và tên", phone: "Số điện thoại", guests: "Số khách", note: "Ghi chú (giờ đến, yêu cầu đặc biệt…)",
    send: "Gửi yêu cầu đặt phòng", sending: "Đang gửi...", cancel: "Đóng",
    doneTitle: "Đã gửi yêu cầu!", doneText: "Homestay sẽ xem và liên hệ xác nhận với bạn. Bạn có thể theo dõi trong mục “Đặt phòng của tôi”.",
    clash: "Rất tiếc, phòng vừa được người khác giữ chỗ trong khoảng ngày này. Vui lòng chọn ngày hoặc phòng khác.",
    err: "Không gửi được yêu cầu. Vui lòng thử lại.", viewMine: "Xem đặt phòng của tôi",
    datesUnavailable: "Phòng không còn trống trong khoảng ngày này. Vui lòng chọn ngày khác.",
    secret: "(Thông tin này được bảo mật và không công khai)", email: "Email liên hệ", coupon: "Mã giảm giá", couponPh: "Nhập mã (nếu có)", apply: "Áp dụng", remove: "Bỏ mã",
    couponOk: "Đã áp dụng giảm", couponGone: "Mã không tồn tại.", couponUsed: "Mã này đã được sử dụng.", couponExpired: "Mã này đã hết hạn.",
    couponRace: "Mã giảm giá vừa được dùng hoặc không còn hiệu lực. Vui lòng bỏ mã hoặc thử mã khác.", original: "Giá gốc", total: "Thành tiền",
  },
  auth: {
    title: "Đăng nhập để đặt phòng", titleRegister: "Tạo tài khoản", sub: "Chỉ mất vài giây.",
    google: "Tiếp tục với Google", or: "hoặc dùng email", email: "Email", password: "Mật khẩu (tối thiểu 6 ký tự)",
    login: "Đăng nhập", register: "Đăng ký", toRegister: "Chưa có tài khoản? Đăng ký", toLogin: "Đã có tài khoản? Đăng nhập", close: "Đóng",
    errors: {
      "auth/invalid-credential": "Email hoặc mật khẩu không đúng.", "auth/invalid-email": "Email không hợp lệ.",
      "auth/email-already-in-use": "Email này đã được đăng ký. Hãy đăng nhập.", "auth/weak-password": "Mật khẩu quá yếu (tối thiểu 6 ký tự).",
      "auth/popup-blocked": "Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép cửa sổ bật lên rồi thử lại.",
      "auth/operation-not-allowed": "Phương thức đăng nhập này chưa được bật trong Firebase.",
      "auth/unauthorized-domain": "Tên miền này chưa được cho phép đăng nhập trong Firebase.",
      "auth/network-request-failed": "Lỗi mạng. Vui lòng thử lại.", "auth/too-many-requests": "Thử quá nhiều lần. Vui lòng đợi một lát.",
    } as Record<string, string>,
    fallback: "Đăng nhập không thành công.", inApp: "Nếu bạn mở trang này trong ứng dụng (Zalo, Facebook…) và Google không cho đăng nhập, hãy mở bằng Chrome/Safari.",
  },
  account: {
    title: "Đặt phòng của tôi", empty: "Bạn chưa có đặt phòng nào.", bookNow: "Đặt phòng ngay", cancel: "Hủy yêu cầu", sure: "Hủy yêu cầu đặt phòng này?",
    staffLink: "Vào trang quản lý", expired: "Hết hạn", back: "← Về trang chủ", contactToChange: "Để đổi hoặc hủy đặt phòng đã xác nhận, vui lòng liên hệ homestay.",
  },
  footer: {
    tagline: "Nghỉ dưỡng giữa vườn xanh, ấm áp như ở nhà.", links: "Khám phá", contact: "Liên hệ",
    contactSoon: "Thông tin liên hệ sẽ sớm được cập nhật.", staff: "Dành cho nhân viên", rights: "Đã đăng ký bản quyền.",
    phone: "Điện thoại", zalo: "Zalo", email: "Email", address: "Địa chỉ", facebook: "Facebook", map: "Xem bản đồ",
  },
};

type Dict = typeof vi;

const en: Dict = {
  nav: { home: "Home", about: "About", rooms: "Rooms", features: "Amenities", booking: "Book", contact: "Contact" },
  signIn: "Sign in", myBookings: "My bookings", manage: "Manage", signOut: "Sign out",
  hero: {
    eyebrow: "A wooden-house homestay in an orchard",
    title1: "Slow down,", title2: "live among the green",
    sub: "A cozy wooden house, a cool fruit orchard and natural well water — a quiet place for the whole family to rest.",
    cta1: "Check availability", cta2: "Explore the stay",
    badge1: "Wooden house, 3 rooms upstairs", badge2: "Private fruit orchard",
  },
  search: { checkIn: "Check-in", checkOut: "Check-out", room: "Room", allRooms: "All rooms", guests: "Guests", go: "Check availability" },
  stats: [
    { n: "5", l: "private bedrooms" },
    { n: "400m²", l: "traditional wooden house" },
    { n: "5", l: "private bathrooms" },
    { n: "1", l: "large shared kitchen" },
  ],
  about: {
    eyebrow: "About", title: "A peaceful corner of the countryside",
    p1: "The wooden house has 3 bedrooms upstairs, plus a spacious living room and kitchen downstairs. Next to it are 2 separate reinforced-concrete rooms, quiet and private.",
    p2: "A generous compound with a fruit orchard, a sturdy fence and plenty of parking — great for families, friends and weekend getaways.",
    points: ["A private bathroom for every room", "A large kitchen to cook together", "Green, airy and private surroundings"],
  },
  rooms: {
    eyebrow: "Rooms", title: "Choose your space", sub: "Prices are per night. Tap a room to see its availability.",
    wood: "Wooden house · Upstairs", concrete: "Concrete house · Separate", perNight: "/ night", capacity: "Capacity", up: "guests", view: "View & book", empty: "Rooms are being updated.",
  },
  features: {
    eyebrow: "Amenities", title: "Everything for a relaxed getaway",
    items: [
      { i: "🏡", t: "Traditional wooden house", d: "3 bedrooms upstairs, a large living room and kitchen downstairs." },
      { i: "🛏️", t: "Private concrete rooms", d: "2 separate rooms next to the wooden house, quiet and comfortable." },
      { i: "🚿", t: "Private bathrooms", d: "5 bathrooms for 5 rooms, clean and convenient." },
      { i: "🍳", t: "Large kitchen", d: "Cook a family meal together in a spacious kitchen." },
      { i: "🌳", t: "Fruit orchard", d: "Stroll through the orchard and breathe fresh air." },
      { i: "💧", t: "Well water", d: "Natural dug-well water for daily use." },
      { i: "🚗", t: "Ample parking", d: "Plenty of space for cars and motorbikes." },
      { i: "📶", t: "Wifi & grid power", d: "Wifi available and stable national grid electricity." },
      { i: "🛡️", t: "Sturdy fence", d: "A fenced compound, reassuring for families with kids." },
    ],
  },
  how: {
    eyebrow: "Easy booking", title: "Three steps to reserve",
    steps: [
      { t: "Pick dates & room", d: "See availability right away, no sign-in needed." },
      { t: "Sign in & send a request", d: "Sign in with Google or email only when you press Book." },
      { t: "Get confirmation", d: "The homestay reviews your request and confirms with you." },
    ],
  },
  booking: {
    eyebrow: "Availability", title: "Check availability & book",
    sub: "Browsing the calendar is free and needs no account. You only sign in when you press “Book”.",
    free: "Available", booked: "Booked", held: "On hold", maintenance: "Maintenance",
    available: "Available", unavailable: "Not available", maintNote: "Under maintenance", heldNote: "Someone is holding this room",
    book: "Book", estimate: "Estimate", nights: "nights", fullCap: "Over capacity",
    errDates: "Check-out must be after check-in.", errPast: "Check-in cannot be in the past.", errLong: "Please book 30 nights at most at a time.",
    prev: "‹ Prev week", next: "Next week ›", today: "Today", calendarFor: "14-day calendar",
    final: "The homestay confirms the final price.",
  },
  modal: {
    title: "Confirm booking", name: "Full name", phone: "Phone number", guests: "Guests", note: "Notes (arrival time, special requests…)",
    send: "Send booking request", sending: "Sending...", cancel: "Close",
    doneTitle: "Request sent!", doneText: "The homestay will review it and get in touch to confirm. Track it under “My bookings”.",
    clash: "Sorry, this room was just taken for those dates. Please pick other dates or another room.",
    err: "Could not send the request. Please try again.", viewMine: "View my bookings",
    datesUnavailable: "This room is not available for those dates. Please pick other dates.",
    secret: "(This information is kept private and never shown publicly)", email: "Contact email", coupon: "Discount code", couponPh: "Enter code (if any)", apply: "Apply", remove: "Remove code",
    couponOk: "Discount applied", couponGone: "Code not found.", couponUsed: "This code has already been used.", couponExpired: "This code has expired.",
    couponRace: "The discount code was just used or is no longer valid. Remove it or try another code.", original: "Original price", total: "Total",
  },
  auth: {
    title: "Sign in to book", titleRegister: "Create an account", sub: "It only takes a few seconds.",
    google: "Continue with Google", or: "or use email", email: "Email", password: "Password (min. 6 characters)",
    login: "Sign in", register: "Sign up", toRegister: "No account? Sign up", toLogin: "Have an account? Sign in", close: "Close",
    errors: {
      "auth/invalid-credential": "Incorrect email or password.", "auth/invalid-email": "Invalid email address.",
      "auth/email-already-in-use": "This email is already registered. Please sign in.", "auth/weak-password": "Password too weak (min. 6 characters).",
      "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups and try again.",
      "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase.",
      "auth/unauthorized-domain": "This domain is not authorized for sign-in in Firebase.",
      "auth/network-request-failed": "Network error. Please try again.", "auth/too-many-requests": "Too many attempts. Please wait a moment.",
    },
    fallback: "Sign-in failed.", inApp: "If you opened this page inside an app (Zalo, Facebook…) and Google refuses to sign in, open it in Chrome/Safari.",
  },
  account: {
    title: "My bookings", empty: "You have no bookings yet.", bookNow: "Book now", cancel: "Cancel request", sure: "Cancel this booking request?",
    staffLink: "Go to management", expired: "Expired", back: "← Back to home", contactToChange: "To change or cancel a confirmed booking, please contact the homestay.",
  },
  footer: {
    tagline: "Rest among the green, warm like home.", links: "Explore", contact: "Contact",
    contactSoon: "Contact details coming soon.", staff: "Staff area", rights: "All rights reserved.",
    phone: "Phone", zalo: "Zalo", email: "Email", address: "Address", facebook: "Facebook", map: "View map",
  },
};

export const landing = { vi, en };
export type Landing = Dict;
