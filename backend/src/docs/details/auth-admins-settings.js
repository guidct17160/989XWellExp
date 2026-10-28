// รายละเอียด API กลุ่ม: ระบบ (health), การยืนยันตัวตน (auth), บัญชีผู้ดูแลระบบ (admins), ตั้งค่าระบบ (settings)
// ข้อมูลในตัวอย่างเป็นข้อมูลสมมติทั้งหมด (ไม่ใช่อีเมล รหัสผ่าน หรือ token จริง)
// ที่มา: controllers/authController.js, adminController.js, settingsController.js, middlewares/authMiddleware.js,
//        utils/workRules.js, stores/systemStore.js, stores/userStore.js, services/emailService.js และเทสใน backend/tests

const FAKE_ACCESS = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token.signature';
const FAKE_REFRESH = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-refresh-token.signature';

// ตัวอย่างข้อมูลผู้ใช้ที่ API ส่งกลับ (ไม่มี password / pinHash เสมอ มีแต่ hasPin)
const ADMIN_USER = {
  id: 'ADM-001',
  code: 'ADM-001',
  username: 'admin',
  name: 'ผู้ดูแลระบบ (Web Admin)',
  email: 'admin@example.com',
  phone: '081-234-5678',
  department: '-',
  role: 'Super Admin',
  status: 'Active',
  startDate: '2026-01-01',
  avatarUrl: 'https://example.com/avatar.png',
  hasPin: false,
};

const EMPLOYEE_USER = {
  id: 'EMP-001',
  code: 'EMP-001',
  username: 'emp-001',
  name: 'สมชาย ใจดี',
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  email: 'somchai@example.com',
  phone: '081-111-2222',
  department: 'ฝ่ายขาย',
  role: 'Employee',
  status: 'Active',
  startDate: '2024-01-01',
  resignDate: null,
  avatarUrl: null,
  gender: 'Male',
  points: 120,
  birthDate: '1995-05-20',
  dob: '1995-05-20',
  createdAt: '2024-01-01T02:00:00.000Z',
  hasPin: false,
};

const EMAIL_PREVIEW = {
  to: 'newadmin@example.com',
  subject: 'ตั้งรหัสผ่านผู้ดูแลระบบ',
  sentAt: '27/10/2569 10:00:00',
  setupLink: 'http://localhost:5173/set-password?email=newadmin%40example.com&token=<setup-token>&portal=web&type=admin',
  setupToken: '<setup-token>',
  gmailComposeUrl: 'https://mail.google.com/mail/?view=cm&to=newadmin%40example.com',
  plainTextBody: '...',
  realSmtpSent: false,
};

