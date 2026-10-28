// Thai summary + tag for every route in routes/api.js, used to build the Swagger (OpenAPI) page.
// Key = "METHOD /express/path". The spec is generated from the live router (docs/openapi.js), so a route that
// is missing here still appears in the docs with an auto summary; a stale entry here is simply ignored.
// Entry = [method, path, tag, summary, options?]
//   options.limited  the route sits behind the strict rate limiter (10 tries / 15 min)
//   options.body     example JSON body (only where verified in the controller / app)
//   options.errors   extra documented status codes { 409: 'คำอธิบาย' }
//   options.binary   response is a file / image, not JSON

const T = {
  system: 'ระบบ',
  auth: 'การยืนยันตัวตน (Auth)',
  admins: 'บัญชีผู้ดูแลระบบ (Admins)',
  employees: 'พนักงาน',
  departments: 'แผนก',
  attendance: 'การลงเวลา',
  locations: 'สถานที่ลงเวลา (Work Locations)',
  uploads: 'ไฟล์แนบใบลา',
  leaves: 'การลา',
  policies: 'นโยบายการลา',
  quests: 'Quest (ภารกิจ)',
  rewards: 'รางวัลและคูปอง',
  categories: 'หมวดหมู่รางวัล',
  points: 'แต้มและลีดเดอร์บอร์ด',
  announcements: 'ประกาศ',
  notifications: 'การแจ้งเตือน',
  hr: 'HR Dashboard และรายงาน',
  settings: 'ตั้งค่าระบบ',
  approvals: 'การอนุมัติ',
  audit: 'Audit Log',
  holidays: 'วันหยุด',
};

