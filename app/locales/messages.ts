export type LocaleCode = "en" | "vi";

export const defaultLocale: LocaleCode = "en";

export const localeOptions: Array<{
  code: LocaleCode;
  label: string;
  nativeLabel: string;
}> = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
];

const en = {
  "common.appName": "Spfi",
  "common.loading": "Loading...",
  "common.processing": "Processing...",
  "common.copy": "Copy",
  "common.done": "Done",
  "common.clear": "Clear",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.add": "Add",
  "common.search": "Search",
  "common.refresh": "Refresh",
  "common.lock": "Lock",
  "nav.setup": "Setup",
  "nav.manager": "Manager",
  "nav.profile": "Profile",
  "nav.customers": "Customers",
  "nav.payment": "Payment",
  "nav.sheet": "Sheet",
  "nav.status": "Status",
  "nav.language": "Language",
  "vault.eyebrow": "Secure workspace",
  "vault.setupTitle": "Create your security PIN",
  "vault.unlockTitle": "Unlock your credentials",
  "vault.setupDescription":
    "This PIN encrypts Client Secrets and Access Tokens on this device. It cannot be recovered if forgotten.",
  "vault.unlockDescription":
    "Enter the PIN/password used for this browser. Decrypted credentials stay in memory only until refresh.",
  "vault.passwordLabel": "PIN or password",
  "vault.confirmPasswordLabel": "Confirm PIN or password",
  "vault.passwordPlaceholder": "At least 4 characters",
  "vault.confirmPasswordPlaceholder": "Enter it again",
  "vault.showPassword": "Show",
  "vault.hidePassword": "Hide",
  "vault.mismatch": "PIN/password confirmation does not match.",
  "vault.submitSecuring": "Securing credentials...",
  "vault.submitCreate": "Create vault",
  "vault.submitUnlock": "Unlock",
  "vault.securityNote": "AES-GCM - PBKDF2 - Device-local encrypted storage",
  "home.eyebrow": "Shopify Operations Console",
  "home.heroTitle": "Telescope the storefront from one desk",
  "home.heroSub":
    "A compact workspace for connecting shops, rotating tokens, checking public store status, and reading Google Sheet data without jumping between tools.",
  "home.openManager": "Open Manager",
  "home.checkStatus": "Check Status",
  "home.previewAria": "Operations preview",
  "home.previewLive": "Live workspace",
  "home.previewBatch": "Batch status",
  "home.previewAlive": "Alive 18",
  "home.previewHttp": "HTTP",
  "home.previewProducts": "Products endpoint",
  "home.previewToken": "Token rotation",
  "home.previewReady": "Ready",
  "home.previewSheet": "Sheet lookup",
  "home.previewTabs": "4 tabs",
  "home.workflowsAria": "Primary workflows",
  "home.quickSetupTitle": "Setup Guide",
  "home.quickSetupDescription":
    "Follow the app creation and credential checklist.",
  "home.quickManagerTitle": "Shop Management",
  "home.quickManagerDescription":
    "Add stores, rotate tokens, and test proxies.",
  "home.quickSheetTitle": "Sheets",
  "home.quickSheetDescription": "Open sheet tabs and inspect rows quickly.",
  "home.quickStatusTitle": "Status Checker",
  "home.quickStatusDescription":
    "Batch check Shopify storefront availability.",
  "home.motivationEyebrow": "Motivation",
  "home.motivationTitle":
    "Keep repetitive Shopify ops calm, visible, and fast.",
  "home.motivationBody":
    "Spfi is built for the small but expensive moments: switching between stores, checking whether storefronts are reachable, and pulling the right sheet data while orders keep moving.",
  "home.motivationTabsTitle": "Fewer tab jumps",
  "home.motivationTabsDescription":
    "Move between setup, profiles, payments, sheets, and status checks from one predictable place.",
  "home.motivationChecksTitle": "Cleaner store checks",
  "home.motivationChecksDescription":
    "Run quick storefront checks with proxy context so blocked or unhealthy shops are easier to spot.",
  "home.motivationCopyTitle": "Less manual copywork",
  "home.motivationCopyDescription":
    "Use saved shop profiles and sheet lookups to reduce the repeated handoff work around orders.",
  "home.flowEyebrow": "Daily Flow",
  "home.flowTitle": "A tighter loop from access to verification.",
  "home.flowConnectTitle": "Connect the shop",
  "home.flowConnectDescription":
    "Add store credentials, prepare tokens, and keep profile data ready for follow-up tasks.",
  "home.flowCheckTitle": "Check the surface",
  "home.flowCheckDescription":
    "Confirm storefront access and endpoint responses before spending time on deeper order work.",
  "home.flowDataTitle": "Use the source data",
  "home.flowDataDescription":
    "Open sheet tabs, inspect rows, and move into product, order, or payment workflows as needed.",
  "home.faqEyebrow": "FAQ",
  "home.faqTitle": "Questions before you open the workspace.",
  "home.faqFirstQuestion": "What should I open first?",
  "home.faqFirstAnswer":
    "Start with Manager when you are preparing stores or credentials. Use Status when you only need a fast storefront health check.",
  "home.faqAdminQuestion": "Does this replace Shopify Admin?",
  "home.faqAdminAnswer":
    "No. It keeps the repetitive operational checks nearby, then links your day-to-day work back to the specific shop data you need.",
  "home.faqSheetQuestion": "Where does sheet data fit?",
  "home.faqSheetAnswer":
    "The Sheet page helps inspect connected Google Sheet tabs and rows when order or product work depends on spreadsheet data.",
  "home.faqBatchQuestion": "Can I use it for batch status checks?",
  "home.faqBatchAnswer":
    "Yes. The Status Checker is designed for running multiple storefront availability checks in one focused view.",
  "home.ctaAria": "Open workspace",
  "home.ctaEyebrow": "Ready Desk",
  "home.ctaTitle":
    "Start with the manager, then branch into the task you need.",
  "setup.title": "Setup Guide",
  "setup.subtitle": "Follow the steps below to connect your Shopify store",
  "setup.stepStoreIdTitle": "Get Store ID",
  "setup.stepStoreIdBody": "Open the Domain page, then copy and save",
  "setup.example": "Example",
  "setup.storeId": "Store ID",
  "setup.stepCreateAppTitle": "Create App",
  "setup.createAppOpenApps": "Open",
  "setup.createAppDevelop": "Choose",
  "setup.createAppDashboard": "Click Build apps in Dev Dashboard",
  "setup.createAppCreate": "Click Create app",
  "setup.createAppName":
    "Name the app with the shop domain, for example:",
  "setup.stepConfigureTitle": "Configure App",
  "setup.tabVersions": "Versions tab",
  "setup.redirectUrl": "Redirect URL",
  "setup.apiVersion": "API version (default available)",
  "setup.scopes": "Scopes",
  "setup.copyScopes": "Copy scopes",
  "setup.expand": "Show more",
  "setup.releaseHint": "Then scroll up and click",
  "setup.stepCredentialsTitle": "Get Credentials",
  "setup.tabSettings": "Settings tab",
  "setup.clientId": "Client ID",
  "setup.clientSecret": "Client Secret",
  "setup.copyAndSave": "Copy and save",
  "setup.stepInstallTitle": "Install App",
  "setup.firstTab": "First tab",
  "setup.installApp": "Click Install app",
  "setup.chooseStore": "Choose the current store, then click Install",
  "setup.noteTitle": "Note this in the sheet with the format",
} as const;