const R401_AUTH = {
  description: 'ไม่ได้ส่ง token (Bearer) มา หรือ token ไม่ถูกต้อง/หมดอายุ',
  example: { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)' },
};
const R403_SUPER = {
  description: 'ผู้เรียกไม่ใช่ role `Super Admin` (Admin ธรรมดา, HR Admin, SuperBoss, Boss, Employee เรียกไม่ได้)',
  example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบสูงสุด (Super Admin)เท่านั้น (Forbidden)' },
};
const R403_ADMIN = {
  description: 'ผู้เรียกไม่ใช่แอดมิน (ต้องเป็น role `Admin`, `Super Admin` หรือ `HR Admin`) เช่น Employee / Boss / SuperBoss',
  example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบ (Admin)เท่านั้น (Forbidden)' },
};
const R429_SENSITIVE = {
  description: 'เรียก endpoint นี้ถี่เกินไป: จำกัด 10 ครั้งต่อ 15 นาทีต่อ IP (ปิดการจำกัดเฉพาะตอนรันเทส)',
  example: { success: false, message: 'ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
};
const R404_ADMIN = {
  description: 'ไม่พบบัญชีแอดมินตามรหัสที่ส่งมา',
  example: { success: false, message: 'ไม่พบข้อมูลผู้ดูแลระบบนี้' },
};

module.exports = {
  // ---------------------------------------------------------------- ระบบ
  'GET /health': {
    description: [
      '**ทำอะไร:** ตรวจว่า backend API เปิดทำงานอยู่หรือไม่ (ใช้เป็น "ping")',
      '',
      '**server ทำอย่างไร:**',
      '1. ตอบ `status: "ok"` พร้อมชื่อบริการและเวลา server ทันที (ไม่ได้ตรวจฐานข้อมูล)',
      '',
      '**กฎสำคัญ:**',
      '- เปิดสาธารณะ ไม่ต้องล็อกอินและไม่ต้องส่ง token',
      '',
      '**ข้อควรระวัง:** คำตอบนี้ไม่มี field `success` ต่างจาก endpoint อื่น และการตอบ ok ไม่ได้แปลว่าเชื่อมต่อ PostgreSQL ได้',
    ].join('\n'),
    responses: {
      200: {
        description: 'server ทำงานปกติ',
        example: { status: 'ok', service: 'WellX989 Backend API', timestamp: '2026-10-27T03:00:00.000Z' },
      },
    },
  },

  // ---------------------------------------------------------------- Auth: login
  'POST /auth/login': {
    description: [
      '**ทำอะไร:** เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน แล้วรับ token สำหรับเรียก API อื่น มี 2 ช่องทาง: เว็บแอดมิน (`portal: "web"`) และแอปพนักงาน (`portal: "app"`)',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจว่ามี `username` และ `password` (ตัดช่องว่างหน้า-หลัง และแปลง username เป็นตัวพิมพ์เล็ก)',
      '2. ค้นหาบัญชีจากตาราง admins และ employees โดย username ตรงกับ username, code, email, id หรือชื่อ (ไม่สนตัวพิมพ์)',
      '3. ตามช่องทาง `portal`: `web` ค้นเฉพาะบัญชีแอดมิน, `app` ค้นเฉพาะบัญชีพนักงาน ถ้าเจอผิดฝั่งตอบ 403',
      '4. ตรวจสถานะบัญชี (Pending / Inactive / Resign) แล้วตรวจรหัสผ่านกับ hash (bcrypt)',
      '5. ออก token ตามช่องทาง: เว็บแอดมินได้ access token อายุ 1 วัน, แอปพนักงานได้ access token อายุ 15 นาที + refresh token อายุ 30 วัน',
      '6. บันทึก Audit Log (`LOGIN_SUCCESS` / `LOGIN_FAILED`)',
      '',
      '**กฎสำคัญ:**',
      '- แอดมิน (ตาราง `admins`) กับพนักงาน (ตาราง `employees`) แยกกัน มีรหัสผ่านคนละชุด พนักงานเข้าเว็บแอดมินไม่ได้ และแอดมินเข้าแอปพนักงานไม่ได้',
      '- เว็บ: บัญชีสถานะ `Pending Password` (ยังไม่ตั้งรหัสผ่านจากอีเมล) หรือ `Inactive` เข้าไม่ได้ (403)',
      '- แอป: บัญชีสถานะ `Pending`, `Inactive`, `Resign` เข้าไม่ได้ (403)',
      '- ถ้าไม่ส่ง `portal` server จะลองหาในแอดมินก่อน แล้วค่อยหาในพนักงาน และออก token ตามประเภทบัญชีที่เจอ (ข้อความสำเร็จจะต่างจากกรณีมี portal)',
      '- เว็บ: ไม่ใช้งาน 30 นาที หรือครบ 8 ชั่วโมง ต้องล็อกอินใหม่ (ฝั่ง client ตรวจเอง ค่าอยู่ใน `timeoutConfig`)',
      '- ถ้าเก็บรหัสผ่านเก่าเป็น plaintext ระบบจะแปลงเป็น bcrypt hash ให้อัตโนมัติหลังล็อกอินสำเร็จ',
      '',
      '**ข้อควรระวัง:** ส่ง token ใน header `Authorization: Bearer <token>` กับ endpoint อื่น ผู้ใช้ในคำตอบจะไม่มี password / PIN hash (มีแค่ `hasPin`) คำตอบล็อกอินเว็บมี `timeoutConfig` ส่วนแอปมี `refreshToken` และ `tokenConfig` เส้นทาง `/auth/login` และ `/login` ถูกจำกัดจำนวนครั้งที่ระดับ server (1,000 ครั้งต่อ 15 นาทีต่อ IP ยกเว้นเครื่อง localhost)',
    ].join('\n'),
    body: {
      description: 'JSON body ที่ต้องมี username และ password',
      fields: [
        { name: 'username', type: 'string', required: true, description: 'ชื่อผู้ใช้ ใช้ username, รหัสพนักงาน (code), อีเมล, id หรือชื่อก็ได้ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) แอดมินใช้อีเมลเป็น username', example: 'somchai' },
        { name: 'password', type: 'string', required: true, description: 'รหัสผ่าน (ตัดช่องว่างหน้า-หลังก่อนตรวจ)', example: 'Passw0rd!' },
        { name: 'portal', type: 'string', required: false, description: 'ช่องทางที่เข้า: `web` = เว็บแอดมิน, `app` = แอปพนักงาน ถ้าไม่ส่ง server เดาจากชนิดบัญชี', example: 'app', enum: ['web', 'app'] },
      ],
      example: { username: 'emp-001', password: 'Passw0rd!', portal: 'app' },
    },
    responses: {
      200: {
        description: 'เข้าสู่ระบบสำเร็จ ตัวอย่างนี้คือแอปพนักงาน (`portal: "app"`) ถ้าเป็นเว็บแอดมินจะไม่มี `refreshToken` / `tokenConfig` แต่มี `timeoutConfig: { idleTimeoutMinutes: 30, absoluteTimeoutHours: 8, description }` และ `message` เป็น "เข้าสู่ระบบ Web Admin สำเร็จ"',
        example: {
          success: true,
          message: 'เข้าสู่ระบบ Mobile App สำเร็จ',
          token: FAKE_ACCESS,
          accessToken: FAKE_ACCESS,
          refreshToken: FAKE_REFRESH,
          user: EMPLOYEE_USER,
          tokenConfig: {
            accessTokenMinutes: 15,
            refreshTokenDays: 30,
            description: 'App HR สำหรับพนักงาน: Access Token 15 นาที, Refresh Token 30 วัน',
          },
        },
      },
      400: {
        description: 'ไม่ได้กรอก username และ/หรือ password (ข้อความต่างกันตามที่ขาด: ขาดทั้งสอง / ขาด username / ขาด password)',
        example: { success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
      },
      401: {
        description: 'ไม่พบชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง (ถ้ารหัสผ่านผิดข้อความคือ "รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง")',
        example: { success: false, message: 'ชื่อผู้ใช้ (Username) ไม่ถูกต้อง หรือไม่พบบัญชีนี้ในระบบ' },
      },
      403: {
        description: 'เข้าผิดช่องทาง (พนักงานเข้าเว็บ / แอดมินเข้าแอป) หรือบัญชียังไม่พร้อมใช้ (Pending / Inactive / Resign) ข้อความตัวอย่างคือพนักงานพยายามเข้าเว็บแอดมิน',
        example: { success: false, message: 'บัญชีนี้เป็นพนักงานทั่วไป สามารถเข้าใช้งานได้เฉพาะบน Mobile App เท่านั้น' },
      },
      429: {
        description: 'เรียกถี่เกินไปจากเครือข่ายเดียวกัน (จำกัดที่ระดับ server ยกเว้นเครื่อง localhost)',
        example: { success: false, message: 'คำขอมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
      },
      500: {
        description: 'เกิดข้อผิดพลาดภายใน server (ส่ง `message` ของ error กลับมา)',
        example: { success: false, message: 'error message จากระบบ' },
      },
    },
  },

  'POST /login': {
    description: [
      '**ทำอะไร:** เหมือน `POST /auth/login` ทุกประการ (alias หรือชื่อสำรองของ endpoint เดียวกัน ใช้ controller ตัวเดียวกัน)',
      '',
      '**server ทำอย่างไร:** ดูรายละเอียดที่ `POST /auth/login` ทั้งหมด (ตรวจ username/password, เลือกบัญชีตาม `portal`, ตรวจสถานะ, ออก token)',
      '',
      '**กฎสำคัญ:**',
      '- แอดมินเข้าได้เฉพาะ `portal: "web"` และพนักงานเข้าได้เฉพาะ `portal: "app"`',
      '- ถ้าไม่ส่ง `portal` server ลองหาในแอดมินก่อน แล้วค่อยหาในพนักงาน',
      '',
      '**ข้อควรระวัง:** แนะนำให้ใช้ `POST /auth/login` เป็นหลัก endpoint นี้มีไว้เพื่อความเข้ากันได้กับ client รุ่นเก่า',
    ].join('\n'),
    body: {
      description: 'เหมือน POST /auth/login',
      fields: [
        { name: 'username', type: 'string', required: true, description: 'ชื่อผู้ใช้ รหัสพนักงาน อีเมล หรือ id (ไม่สนตัวพิมพ์เล็ก/ใหญ่)', example: 'admin@example.com' },
        { name: 'password', type: 'string', required: true, description: 'รหัสผ่าน', example: 'Passw0rd!' },
        { name: 'portal', type: 'string', required: false, description: '`web` = เว็บแอดมิน, `app` = แอปพนักงาน', example: 'web', enum: ['web', 'app'] },
      ],
      example: { username: 'admin@example.com', password: 'Passw0rd!', portal: 'web' },
    },
    responses: {
      200: {
        description: 'เข้าสู่ระบบสำเร็จ (ตัวอย่างนี้คือเว็บแอดมิน: access token อายุ 1 วัน ไม่มี refresh token)',
        example: {
          success: true,
          message: 'เข้าสู่ระบบ Web Admin สำเร็จ',
          token: FAKE_ACCESS,
          accessToken: FAKE_ACCESS,
          user: ADMIN_USER,
          timeoutConfig: {
            idleTimeoutMinutes: 30,
            absoluteTimeoutHours: 8,
            description: 'Web Admin HR: Idle Timeout 30 นาที, Absolute Timeout 8 ชั่วโมง',
          },
        },
      },
      400: {
        description: 'ไม่ได้กรอก username และ/หรือ password',
        example: { success: false, message: 'กรุณากรอกรหัสผ่าน (Password)' },
      },
      401: {
        description: 'ไม่พบชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง',
        example: { success: false, message: 'รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' },
      },
      403: {
        description: 'เข้าผิดช่องทาง หรือบัญชียังไม่พร้อมใช้ (Pending / Inactive / Resign)',
        example: { success: false, message: 'บัญชีนี้เป็นผู้ดูแลระบบ (Admin) สามารถเข้าใช้งานได้เฉพาะบน Web Admin เท่านั้น' },
      },
      429: {
        description: 'เรียกถี่เกินไปจากเครือข่ายเดียวกัน',
        example: { success: false, message: 'คำขอมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
      },
      500: {
        description: 'เกิดข้อผิดพลาดภายใน server',
        example: { success: false, message: 'error message จากระบบ' },
      },
    },
  },

  // ---------------------------------------------------------------- Auth: profile
  'GET /auth/profile': {
    description: [
      '**ทำอะไร:** ดูข้อมูลโปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่ (พนักงานหรือแอดมิน)',
      '',
      '**server ทำอย่างไร:**',
      '1. อ่านตัวตนจาก token (Bearer) เท่านั้น',
      '2. ค้นหาบัญชีในตาราง employees และ admins',
      '3. ส่งข้อมูลกลับโดยตัด password และ PIN hash ออก เหลือแค่ `hasPin` (true/false)',
      '',
      '**กฎสำคัญ:**',
      '- ต้องล็อกอิน (ส่ง token)',
      '- ตัวตนมาจาก token เท่านั้น ไม่เชื่อ header `x-employee-id`, query `employeeId` หรือ body (กันการดูข้อมูลของคนอื่น)',
      '',
      '**ข้อควรระวัง:** field ของ `user` ต่างกันตามชนิดบัญชี: พนักงานมี `firstName`, `lastName`, `gender`, `points`, `birthDate` ส่วนแอดมินไม่มี',
    ].join('\n'),
    responses: {
      200: { description: 'สำเร็จ ตัวอย่างเป็นบัญชีพนักงาน', example: { success: true, user: EMPLOYEE_USER } },
      401: {
        description: 'ไม่ได้ส่ง token / token ไม่ถูกต้อง หรือไม่พบบัญชีของ token นี้ในระบบ (ข้อความหลังคือกรณีไม่พบบัญชี)',
        example: { success: false, message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่' },
      },
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  'PUT /auth/profile/avatar': {
    description: [
      '**ทำอะไร:** พนักงานเปลี่ยนรูปโปรไฟล์ของตัวเองในแอป โดยไม่ต้องรอ Admin',
      '',
      '**server ทำอย่างไร:**',
      '1. อ่านตัวตนจาก token',
      '2. ตรวจ `avatarUrl` ว่าเป็น data URL ของรูป JPG / PNG / WEBP (base64)',
      '3. ตรวจขนาด: ความยาวข้อความไม่เกิน 600 x 1024 ตัวอักษร (ประมาณ 450 KB ของรูป)',
      '4. หาพนักงานจาก token แล้วบันทึกลง `employees.avatar_url`',
      '5. บันทึก Audit Log (`UPDATE_OWN_AVATAR`)',
      '',
      '**กฎสำคัญ:**',
      '- ใช้ได้เฉพาะบัญชีพนักงาน (บัญชีแอดมินจะได้ 404)',
      '- แอปย่อรูปเป็น JPEG กว้าง 320 px ก่อนส่ง จึงไม่ควรใหญ่เกินกำหนด',
      '',
      '**ข้อควรระวัง:** ส่งเป็น data URL ในรูป `data:image/jpeg;base64,xxxx` ไม่ใช่การอัปโหลดไฟล์ (multipart)',
    ].join('\n'),
    body: {
      description: 'JSON body มี field เดียว',
      fields: [
        { name: 'avatarUrl', type: 'string', required: true, description: 'data URL ของรูป รูปแบบ `data:image/(jpeg|jpg|png|webp);base64,<ข้อมูล base64>` ความยาวรวมไม่เกิน 614,400 ตัวอักษร', example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...' },
      ],
      example: { avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...' },
    },
    responses: {
      200: { description: 'เปลี่ยนรูปสำเร็จ', example: { success: true, message: 'เปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว', avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...' } },
      400: {
        description: 'รูปไม่ใช่ชนิดที่รองรับ/รูปแบบ data URL ไม่ถูกต้อง (ข้อความตัวอย่าง) หรือรูปใหญ่เกินไป ("ไฟล์รูปภาพใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง")',
        example: { success: false, message: 'ไฟล์รูปภาพไม่ถูกต้อง (รองรับ JPG, PNG, WEBP)' },
      },
      401: R401_AUTH,
      404: {
        description: 'ไม่พบข้อมูลพนักงาน (เช่น ผู้เรียกเป็นบัญชีแอดมิน)',
        example: { success: false, message: 'ไม่พบข้อมูลพนักงาน (เปลี่ยนรูปโปรไฟล์ได้เฉพาะบัญชีพนักงานในแอป)' },
      },
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'ไม่สามารถเปลี่ยนรูปโปรไฟล์ได้' } },
    },
  },

  'POST /auth/change-password': {
    description: [
      '**ทำอะไร:** ผู้ใช้ที่ล็อกอินอยู่ (พนักงานหรือแอดมิน) เปลี่ยนรหัสผ่านของตัวเอง โดยต้องยืนยันรหัสผ่านเดิม',
      '',
      '**server ทำอย่างไร:**',
      '1. อ่านตัวตนจาก token',
      '2. ตรวจว่าส่ง `currentPassword` และ `newPassword` มาครบ และ `newPassword` ยาวอย่างน้อย 6 ตัวอักษร',
      '3. หาบัญชีในตาราง employees และ admins แล้วตรวจรหัสผ่านเดิม',
      '4. เข้ารหัสรหัสผ่านใหม่ (bcrypt) แล้วบันทึกลงตารางของบัญชีนั้น',
      '',
      '**กฎสำคัญ:**',
      '- ต้องล็อกอิน และเปลี่ยนได้เฉพาะบัญชีของตัวเอง (ตัวตนมาจาก token ไม่ใช่ body)',
      '- รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร (ไม่มีกฎอื่น)',
      '- พนักงานลืมรหัสผ่านต้องแจ้ง Admin ให้รีเซ็ต ไม่ใช้ endpoint นี้ (ต้องรู้รหัสผ่านเดิม)',
      '',
      '**ข้อควรระวัง:** field `employeeId` ใน body มีไว้เป็นค่าสำรองเท่านั้น และไม่มีผลเมื่อมี token (ซึ่ง endpoint นี้บังคับเสมอ) ยังไม่ได้ยืนยัน: endpoint นี้ไม่บันทึก Audit Log',
    ].join('\n'),
    body: {
      description: 'JSON body',
      fields: [
        { name: 'currentPassword', type: 'string', required: true, description: 'รหัสผ่านปัจจุบัน', example: 'Passw0rd!' },
        { name: 'newPassword', type: 'string', required: true, description: 'รหัสผ่านใหม่ อย่างน้อย 6 ตัวอักษร', example: 'NewPassw0rd!' },
      ],
      example: { currentPassword: 'Passw0rd!', newPassword: 'NewPassw0rd!' },
    },
    responses: {
      200: { description: 'เปลี่ยนรหัสผ่านสำเร็จ', example: { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว' } },
      400: {
        description: 'ส่งข้อมูลไม่ครบ หรือรหัสผ่านใหม่สั้นกว่า 6 ตัวอักษร ("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร")',
        example: { success: false, message: 'กรุณาระบุรหัสผ่านเดิมและรหัสผ่านใหม่' },
      },
      401: {
        description: 'ไม่ได้ล็อกอิน (ข้อความ "กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)") หรือรหัสผ่านเดิมไม่ถูกต้อง (ข้อความตัวอย่าง)',
        example: { success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' },
      },
      404: { description: 'ไม่พบบัญชีผู้ใช้ของ token นี้ในระบบ', example: { success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' } },
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  'POST /auth/forgot-password': {
    description: [
      '**ทำอะไร:** แอดมินที่ลืมรหัสผ่านขอลิงก์ตั้งรหัสผ่านใหม่ ส่งไปที่อีเมลของบัญชี ใช้ได้เฉพาะจากหน้าเว็บแอดมินเท่านั้น',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจว่า `portal` เป็น `web` ถ้าไม่ใช่ตอบ 403 ทันที',
      '2. ตรวจว่ามี `employeeId` หรือ `email` (ใช้เป็นตัวระบุบัญชี)',
      '3. ค้นหาบัญชีแอดมินที่ code / email / username / id ตรงกัน',
      '4. สร้างลิงก์ตั้งรหัสผ่าน (อายุ 15 นาที ใช้ได้ครั้งเดียว) แล้วส่งอีเมล',
      '5. บันทึก Audit Log (`FORGOT_PASSWORD_REQUEST`) และตอบกลับพร้อมอีเมลที่ปิดบางส่วน เช่น `s***i@company.com`',
      '',
      '**กฎสำคัญ:**',
      '- **พนักงาน (แอป) รีเซ็ตรหัสผ่านเองไม่ได้** ต้องแจ้ง Admin ให้กด Reset password ที่เว็บเมนู All Employees (`POST /employees/:id/reset-password`)',
      '- ถ้าไม่ส่ง `portal: "web"` ตอบ 403 เสมอ (ไม่ว่ากรอกอะไร)',
      '- ค้นหาเฉพาะบัญชีแอดมิน ไม่รวมพนักงาน',
      '- จำกัด 10 ครั้งต่อ 15 นาที (429)',
      '',
      '**ข้อควรระวัง:** ถ้าไม่พบบัญชี โหมด production ตอบ 200 ข้อความกลางๆ (กันคนเดาว่าอีเมลไหนมีในระบบ) แต่โหมดพัฒนาตอบ 404 บอกชัดเจน ลิงก์ตั้งรหัสผ่าน (`resetUrl`) จะถูกส่งกลับใน response เฉพาะโหมดที่ไม่ใช่ production เท่านั้น',
    ].join('\n'),
    body: {
      description: 'ส่ง `employeeId` หรือ `email` อย่างใดอย่างหนึ่ง (ถ้าส่งทั้งสองจะใช้ `employeeId` ก่อน) และต้องส่ง `portal: "web"`',
      fields: [
        { name: 'employeeId', type: 'string', required: false, description: 'รหัส / username / id ของแอดมิน (ต้องมีอย่างน้อย employeeId หรือ email)', example: 'ADM-001' },
        { name: 'email', type: 'string', required: false, description: 'อีเมลของแอดมิน (ใช้เมื่อไม่ส่ง employeeId)', example: 'admin@example.com' },
        { name: 'portal', type: 'string', required: true, description: 'ต้องเป็น `web` เท่านั้น ถ้าไม่ใช่ตอบ 403', example: 'web', enum: ['web'] },
      ],
      example: { email: 'admin@example.com', portal: 'web' },
    },
    responses: {
      200: {
        description: 'ส่งลิงก์แล้ว (ในโหมดที่ไม่ใช่ production จะมี `resetUrl` ด้วย ใน production ไม่มี และกรณีไม่พบบัญชีจะตอบข้อความกลางๆ ว่า "หากข้อมูลตรงกับบัญชีในระบบ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลที่ลงทะเบียนไว้")',
        example: {
          success: true,
          message: 'ระบบได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมล a***n@example.com เรียบร้อยแล้ว',
          maskedEmail: 'a***n@example.com',
          resetUrl: 'http://localhost:5173/set-password?email=admin%40example.com&token=<setup-token>&portal=web&type=admin',
        },
      },
      400: { description: 'ไม่ได้ส่ง employeeId หรือ email', example: { success: false, message: 'กรุณากรอกรหัสพนักงานหรืออีเมล' } },
      403: {
        description: 'ไม่ได้ส่ง `portal: "web"` (เช่น เรียกจากแอปพนักงาน) พนักงานรีเซ็ตรหัสผ่านเองไม่ได้',
        example: { success: false, message: 'พนักงานไม่สามารถรีเซ็ตรหัสผ่านด้วยตัวเองได้ กรุณาแจ้งผู้ดูแลระบบ (Admin) ให้รีเซ็ตรหัสผ่านให้' },
      },
      404: {
        description: 'ไม่พบบัญชีแอดมินที่ตรงกัน (เฉพาะโหมดที่ไม่ใช่ production)',
        example: { success: false, message: 'ไม่พบบัญชีที่ตรงกับ "admin@example.com" ในระบบ กรุณาตรวจสอบรหัสพนักงานหรือติดต่อฝ่าย HR' },
      },
      429: R429_SENSITIVE,
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'เกิดข้อผิดพลาดในการประมวลผลคำขอรีเซ็ตรหัสผ่าน' } },
    },
  },

  'POST /auth/refresh': {
    description: [
      '**ทำอะไร:** ขอ access token ใหม่ด้วย refresh token เมื่อ access token เดิมหมดอายุ (แอปพนักงานใช้ access token แค่ 15 นาที)',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจว่ามี `refreshToken` และถอดรหัส/ตรวจลายเซ็นได้',
      '2. หาบัญชีของ token ในตาราง employees และ admins ว่ายังมีอยู่',
      '3. ตรวจสถานะบัญชี (Pending / Inactive / Resign ใช้ไม่ได้)',
      '4. ออก access token ใหม่: แอดมินอายุ 1 วัน (portal `web`), พนักงานอายุ 15 นาที (portal `app`)',
      '',
      '**กฎสำคัญ:**',
      '- ไม่ต้องส่ง Bearer token ใช้ `refreshToken` ใน body แทน',
      '- บัญชีที่ถูกระงับหรือลาออกแล้วต่ออายุไม่ได้ แม้ refresh token ยังไม่หมดอายุ',
      '',
      '**ข้อควรระวัง:** endpoint นี้ไม่ออก refresh token ใหม่ให้ (ใช้ตัวเดิมจนครบ 30 วัน)',
    ].join('\n'),
    body: {
      description: 'JSON body',
      fields: [
        { name: 'refreshToken', type: 'string', required: true, description: 'refresh token ที่ได้จากตอนล็อกอินแอป (`POST /auth/login` ช่องทาง app) หรือจาก `POST /auth/verify-pin`', example: FAKE_REFRESH },
      ],
      example: { refreshToken: FAKE_REFRESH },
    },
    responses: {
      200: { description: 'ออก access token ใหม่สำเร็จ', example: { success: true, message: 'Token renewed successfully', accessToken: FAKE_ACCESS, token: FAKE_ACCESS } },
      400: { description: 'ไม่ได้ส่ง refreshToken', example: { success: false, message: 'กรุณาระบุ Refresh Token' } },
      401: {
        description: 'refresh token ไม่ถูกต้อง/หมดอายุ (ข้อความตัวอย่าง) หรือไม่พบบัญชีผู้ใช้แล้ว ("ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่")',
        example: { success: false, message: 'Refresh Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
      },
      403: {
        description: 'บัญชีรอตั้งรหัสผ่าน / ถูกระงับ / พ้นสภาพ (ข้อความตัวอย่างคือ Inactive)',
        example: { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน (Inactive) กรุณาติดต่อผู้ดูแลระบบหรือฝ่ายทรัพยากรบุคคล (HR)' },
      },
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  'POST /auth/logout': {
    description: [
      '**ทำอะไร:** ออกจากระบบ และ **ล้าง PIN ของบัญชีนั้นทิ้ง** (ผู้ใช้ต้องตั้ง PIN ใหม่หลังล็อกอินด้วยรหัสผ่านครั้งถัดไป)',
      '',
      '**server ทำอย่างไร:**',
      '1. หาตัวตนจาก Bearer token ถ้าไม่มีก็ลองถอดจาก `refreshToken` ใน body',
      '2. ถ้ารู้ตัวตน: ตั้ง `pinHash` ของบัญชี (พนักงานหรือแอดมิน) เป็นค่าว่าง',
      '3. บันทึก Audit Log (`LOGOUT_RESET_PIN`)',
      '4. ตอบ 200 เสมอ',
      '',
      '**กฎสำคัญ:**',
      '- ไม่บังคับล็อกอิน ไม่มี token ก็เรียกได้ (จะไม่มีอะไรถูกล้าง)',
      '- ตอบ 200 เสมอ แม้เกิดข้อผิดพลาดภายใน (ฝั่ง client จะได้ออกจากระบบได้ทุกกรณี)',
      '',
      '**ข้อควรระวัง:** token ที่ออกไปแล้วไม่ถูกยกเลิกที่ server (เป็น JWT แบบ stateless) ฝั่ง client ต้องลบ token ทิ้งเอง การออกจากระบบจะรีเซ็ต PIN ด้วยเสมอ',
    ].join('\n'),
    body: {
      description: 'ไม่บังคับ ถ้าไม่มี Bearer token ให้ส่ง `refreshToken` เพื่อให้ server รู้ว่าจะล้าง PIN ของใคร',
      fields: [
        { name: 'refreshToken', type: 'string', required: false, description: 'refresh token ของผู้ใช้ (ใช้เมื่อไม่ได้ส่ง Bearer token)', example: FAKE_REFRESH },
      ],
      example: { refreshToken: FAKE_REFRESH },
    },
    responses: {
      200: {
        description: 'ออกจากระบบแล้ว (ถ้าเกิดข้อผิดพลาดภายในจะตอบ 200 เช่นกัน ด้วยข้อความ "ออกจากระบบเรียบร้อยแล้ว")',
        example: { success: true, message: 'ออกจากระบบและรีเซ็ตรหัส PIN เรียบร้อยแล้ว' },
      },
    },
  },

  // ---------------------------------------------------------------- Auth: PIN
  'POST /auth/set-pin': {
    description: [
      '**ทำอะไร:** ตั้งหรือเปลี่ยน PIN 6 หลักของตัวเอง ไว้ปลดล็อกแอปแทนการพิมพ์รหัสผ่านทุกครั้ง',
      '',
      '**server ทำอย่างไร:**',
      '1. อ่านตัวตนจาก token',
      '2. ตรวจว่า `pin` เป็นตัวเลข 6 หลักเท่านั้น',
      '3. หาบัญชีในตาราง employees ก่อน แล้วค่อย admins',
      '4. ถ้าบัญชีเคยมี PIN อยู่แล้ว ต้องยืนยันด้วย `currentPin` (PIN เดิม) หรือ `currentPassword` (รหัสผ่าน) อย่างใดอย่างหนึ่งให้ถูก',
      '5. เก็บ PIN เป็น bcrypt hash (ไม่เก็บตัวเลขจริง) และบันทึก Audit Log (`SET_PIN_SUCCESS`)',
      '',
      '**กฎสำคัญ:**',
      '- PIN ผู้ใช้ตั้งเอง **ไม่มีค่าเริ่มต้น** (ไม่คำนวณจากวันเกิด)',
      '- ตั้ง PIN ครั้งแรกไม่ต้องยืนยันอะไรเพิ่ม แต่เปลี่ยน PIN ที่มีอยู่ต้องยืนยัน',
      '',
      '**ข้อควรระวัง:** การออกจากระบบ (`POST /auth/logout`) จะล้าง PIN ทิ้ง ต้องตั้งใหม่ทุกครั้งหลังล็อกอินด้วยรหัสผ่าน',
    ].join('\n'),
    body: {
      description: 'JSON body',
      fields: [
        { name: 'pin', type: 'string', required: true, description: 'PIN ใหม่ ตัวเลข 0-9 จำนวน 6 หลักพอดี (ส่งเป็นสตริงหรือตัวเลขก็ได้ แต่แนะนำสตริงเพื่อไม่ให้เลข 0 นำหน้าหาย)', example: '482915' },
        { name: 'currentPin', type: 'string', required: false, description: 'PIN เดิม ต้องส่ง (หรือส่ง currentPassword) เมื่อบัญชีมี PIN อยู่แล้ว', example: '123456' },
        { name: 'currentPassword', type: 'string', required: false, description: 'รหัสผ่านปัจจุบัน ใช้ยืนยันแทน currentPin เมื่อเปลี่ยน PIN ที่มีอยู่', example: 'Passw0rd!' },
      ],
      example: { pin: '482915', currentPin: '123456' },
    },
    responses: {
      200: { description: 'ตั้ง PIN สำเร็จ', example: { success: true, message: 'ตั้งรหัส PIN 6 หลักสำเร็จเรียบร้อยแล้ว', hasPin: true } },
      400: {
        description: 'ไม่ได้ส่ง pin ("กรุณาระบุรหัส PIN 6 หลัก") / pin ไม่ใช่ตัวเลข 6 หลัก (ข้อความตัวอย่าง) / บัญชีมี PIN อยู่แล้วแต่ไม่ส่งหรือส่ง PIN เดิมหรือรหัสผ่านผิด ("รหัส PIN เดิมหรือรหัสผ่านไม่ถูกต้อง ไม่สามารถเปลี่ยน PIN ได้")',
        example: { success: false, message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลักเท่านั้น (0-9)' },
      },
      401: R401_AUTH,
      404: { description: 'ไม่พบบัญชีของ token นี้', example: { success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' } },
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'เกิดข้อผิดพลาดในการตั้งรหัส PIN' } },
    },
  },

  'POST /auth/verify-pin': {
    description: [
      '**ทำอะไร:** ปลดล็อกเข้าแอปด้วย PIN 6 หลัก ถ้าถูกต้อง server ออก token ชุดใหม่ให้ (เป็นการล็อกอินแบบเร็วสำหรับคนที่เคยล็อกอินและตั้ง PIN ไว้แล้ว)',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจว่า `pin` เป็นตัวเลข 6 หลัก',
      '2. ระบุบัญชี: ใช้ตัวตนจาก Bearer token ถ้ามี ถ้าไม่มีใช้ `username` ใน body (ตรงกับ id / code / username / email)',
      '3. ตรวจสถานะบัญชี (Pending / Inactive / Resign ใช้ไม่ได้) และตรวจว่าบัญชีไม่ถูกล็อก',
      '4. เทียบ PIN กับ hash ที่เก็บไว้ ถ้าผิดนับจำนวนครั้ง และบันทึก Audit Log (`VERIFY_PIN_FAILED`)',
      '5. ถ้าถูก: ล้างตัวนับความผิด ออก access token (15 นาที) + refresh token (30 วัน) และบันทึก Audit Log (`VERIFY_PIN_SUCCESS`)',
      '',
      '**กฎสำคัญ:**',
      '- ไม่มี PIN เริ่มต้น: บัญชีที่ยังไม่ได้ตั้ง PIN ตอบ 401 พร้อม `hasPin: false`',
      '- **ใส่ผิด 5 ครั้งต่อบัญชี ถูกล็อก 15 นาที** (ตอบ 429 แม้ใส่ถูกในช่วงล็อก) ตัวนับเก็บในหน่วยความจำของ server (รีสตาร์ท server แล้วเริ่มนับใหม่)',
      '- ยังมีตัวจำกัดตาม IP: 10 ครั้งต่อ 15 นาที (ก็ตอบ 429 เช่นกัน)',
      '',
      '**ข้อควรระวัง:** ถ้าส่ง Bearer token มาด้วย server ใช้ตัวตนจาก token และไม่สนใจ `username` ใน body เรียกได้โดยไม่ต้องมี token ถ้าส่ง `username` (ใช้ตอนเปิดแอปที่ access token หมดอายุ) ค่า `portal` ใน token ใหม่เป็น `web` เฉพาะ role `Admin` และ `Super Admin` นอกนั้น (รวมถึง `HR Admin`) เป็น `app`',
    ].join('\n'),
    body: {
      description: 'JSON body ต้องมี pin ส่วน username ใช้เมื่อไม่ได้ส่ง Bearer token',
      fields: [
        { name: 'pin', type: 'string', required: true, description: 'PIN ตัวเลข 6 หลัก', example: '482915' },
        { name: 'username', type: 'string', required: false, description: 'ชื่อผู้ใช้ / รหัสพนักงาน / อีเมล / id ใช้ระบุบัญชีเมื่อไม่ได้ส่ง Bearer token (ถ้ามี token จะถูกละเลย)', example: 'emp-001' },
      ],
      example: { pin: '482915', username: 'emp-001' },
    },
    responses: {
      200: {
        description: 'PIN ถูกต้อง ออก token ชุดใหม่',
        example: { success: true, message: 'ยืนยันรหัส PIN ถูกต้อง', token: FAKE_ACCESS, accessToken: FAKE_ACCESS, refreshToken: FAKE_REFRESH, user: EMPLOYEE_USER },
      },
      400: {
        description: 'ไม่ได้ส่ง pin ("กรุณากรอกรหัส PIN 6 หลัก") / pin ไม่ใช่ตัวเลข 6 หลัก (ข้อความตัวอย่าง) / ไม่มีทั้ง token และ username ("กรุณาระบุบัญชีผู้ใช้หรือส่ง Token เพื่อตรวจสอบ PIN")',
        example: { success: false, message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลัก' },
      },
      401: {
        description: 'PIN ไม่ถูกต้อง (ข้อความตัวอย่าง) หรือบัญชียังไม่ได้ตั้ง PIN (ข้อความ "บัญชีนี้ยังไม่ได้ตั้ง PIN เข้าสู่ระบบ กรุณาเข้าสู่ระบบด้วยรหัสผ่านแล้วตั้ง PIN 6 หลัก" พร้อม `hasPin: false`)',
        example: { success: false, message: 'รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' },
      },
      403: {
        description: 'บัญชีรอตั้งรหัสผ่าน / ถูกระงับ / พ้นสภาพ (ข้อความตัวอย่างคือ Resign)',
        example: { success: false, message: 'บัญชีนี้พ้นสภาพการเป็นพนักงานแล้ว (Resign) ไม่สามารถเข้าสู่ระบบได้' },
      },
      404: { description: 'ไม่พบบัญชีผู้ใช้', example: { success: false, message: 'ไม่พบบัญชีผู้ใช้งานในระบบ' } },
      429: {
        description: 'ใส่ PIN ผิดเกิน 5 ครั้ง บัญชีถูกล็อก 15 นาที (ข้อความตัวอย่าง) หรือเรียกถี่เกินกำหนดต่อ IP (ข้อความ "ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่")',
        example: { success: false, message: 'ใส่ PIN ผิดเกินกำหนด บัญชีถูกล็อกชั่วคราว 15 นาที กรุณาเข้าสู่ระบบด้วยรหัสผ่าน' },
      },
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัส PIN' } },
    },
  },

  'POST /auth/remove-pin': {
    description: [
      '**ทำอะไร:** ยกเลิกการใช้ PIN ของตัวเอง (ลบ PIN ออกจากบัญชี)',
      '',
      '**server ทำอย่างไร:**',
      '1. อ่านตัวตนจาก token แล้วหาบัญชีในตาราง employees ก่อน แล้วค่อย admins',
      '2. ถ้าส่ง `password` มา ตรวจว่าตรงกับรหัสผ่านของบัญชี',
      '3. ล้าง PIN hash ของบัญชีและบันทึก Audit Log (`REMOVE_PIN_SUCCESS`)',
      '',
      '**กฎสำคัญ:**',
      '- ต้องล็อกอิน และลบได้เฉพาะ PIN ของตัวเอง',
      '- ถ้าส่ง `password` มาแล้วผิด จะไม่ลบ (401)',
      '',
      '**ข้อควรระวัง:** ตามโค้ดปัจจุบัน field `password` ไม่บังคับ ถ้าไม่ส่งมา server จะลบ PIN ให้โดยไม่ตรวจรหัสผ่าน (แอปควรส่งรหัสผ่านมาเสมอเพื่อความปลอดภัย)',
    ].join('\n'),
    body: {
      description: 'JSON body (ไม่บังคับ แต่แนะนำให้ส่ง password)',
      fields: [
        { name: 'password', type: 'string', required: false, description: 'รหัสผ่านของบัญชี ถ้าส่งมาต้องถูกต้องจึงจะลบ PIN ได้', example: 'Passw0rd!' },
      ],
      example: { password: 'Passw0rd!' },
    },
    responses: {
      200: { description: 'ยกเลิก PIN สำเร็จ', example: { success: true, message: 'ยกเลิกการใช้งานรหัส PIN เรียบร้อยแล้ว', hasPin: false } },
      401: {
        description: 'ไม่ได้ล็อกอิน (ข้อความ "กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)") หรือรหัสผ่านที่ส่งมาไม่ถูกต้อง (ข้อความตัวอย่าง)',
        example: { success: false, message: 'รหัสผ่านไม่ถูกต้อง ไม่สามารถยกเลิก PIN ได้' },
      },
      404: { description: 'ไม่พบบัญชีของ token นี้', example: { success: false, message: 'ไม่พบบัญชีผู้ใช้' } },
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'เกิดข้อผิดพลาดในการยกเลิก PIN' } },
    },
  },

  'GET /auth/pin-status': {
    description: [
      '**ทำอะไร:** เช็กว่าบัญชีที่ล็อกอินอยู่ตั้ง PIN ไว้แล้วหรือยัง (แอปใช้ตัดสินว่าจะให้ผู้ใช้ตั้ง PIN หรือขอ PIN ตอนเปิดแอป)',
      '',
      '**server ทำอย่างไร:**',
      '1. อ่านตัวตนจาก token',
      '2. หาบัญชีในตาราง employees และ admins แล้วดูว่ามี PIN hash หรือไม่',
      '',
      '**กฎสำคัญ:**',
      '- ต้องล็อกอิน',
      '- ไม่เปิดเผย PIN hash ตอบเพียง true/false',
    ].join('\n'),
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, hasPin: true } },
      401: R401_AUTH,
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  // ---------------------------------------------------------------- Admins
  'GET /admins': {
    description: [
      '**ทำอะไร:** ดูรายชื่อบัญชีผู้ดูแลระบบ (web admin) ทั้งหมด ใช้ในเมนู Role & Permission ของเว็บ',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจว่าผู้เรียกเป็น `Super Admin`',
      '2. ดึงบัญชีแอดมินทั้งหมด (ใหม่สุดก่อน) และตัด password / PIN hash ออก เหลือ `hasPin`',
      '',
      '**กฎสำคัญ:**',
      '- เฉพาะ role `Super Admin` เท่านั้น แอดมินธรรมดา (`Admin`, `HR Admin`) และพนักงานทุก role (รวม SuperBoss) ได้ 403',
      '- ตาราง `admins` แยกจากพนักงาน (`employees`) ไม่นับพนักงานรวมมา',
    ].join('\n'),
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, total: 1, admins: [ADMIN_USER] } },
      401: R401_AUTH,
      403: R403_SUPER,
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  'POST /admins': {
    description: [
      '**ทำอะไร:** Super Admin สร้างบัญชีผู้ดูแลระบบใหม่ ระบบสร้างบัญชีสถานะรอตั้งรหัสผ่านแล้วส่งลิงก์ตั้งรหัสผ่านไปที่อีเมล',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจ `name` และ `email` (รูปแบบอีเมลถูกต้อง) และตรวจว่าอีเมล/username ยังไม่ซ้ำกับแอดมินคนอื่น',
      '2. กำหนด role (มีให้เลือกแค่ `Super Admin` หรือ `HR Admin` ค่าอื่นกลายเป็น `HR Admin`)',
      '3. สร้างรหัส `ADM-xxxx` อัตโนมัติ ตั้ง `username` = อีเมล (ตัวพิมพ์เล็ก) ตั้งรหัสผ่านชั่วคราวแบบสุ่ม และสถานะ `Pending Password`',
      '4. ส่งอีเมลลิงก์ตั้งรหัสผ่าน (อายุ 15 นาที) และบันทึก Audit Log (`CREATE_ADMIN`)',
      '',
      '**กฎสำคัญ:**',
      '- เฉพาะ `Super Admin`',
      '- อีเมลใช้เป็น Username เข้าเว็บ',
      '- บัญชีใหม่เข้าสู่ระบบไม่ได้ (403) จนกว่าจะตั้งรหัสผ่านผ่านลิงก์ (`POST /admins/set-password`)',
      '- แอดมินไม่สังกัดแผนก (`department` เป็น `-`)',
      '',
      '**ข้อควรระวัง:** `emailPreview` ใน response: โหมดที่ไม่ใช่ production จะมีลิงก์และ token ตั้งรหัสผ่านด้วย (ใช้ทดสอบโดยไม่ต้องเปิดอีเมล) แต่ production จะมีเพียง `to`, `subject`, `sentAt`, `realSmtpSent` อีเมลซ้ำตอบ 400 (ไม่ใช่ 409) ถ้ารหัสซ้ำในฐานข้อมูลอาจได้ 409',
    ].join('\n'),
    body: {
      description: 'JSON body ต้องมี name และ email',
      fields: [
        { name: 'name', type: 'string', required: true, description: 'ชื่อ-นามสกุลแอดมิน (ห้ามว่าง)', example: 'สมหญิง รักงาน' },
        { name: 'email', type: 'string', required: true, description: 'อีเมล รูปแบบ `ชื่อ@โดเมน.xx` ใช้เป็น Username เข้าสู่ระบบ ห้ามซ้ำ (ไม่สนตัวพิมพ์) ระบบแปลงเป็นตัวพิมพ์เล็ก', example: 'newadmin@example.com' },
        { name: 'phone', type: 'string', required: false, description: 'เบอร์โทร ถ้าไม่ส่งเก็บเป็น `-`', example: '081-234-5678' },
        { name: 'role', type: 'string', required: false, description: 'role ของแอดมิน เลือกได้ 2 ค่า ถ้าไม่ส่งหรือส่งค่าอื่นจะเป็น `HR Admin`', example: 'HR Admin', enum: ['Super Admin', 'HR Admin'] },
        { name: 'startDate', type: 'string', required: false, description: 'วันที่เริ่มงาน รูปแบบ YYYY-MM-DD ถ้าไม่ส่งใช้วันนี้', example: '2026-10-27' },
      ],
      example: { name: 'สมหญิง รักงาน', email: 'newadmin@example.com', phone: '081-234-5678', role: 'HR Admin', startDate: '2026-10-27' },
    },
    responses: {
      201: {
        description: 'สร้างบัญชีสำเร็จ (สถานะ `Pending Password`)',
        example: {
          success: true,
          message: 'สร้างบัญชีผู้ดูแลระบบ "สมหญิง รักงาน" สำเร็จแล้ว และได้ส่งลิงก์กำหนดรหัสผ่านไปยัง newadmin@example.com',
          admin: { ...ADMIN_USER, id: 'ADM-1234567', code: 'ADM-1234567', username: 'newadmin@example.com', name: 'สมหญิง รักงาน', email: 'newadmin@example.com', phone: '081-234-5678', role: 'HR Admin', status: 'Pending Password', startDate: '2026-10-27' },
          emailPreview: EMAIL_PREVIEW,
        },
      },
      400: {
        description: 'ไม่ได้กรอกชื่อ ("กรุณาระบุชื่อ-นามสกุล Admin") / ไม่ได้กรอกอีเมล ("กรุณาระบุอีเมลสำหรับ Admin (ใช้เป็น Username สำหรับเข้าสู่ระบบ)") / รูปแบบอีเมลไม่ถูกต้อง / อีเมลซ้ำ (ข้อความตัวอย่าง)',
        example: { success: false, message: 'อีเมล / Username "newadmin@example.com" มีอยู่ในระบบแล้ว ไม่สามารถสร้างซ้ำได้' },
      },
      401: R401_AUTH,
      403: R403_SUPER,
      409: { description: 'ข้อมูลซ้ำในฐานข้อมูล (รหัส / อีเมล / username ชนกันที่ระดับ database)', example: { success: false, message: 'ข้อมูลซ้ำในระบบ (อีเมล / รหัสพนักงาน / ชื่อผู้ใช้ ถูกใช้งานแล้ว)' } },
      500: { description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ', example: { success: false, message: 'ไม่สามารถบันทึกข้อมูลผู้ดูแลระบบลงฐานข้อมูลได้' } },
    },
  },

  'POST /admins/set-password': {
    description: [
      '**ทำอะไร:** แอดมินตั้งรหัสผ่านใหม่ด้วยลิงก์จากอีเมล ใช้ทั้งตอนเปิดบัญชีใหม่ (เชิญ) และตอนรีเซ็ตรหัสผ่าน หน้าเว็บ `/set-password` เรียก endpoint นี้',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจว่าส่ง `email`, `password`, `token` ครบ และ `password` ยาวอย่างน้อย 6 ตัวอักษร',
      '2. หาแอดมินจากอีเมล แล้วตรวจ `token` (ลายเซ็น + อายุ 15 นาที + ผูกกับ hash รหัสผ่านปัจจุบัน)',
      '3. เข้ารหัสรหัสผ่านใหม่ (bcrypt) แล้วบันทึก ถ้าบัญชีเป็น `Pending Password` เปลี่ยนเป็น `Active`',
      '4. บันทึก Audit Log (`ADMIN_SET_PASSWORD`)',
      '',
      '**กฎสำคัญ:**',
      '- เปิดสาธารณะ (ไม่ต้องล็อกอิน) แต่ต้องมี `token` ที่ถูกต้องจากอีเมล',
      '- token อายุ 15 นาที และ **ใช้ได้ครั้งเดียว** (เมื่อรหัสผ่านเปลี่ยนแล้ว token เดิมใช้ไม่ได้อีก)',
      '- จำกัด 10 ครั้งต่อ 15 นาที (429)',
      '',
      '**ข้อควรระวัง:** ถ้า token ผิดหรือหมดอายุให้ Super Admin ส่งลิงก์ใหม่ที่ `POST /admins/:id/resend-invite` ข้อความ 401 รวมทั้งกรณีไม่พบอีเมลและ token ไม่ถูกต้อง (ไม่บอกว่าผิดที่ใด เพื่อความปลอดภัย)',
    ].join('\n'),
    body: {
      description: 'JSON body ทั้ง 3 field ต้องส่งครบ (ค่าที่ได้จากลิงก์ในอีเมล: email และ token)',
      fields: [
        { name: 'email', type: 'string', required: true, description: 'อีเมลของแอดมิน (ตรงกับในลิงก์)', example: 'newadmin@example.com' },
        { name: 'password', type: 'string', required: true, description: 'รหัสผ่านใหม่ อย่างน้อย 6 ตัวอักษร', example: 'Admin1234' },
        { name: 'token', type: 'string', required: true, description: 'token ตั้งรหัสผ่านจากลิงก์ในอีเมล อายุ 15 นาที ใช้ได้ครั้งเดียว', example: '<setup-token>' },
      ],
      example: { email: 'newadmin@example.com', password: 'Admin1234', token: '<setup-token>' },
    },
    responses: {
      200: {
        description: 'ตั้งรหัสผ่านสำเร็จ เข้าเว็บแอดมินได้ทันที',
        example: { success: true, message: 'กำหนดรหัสผ่านผู้ดูแลระบบเรียบร้อยแล้ว สามารถเข้าสู่ระบบ Web Admin ได้ทันที', admin: { ...ADMIN_USER, username: 'newadmin@example.com', name: 'สมหญิง รักงาน', email: 'newadmin@example.com', role: 'HR Admin', status: 'Active' } },
      },
      400: {
        description: 'ไม่ได้ส่ง email หรือ password ("กรุณาระบุอีเมลและรหัสผ่านใหม่") หรือรหัสผ่านสั้นกว่า 6 ตัวอักษร (ข้อความตัวอย่าง)',
        example: { success: false, message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' },
      },
      401: {
        description: 'ไม่ได้ส่ง token ("ลิงก์ไม่ถูกต้อง กรุณาเปิดลิงก์จากอีเมลอีกครั้ง (Missing token)") หรือ token ไม่ถูกต้อง/หมดอายุ/ถูกใช้ไปแล้ว/ไม่พบอีเมล (ข้อความตัวอย่าง)',
        example: { success: false, message: 'ลิงก์กำหนดรหัสผ่านไม่ถูกต้อง หรือหมดอายุแล้ว (มีอายุการใช้งาน 15 นาที) กรุณาติดต่อ Super Admin เพื่อขอลิงก์ใหม่' },
      },
      429: R429_SENSITIVE,
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  'POST /admins/:id/resend-invite': {
    description: [
      '**ทำอะไร:** Super Admin ส่งอีเมลลิงก์ตั้งรหัสผ่านให้แอดมินคนนั้นอีกครั้ง ใช้เมื่อลิงก์เดิมหมดอายุ (15 นาที) หรือแอดมินลืมรหัสผ่านและต้องรีเซ็ต',
      '',
      '**server ทำอย่างไร:**',
      '1. หาบัญชีแอดมินจาก `:id` (ตรงกับ id, code หรือ username) ถ้าไม่พบตอบ 404',
      '2. ถ้าบัญชียังเป็น `Pending Password`: สร้างรหัสผ่านชั่วคราวใหม่แบบสุ่ม ทำให้ลิงก์เก่าใช้ไม่ได้ทันที',
      '3. ส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ (อายุ 15 นาที)',
      '4. บันทึก Audit Log (`RESEND_ADMIN_INVITE` ถ้ายังรอตั้งรหัสผ่าน, `ADMIN_PASSWORD_RESET_EMAIL` ถ้าเป็นการรีเซ็ตของบัญชีที่ใช้งานอยู่)',
      '',
      '**กฎสำคัญ:**',
      '- เฉพาะ `Super Admin`',
      '- ถ้าบัญชี Active อยู่แล้วจะเป็นการส่งลิงก์ "รีเซ็ตรหัสผ่าน" (รหัสผ่านเดิมยังใช้ได้จนกว่าจะตั้งใหม่)',
      '',
      '**ข้อควรระวัง:** `emailPreview` ใน production มีเฉพาะ `to`, `subject`, `sentAt`, `realSmtpSent` (ไม่มีลิงก์/token)',
    ].join('\n'),
    pathParams: {
      id: { description: 'รหัสบัญชีแอดมิน (admins.id) เช่น ADM-001 (ระบบรับ code หรือ username ด้วย)', example: 'ADM-001' },
    },
    responses: {
      200: {
        description: 'ส่งอีเมลสำเร็จ',
        example: { success: true, message: 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยัง newadmin@example.com เรียบร้อยแล้ว', emailPreview: EMAIL_PREVIEW },
      },
      401: R401_AUTH,
      403: R403_SUPER,
      404: R404_ADMIN,
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  'PUT /admins/:id': {
    description: [
      '**ทำอะไร:** Super Admin แก้ไขข้อมูลบัญชีผู้ดูแลระบบ เช่น ชื่อ อีเมล เบอร์ role สถานะ หรือตั้งรหัสผ่านใหม่ให้',
      '',
      '**server ทำอย่างไร:**',
      '1. ตัด field ที่ห้ามแก้ออก (`department`, `id`, `pinHash`, `hasPin`)',
      '2. ปรับ `role`: ถ้าส่งมา และไม่ใช่ `Super Admin` จะกลายเป็น `HR Admin`',
      '3. ตรวจ `status` (ดูกฎด้านล่าง)',
      '4. ถ้าส่ง `email` ระบบแปลงเป็นตัวพิมพ์เล็ก และตั้ง `username` ให้ตรงกับอีเมลเสมอ',
      '5. ถ้าส่ง `password` (ไม่ว่าง) ระบบเข้ารหัส (bcrypt) ก่อนบันทึก',
      '6. บันทึกการแก้ไข แล้วตอบข้อมูลแอดมินกลับ (ไม่มีรหัสผ่าน/PIN hash)',
      '',
      '**กฎสำคัญ:**',
      '- เฉพาะ `Super Admin`',
      '- มี role ให้เลือกแค่ 2 ค่า: `Super Admin`, `HR Admin` (ค่าอื่นกลายเป็น `HR Admin`)',
      '- `status` ที่ยอมรับ: `Active`, `Inactive`, `Pending Password` (ส่ง `Resign` / `Resigned` มาจะถูกแปลงเป็น `Inactive`) ค่าอื่น 400',
      '- ห้ามเปลี่ยนสถานะบัญชีของตัวเองเป็น `Inactive` และห้ามปิด Super Admin ที่ Active คนสุดท้ายของระบบ',
      '- ห้ามแก้ `id` และ PIN ผ่าน body (ถูกทิ้งเงียบๆ) แอดมินไม่สังกัดแผนก (`department` ถูกทิ้ง)',
      '',
      '**ข้อควรระวัง:** ส่งเฉพาะ field ที่ต้องการแก้ ค่าที่ไม่ส่งจะคงเดิม ยังไม่ได้ยืนยัน: endpoint นี้ไม่ตรวจรูปแบบอีเมลหรือความยาวรหัสผ่าน ไม่ป้องกันการลดระดับ role ของ Super Admin คนสุดท้าย และไม่บันทึก Audit Log',
    ].join('\n'),
    pathParams: {
      id: { description: 'รหัสบัญชีแอดมิน (admins.id) เช่น ADM-001', example: 'ADM-001' },
    },
    body: {
      description: 'JSON body ส่งเฉพาะ field ที่ต้องการแก้ (ทุก field ไม่บังคับ)',
      fields: [
        { name: 'name', type: 'string', required: false, description: 'ชื่อ-นามสกุล', example: 'สมหญิง รักงาน' },
        { name: 'email', type: 'string', required: false, description: 'อีเมลใหม่ (ระบบแปลงเป็นตัวพิมพ์เล็ก และตั้ง username เป็นอีเมลนี้ด้วย)', example: 'newadmin@example.com' },
        { name: 'phone', type: 'string', required: false, description: 'เบอร์โทร', example: '081-234-5678' },
        { name: 'role', type: 'string', required: false, description: 'role ใหม่ ค่าอื่นนอกจาก `Super Admin` กลายเป็น `HR Admin`', example: 'HR Admin', enum: ['Super Admin', 'HR Admin'] },
        { name: 'status', type: 'string', required: false, description: 'สถานะ `Resign` / `Resigned` จะถูกแปลงเป็น `Inactive` ค่าที่อนุญาตหลังแปลง: Active, Inactive, Pending Password', example: 'Inactive', enum: ['Active', 'Inactive', 'Pending Password'] },
        { name: 'password', type: 'string', required: false, description: 'รหัสผ่านใหม่ที่ Super Admin ตั้งให้ (ถ้าส่งค่าว่างจะไม่เปลี่ยน)', example: 'NewAdmin1234' },
        { name: 'startDate', type: 'string', required: false, description: 'วันที่เริ่มงาน YYYY-MM-DD', example: '2026-10-27' },
        { name: 'avatarUrl', type: 'string', required: false, description: 'URL รูปโปรไฟล์', example: 'https://example.com/avatar.png' },
      ],
      example: { name: 'สมหญิง รักงาน', role: 'HR Admin', status: 'Inactive' },
    },
    responses: {
      200: {
        description: 'แก้ไขสำเร็จ',
        example: { success: true, message: 'อัปเดตข้อมูลผู้ดูแลระบบเรียบร้อยแล้ว', admin: { ...ADMIN_USER, id: 'ADM-1234567', code: 'ADM-1234567', username: 'newadmin@example.com', name: 'สมหญิง รักงาน', email: 'newadmin@example.com', role: 'HR Admin', status: 'Inactive' } },
      },
      400: {
        description: 'สถานะไม่อยู่ในรายการที่อนุญาต (ข้อความตัวอย่าง) / ปิดบัญชีตัวเอง ("ไม่สามารถเปลี่ยนสถานะบัญชีของตัวเองเป็น Inactive ได้") / ปิด Super Admin คนสุดท้าย ("ไม่สามารถเปลี่ยน Super Admin คนสุดท้ายของระบบเป็น Inactive ได้")',
        example: { success: false, message: 'สถานะ Admin ต้องเป็น Active หรือ Inactive เท่านั้น' },
      },
      401: R401_AUTH,
      403: R403_SUPER,
      404: R404_ADMIN,
      409: { description: 'อีเมล / username ที่แก้ไปซ้ำกับบัญชีอื่น (ชนที่ระดับ database)', example: { success: false, message: 'ข้อมูลซ้ำในระบบ (อีเมล / รหัสพนักงาน / ชื่อผู้ใช้ ถูกใช้งานแล้ว)' } },
      500: { description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ', example: { success: false, message: 'ไม่สามารถบันทึกการแก้ไขผู้ดูแลระบบลงฐานข้อมูลได้' } },
    },
  },

  'DELETE /admins/:id': {
    description: [
      '**ทำอะไร:** Super Admin ลบบัญชีผู้ดูแลระบบออกจากระบบถาวร',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจว่าไม่ได้ลบบัญชีของตัวเองที่กำลังล็อกอินอยู่',
      '2. หาบัญชีตาม `:id` ถ้าไม่พบตอบ 404',
      '3. ตรวจว่าไม่ใช่ Super Admin คนสุดท้ายของระบบ',
      '4. ลบบัญชี และบันทึก Audit Log (`DELETE_ADMIN`)',
      '',
      '**กฎสำคัญ:**',
      '- เฉพาะ `Super Admin`',
      '- ลบบัญชีของตัวเองไม่ได้ และลบ Super Admin คนสุดท้ายไม่ได้ (ระบบต้องมี Super Admin อย่างน้อย 1 คน)',
      '',
      '**ข้อควรระวัง:** การลบไม่สามารถกู้คืนได้ ถ้าต้องการแค่ระงับการใช้งานให้ใช้ `PUT /admins/:id` ตั้ง `status` เป็น `Inactive`',
    ].join('\n'),
    pathParams: {
      id: { description: 'รหัสบัญชีแอดมิน (admins.id) เช่น ADM-001', example: 'ADM-1234567' },
    },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'ลบบัญชีผู้ดูแลระบบเรียบร้อยแล้ว' } },
      400: {
        description: 'ลบบัญชีของตัวเอง (ข้อความตัวอย่าง) หรือลบ Super Admin คนสุดท้าย ("ไม่สามารถลบ Super Admin คนสุดท้ายของระบบได้")',
        example: { success: false, message: 'คุณไม่สามารถลบบัญชีผู้ดูแลระบบของตนเองที่กำลังเข้าสู่ระบบอยู่ได้' },
      },
      401: R401_AUTH,
      403: R403_SUPER,
      404: R404_ADMIN,
      500: { description: 'ลบจากฐานข้อมูลไม่สำเร็จ', example: { success: false, message: 'ไม่สามารถลบผู้ดูแลระบบออกจากฐานข้อมูลได้' } },
    },
  },

  // ---------------------------------------------------------------- Settings
  'GET /settings/work-time': {
    description: [
      '**ทำอะไร:** อ่านกฎเวลาทำงานที่ HR ตั้งไว้ (เวลาเริ่มงาน เวลาสาย ชั่วโมงต่อวัน แต้มเข้างานตรงเวลา) แอปและเว็บใช้แสดงผลสาย/ชั่วโมงทำงานให้ตรงกัน',
      '',
      '**server ทำอย่างไร:**',
      '1. อ่านการตั้งค่าที่เก็บไว้ (`system_settings` คีย์ `app_settings`)',
      '2. แปลงเป็น 4 ค่า ถ้าค่าไหนยังไม่เคยตั้งหรือไม่ถูกต้อง ใช้ค่าเริ่มต้น `08:00`, `09:00`, 9 ชั่วโมง, 0 แต้ม',
      '',
      '**กฎสำคัญ:**',
      '- ผู้ใช้ที่ล็อกอินทุกคนอ่านได้ (พนักงานในแอปต้องใช้ค่านี้) แต่แก้ได้เฉพาะแอดมิน',
      '- `workStartTime`: เวลาเริ่มนับชั่วโมงทำงาน (คนมาก่อนก็นับจากเวลานี้)',
      '- `lateAfterTime`: เข้างานหลังเวลานี้ = สาย',
      '- `requiredHours`: ชั่วโมงทำงานต่อวัน ต่ำกว่านี้ = ทำงานไม่ครบเวลา',
      '- `onTimePoints`: แต้มที่ได้เมื่อเข้างานตรงเวลาและทำงานครบชั่วโมง (0 = ปิด)',
      '- ใช้เวลาประเทศไทย (Asia/Bangkok) รูปแบบ `HH:mm`',
    ].join('\n'),
    responses: {
      200: {
        description: 'สำเร็จ',
        example: { success: true, rules: { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 20 } },
      },
      401: R401_AUTH,
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  'PUT /settings/work-time': {
    description: [
      '**ทำอะไร:** แอดมินตั้งค่าเวลาทำงาน เวลาสาย ชั่วโมงต่อวัน และแต้มเข้างานตรงเวลา (เว็บ เมนู Settings → Work Time Settings)',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจทั้ง 4 ค่า (ดูกฎด้านล่าง) ถ้าผิดตอบ 400 และไม่แก้ค่าเดิม',
      '2. บันทึกลงการตั้งค่าระบบ (`app_settings` คีย์ `workTimeStart`, `lateThresholdTime`, `workHoursPerDay`, `onTimePoints`)',
      '3. บันทึก Audit Log (`UPDATE_WORK_TIME_SETTINGS`) และตอบค่าที่บันทึกแล้วกลับ',
      '',
      '**กฎสำคัญ:**',
      '- เฉพาะแอดมิน (`Admin`, `Super Admin`, `HR Admin`) พนักงานทุก role ได้ 403',
      '- ต้องส่งครบทั้ง 4 ค่า',
      '- เวลาเริ่มงาน (`workStartTime`) ต้องไม่ช้ากว่าเวลาสาย (`lateAfterTime`)',
      '- `requiredHours` ตั้งได้ 1 ถึง 16 ชั่วโมง ทีละ 0.5 (เช่น 8, 8.5, 9)',
      '- `onTimePoints` เป็นจำนวนเต็ม 0 ถึง 100,000 (0 = ปิดการแจกแต้ม)',
      '- แต้มจะแจกตอนกดออกงาน เมื่อเข้างานตรงเวลา (ไม่สาย) และทำงานครบชั่วโมงที่ตั้ง จ่ายครั้งเดียวต่อวัน',
      '',
      '**ข้อควรระวัง:** เวลาสายที่เปลี่ยนมีผลกับการเข้างานตั้งแต่ตอนนั้น แถวที่บันทึกว่าสาย/ปกติไปแล้วคงสถานะเดิม ส่วนกฎชั่วโมงใช้ตอนแสดงผล (มีผลย้อนหลังด้วย) ข้อความ error ของ endpoint นี้เป็นภาษาอังกฤษ',
    ].join('\n'),
    body: {
      description: 'JSON body ต้องส่งครบ 4 ค่า',
      fields: [
        { name: 'workStartTime', type: 'string', required: true, description: 'เวลาเริ่มงาน รูปแบบ `HH:mm` (24 ชั่วโมง เช่น 08:00 รับ `8:00` ด้วยและแปลงเป็น `08:00`) ต้องไม่ช้ากว่า lateAfterTime', example: '08:00' },
        { name: 'lateAfterTime', type: 'string', required: true, description: 'เวลาสาย รูปแบบ `HH:mm` เข้างานหลังเวลานี้ถือว่าสาย', example: '09:00' },
        { name: 'requiredHours', type: 'number', required: true, description: 'ชั่วโมงทำงานต่อวัน 1 ถึง 16 ทีละ 0.5', example: 9 },
        { name: 'onTimePoints', type: 'integer', required: true, description: 'แต้มเข้างานตรงเวลา จำนวนเต็ม 0 ถึง 100,000 (0 = ปิด)', example: 20 },
      ],
      example: { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 20 },
    },
    responses: {
      200: {
        description: 'บันทึกสำเร็จ ตอบค่าที่บันทึกแล้ว',
        example: { success: true, message: 'Work time settings saved', rules: { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 20 } },
      },
      400: {
        description: 'ค่าไม่ถูกต้อง ข้อความที่เป็นไปได้: "Work start time must be a valid time (HH:mm)", "Late time must be a valid time (HH:mm)", "Work start time cannot be later than the late time", "Required work hours must be between 1 and 16 (steps of 0.5)", "On-time points must be a whole number from 0 to 100,000" (ตัวอย่างคือกรณีเวลาเริ่มงานช้ากว่าเวลาสาย)',
        example: { success: false, message: 'Work start time cannot be later than the late time' },
      },
      401: R401_AUTH,
      403: R403_ADMIN,
      500: { description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ', example: { success: false, message: 'ไม่สามารถบันทึกการตั้งค่าระบบลงฐานข้อมูลได้' } },
    },
  },

  'GET /settings': {
    description: [
      '**ทำอะไร:** อ่านการตั้งค่าระบบทั้งหมดที่เก็บไว้ (ชื่อบริษัท เวลาทำงาน ฯลฯ) เป็นก้อน JSON เดียว',
      '',
      '**server ทำอย่างไร:**',
      '1. อ่านการตั้งค่าจากฐานข้อมูล (`system_settings` คีย์ `app_settings`) แล้วรวมกับค่าเริ่มต้นของระบบ',
      '2. ส่ง object การตั้งค่ากลับใน `settings`',
      '',
      '**กฎสำคัญ:**',
      '- ผู้ใช้ที่ล็อกอินทุกคนอ่านได้ ดังนั้น **อย่าเก็บข้อมูลลับในการตั้งค่านี้**',
      '- ค่าเริ่มต้นที่มีเสมอ: `companyName`, `workTimeStart`, `workTimeEnd`, `workHoursPerDay`, `lateThresholdTime`, `onTimePoints`, `lateGraceMinutes`, `enableBiometrics`, `enableGPSAttendance`, `allowRemoteCheckin`, `appVersion` และอาจมี key อื่นที่ถูกบันทึกเพิ่ม',
      '',
      '**ข้อควรระวัง:** กฎเวลาทำงานที่ใช้งานจริงใช้ 4 ค่า `workTimeStart`, `lateThresholdTime`, `workHoursPerDay`, `onTimePoints` (ควรอ่านผ่าน `GET /settings/work-time` ซึ่งตรวจค่าให้แล้ว) ส่วน `workTimeEnd`, `lateGraceMinutes` และสวิตช์อื่นเป็นค่าที่เก็บไว้ ยังไม่ได้ยืนยันว่ามีส่วนไหนของระบบใช้',
    ].join('\n'),
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          settings: {
            companyName: 'WellX989 Enterprise Co., Ltd.',
            workTimeStart: '08:00',
            workTimeEnd: '17:00',
            workHoursPerDay: 9,
            lateThresholdTime: '09:00',
            onTimePoints: 0,
            lateGraceMinutes: 60,
            enableBiometrics: true,
            enableGPSAttendance: true,
            allowRemoteCheckin: true,
            appVersion: '1.0.0 (Build 1)',
          },
        },
      },
      401: R401_AUTH,
      500: { description: 'เกิดข้อผิดพลาดภายใน server', example: { success: false, message: 'error message จากระบบ' } },
    },
  },

  'PUT /settings': {
    description: [
      '**ทำอะไร:** แอดมินบันทึกการตั้งค่าระบบทั่วไป (JSON ก้อนเดียว) โดยส่งเฉพาะ key ที่ต้องการเปลี่ยน ระบบจะรวมกับค่าเดิม',
      '',
      '**server ทำอย่างไร:**',
      '1. ตรวจว่า body เป็น object (ไม่ใช่ array หรือค่าว่าง)',
      '2. อ่านการตั้งค่าปัจจุบันจากฐานข้อมูล แล้วรวม key ที่ส่งมาทับ (shallow merge) key ที่ไม่ส่งยังคงเดิม',
      '3. บันทึกกลับลงฐานข้อมูล (`system_settings` คีย์ `app_settings`) และตอบการตั้งค่าที่รวมแล้ว',
      '',
      '**กฎสำคัญ:**',
      '- เฉพาะแอดมิน (`Admin`, `Super Admin`, `HR Admin`)',
      '- ไม่มีการตรวจชื่อ key หรือชนิดของค่าใดๆ (รับทุก key ที่เป็น JSON)',
      '',
      '**ข้อควรระวัง:** ถ้าต้องการเปลี่ยนกฎเวลาทำงาน (เวลาเริ่ม เวลาสาย ชั่วโมง แต้ม) ให้ใช้ `PUT /settings/work-time` ซึ่งตรวจความถูกต้องของค่า ส่วน endpoint นี้ไม่ตรวจ ถ้าเขียน key เหล่านั้นผ่านที่นี่อาจได้ค่าที่ผิดรูปแบบ (ระบบจะอ่านค่าผิดรูปแบบแล้วกลับไปใช้ค่าเริ่มต้นของกฎเวลา) ยังไม่ได้ยืนยัน: endpoint นี้ไม่บันทึก Audit Log',
    ].join('\n'),
    body: {
      description: 'JSON object ของ key/ค่าที่ต้องการบันทึก (ส่งเฉพาะที่เปลี่ยน) ไม่มี field ตายตัว ตัวอย่างใช้ key ที่ระบบมีอยู่แล้ว',
      fields: [
        { name: 'companyName', type: 'string', required: false, description: 'ชื่อบริษัท (ตัวอย่าง key ที่มีในค่าเริ่มต้น)', example: 'บริษัท ตัวอย่าง จำกัด' },
        { name: 'enableGPSAttendance', type: 'boolean', required: false, description: 'สวิตช์ที่มีในค่าเริ่มต้น (ตัวอย่าง) ไม่มี key อื่นที่ถูกตรวจสอบ ส่ง key อะไรก็ได้ที่เป็น JSON', example: true },
      ],
      example: { companyName: 'บริษัท ตัวอย่าง จำกัด' },
    },
    responses: {
      200: {
        description: 'บันทึกสำเร็จ ตอบการตั้งค่าทั้งก้อนหลังรวมแล้ว (ตัวอย่างตัดบาง key ออก)',
        example: {
          success: true,
          message: 'Settings updated successfully',
          settings: {
            companyName: 'บริษัท ตัวอย่าง จำกัด',
            workTimeStart: '08:00',
            workHoursPerDay: 9,
            lateThresholdTime: '09:00',
            onTimePoints: 0,
          },
        },
      },
      400: { description: 'body ไม่ใช่ object (เช่น ส่ง array)', example: { success: false, message: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' } },
      401: R401_AUTH,
      403: R403_ADMIN,
      500: { description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ', example: { success: false, message: 'ไม่สามารถบันทึกการตั้งค่าระบบลงฐานข้อมูลได้' } },
    },
  },
};