const ROUTES = [
  ['GET', '/health', T.system, 'ตรวจสอบว่า API ทำงานอยู่'],

  ['POST', '/auth/login', T.auth, 'เข้าสู่ระบบ (ได้ token สำหรับใส่ปุ่ม Authorize)', { body: { username: 'admin@example.com', password: '********', portal: 'web' } }],
  ['POST', '/login', T.auth, 'เข้าสู่ระบบ (ชื่อสำรองของ /auth/login)', { body: { username: 'admin@example.com', password: '********', portal: 'web' } }],
  ['GET', '/auth/profile', T.auth, 'ดูข้อมูลโปรไฟล์ของตัวเอง'],
  ['PUT', '/auth/profile/avatar', T.auth, 'เปลี่ยนรูปโปรไฟล์ของตัวเอง (ส่งเป็น data URL, server ตรวจชนิดและขนาด)'],
  ['POST', '/auth/change-password', T.auth, 'เปลี่ยนรหัสผ่านของตัวเอง'],
  ['POST', '/auth/forgot-password', T.auth, 'ขอลิงก์รีเซ็ตรหัสผ่าน (ใช้ได้เฉพาะแอดมินจากหน้าเว็บ portal=web)', { limited: true }],
  ['POST', '/auth/refresh', T.auth, 'ขอ token ใหม่ด้วย refresh token'],
  ['POST', '/auth/logout', T.auth, 'ออกจากระบบ'],
  ['POST', '/auth/set-pin', T.auth, 'ตั้งหรือเปลี่ยน PIN 6 หลัก', { body: { pin: '123456', currentPin: '(ถ้าเปลี่ยน PIN)', currentPassword: '(หรือยืนยันด้วยรหัสผ่าน)' } }],
  ['POST', '/auth/verify-pin', T.auth, 'ตรวจสอบ PIN เพื่อปลดล็อกแอป', { limited: true }],
  ['POST', '/auth/remove-pin', T.auth, 'ยกเลิก PIN'],
  ['GET', '/auth/pin-status', T.auth, 'ดูว่าตั้ง PIN ไว้แล้วหรือยัง'],

  ['GET', '/admins', T.admins, 'รายชื่อบัญชีแอดมิน'],
  ['POST', '/admins', T.admins, 'สร้างบัญชีแอดมิน (ระบบส่งอีเมลให้ตั้งรหัสผ่าน)'],
  ['POST', '/admins/set-password', T.admins, 'ตั้งรหัสผ่านแอดมินจากลิงก์ในอีเมล', { limited: true }],
  ['POST', '/admins/:id/resend-invite', T.admins, 'ส่งอีเมลเชิญตั้งรหัสผ่านซ้ำ'],
  ['PUT', '/admins/:id', T.admins, 'แก้ไขบัญชีแอดมิน'],
  ['DELETE', '/admins/:id', T.admins, 'ลบบัญชีแอดมิน'],

  ['GET', '/employees', T.employees, 'รายชื่อพนักงาน'],
  ['GET', '/employees/:id', T.employees, 'ดูข้อมูลพนักงานรายคน'],
  ['POST', '/employees', T.employees, 'เพิ่มพนักงาน'],
  ['POST', '/employees/set-password', T.employees, 'ตั้งรหัสผ่านพนักงานจากลิงก์ในอีเมล', { limited: true }],
  ['POST', '/employees/:id/reset-password', T.employees, 'รีเซ็ตรหัสผ่านพนักงาน (ส่งลิงก์ตั้งรหัสผ่านทางอีเมล)'],
  ['PUT', '/employees/:id', T.employees, 'แก้ไขข้อมูลพนักงาน'],
  ['DELETE', '/employees/:id', T.employees, 'ลบพนักงาน'],

  ['GET', '/departments', T.departments, 'รายการแผนก'],
  ['POST', '/departments', T.departments, 'สร้างแผนก'],
  ['PUT', '/departments/:id', T.departments, 'แก้ไขแผนก (เปลี่ยนชื่อจะอัปเดตชื่อในพนักงานด้วย)'],
  ['DELETE', '/departments/:id', T.departments, 'ลบแผนก (ลบไม่ได้ถ้ายังมีสมาชิก)'],

  ['POST', '/attendance/clock-in', T.attendance, 'เข้างาน (ต้องส่ง locationId + พิกัด server คำนวณระยะเอง นอกรัศมีตอบ 403)', { errors: { 403: 'อยู่นอกรัศมีสถานที่ลงเวลา หรือยังไม่มีสถานที่ที่ใช้ได้' } }],
  ['POST', '/attendance/clock-out', T.attendance, 'ออกงาน (ตรวจพื้นที่เหมือนเข้างาน และแจกแต้มเข้างานตรงเวลาถ้าครบเงื่อนไข ตอบ pointsAwarded)', { errors: { 403: 'อยู่นอกรัศมีสถานที่ลงเวลา' } }],
  ['GET', '/attendance/today', T.attendance, 'สถานะการลงเวลาของวันนี้'],
  ['GET', '/attendance/locations', T.attendance, 'สถานที่ลงเวลาที่ผู้ใช้ใช้ได้ เรียงตามระยะ'],
  ['GET', '/attendance/history', T.attendance, 'ประวัติการลงเวลา'],
  ['GET', '/attendance/summary', T.attendance, 'สรุปการลงเวลา'],
  ['GET', '/attendance/corrections', T.attendance, 'รายการคำขอปรับปรุงเวลา (สำหรับผู้อนุมัติ)'],
  ['POST', '/attendance/corrections', T.attendance, 'ยื่นคำขอปรับปรุงเวลาเข้า-ออกงาน (SuperBoss อนุมัติและบันทึกทันที)'],
  ['GET', '/attendance/corrections/my-requests', T.attendance, 'คำขอปรับปรุงเวลาของตัวเอง'],

  ['GET', '/work-locations', T.locations, 'รายการสถานที่ลงเวลาทั้งหมด (แอดมิน)'],
  ['POST', '/work-locations', T.locations, 'สร้างสถานที่ลงเวลา (ชื่อ ประเภท พิกัด รัศมี ผู้ใช้ได้)'],
  ['PUT', '/work-locations/:id', T.locations, 'แก้ไขสถานที่ลงเวลา'],
  ['DELETE', '/work-locations/:id', T.locations, 'ลบสถานที่ลงเวลา'],

  ['POST', '/uploads/leave-attachment', T.uploads, 'อัปโหลดไฟล์แนบใบลา (รูป / PDF / Word ไม่เกิน 5 MB, server ตรวจชนิดจากเนื้อไฟล์)'],
  ['GET', '/uploads/leave/:id/link', T.uploads, 'ขอลิงก์เปิดไฟล์แนบ อายุ 5 นาที (เฉพาะเจ้าของใบลาหรือผู้อนุมัติ)'],
  ['GET', '/uploads/leave/:id/file', T.uploads, 'เปิดไฟล์แนบด้วยลิงก์ชั่วคราวที่ได้จาก endpoint link', { binary: true }],

  ['GET', '/leaves/balances', T.leaves, 'สิทธิ์การลาคงเหลือ'],
  ['POST', '/leaves', T.leaves, 'ยื่นใบลา (ตรวจโควตา เพศ และไฟล์แนบตามนโยบาย)'],
  ['GET', '/leaves/my-requests', T.leaves, 'ใบลาของตัวเอง'],
  ['GET', '/leaves/:id', T.leaves, 'ดูใบลา (เจ้าของใบลาหรือผู้อนุมัติ)'],
  ['DELETE', '/leaves/:id/cancel', T.leaves, 'ยกเลิกใบลาของตัวเอง'],

  ['GET', '/leave-policies', T.policies, 'รายการนโยบายการลา'],
  ['POST', '/leave-policies', T.policies, 'สร้างนโยบายการลา (โควตา เพศที่ใช้ได้ ต้องแนบเอกสาร)'],
  ['PUT', '/leave-policies/:id', T.policies, 'แก้ไขนโยบายการลา'],
  ['DELETE', '/leave-policies/:id', T.policies, 'ลบนโยบายการลา'],

  ['GET', '/quests', T.quests, 'รายการ Quest (แอดมิน)'],
  ['GET', '/quests/:id', T.quests, 'รายละเอียด Quest (แอดมิน)'],
  ['POST', '/quests', T.quests, 'สร้าง Quest'],
  ['PUT', '/quests/:id', T.quests, 'แก้ไข Quest (Quiz ที่ตั้ง No edit allow แก้ไม่ได้เมื่อ Quest เริ่มแล้ว)'],
  ['DELETE', '/quests/:id', T.quests, 'ลบ Quest'],
  ['GET', '/my-quests', T.quests, 'Quest ที่มอบหมายให้ฉัน'],
  ['GET', '/my-quests/:id', T.quests, 'รายละเอียด Quest ของฉัน (ไม่ส่งเฉลย)'],
  ['POST', '/my-quests/:id/submit', T.quests, 'ส่งคำตอบ Quest (server ตรวจเอง ผ่านแล้วได้แต้มและคูปองใน transaction เดียว ทำได้ครั้งเดียวต่อ Quest)', { errors: { 409: 'ทำ Quest นี้ไปแล้ว (ผ่านแล้วหรือส่งแล้วไม่ผ่าน)' } }],

  ['GET', '/reward-categories', T.categories, 'รายการหมวดหมู่รางวัล'],
  ['POST', '/reward-categories', T.categories, 'สร้างหมวดหมู่รางวัล (ชื่อและ code ห้ามซ้ำ)'],
  ['PUT', '/reward-categories/:id', T.categories, 'แก้ไขหมวดหมู่ (เปลี่ยนชื่อจะอัปเดตชื่อใน Reward ทั้งหมด)'],
  ['DELETE', '/reward-categories/:id', T.categories, 'ลบหมวดหมู่ (ลบไม่ได้ถ้ายังมี Reward)', { errors: { 409: 'ยังมี Reward อยู่ในหมวดนี้' } }],

  ['GET', '/rewards', T.rewards, 'รายการรางวัล'],
  ['POST', '/rewards', T.rewards, 'สร้างรางวัล (ต้องเลือกหมวดหมู่)'],
  ['DELETE', '/rewards/:id', T.rewards, 'ลบรางวัล'],
  ['GET', '/rewards/my-coupons', T.rewards, 'คูปองรางวัลของฉัน'],
  ['GET', '/rewards/:id', T.rewards, 'รายละเอียดรางวัล'],
  ['POST', '/rewards/:id/redeem', T.rewards, 'แลกรางวัลด้วยแต้ม (atomic transaction ใช้แต้มเกินไม่ได้)'],

  ['GET', '/points/history', T.points, 'ประวัติแต้มของฉัน'],
  ['GET', '/leaderboard', T.points, 'ลีดเดอร์บอร์ดแต้มสะสม'],

  ['GET', '/announcements', T.announcements, 'ประกาศที่ Active ตอนนี้ (สาธารณะ แอปใช้)'],
  ['GET', '/announcements/all', T.announcements, 'ประกาศทุกสถานะ (แอดมิน)'],
  ['GET', '/announcements/:id/image', T.announcements, 'รูปประกาศ (PNG / GIF)', { binary: true }],
  ['GET', '/announcements/:id', T.announcements, 'รายละเอียดประกาศ'],
  ['POST', '/announcements', T.announcements, 'สร้างประกาศ (รูป PNG / GIF ไม่เกิน 5 MB)'],
  ['PUT', '/announcements/:id', T.announcements, 'แก้ไขประกาศ'],
  ['DELETE', '/announcements/:id', T.announcements, 'ลบประกาศ'],

  ['GET', '/notifications', T.notifications, 'การแจ้งเตือนของฉัน'],
  ['PATCH', '/notifications/read-all', T.notifications, 'ทำเครื่องหมายอ่านแล้วทั้งหมด'],
  ['PATCH', '/notifications/:id/read', T.notifications, 'ทำเครื่องหมายอ่านแล้วรายการเดียว'],
  ['POST', '/notifications/push-token', T.notifications, 'ลงทะเบียน push token ของอุปกรณ์'],

  ['GET', '/hr/dashboard/stats', T.hr, 'ตัวเลขสรุปบน HR Dashboard'],
  ['GET', '/hr/reports/attendance', T.hr, 'รายงานการลงเวลา'],

  ['GET', '/settings/work-time', T.settings, 'อ่านการตั้งค่าเวลาทำงาน (เวลาเริ่มงาน เวลาสาย ชั่วโมงต่อวัน แต้มเข้างานตรงเวลา)'],
  ['PUT', '/settings/work-time', T.settings, 'บันทึกการตั้งค่าเวลาทำงาน (server ตรวจค่าที่ workRules)'],
  ['GET', '/settings', T.settings, 'อ่านการตั้งค่าระบบ'],
  ['PUT', '/settings', T.settings, 'บันทึกการตั้งค่าระบบ'],

  ['GET', '/approvals/pending', T.approvals, 'คำขอลา / แก้เวลาที่รออนุมัติและผู้ใช้ตัดสินได้'],
  ['GET', '/approvals/history', T.approvals, 'ประวัติที่ผู้ใช้คนนี้ตัดสินเอง'],
  ['PATCH', '/approvals/:requestType/:id', T.approvals, 'อนุมัติหรือไม่อนุมัติคำขอ (ขั้นเดียวจบ ไม่ส่งต่อ)', { body: { action: 'approved', remark: '(เหตุผล ถ้าไม่อนุมัติ)' } }],

  ['GET', '/audit-logs', T.audit, 'รายการ Audit Log'],

  ['GET', '/holidays', T.holidays, 'วันหยุดราชการ (สาธารณะ)'],
];