export type MessageKey = keyof typeof en;

const vi: Record<MessageKey, string> = {
  "common.appName": "Spfi",
  "common.loading": "Đang tải...",
  "common.processing": "Đang xử lý...",
  "common.copy": "Sao chép",
  "common.done": "Xong",
  "common.clear": "Xóa",
  "common.cancel": "Hủy",
  "common.save": "Lưu",
  "common.add": "Thêm",
  "common.search": "Tìm kiếm",
  "common.refresh": "Làm mới",
  "common.lock": "Khóa",
  "nav.setup": "Thiết lập",
  "nav.manager": "Quản lý",
  "nav.profile": "Hồ sơ",
  "nav.customers": "Khách hàng",
  "nav.payment": "Thanh toán",
  "nav.sheet": "Sheet",
  "nav.status": "Trạng thái",
  "nav.language": "Ngôn ngữ",
  "vault.eyebrow": "Không gian bảo mật",
  "vault.setupTitle": "Tạo PIN bảo mật",
  "vault.unlockTitle": "Mở khóa credentials",
  "vault.setupDescription":
    "PIN này dùng để mã hóa Client Secret và Access Token trên thiết bị này. Nếu quên PIN thì không thể khôi phục.",
  "vault.unlockDescription":
    "Nhập PIN/password đã dùng cho trình duyệt này. Credentials sau khi giải mã chỉ nằm trong bộ nhớ cho đến khi refresh.",
  "vault.passwordLabel": "PIN hoặc password",
  "vault.confirmPasswordLabel": "Nhập lại PIN hoặc password",
  "vault.passwordPlaceholder": "Tối thiểu 4 ký tự",
  "vault.confirmPasswordPlaceholder": "Nhập lại lần nữa",
  "vault.showPassword": "Hiện",
  "vault.hidePassword": "Ẩn",
  "vault.mismatch": "PIN/password nhập lại chưa khớp.",
  "vault.submitSecuring": "Đang bảo mật credentials...",
  "vault.submitCreate": "Tạo vault",
  "vault.submitUnlock": "Mở khóa",
  "vault.securityNote": "AES-GCM - PBKDF2 - Lưu mã hóa trên thiết bị",
  "home.eyebrow": "Bảng điều khiển vận hành Shopify",
  "home.heroTitle": "Quan sát storefront từ một bàn làm việc",
  "home.heroSub":
    "Workspace gọn để kết nối shop, xoay token, kiểm tra trạng thái storefront và đọc dữ liệu Google Sheet mà không phải nhảy qua nhiều công cụ.",
  "home.openManager": "Mở Quản lý",
  "home.checkStatus": "Kiểm tra trạng thái",
  "home.previewAria": "Xem trước vận hành",
  "home.previewLive": "Workspace trực tiếp",
  "home.previewBatch": "Trạng thái hàng loạt",
  "home.previewAlive": "Alive 18",
  "home.previewHttp": "HTTP",
  "home.previewProducts": "Endpoint sản phẩm",
  "home.previewToken": "Xoay token",
  "home.previewReady": "Sẵn sàng",
  "home.previewSheet": "Tra cứu Sheet",
  "home.previewTabs": "4 tab",
  "home.workflowsAria": "Luồng công việc chính",
  "home.quickSetupTitle": "Hướng dẫn thiết lập",
  "home.quickSetupDescription":
    "Theo dõi checklist tạo app và chuẩn bị credentials.",
  "home.quickManagerTitle": "Quản lý shop",
  "home.quickManagerDescription":
    "Thêm store, xoay token và kiểm tra proxy.",
  "home.quickSheetTitle": "Sheets",
  "home.quickSheetDescription": "Mở các tab sheet và kiểm tra dòng nhanh.",
  "home.quickStatusTitle": "Kiểm tra trạng thái",
  "home.quickStatusDescription":
    "Kiểm tra hàng loạt khả năng truy cập storefront Shopify.",
  "home.motivationEyebrow": "Mục tiêu",
  "home.motivationTitle":
    "Giữ các thao tác Shopify lặp lại thật rõ ràng, bình tĩnh và nhanh.",
  "home.motivationBody":
    "Spfi được tạo cho những việc nhỏ nhưng tốn thời gian: chuyển giữa store, kiểm tra storefront còn truy cập được không, và lấy đúng dữ liệu sheet khi đơn hàng vẫn đang chạy.",
  "home.motivationTabsTitle": "Ít nhảy tab hơn",
  "home.motivationTabsDescription":
    "Di chuyển giữa setup, profile, payment, sheet và status check từ một nơi dễ đoán.",
  "home.motivationChecksTitle": "Kiểm tra store sạch hơn",
  "home.motivationChecksDescription":
    "Chạy kiểm tra storefront với ngữ cảnh proxy để dễ nhận ra shop bị chặn hoặc không khỏe.",
  "home.motivationCopyTitle": "Bớt thao tác copy tay",
  "home.motivationCopyDescription":
    "Dùng profile shop và sheet lookup đã lưu để giảm việc bàn giao thủ công quanh order.",
  "home.flowEyebrow": "Luồng hằng ngày",
  "home.flowTitle": "Một vòng lặp gọn hơn từ quyền truy cập đến xác minh.",
  "home.flowConnectTitle": "Kết nối shop",
  "home.flowConnectDescription":
    "Thêm credentials của store, chuẩn bị token và giữ dữ liệu profile sẵn sàng cho các bước tiếp theo.",
  "home.flowCheckTitle": "Kiểm tra bề mặt",
  "home.flowCheckDescription":
    "Xác nhận storefront và endpoint phản hồi ổn trước khi đi sâu vào order.",
  "home.flowDataTitle": "Dùng dữ liệu nguồn",
  "home.flowDataDescription":
    "Mở sheet, kiểm tra dòng, rồi chuyển sang product, order hoặc payment khi cần.",
  "home.faqEyebrow": "FAQ",
  "home.faqTitle": "Một vài câu hỏi trước khi mở workspace.",
  "home.faqFirstQuestion": "Nên mở trang nào trước?",
  "home.faqFirstAnswer":
    "Bắt đầu với Quản lý khi cần chuẩn bị store hoặc credentials. Dùng Trạng thái khi chỉ cần kiểm tra nhanh sức khỏe storefront.",
  "home.faqAdminQuestion": "Trang này có thay Shopify Admin không?",
  "home.faqAdminAnswer":
    "Không. Nó gom các kiểm tra vận hành lặp lại vào một chỗ, rồi dẫn bạn về đúng dữ liệu shop cần dùng.",
  "home.faqSheetQuestion": "Dữ liệu sheet dùng ở đâu?",
  "home.faqSheetAnswer":
    "Trang Sheet giúp kiểm tra tab và dòng trong Google Sheet khi công việc order hoặc product phụ thuộc vào bảng tính.",
  "home.faqBatchQuestion": "Có dùng để kiểm tra status hàng loạt được không?",
  "home.faqBatchAnswer":
    "Có. Status Checker được thiết kế để chạy nhiều kiểm tra storefront trong một view tập trung.",
  "home.ctaAria": "Mở workspace",
  "home.ctaEyebrow": "Bàn làm việc sẵn sàng",
  "home.ctaTitle":
    "Bắt đầu từ Quản lý, rồi đi tiếp vào đúng việc bạn cần.",
  "setup.title": "Hướng dẫn thiết lập",
  "setup.subtitle": "Làm theo các bước dưới đây để kết nối Shopify store",
  "setup.stepStoreIdTitle": "Lấy Store ID",
  "setup.stepStoreIdBody": "Vào trang Domain, sau đó copy và lưu lại",
  "setup.example": "Ví dụ",
  "setup.storeId": "Store ID",
  "setup.stepCreateAppTitle": "Tạo App",
  "setup.createAppOpenApps": "Vào trang",
  "setup.createAppDevelop": "Chọn",
  "setup.createAppDashboard": "Click Build apps in Dev Dashboard",
  "setup.createAppCreate": "Click Create app",
  "setup.createAppName": "Đặt tên app theo shop domain, ví dụ:",
  "setup.stepConfigureTitle": "Cấu hình App",
  "setup.tabVersions": "Tab Versions",
  "setup.redirectUrl": "Redirect URL",
  "setup.apiVersion": "API version (mặc định có sẵn)",
  "setup.scopes": "Scopes",
  "setup.copyScopes": "Sao chép scopes",
  "setup.expand": "Xem thêm",
  "setup.releaseHint": "Sau đó kéo lên và click",
  "setup.stepCredentialsTitle": "Lấy Credentials",
  "setup.tabSettings": "Tab Settings",
  "setup.clientId": "Client ID",
  "setup.clientSecret": "Client Secret",
  "setup.copyAndSave": "Copy và lưu lại",
  "setup.stepInstallTitle": "Cài App",
  "setup.firstTab": "Tab đầu tiên",
  "setup.installApp": "Click Install app",
  "setup.chooseStore": "Chọn store hiện tại, sau đó click Install",
  "setup.noteTitle": "Note vào sheet theo format",
};

export const messages: Record<LocaleCode, Record<MessageKey, string>> = {
  en,
  vi,
};

export function isLocaleCode(value: string): value is LocaleCode {
  return value === "en" || value === "vi";
}
