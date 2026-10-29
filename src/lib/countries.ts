/** Danh sách quốc gia/vùng lãnh thổ (tên tiếng Anh quốc tế) cho ô "Quốc tịch". 193 thành viên Liên Hợp Quốc + Palestine, Kosovo, Taiwan, Hong Kong, Macau. */
export const COUNTRIES: string[] = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Macau", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();

/** Tên cũ/biến thể thường gặp → tên chuẩn trong danh sách (để dữ liệu nhập tay trước đây vẫn được nhận ra). */
const ALIASES: Record<string, string> = {
  "viet nam": "Vietnam", "vn": "Vietnam", "vietnamese": "Vietnam", "cong hoa xa hoi chu nghia viet nam": "Vietnam",
  "usa": "United States", "us": "United States", "united states of america": "United States", "america": "United States", "my": "United States",
  "uk": "United Kingdom", "great britain": "United Kingdom", "england": "United Kingdom", "anh": "United Kingdom",
  "south korea": "South Korea", "korea": "South Korea", "republic of korea": "South Korea", "han quoc": "South Korea", "north korea": "North Korea",
  "czech republic": "Czechia", "ivory coast": "Cote d'Ivoire", "burma": "Myanmar", "russian federation": "Russia", "nga": "Russia",
  "trung quoc": "China", "nhat ban": "Japan", "phap": "France", "duc": "Germany", "uc": "Australia", "thai lan": "Thailand", "lao": "Laos",
  "turkiye": "Turkey", "holland": "Netherlands", "the netherlands": "Netherlands", "uae": "United Arab Emirates", "swaziland": "Eswatini",
  "democratic republic of congo": "Democratic Republic of the Congo", "dr congo": "Democratic Republic of the Congo", "republic of the congo": "Congo",
};
const BY_FOLD = new Map<string, string>([...COUNTRIES.map((c) => [fold(c), c] as [string, string]), ...Object.entries(ALIASES)]);

/** Tên chuẩn trong danh sách ứng với giá trị đã lưu (không phân biệt hoa thường/dấu); không có thì `null`. */
export const matchCountry = (value: string): string | null => BY_FOLD.get(fold(value)) ?? null;