// One-paragraph Thai explanation shown under each group title
const TAG_DESCRIPTIONS = {
  [T.system]: 'เส้นทางตรวจสุขภาพของ API ใช้ดูว่า server เปิดอยู่ ไม่ต้องล็อกอิน',
  [T.auth]: 'ล็อกอิน รับ token ตั้ง/ตรวจ PIN 6 หลัก เปลี่ยนรหัสผ่าน และจัดการโปรไฟล์ของตัวเอง **พนักงานรีเซ็ตรหัสผ่านเองในแอปไม่ได้** ต้องให้ Admin รีเซ็ตให้ที่เว็บ ส่วน `forgot-password` ใช้ได้เฉพาะแอดมินจากหน้าเว็บ',
  [T.admins]: 'จัดการบัญชีผู้ดูแลระบบของเว็บ (ตาราง admins แยกจากพนักงาน) ใช้ได้เฉพาะ **Super Admin** เท่านั้น SuperBoss ซึ่งเป็นผู้อนุมัติฝั่งพนักงานจัดการแอดมินไม่ได้',
  [T.employees]: 'ข้อมูลพนักงาน (ตาราง employees) แอดมินเพิ่ม/แก้ไข/ลบและรีเซ็ตรหัสผ่านผ่านเว็บ พนักงานเชื่อมกับแผนกด้วย department_id จริง',
  [T.departments]: 'โครงสร้างแผนก เปลี่ยนชื่อแผนกจะ cascade ชื่อไปยังพนักงานทุกคน และลบแผนกไม่ได้ถ้ายังมีสมาชิก',
  [T.attendance]: 'เข้างาน/ออกงาน ประวัติ และคำขอปรับปรุงเวลา **ต้องอยู่ในพื้นที่ที่แอดมินกำหนดเท่านั้น** server คำนวณระยะเอง ไม่เชื่อระยะที่แอปส่งมา เวลาสายและชั่วโมงทำงานอ่านจากการตั้งค่า Work Time Settings ไม่ฮาร์ดโค้ด',
  [T.locations]: 'แอดมินกำหนดสถานที่ลงเวลา (ชื่อ ประเภท พิกัด รัศมีเมตร และใช้ได้ทุกคน/ตามแผนก/รายบุคคล) ถ้ายังไม่มีสถานที่ Active เลย พนักงานลงเวลาไม่ได้',
  [T.uploads]: 'ไฟล์แนบใบลา (รูป / PDF / Word ไม่เกิน 5 MB) เก็บในฐานข้อมูล server ตรวจชนิดไฟล์จากเนื้อหาจริง และเปิดดูผ่านลิงก์ชั่วคราวอายุ 5 นาที',
  [T.leaves]: 'ยื่นใบลา ดูสิทธิ์คงเหลือ และยกเลิกใบลา สถานะเริ่มต้นเป็น `รออนุมัติระดับ 1 (Boss)` ถ้าผู้ยื่นเป็น Employee ที่มี Boss ในแผนก นอกนั้นเป็น `รออนุมัติระดับ 2 (Superboss)`',
  [T.policies]: 'นโยบายการลาที่ HR ตั้ง (โควตา เพศที่ใช้ได้ ต้องแนบเอกสาร) server บังคับใช้ตอนยื่นใบลา',
  [T.quests]: 'ภารกิจแบบ Quiz แอดมินสร้างผ่านเว็บ (เมนู Mission) พนักงานทำผ่านแอป server ตรวจคำตอบเอง ผ่านแล้วได้แต้มก้อนเดียวและคูปองรางวัลฟรี **ทำได้ครั้งเดียวต่อ Quest**',
  [T.rewards]: 'แค็ตตาล็อกรางวัล การแลกด้วยแต้ม และคูปองของฉัน การแลกเป็น atomic transaction ใช้แต้มเกินไม่ได้',
  [T.categories]: 'หมวดหมู่ของรางวัล ทุก Reward ต้องอยู่ในหมวดหมู่ ลบหมวดที่ยังมี Reward ไม่ได้',
  [T.points]: 'ประวัติแต้มของฉันและลีดเดอร์บอร์ด แต้มเพิ่มได้จาก server เท่านั้น (แต้มเข้างานตรงเวลา, Quest) ทุกรายการบันทึกใน point_transactions',
  [T.announcements]: 'ประกาศที่แอดมินสร้างผ่านเว็บ สถานะ Scheduled / Active / Expired คำนวณที่ server เวลาไทย แอปแสดงเฉพาะที่ Active ผ่านกระดิ่งแจ้งเตือน',
  [T.notifications]: 'การแจ้งเตือนของผู้ใช้ (ผลอนุมัติ ฯลฯ) และการลงทะเบียน push token แอปรวมประกาศที่ Active เข้ากับรายการนี้ฝั่งเครื่อง ยังไม่ใช่ push จริง',
  [T.hr]: 'ตัวเลขสรุปและรายงานสำหรับ HR และผู้อนุมัติ',
  [T.settings]: 'การตั้งค่าระบบ รวมถึง **Work Time Settings** (เวลาเริ่มงาน เวลาสาย ชั่วโมงทำงานต่อวัน แต้มเข้างานตรงเวลา) ที่ทั้งเว็บ แอป และ server ใช้ร่วมกัน',
  [T.approvals]: '**การอนุมัติครั้งเดียวจบ ไม่ส่งต่อ** Boss ตัดสินคำขอของ Employee ในแผนกเดียวกันได้โดยตรง ส่วนคำขอของ Boss และของแผนกที่ไม่มี Boss ให้ SuperBoss / Super Admin / CEO / Director ตัดสินขั้นสุดท้าย Boss อนุมัติของตัวเองหรือของ Boss ด้วยกันไม่ได้ ประวัติแยกตามบัญชีที่ตัดสินเอง',
  [T.audit]: 'บันทึกการกระทำสำคัญในระบบ (เช่น อนุมัติ/ไม่อนุมัติ) ดูได้เฉพาะแอดมิน',
  [T.holidays]: 'วันหยุดราชการ ไม่ต้องล็อกอิน',
};

module.exports = { ROUTES, TAGS: Object.values(T), TAG_DESCRIPTIONS };
