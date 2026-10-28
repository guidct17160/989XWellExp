// รายละเอียด API สำหรับหน้า Swagger: พนักงาน, แผนก, สถานที่ลงเวลา, แจ้งเตือน, รายงาน HR, Audit log, วันหยุด
// ข้อมูลในตัวอย่างเป็นข้อมูลสมมติทั้งหมด

const UNAUTHORIZED = {
  description: 'ไม่ได้แนบ token หรือ token ไม่ถูกต้อง/หมดอายุ (ต้องส่ง header `Authorization: Bearer <token>`)',
  example: { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)' },
};

const FORBIDDEN_ADMIN = {
  description: 'ล็อกอินแล้วแต่ role ไม่ใช่แอดมิน (ต้องเป็น Admin / Super Admin / HR Admin / System Admin) เช่น พนักงาน Employee หรือ Boss',
  example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบ (Admin)เท่านั้น (Forbidden)' },
};

const FORBIDDEN_APPROVER = {
  description: 'ล็อกอินแล้วแต่ role ไม่ใช่ผู้อนุมัติ/แอดมิน (เช่น Employee) — role ที่เข้าได้คือ Admin, Super Admin, HR Admin, System Admin, HR, Manager, Boss, SuperBoss, Supervisor, Head, CEO, Director',
  example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบ/หัวหน้างานเท่านั้น (Forbidden)' },
};

const EMPLOYEE_EXAMPLE = {
  id: 'EMP-001',
  code: 'EMP-001',
  username: 'somchai.j@example.com',
  name: 'Somchai Jaidee',
  firstName: 'Somchai',
  lastName: 'Jaidee',
  email: 'somchai.j@example.com',
  phone: '081-234-5678',
  department: 'Sales',
  role: 'Employee',
  status: 'Active',
  startDate: '2026-01-05',
  resignDate: null,
  avatarUrl: 'https://example.com/avatar/somchai.jpg',
  gender: 'Male',
  points: 120,
  birthDate: '1995-04-12',
  dob: '1995-04-12',
  createdAt: '2026-01-05T02:00:00.000Z',
  hasPin: true,
};

const EMAIL_PREVIEW_EXAMPLE = {
  to: 'somchai.j@example.com',
  subject: 'ตั้งรหัสผ่านสำหรับบัญชี WellX989 ของคุณ',
  sentAt: '27/10/2569 09:30:15',
  realSmtpSent: true,
};

const LOCATION_EXAMPLE = {
  id: 'loc-mh3k9a1b2c3d',
  name: 'สำนักงานใหญ่ สีลม',
  type: 'Office',
  address: '123 ถนนสีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ',
  latitude: 13.7563,
  longitude: 100.5018,
  radiusM: 150,
  status: 'Active',
  scope: 'all',
  departmentIds: [],
  members: [],
  assignedCount: 120,
};

const LOCATION_BODY_FIELDS = [
  { name: 'name', type: 'string', required: true, description: 'ชื่อสถานที่ ห้ามว่าง ยาวไม่เกิน 100 ตัวอักษร (ตัดช่องว่างหัวท้ายให้)', example: 'สำนักงานใหญ่ สีลม' },
  { name: 'latitude', type: 'number', required: true, description: 'ละติจูด เป็นตัวเลขระหว่าง -90 ถึง 90 (ส่งสตริงว่าง/ไม่ส่ง = ผิด)', example: 13.7563 },
  { name: 'longitude', type: 'number', required: true, description: 'ลองจิจูด เป็นตัวเลขระหว่าง -180 ถึง 180', example: 100.5018 },
  { name: 'radiusM', type: 'integer', required: true, description: 'รัศมีที่ลงเวลาได้ หน่วยเมตร ต้องอยู่ระหว่าง 20 ถึง 5,000 (ถ้าเป็นทศนิยมระบบปัดเป็นจำนวนเต็ม)', example: 150 },
  { name: 'type', type: 'string', required: false, description: 'ประเภทสถานที่ ถ้าไม่ส่งหรือส่งค่าที่ไม่รู้จัก ระบบใช้ `Office` (ไม่ error)', example: 'Office', enum: ['Office', 'WFH', 'Site', 'Other'] },
  { name: 'address', type: 'string', required: false, description: 'ที่อยู่ (ข้อความอิสระ) ระบบตัดให้เหลือไม่เกิน 500 ตัวอักษร', example: '123 ถนนสีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ' },
  { name: 'status', type: 'string', required: false, description: 'สถานะ ค่าเริ่มต้น `Active` (ถ้าส่งค่าที่ไม่รู้จักก็ใช้ `Active`) สถานที่ `Inactive` ใช้ลงเวลาไม่ได้', example: 'Active', enum: ['Active', 'Inactive'] },
  { name: 'scope', type: 'string', required: false, description: 'ใครใช้สถานที่นี้ได้: `all` = ทุกคน, `departments` = ตามแผนก (ต้องส่ง departmentIds), `members` = รายบุคคล (ต้องส่ง memberIds) ค่าเริ่มต้น `all`', example: 'all', enum: ['all', 'departments', 'members'] },
  { name: 'departmentIds', type: 'array', items: { type: 'string' }, required: false, description: 'รหัส (id) ของแผนก ใช้เมื่อ scope = `departments` ต้องมีอย่างน้อย 1 รายการ (ค่าซ้ำถูกตัดออก) ถ้า scope อื่นระบบเมินฟิลด์นี้', example: ['DEP-01'] },
  { name: 'memberIds', type: 'array', items: { type: 'string' }, required: false, description: 'รหัส (id) ของพนักงาน ใช้เมื่อ scope = `members` ต้องมีอย่างน้อย 1 รายการ ถ้า scope อื่นระบบเมินฟิลด์นี้', example: ['EMP-001', 'EMP-002'] },
];

const LOCATION_400 = {
  description: 'ข้อมูลไม่ถูกต้อง ข้อความ (ภาษาอังกฤษ) จะเป็นหนึ่งใน: `Location name is required`, `Location name is too long (max 100 characters)`, `Latitude must be a number between -90 and 90`, `Longitude must be a number between -180 and 180`, `Radius must be between 20 and 5,000 metres`, `Select at least one department`, `Select at least one employee`, `Some selected departments or employees no longer exist` (departmentIds/memberIds ที่ไม่มีอยู่จริง)',
  example: { success: false, message: 'Radius must be between 20 and 5,000 metres' },
};

module.exports = {
  // ==================================================================
  // Employees
  // ==================================================================
  'GET /employees': {
    description:
      '**ทำอะไร:** ดึงรายชื่อพนักงานทั้งหมด พร้อมตัวกรองตามแผนก สถานะ หรือคำค้นหา เว็บแอดมินใช้แสดงหน้า All Employees\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจ token (ล็อกอินแล้วทุก role เรียกได้)\n2. อ่านพนักงานทั้งหมดจากฐานข้อมูล\n3. กรองตาม query ที่ส่งมา (ทุกตัวกรองใช้ร่วมกันแบบ "และ")\n4. ตัดฟิลด์ลับออกก่อนส่งกลับ แล้วบอกจำนวนรวมใน `total`\n\n' +
      '**กฎสำคัญ:**\n- `department`, `position`, `status` เทียบแบบ **ตรงตัวทั้งคำ** (พิมพ์เล็ก/ใหญ่ต่างกันถือว่าไม่ตรง); `search` เป็นการค้นแบบ "มีคำนี้อยู่" ไม่สนตัวพิมพ์ ค้นใน ชื่อ อีเมล รหัสพนักงาน และชื่อแผนก\n- ไม่ส่งรหัสผ่านและ PIN กลับเสมอ (ส่งเฉพาะ `hasPin` true/false)\n- ถ้าผู้เรียกไม่ใช่แอดมิน จะไม่เห็น `birthDate` / `dob` ของเพื่อนร่วมงาน (เห็นของตัวเองได้) เพราะวันเกิดเคยเป็นข้อมูลสำคัญในการตั้ง PIN\n\n' +
      '**ข้อควรระวัง:** ไม่มีการแบ่งหน้า (pagination) ส่งกลับทุกคนในครั้งเดียว ฟิลด์ `position` ถูกถอดออกจากข้อมูลพนักงานแล้ว การกรองด้วย `position` จึงมักได้รายการว่าง (ยังไม่ได้ยืนยัน)',
    query: [
      { name: 'department', type: 'string', required: false, description: 'ชื่อแผนก (ไม่ใช่ id) ที่ต้องตรงตัวทั้งคำ', example: 'Sales' },
      { name: 'position', type: 'string', required: false, description: 'ตำแหน่ง (เทียบตรงตัว) ปัจจุบันข้อมูลพนักงานไม่มีฟิลด์ตำแหน่งแล้ว', example: 'Sales Executive' },
      { name: 'status', type: 'string', required: false, description: 'สถานะพนักงาน เทียบตรงตัว เช่น Active, Pending Password, Resign', example: 'Active' },
      { name: 'search', type: 'string', required: false, description: 'คำค้นหา ค้นใน ชื่อ อีเมล รหัสพนักงาน ชื่อแผนก (ไม่สนตัวพิมพ์เล็ก/ใหญ่)', example: 'somchai' },
    ],
    responses: {
      200: { description: 'สำเร็จ ส่งรายการพนักงานที่ตรงเงื่อนไข (ถ้าไม่มีก็ได้ `total: 0` และ `employees: []`)', example: { success: true, total: 1, employees: [EMPLOYEE_EXAMPLE] } },
      401: UNAUTHORIZED,
    },
  },

  'GET /employees/:id': {
    description:
      '**ทำอะไร:** ดึงข้อมูลพนักงานหนึ่งคน\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจ token\n2. ค้นพนักงานที่ `id` ตรงกับ id, รหัสพนักงาน (code) หรือ username ก็ได้\n3. ตัดฟิลด์ลับออกแล้วส่งกลับใน `employee`\n\n' +
      '**กฎสำคัญ:**\n- ไม่ส่งรหัสผ่านและ PIN (ส่งเฉพาะ `hasPin`)\n- ถ้าผู้เรียกไม่ใช่แอดมินและไม่ได้ดูข้อมูลตัวเอง จะไม่เห็น `birthDate` / `dob`\n\n' +
      '**ข้อควรระวัง:** ผู้ใช้ที่ล็อกอินแล้วทุก role ดูข้อมูลพนักงานคนอื่นได้ (ยกเว้นวันเกิด) ข้อความ 404 เป็นภาษาอังกฤษ',
    pathParams: { id: { description: 'รหัสพนักงาน (id) หรือ code หรือ username ก็ได้ เช่น EMP-001', example: 'EMP-001' } },
    responses: {
      200: { description: 'พบพนักงาน', example: { success: true, employee: EMPLOYEE_EXAMPLE } },
      401: UNAUTHORIZED,
      404: { description: 'ไม่พบพนักงานตามรหัสที่ส่งมา', example: { success: false, message: 'Employee not found' } },
    },
  },

  'POST /employees': {
    description:
      '**ทำอะไร:** แอดมินสร้างพนักงานใหม่ และระบบส่งอีเมลลิงก์ตั้งรหัสผ่านให้พนักงาน (พนักงานตั้งรหัสผ่านเองจากลิงก์ ไม่ต้องรู้รหัสเริ่มต้น)\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. กันการกดซ้ำ: ถ้าอีเมลเดียวกันถูกส่งเข้ามาภายใน 5 วินาที ตอบ 429\n3. ตรวจว่ามีชื่อ (`name` หรือ `firstName`) และ `email`\n4. ตรวจอีเมลและรหัสพนักงาน (`code`) ซ้ำกับคนที่มีอยู่ (อีเมลเทียบแบบไม่สนตัวพิมพ์, code เทียบแบบไม่สนตัวพิมพ์)\n5. เข้ารหัส (hash) รหัสผ่านที่แอดมินส่งมา ถ้าไม่ส่งมาจะสุ่มรหัสที่ใครก็เดาไม่ได้ให้แทน\n6. บันทึกพนักงาน (สถานะเริ่มต้น `Pending Password`) แล้วส่งอีเมลตั้งรหัสผ่าน (ลิงก์มีอายุ 15 นาที)\n7. บันทึก Audit log (`CREATE_EMPLOYEE`)\n\n' +
      '**กฎสำคัญ:**\n- `username` สำหรับเข้าแอปจะเท่ากับอีเมล (ตัวพิมพ์เล็ก)\n- ถ้าไม่ส่ง `code` ระบบใช้รหัสอัตโนมัติ (เช่น `EMP-483012`) เป็นทั้ง id และ code\n- ถ้าไม่ส่ง `startDate` ใช้วันนี้ตามเวลาไทย (รูปแบบ `YYYY-MM-DD`) ถ้าไม่ส่ง `gender` ใช้ `Male` ถ้าไม่ส่ง `role` ใช้ `Employee`\n- พนักงานสถานะ `Pending Password` ยังเข้าสู่ระบบแอปไม่ได้ จนกว่าจะตั้งรหัสผ่านสำเร็จ (ดู `POST /employees/set-password`)\n- ชื่อแผนก (`department`) ควรตรงกับแผนกที่มีอยู่ เพื่อให้ระบบผูกกับแผนกจริง\n\n' +
      '**ข้อควรระวัง:** ตัวกันซ้ำ 5 วินาทีทำงานก่อนการตรวจข้อมูล ถ้ากดส่งแล้วได้ 400 แล้วแก้และส่งใหม่ทันทีด้วยอีเมลเดิม อาจได้ 429 ให้รอสักครู่; ใน production ผลลัพธ์ `emailPreview` จะไม่มีลิงก์/token (มีเฉพาะ `to`, `subject`, `sentAt`, `realSmtpSent`) แต่ในโหมดพัฒนา/ทดสอบจะมี `setupLink`, `setupToken`, `gmailComposeUrl`, `plainTextBody` เพิ่ม; `realSmtpSent` เป็น `false` ถ้าไม่ได้ตั้งค่า SMTP หรือส่งไม่สำเร็จ (พนักงานถูกสร้างแล้ว แอดมินใช้ปุ่ม Reset password ส่งใหม่ได้)',
    body: {
      description: 'ส่งเป็น JSON ฟิลด์ที่ระบบอ่านมีตามตารางนี้ ฟิลด์ที่ไม่รู้จักจะถูกเมิน',
      fields: [
        { name: 'email', type: 'string', required: true, description: 'อีเมลพนักงาน ใช้เป็น username เข้าแอปและเป็นปลายทางของลิงก์ตั้งรหัสผ่าน ห้ามซ้ำกับพนักงานอื่น', example: 'somchai.j@example.com' },
        { name: 'name', type: 'string', required: false, description: 'ชื่อ-นามสกุลเต็ม (ต้องส่ง `name` หรือ `firstName` อย่างน้อยหนึ่งอย่าง) ถ้าไม่ส่ง firstName/lastName ระบบแยกชื่อจากคำแรก/คำที่เหลือให้', example: 'Somchai Jaidee' },
        { name: 'firstName', type: 'string', required: false, description: 'ชื่อจริง', example: 'Somchai' },
        { name: 'lastName', type: 'string', required: false, description: 'นามสกุล', example: 'Jaidee' },
        { name: 'code', type: 'string', required: false, description: 'รหัสพนักงาน ห้ามซ้ำ (ไม่สนตัวพิมพ์) ถ้าไม่ส่งระบบสร้างให้', example: 'EMP-001' },
        { name: 'department', type: 'string', required: false, description: 'ชื่อแผนก (ต้องตรงกับชื่อแผนกที่มีอยู่จึงจะผูกกับแผนกจริง)', example: 'Sales' },
        { name: 'role', type: 'string', required: false, description: 'บทบาทในแอป ค่าเริ่มต้น `Employee` ตัวอย่างค่าที่ระบบใช้: Employee, Boss, SuperBoss (server ไม่ได้ตรวจรายการค่าที่อนุญาต)', example: 'Employee' },
        { name: 'phone', type: 'string', required: false, description: 'เบอร์โทร ถ้าไม่ส่งเก็บเป็น `-`', example: '081-234-5678' },
        { name: 'gender', type: 'string', required: false, description: 'เพศ ค่าเริ่มต้น `Male` (ใช้กับนโยบายลาที่จำกัดเพศ)', example: 'Male', enum: ['Male', 'Female'] },
        { name: 'startDate', type: 'string', required: false, description: 'วันเริ่มงาน รูปแบบ `YYYY-MM-DD` ถ้าไม่ส่งใช้วันนี้ (เวลาไทย)', example: '2026-01-05' },
        { name: 'birthDate', type: 'string', required: false, description: 'วันเกิด `YYYY-MM-DD` (ระบบรับ `birth_date` หรือ `dob` แทนได้)', example: '1995-04-12' },
        { name: 'status', type: 'string', required: false, description: 'สถานะเริ่มต้น ปกติไม่ต้องส่ง ระบบใช้ `Pending Password`', example: 'Pending Password' },
        { name: 'password', type: 'string', required: false, description: 'รหัสผ่านเริ่มต้นที่แอดมินกำหนดเอง (จะถูก hash) ปกติไม่ต้องส่ง ให้พนักงานตั้งเองผ่านลิงก์ในอีเมล', example: 'Temp1234' },
        { name: 'avatarUrl', type: 'string', required: false, description: 'ลิงก์รูปโปรไฟล์ ถ้าไม่ส่งระบบใส่รูปตัวอย่างตามเพศ', example: 'https://example.com/avatar/somchai.jpg' },
        { name: 'points', type: 'integer', required: false, description: 'แต้มเริ่มต้น ค่าเริ่มต้น 0', example: 0 },
        { name: 'id', type: 'string', required: false, description: 'รหัสภายใน (id) ปกติไม่ต้องส่ง ระบบสร้างให้ ถ้าส่งมาซ้ำกับของเดิมจะได้ 409', example: 'EMP-001' },
      ],
      example: {
        name: 'Somchai Jaidee',
        firstName: 'Somchai',
        lastName: 'Jaidee',
        email: 'somchai.j@example.com',
        code: 'EMP-001',
        department: 'Sales',
        role: 'Employee',
        phone: '081-234-5678',
        gender: 'Male',
        startDate: '2026-01-05',
        birthDate: '1995-04-12',
      },
    },
    responses: {
      201: {
        description: 'สร้างพนักงานสำเร็จและพยายามส่งอีเมลแล้ว (ดู `emailPreview.realSmtpSent` ว่าส่งจริงหรือไม่)',
        example: {
          success: true,
          message: 'สมัครพนักงาน Somchai Jaidee สำเร็จแล้ว และได้ส่งอีเมลตั้งรหัสผ่านไปยัง Gmail (somchai.j@example.com)',
          employee: { ...EMPLOYEE_EXAMPLE, status: 'Pending Password', hasPin: false, points: 0 },
          emailPreview: EMAIL_PREVIEW_EXAMPLE,
        },
      },
      400: {
        description: 'ข้อมูลไม่ครบหรือซ้ำ ข้อความที่เป็นไปได้: `กรุณากรอกชื่อและอีเมลพนักงาน` (ไม่มีชื่อหรืออีเมล), `อีเมล "<อีเมล>" นี้ถูกใช้งานในระบบแล้ว ไม่สามารถสร้างซ้ำได้`, `รหัสพนักงาน "<CODE>" นี้ถูกใช้งานในระบบแล้ว`',
        example: { success: false, message: 'กรุณากรอกชื่อและอีเมลพนักงาน' },
      },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      409: { description: 'ข้อมูลซ้ำที่ฐานข้อมูลตรวจเจอ เช่น `id` หรือ username ซ้ำกับของเดิม', example: { success: false, message: 'ข้อมูลซ้ำในระบบ (อีเมล / รหัสพนักงาน / ชื่อผู้ใช้ ถูกใช้งานแล้ว)' } },
      429: { description: 'ส่งอีเมลเดียวกันซ้ำภายใน 5 วินาที (กันกดซ้ำ)', example: { success: false, message: 'กำลังประมวลผลการส่งอีเมลสำหรับบัญชีนี้อยู่ กรุณารอสักครู่ก่อนลองอีกครั้ง' } },
    },
  },

  'POST /employees/set-password': {
    description:
      '**ทำอะไร:** พนักงานตั้ง (หรือตั้งใหม่) รหัสผ่านและ username จากลิงก์ที่ได้รับทางอีเมล เรียกจากหน้า "ตั้งรหัสผ่าน" ในแอป ไม่ต้องล็อกอิน\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าส่ง `email` และ `password` มา\n2. ถ้าส่ง `username` ที่ไม่ใช่อีเมลของตัวเอง ตรวจรูปแบบและว่าไม่ซ้ำกับพนักงานคนอื่น\n3. ตรวจความแข็งแรงของรหัสผ่าน\n4. ตรวจ `token` ที่มากับลิงก์: ต้องถูกต้อง ตรงกับอีเมล ยังไม่หมดอายุ (15 นาที) และยังไม่เคยถูกใช้\n5. เก็บรหัสผ่านแบบ hash เปลี่ยนสถานะพนักงานเป็น `Active` (และตั้ง username ถ้าส่งมา)\n\n' +
      '**กฎสำคัญ:**\n- รหัสผ่านยาว 6-30 ตัวอักษร ต้องมีทั้งตัวอักษรภาษาอังกฤษและตัวเลขอย่างน้อยอย่างละ 1 ตัว\n- username ต้องเป็นภาษาอังกฤษ ตัวเลข `_` หรือ `.` ยาว 4-30 ตัว (ถ้าเว้นว่างหรือเท่ากับอีเมลจะไม่ตรวจและไม่เปลี่ยน username)\n- ลิงก์ใช้ได้ครั้งเดียว: หลังตั้งรหัสผ่านสำเร็จ token เดิมใช้ไม่ได้อีก\n- ไม่ว่าอีเมลไม่มีในระบบ, token ผิด, หมดอายุ หรือถูกใช้แล้ว จะตอบข้อความเดียวกัน (401) เพื่อไม่ให้เดาได้ว่ามีอีเมลนี้หรือไม่\n\n' +
      '**ข้อควรระวัง:** จำกัดการเรียกสูงสุด 10 ครั้งต่อ 15 นาทีต่อ IP (ตอบ 429) กันการสุ่มเดา; สำหรับบัญชีแอดมินเว็บใช้ `POST /admins/set-password` แทน',
    body: {
      description: 'ส่งเป็น JSON ค่า `email` และ `token` ได้จากลิงก์ในอีเมล (`.../set-password?email=...&token=...`)',
      fields: [
        { name: 'email', type: 'string', required: true, description: 'อีเมลของพนักงาน (ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็กให้)', example: 'somchai.j@example.com' },
        { name: 'password', type: 'string', required: true, description: 'รหัสผ่านใหม่ 6-30 ตัวอักษร ต้องมีตัวอักษรอังกฤษและตัวเลขอย่างน้อยอย่างละ 1', example: 'Valid1234' },
        { name: 'token', type: 'string', required: true, description: 'token จากลิงก์ในอีเมล อายุ 15 นาที ใช้ได้ครั้งเดียว (ถ้าไม่ส่งตอบ 401)', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.signature' },
        { name: 'username', type: 'string', required: false, description: 'ชื่อผู้ใช้ที่อยากใช้ ภาษาอังกฤษ ตัวเลข _ หรือ . ยาว 4-30 ตัว และต้องไม่ซ้ำกับคนอื่น (เก็บเป็นตัวพิมพ์เล็ก) ถ้าไม่ส่ง จะใช้ username เดิม (คืออีเมล)', example: 'somchai.j' },
      ],
      example: { email: 'somchai.j@example.com', token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.signature', password: 'Valid1234', username: 'somchai.j' },
    },
    responses: {
      200: { description: 'ตั้งรหัสผ่านสำเร็จ พนักงานเข้าแอปด้วยรหัสผ่านใหม่ได้ทันที', example: { success: true, message: 'บันทึกชื่อผู้ใช้งาน (somchai.j) และรหัสผ่านใหม่สำเร็จแล้ว' } },
      400: {
        description: 'ข้อมูลไม่ถูกต้อง ข้อความที่เป็นไปได้: `กรุณาระบุอีเมลและรหัสผ่านใหม่`, `ชื่อผู้ใช้งาน (Username) ต้องเป็นภาษาอังกฤษ ตัวเลข, _ หรือ . ความยาว 4-30 ตัวอักษรเท่านั้น`, `ชื่อผู้ใช้งาน "<username>" ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้งานอื่น`, `รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร`, `รหัสผ่านต้องประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลขอย่างน้อยประเภทละ 1 ตัว`',
        example: { success: false, message: 'รหัสผ่านต้องประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลขอย่างน้อยประเภทละ 1 ตัว' },
      },
      401: {
        description: 'ไม่ส่ง token (`ลิงก์ไม่ถูกต้อง กรุณาเปิดลิงก์จากอีเมลอีกครั้ง (Missing token)`) หรือ token ไม่ถูกต้อง/หมดอายุ/ถูกใช้แล้ว/อีเมลไม่มีในระบบ (ข้อความตามตัวอย่าง)',
        example: { success: false, message: 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง หมดอายุแล้ว (มีอายุการใช้งาน 15 นาที) หรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่' },
      },
      429: { description: 'เรียกบ่อยเกินไป (เกิน 10 ครั้งใน 15 นาที)', example: { success: false, message: 'ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' } },
    },
  },

  'POST /employees/:id/reset-password': {
    description:
      '**ทำอะไร:** แอดมินกด Reset password ให้พนักงาน ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของพนักงาน (พนักงานรีเซ็ตรหัสผ่านเองในแอปไม่ได้ ต้องแจ้งแอดมิน)\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ค้นพนักงานจาก id (หรือ code/username)\n3. ปฏิเสธถ้าพนักงานลาออกแล้ว หรือไม่มีอีเมล\n4. สร้างลิงก์ตั้งรหัสผ่าน (อายุ 15 นาที ใช้ได้ครั้งเดียว) และส่งอีเมล\n5. บันทึก Audit log (`RESET_EMPLOYEE_PASSWORD`)\n\n' +
      '**กฎสำคัญ:**\n- รหัสผ่านเดิมยังใช้ได้ต่อไปจนกว่าพนักงานจะตั้งรหัสใหม่สำเร็จ\n- พนักงานสถานะ `Resign` / `Resigned` รีเซ็ตไม่ได้\n- ตอบกลับด้วยอีเมลที่ปิดบังบางส่วน (เช่น `s***i@example.com`) ไม่ส่งอีเมลเต็มกลับ\n\n' +
      '**ข้อควรระวัง:** ใน production `emailPreview` ไม่มีลิงก์/token (เห็นเฉพาะ `to`, `subject`, `sentAt`, `realSmtpSent`); ไม่มี body',
    pathParams: { id: { description: 'รหัสพนักงาน (id) เช่น EMP-001', example: 'EMP-001' } },
    responses: {
      200: {
        description: 'ส่งลิงก์ตั้งรหัสผ่านแล้ว (ถ้า `realSmtpSent` เป็น false แปลว่าระบบอีเมลไม่ได้ส่งจริง)',
        example: {
          success: true,
          message: 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล s***j@example.com ของ Somchai Jaidee แล้ว',
          maskedEmail: 's***j@example.com',
          emailPreview: EMAIL_PREVIEW_EXAMPLE,
        },
      },
      400: {
        description: 'รีเซ็ตไม่ได้: พนักงานลาออกแล้ว (`ไม่สามารถรีเซ็ตรหัสผ่านของพนักงานที่ลาออกแล้ว`) หรือพนักงานไม่มีอีเมล (`พนักงานคนนี้ไม่มีอีเมล จึงส่งลิงก์ตั้งรหัสผ่านไม่ได้`)',
        example: { success: false, message: 'ไม่สามารถรีเซ็ตรหัสผ่านของพนักงานที่ลาออกแล้ว' },
      },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      404: { description: 'ไม่พบพนักงานตาม id', example: { success: false, message: 'ไม่พบพนักงานที่ต้องการรีเซ็ตรหัสผ่าน' } },
    },
  },

  'PUT /employees/:id': {
    description:
      '**ทำอะไร:** แอดมินแก้ไขข้อมูลพนักงาน หรือบันทึกการลาออก (ส่ง `status` เป็น `Resign`)\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ค้นพนักงาน (ไม่พบ = 404) และปฏิเสธถ้าพนักงานลาออกไปแล้ว\n3. ตัดฟิลด์ที่ห้ามแก้ผ่าน API นี้ออก (`id`, `pinHash`, `hasPin`, `createdAt`)\n4. ถ้าส่ง `password` มาและไม่ว่าง จะ hash แล้วเปลี่ยน ถ้าว่างหรือไม่ส่ง = "ไม่เปลี่ยน" (ไม่ล้างรหัสเดิม)\n5. รวมค่าที่ส่งมากับข้อมูลเดิม (**ส่งเฉพาะฟิลด์ที่ต้องการแก้ได้**) แล้วบันทึก\n6. บันทึก Audit log (`UPDATE_EMPLOYEE` หรือ `EMPLOYEE_RESIGNED` ถ้าเป็นการลาออก)\n\n' +
      '**กฎสำคัญ:**\n- พนักงานที่ `status` เป็น `Resign` / `Resigned` แล้วแก้ไขไม่ได้อีก (400)\n- ส่ง `status: "Resign"` โดยไม่ระบุ `resignDate` ระบบใช้วันนี้ (เวลาไทย) เป็นวันลาออก ไม่ใช่วันเริ่มงาน\n- ถ้าส่ง `firstName`/`lastName` ระบบรวมเป็น `name` ให้ ถ้าส่งแค่ `name` ระบบแยกเป็นชื่อ/นามสกุลให้\n- เปลี่ยน `department` ด้วยชื่อแผนกที่มีอยู่ ระบบผูก `department_id` ให้ตามชื่อ (ชื่อที่ไม่มีอยู่จะไม่ผูกกับแผนกใด)\n- server ไม่ได้ตรวจรายการค่าของ `role` และ `status` ให้แอดมินส่งค่าที่ระบบใช้จริง (role: Employee/Boss/SuperBoss, status: Active/Pending Password/Resign/Inactive)\n\n' +
      '**ข้อควรระวัง:** อีเมล/username ที่ซ้ำกับคนอื่นจะได้ 409 จากฐานข้อมูล; พนักงานที่เป็น Employee เรียก API นี้ไม่ได้ (403)',
    pathParams: { id: { description: 'รหัสพนักงาน (id) เช่น EMP-001', example: 'EMP-001' } },
    body: {
      description: 'ส่งเฉพาะฟิลด์ที่ต้องการแก้ ฟิลด์ที่ไม่ได้ส่งคงค่าเดิม',
      fields: [
        { name: 'firstName', type: 'string', required: false, description: 'ชื่อจริง', example: 'Somchai' },
        { name: 'lastName', type: 'string', required: false, description: 'นามสกุล', example: 'Jaidee' },
        { name: 'name', type: 'string', required: false, description: 'ชื่อเต็ม (ใช้เมื่อไม่ส่ง firstName/lastName)', example: 'Somchai Jaidee' },
        { name: 'email', type: 'string', required: false, description: 'อีเมล ห้ามซ้ำกับพนักงานอื่น', example: 'somchai.j@example.com' },
        { name: 'username', type: 'string', required: false, description: 'ชื่อผู้ใช้สำหรับเข้าแอป ห้ามซ้ำ', example: 'somchai.j' },
        { name: 'phone', type: 'string', required: false, description: 'เบอร์โทร', example: '081-000-0000' },
        { name: 'department', type: 'string', required: false, description: 'ชื่อแผนก (ต้องตรงกับแผนกที่มีอยู่)', example: 'Sales' },
        { name: 'role', type: 'string', required: false, description: 'บทบาท เช่น Employee, Boss, SuperBoss (ไม่ตรวจรายการค่า)', example: 'Boss' },
        { name: 'status', type: 'string', required: false, description: 'สถานะ เช่น Active, Pending Password, Inactive, Resign (ส่ง Resign = บันทึกลาออก)', example: 'Active' },
        { name: 'gender', type: 'string', required: false, description: 'เพศ', example: 'Male', enum: ['Male', 'Female'] },
        { name: 'startDate', type: 'string', required: false, description: 'วันเริ่มงาน `YYYY-MM-DD`', example: '2026-01-05' },
        { name: 'birthDate', type: 'string', required: false, description: 'วันเกิด `YYYY-MM-DD` (รับ `birth_date` / `dob` แทนได้)', example: '1995-04-12' },
        { name: 'resignDate', type: 'string', required: false, description: 'วันลาออก `YYYY-MM-DD` ใช้คู่กับ status = Resign (ถ้าไม่ส่งใช้วันนี้)', example: '2026-10-31' },
        { name: 'points', type: 'integer', required: false, description: 'แต้มสะสม (ตั้งค่าตรงๆ ไม่ผ่านประวัติแต้ม)', example: 120 },
        { name: 'avatarUrl', type: 'string', required: false, description: 'ลิงก์รูปโปรไฟล์', example: 'https://example.com/avatar/somchai.jpg' },
        { name: 'password', type: 'string', required: false, description: 'รหัสผ่านใหม่ (จะถูก hash) เว้นว่าง/ไม่ส่ง = ไม่เปลี่ยนรหัสผ่าน', example: '' },
      ],
      example: { phone: '081-000-0000', department: 'Sales', role: 'Boss' },
    },
    responses: {
      200: { description: 'แก้ไขสำเร็จ ส่งข้อมูลพนักงานล่าสุดกลับ (ไม่รวมรหัสผ่านและ PIN)', example: { success: true, message: 'Employee updated successfully', employee: { ...EMPLOYEE_EXAMPLE, phone: '081-000-0000', role: 'Boss' } } },
      400: { description: 'พนักงานคนนี้ลาออกแล้ว แก้ไขไม่ได้', example: { success: false, message: 'ไม่สามารถแก้ไขข้อมูลพนักงานที่ลาออกแล้ว (Resign) ได้ เนื่องจากบัญชีนี้พ้นสภาพการทำงานแล้ว' } },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      404: { description: 'ไม่พบพนักงานตาม id', example: { success: false, message: 'Employee not found' } },
      409: { description: 'อีเมล/รหัสพนักงาน/username ที่แก้ซ้ำกับของคนอื่น (ฐานข้อมูลตรวจเจอ)', example: { success: false, message: 'ข้อมูลซ้ำในระบบ (อีเมล / รหัสพนักงาน / ชื่อผู้ใช้ ถูกใช้งานแล้ว)' } },
    },
  },

  'DELETE /employees/:id': {
    description:
      '**ทำอะไร:** แอดมินลบพนักงานออกจากระบบถาวร\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ค้นพนักงานจาก id, code, อีเมล หรือ username\n3. ใน transaction เดียว (สำเร็จทั้งหมดหรือยกเลิกทั้งหมด) ลบข้อมูลที่ผูกกับพนักงานคนนี้ ได้แก่ การลงเวลา ใบลา คำขอแก้เวลา การแจ้งเตือน ประวัติแต้ม และประวัติแลกรางวัล แล้วจึงลบตัวพนักงาน\n4. บันทึก Audit log (`DELETE_EMPLOYEE`)\n\n' +
      '**ข้อควรระวัง:** **ลบแล้วกู้คืนไม่ได้ และประวัติของพนักงานคนนั้นหายด้วย** ถ้าแค่พ้นสภาพพนักงานควรใช้ `PUT /employees/:id` ส่ง `status: "Resign"` แทนเพื่อเก็บประวัติไว้; ถ้าลบไม่สำเร็จเพราะข้อผิดพลาดของฐานข้อมูลจะตอบ 500 ว่า `ไม่สามารถลบข้อมูลพนักงานออกจากฐานข้อมูลได้`',
    pathParams: { id: { description: 'รหัสพนักงาน (id) เช่น EMP-001', example: 'EMP-001' } },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'ลบข้อมูลพนักงานออกจากระบบเรียบร้อยแล้ว' } },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      404: { description: 'ไม่พบพนักงาน (หรือถูกลบไปแล้ว)', example: { success: false, message: 'ไม่พบพนักงานที่ต้องการลบ' } },
      500: { description: 'ฐานข้อมูลลบไม่สำเร็จ (ระบบยกเลิกทั้ง transaction ไม่ลบบางส่วน)', example: { success: false, message: 'ไม่สามารถลบข้อมูลพนักงานออกจากฐานข้อมูลได้' } },
    },
  },

  // ==================================================================
  // Departments
  // ==================================================================
  'GET /departments': {
    description:
      '**ทำอะไร:** ดึงรายการแผนกทั้งหมด พร้อมจำนวนพนักงานและชื่อหัวหน้าแผนก\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจ token (ทุก role เรียกได้)\n2. อ่านแผนกทั้งหมด\n3. นับพนักงานของแต่ละแผนกจากชื่อแผนก (ไม่สนตัวพิมพ์เล็ก/ใหญ่)\n4. หาหัวหน้าแผนก: คนแรกในแผนกที่ role เป็น Boss / Manager / HR Admin / Super Admin / SuperBoss ถ้าไม่มี ใช้ชื่อที่เก็บไว้ใน `manager`\n\n' +
      '**กฎสำคัญ:**\n- `employeeCount` และ `memberCount` ค่าเท่ากัน (นับเฉพาะพนักงาน ไม่รวมบัญชีแอดมิน)\n- `manager` ที่คำนวณได้จะขึ้นต้นด้วย `คุณ ` ตามด้วยชื่อ\n- แผนกที่ `employeeCount` > 0 ลบไม่ได้\n\n' +
      '**ข้อควรระวัง:** `id` ของแผนกใช้อ้างอิงในสถานที่ลงเวลา (`departmentIds`) ส่วนพนักงานผูกกับแผนกด้วยชื่อแผนก',
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          departments: [
            { id: 'DEP-01', code: 'SALES', name: 'Sales', manager: 'คุณ Somsri Rakdee', employeeCount: 12, memberCount: 12, status: 'Active' },
          ],
        },
      },
      401: UNAUTHORIZED,
    },
  },

  'POST /departments': {
    description:
      '**ทำอะไร:** แอดมินสร้างแผนกใหม่\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ตรวจว่ามี `name` ไม่ว่าง\n3. ตรวจชื่อซ้ำกับแผนกเดิม (ไม่สนตัวพิมพ์เล็ก/ใหญ่และช่องว่างหัวท้าย)\n4. สร้างแผนก (เมินฟิลด์ `id` ที่ส่งมา เพื่อกันไม่ให้ไปทับแผนกอื่น) แล้วคืนแผนกที่สร้าง\n\n' +
      '**กฎสำคัญ:**\n- ชื่อแผนกห้ามซ้ำ (ไม่สนตัวพิมพ์) และ `code` ห้ามซ้ำ\n- ถ้าไม่ส่ง `code` ระบบสร้างให้ (เช่น `DEP-123456`) id สร้างโดยระบบเสมอ\n- `manager` ถ้าไม่ส่งเก็บเป็น `ไม่ระบุ` (ตอนแสดงผลระบบเลือกหัวหน้าจาก role ในแผนกให้เอง)\n- `status` ค่าเริ่มต้น `Active`\n\n' +
      '**ข้อควรระวัง:** ข้อความ 400 เป็นภาษาอังกฤษ',
    body: {
      fields: [
        { name: 'name', type: 'string', required: true, description: 'ชื่อแผนก ห้ามว่าง ห้ามซ้ำกับแผนกอื่น (ไม่สนตัวพิมพ์)', example: 'Finance' },
        { name: 'code', type: 'string', required: false, description: 'รหัสแผนก ห้ามซ้ำ ถ้าไม่ส่งระบบสร้างให้', example: 'FIN' },
        { name: 'manager', type: 'string', required: false, description: 'ชื่อหัวหน้าแผนก (ข้อความ) ใช้เมื่อยังไม่มีพนักงานที่มี role หัวหน้าในแผนก', example: 'Somsri Rakdee' },
        { name: 'status', type: 'string', required: false, description: 'สถานะ ค่าเริ่มต้น `Active`', example: 'Active', enum: ['Active', 'Inactive'] },
      ],
      example: { name: 'Finance', code: 'FIN', manager: 'Somsri Rakdee', status: 'Active' },
    },
    responses: {
      201: { description: 'สร้างแผนกสำเร็จ', example: { success: true, department: { id: 'DEP-48301267', code: 'FIN', name: 'Finance', manager: 'Somsri Rakdee', employeeCount: 0, status: 'Active' } } },
      400: { description: 'ไม่ได้ส่งชื่อแผนก หรือชื่อเป็นช่องว่างล้วน', example: { success: false, message: 'Department name is required' } },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      409: { description: 'ชื่อแผนกซ้ำ (ข้อความตามตัวอย่าง) หรือ `code` ซ้ำ (`ข้อมูลซ้ำในระบบ (อีเมล / รหัสพนักงาน / ชื่อผู้ใช้ ถูกใช้งานแล้ว)`)', example: { success: false, message: 'มีแผนก "Finance" อยู่ในระบบแล้ว' } },
    },
  },

  'PUT /departments/:id': {
    description:
      '**ทำอะไร:** แอดมินแก้ไขแผนก เช่น เปลี่ยนชื่อ รหัส หัวหน้า หรือสถานะ\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ค้นแผนกจาก `id` (ไม่พบ = 404)\n3. ถ้าเปลี่ยนชื่อ ตรวจว่าไม่ซ้ำกับแผนกอื่น\n4. นำค่าที่ส่งมารวมกับค่าเดิม (**ส่งเฉพาะฟิลด์ที่ต้องการแก้ได้** ฟิลด์อื่นไม่ถูกรีเซ็ต) แล้วบันทึก\n5. ถ้าเปลี่ยนชื่อ ระบบเปลี่ยนชื่อแผนกของพนักงานและแอดมินในแผนกนั้นตามให้ทั้งหมด\n\n' +
      '**ข้อควรระวัง:** ใน path ต้องใช้ `id` ของแผนก (ไม่ใช่ code); ถ้าส่ง `code` ซ้ำกับแผนกอื่นจะได้ 409 จากฐานข้อมูล',
    pathParams: { id: { description: 'id ของแผนก เช่น DEP-01 (ดูได้จาก GET /departments)', example: 'DEP-01' } },
    body: {
      description: 'ส่งเฉพาะฟิลด์ที่ต้องการแก้',
      fields: [
        { name: 'name', type: 'string', required: false, description: 'ชื่อแผนกใหม่ ห้ามซ้ำกับแผนกอื่น (ไม่สนตัวพิมพ์) การเปลี่ยนชื่อจะเปลี่ยนชื่อแผนกในข้อมูลพนักงานตาม', example: 'Sales & Marketing' },
        { name: 'code', type: 'string', required: false, description: 'รหัสแผนก ห้ามซ้ำ', example: 'SALES' },
        { name: 'manager', type: 'string', required: false, description: 'ชื่อหัวหน้าแผนก (ข้อความ)', example: 'Somsri Rakdee' },
        { name: 'status', type: 'string', required: false, description: 'สถานะแผนก', example: 'Active', enum: ['Active', 'Inactive'] },
      ],
      example: { manager: 'Somsri Rakdee' },
    },
    responses: {
      200: { description: 'แก้ไขสำเร็จ', example: { success: true, message: 'อัปเดตแผนกเรียบร้อยแล้ว', department: { id: 'DEP-01', code: 'SALES', name: 'Sales', manager: 'Somsri Rakdee', employeeCount: 0, status: 'Active' } } },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      404: { description: 'ไม่พบแผนกตาม id', example: { success: false, message: 'ไม่พบแผนกที่ต้องการแก้ไข' } },
      409: { description: 'ชื่อใหม่ซ้ำกับแผนกอื่น', example: { success: false, message: 'มีแผนก "Finance" อยู่ในระบบแล้ว' } },
    },
  },

  'DELETE /departments/:id': {
    description:
      '**ทำอะไร:** แอดมินลบแผนก\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ค้นแผนกจาก id หรือ code\n3. ตรวจว่าไม่มีพนักงานอยู่ในแผนก (ถ้ามี = 409)\n4. ลบแผนก\n\n' +
      '**กฎสำคัญ:**\n- ลบแผนกที่ยังมีพนักงานไม่ได้ ต้องย้ายพนักงานออกก่อน\n\n' +
      '**ข้อควรระวัง:** ลบแล้วกู้คืนไม่ได้ ถ้าแผนกถูกกำหนดเป็นผู้ใช้สถานที่ลงเวลา (scope = departments) รายการผูกนั้นจะถูกลบไปด้วย',
    pathParams: { id: { description: 'id หรือ code ของแผนก เช่น DEP-01', example: 'DEP-01' } },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'Department deleted' } },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      404: { description: 'ไม่พบแผนก (หรือถูกลบไปแล้ว)', example: { success: false, message: 'ไม่พบแผนกที่ต้องการลบ' } },
      409: { description: 'ยังมีพนักงานอยู่ในแผนก', example: { success: false, message: 'ไม่สามารถลบแผนก "Sales" ได้ เนื่องจากยังมีพนักงาน 12 คนอยู่ในแผนกนี้ กรุณาย้ายพนักงานก่อน' } },
    },
  },

  // ==================================================================
  // Work locations (admin)
  // ==================================================================
  'GET /work-locations': {
    description:
      '**ทำอะไร:** แอดมินดูรายการสถานที่ลงเวลา (Work Locations) ทั้งหมดที่ตั้งไว้ พร้อมว่าใครใช้ได้บ้าง\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. อ่านสถานที่ทั้งหมด (ใหม่สุดก่อน) พร้อมแผนก/พนักงานที่ผูกไว้\n3. นับ `assignedCount` = จำนวนพนักงานสถานะ `Active` ที่ใช้สถานที่นั้นได้\n\n' +
      '**กฎสำคัญ:**\n- พนักงานลงเวลาเข้า/ออกงานได้เฉพาะเมื่ออยู่ในรัศมีของสถานที่ที่ Active และตนมีสิทธิ์ใช้ (server คำนวณระยะเอง) ถ้ายังไม่มีสถานที่ Active เลย พนักงานลงเวลาไม่ได้\n- รายการสำหรับพนักงานในแอปอยู่ที่ `GET /attendance/locations` (คนละ API)\n\n' +
      '**ข้อควรระวัง:** `latitude`, `longitude`, `radiusM` ส่งกลับเป็นตัวเลข; `members` มีเฉพาะเมื่อ scope = `members`, `departmentIds` มีเฉพาะเมื่อ scope = `departments`',
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, locations: [LOCATION_EXAMPLE] } },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
    },
  },

  'POST /work-locations': {
    description:
      '**ทำอะไร:** แอดมินสร้างสถานที่ลงเวลาใหม่ (จุดพิกัด + รัศมี) และกำหนดว่าใครใช้ได้\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ตรวจและจัดรูปข้อมูล (ชื่อ พิกัด รัศมี ขอบเขตผู้ใช้)\n3. บันทึกสถานที่พร้อมรายการแผนก/พนักงานที่ผูกใน transaction เดียว\n4. บันทึก Audit log (`CREATE_WORK_LOCATION`)\n\n' +
      '**กฎสำคัญ:**\n- รัศมีต้องอยู่ระหว่าง 20 ถึง 5,000 เมตร\n- scope = `departments` ต้องเลือกอย่างน้อย 1 แผนก, scope = `members` ต้องเลือกอย่างน้อย 1 คน\n- ค่า `type`, `status`, `scope` ที่ไม่ถูกต้องจะถูกแทนที่ด้วยค่าเริ่มต้น (`Office`, `Active`, `all`) โดยไม่ error\n\n' +
      '**ข้อควรระวัง:** ข้อความ error ของ API กลุ่มนี้เป็นภาษาอังกฤษ; หน้าเว็บมีช่องค้นหาพิกัดช่วยหาละติจูด/ลองจิจูด แต่ API รับเฉพาะตัวเลขพิกัด',
    body: { fields: LOCATION_BODY_FIELDS, example: { name: 'สำนักงานใหญ่ สีลม', type: 'Office', address: '123 ถนนสีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ', latitude: 13.7563, longitude: 100.5018, radiusM: 150, status: 'Active', scope: 'all' } },
    responses: {
      201: { description: 'สร้างสำเร็จ ส่งสถานที่ที่สร้างกลับ', example: { success: true, message: 'Work location created', location: LOCATION_EXAMPLE } },
      400: LOCATION_400,
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
    },
  },

  'PUT /work-locations/:id': {
    description:
      '**ทำอะไร:** แอดมินแก้ไขสถานที่ลงเวลา\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ตรวจและจัดรูปข้อมูลแบบเดียวกับตอนสร้าง\n3. อัปเดตสถานที่ และ **แทนที่รายการแผนก/พนักงานที่ผูกไว้ทั้งหมด** ใน transaction เดียว (ไม่พบสถานที่ = 404)\n4. บันทึก Audit log (`UPDATE_WORK_LOCATION`)\n\n' +
      '**ข้อควรระวัง:** API นี้เป็นการ **แทนที่ทั้งชุด** ไม่ใช่แก้บางฟิลด์: ต้องส่ง `name`, `latitude`, `longitude`, `radiusM` ทุกครั้ง และถ้าไม่ส่ง `type` / `status` / `scope` ระบบจะรีเซ็ตเป็น `Office` / `Active` / `all` (ไม่ใช่คงค่าเดิม) ดังนั้นควรส่งข้อมูลครบทุกฟิลด์เสมอ (หน้าเว็บส่งครบ)',
    pathParams: { id: { description: 'id ของสถานที่ เช่น loc-mh3k9a1b2c3d (ดูได้จาก GET /work-locations)', example: 'loc-mh3k9a1b2c3d' } },
    body: { description: 'ฟิลด์เหมือนตอนสร้าง ต้องส่งครบชุด', fields: LOCATION_BODY_FIELDS, example: { name: 'สำนักงานใหญ่ สีลม', type: 'Office', address: '123 ถนนสีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ', latitude: 13.7563, longitude: 100.5018, radiusM: 200, status: 'Active', scope: 'departments', departmentIds: ['DEP-01'] } },
    responses: {
      200: { description: 'แก้ไขสำเร็จ ส่งสถานที่ล่าสุดกลับ', example: { success: true, message: 'Work location updated', location: { ...LOCATION_EXAMPLE, radiusM: 200, scope: 'departments', departmentIds: ['DEP-01'], assignedCount: 12 } } },
      400: LOCATION_400,
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      404: { description: 'ไม่พบสถานที่ตาม id', example: { success: false, message: 'Work location not found' } },
    },
  },

  'DELETE /work-locations/:id': {
    description:
      '**ทำอะไร:** แอดมินลบสถานที่ลงเวลา\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. ลบสถานที่ (รายการแผนก/พนักงานที่ผูกไว้ถูกลบตามอัตโนมัติ)\n3. บันทึก Audit log (`DELETE_WORK_LOCATION`)\n\n' +
      '**ข้อควรระวัง:** ถ้าลบสถานที่ Active ที่เหลืออยู่แห่งสุดท้าย พนักงานจะลงเวลาไม่ได้จนกว่าจะสร้างสถานที่ใหม่ (ถ้าไม่ต้องการใช้ชั่วคราว ควรตั้ง `status` เป็น `Inactive` แทนการลบ)',
    pathParams: { id: { description: 'id ของสถานที่ เช่น loc-mh3k9a1b2c3d', example: 'loc-mh3k9a1b2c3d' } },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'Work location deleted' } },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      404: { description: 'ไม่พบสถานที่ตาม id', example: { success: false, message: 'Work location not found' } },
    },
  },

  // ==================================================================
  // Notifications
  // ==================================================================
  'GET /notifications': {
    description:
      '**ทำอะไร:** ดึงรายการแจ้งเตือนของ "ตัวเอง" (แอปใช้แสดงกระดิ่งแจ้งเตือนและตัวเลขที่ยังไม่อ่าน)\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านตัวตนผู้ใช้จาก token เท่านั้น (ไม่รับ id จาก query/body)\n2. ดึงแจ้งเตือนทั้งหมดของผู้ใช้คนนั้น เรียงใหม่สุดก่อน\n3. นับจำนวนที่ยังไม่อ่านใน `unreadCount`\n\n' +
      '**กฎสำคัญ:**\n- เห็นเฉพาะแจ้งเตือนของตัวเอง ดูของคนอื่นไม่ได้\n- แจ้งเตือนถูกสร้างโดยระบบเมื่อมีเหตุการณ์ เช่น มีคำขอลารออนุมัติ หรือคำขอได้รับการอนุมัติ/ไม่อนุมัติ (`type` เช่น `info`, `warning`, `success`, `error`)\n\n' +
      '**ข้อควรระวัง:** ประกาศ (Announcements) ไม่อยู่ในรายการนี้ แอปดึงจาก `GET /announcements` มารวมเอง; ยังไม่ใช่ push จริง',
    responses: {
      200: {
        description: 'สำเร็จ ถ้าไม่มีแจ้งเตือนจะได้ `total: 0`',
        example: {
          success: true,
          total: 2,
          unreadCount: 1,
          notifications: [
            { id: 'notif-1761529800000-ab12', employeeId: 'EMP-001', title: '✅ ใบลาของคุณได้รับการอนุมัติแล้ว', message: 'ใบลาได้รับการอนุมัติสมบูรณ์เรียบร้อยแล้ว โดย Somsri Rakdee', type: 'success', isRead: false, createdAt: '2026-10-27T02:30:00.000Z' },
            { id: 'notif-1761443400000-cd34', employeeId: 'EMP-001', title: '📩 คำขอใหม่', message: 'มีคำขอรออนุมัติ', type: 'warning', isRead: true, createdAt: '2026-10-26T02:30:00.000Z' },
          ],
        },
      },
      401: UNAUTHORIZED,
    },
  },

  'PATCH /notifications/read-all': {
    description:
      '**ทำอะไร:** ทำเครื่องหมาย "อ่านแล้ว" กับแจ้งเตือนทั้งหมดของตัวเอง\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านตัวตนจาก token\n2. ตั้ง `isRead = true` ให้ทุกแจ้งเตือนของผู้ใช้คนนี้\n\n' +
      '**กฎสำคัญ:** มีผลกับแจ้งเตือนของตัวเองเท่านั้น ไม่กระทบผู้ใช้อื่น; ไม่มี body',
    responses: {
      200: { description: 'สำเร็จ (เรียกซ้ำได้ ไม่เกิดปัญหา)', example: { success: true, message: 'ทำรายการอ่านทั้งหมดเรียบร้อยแล้ว' } },
      401: UNAUTHORIZED,
    },
  },

  'PATCH /notifications/:id/read': {
    description:
      '**ทำอะไร:** ทำเครื่องหมาย "อ่านแล้ว" กับแจ้งเตือนหนึ่งรายการของตัวเอง\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านตัวตนจาก token\n2. ตั้ง `isRead = true` เฉพาะแจ้งเตือนที่ id ตรงและเป็นของผู้ใช้คนนี้\n\n' +
      '**กฎสำคัญ:** ทำเครื่องหมายแจ้งเตือนของคนอื่นไม่ได้ (ระบบไม่แก้ให้ และไม่ได้แจ้ง error)\n\n' +
      '**ข้อควรระวัง:** API นี้ตอบ 200 เสมอแม้ id ไม่มีอยู่หรือเป็นของคนอื่น (ไม่มี 404/403) ในกรณีนั้นฟิลด์ `notification` จะไม่ปรากฏในผลลัพธ์ และหลัง restart server ฟิลด์ `notification` อาจไม่ปรากฏแม้บันทึกสำเร็จ (ยังไม่ได้ยืนยัน) ให้ตรวจผลด้วย `GET /notifications`; ไม่มี body',
    pathParams: { id: { description: 'id ของแจ้งเตือน (ดูได้จาก GET /notifications)', example: 'notif-1761529800000-ab12' } },
    responses: {
      200: { description: 'สำเร็จ ส่งแจ้งเตือนที่อัปเดตกลับ (ถ้าหาไม่เจอจะไม่มีฟิลด์ `notification`)', example: { success: true, notification: { id: 'notif-1761529800000-ab12', employeeId: 'EMP-001', title: '✅ ใบลาของคุณได้รับการอนุมัติแล้ว', message: 'ใบลาได้รับการอนุมัติสมบูรณ์เรียบร้อยแล้ว โดย Somsri Rakdee', type: 'success', isRead: true, createdAt: '2026-10-27T02:30:00.000Z' } } },
      401: UNAUTHORIZED,
    },
  },

  'POST /notifications/push-token': {
    description:
      '**ทำอะไร:** แอปลงทะเบียน Expo Push Token ของเครื่องมือถือไว้กับพนักงาน เพื่อใช้ส่ง push notification ในอนาคต\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านตัวตนจาก token\n2. ถ้าผู้เรียกเป็นแอดมินและส่ง `employeeId` มา จะบันทึกให้พนักงานคนนั้น ถ้าไม่ใช่แอดมิน (ส่ง employeeId มาก็ถูกเมิน) บันทึกให้ตัวเองเสมอ\n3. เก็บ token\n\n' +
      '**กฎสำคัญ:** พนักงานฝาก token ให้คนอื่นหรือเขียนทับของคนอื่นไม่ได้\n\n' +
      '**ข้อควรระวัง:** ปัจจุบัน token เก็บไว้ในหน่วยความจำของ server เท่านั้น (ไม่ได้เก็บในฐานข้อมูล) จึงหายเมื่อ server restart และระบบยังไม่ได้ส่ง push จริง (แอปใช้การเช็กแจ้งเตือนเป็นระยะแทน)',
    body: {
      fields: [
        { name: 'token', type: 'string', required: true, description: 'Expo Push Token ของเครื่อง เช่น `ExponentPushToken[...]` (ถ้าไม่ส่ง = 400)', example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' },
        { name: 'employeeId', type: 'string', required: false, description: 'ใช้ได้เฉพาะแอดมิน: id พนักงานที่จะบันทึก token ให้ ผู้ใช้อื่นส่งมาก็ไม่มีผล', example: 'EMP-001' },
      ],
      example: { token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' },
    },
    responses: {
      200: { description: 'บันทึก token สำเร็จ', example: { success: true, message: 'ลงทะเบียน Expo Push Token เรียบร้อยแล้ว' } },
      400: { description: 'ไม่ได้ส่ง `token`', example: { success: false, message: 'กรุณาระบุ Push Token' } },
      401: UNAUTHORIZED,
    },
  },

  // ==================================================================
  // HR dashboard & reports
  // ==================================================================
  'GET /hr/dashboard/stats': {
    description:
      '**ทำอะไร:** ดึงตัวเลขสรุปของวันนี้สำหรับหน้า Dashboard ของ HR\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นผู้อนุมัติ/แอดมิน\n2. นับพนักงานทั้งหมด (ไม่รวมสถานะ `Resign`, `Resigned`, `Inactive`)\n3. นับคนที่ลงเวลาเข้างานวันนี้ (เวลาไทย) และคนที่เข้างานสาย\n4. นับคนที่ลาอยู่วันนี้ (ใบลาสถานะ `อนุมัติแล้ว` ที่คร่อมวันนี้)\n5. นับคำขอที่ยังรออนุมัติ (ใบลา + คำขอแก้เวลา ที่สถานะมีคำว่า `รออนุมัติ`)\n6. คำนวณ % ตรงเวลาจากข้อมูลลงเวลา 30 วันล่าสุด\n\n' +
      '**กฎสำคัญ:**\n- `clockedInToday` และ `presentToday` เป็นค่าเดียวกัน (จำนวนคนที่ไม่ซ้ำกันที่ลงเวลาเข้างานวันนี้)\n- `onTimeRate` เป็นข้อความ เช่น `93%` (สัดส่วนแถวลงเวลาสถานะ `ปกติ` ใน 30 วันล่าสุด) ถ้ายังไม่มีข้อมูลเลยได้ `100%`\n- เป็นตัวเลขของทั้งบริษัท (ไม่แยกตามแผนก) ทุก role ที่เป็นผู้อนุมัติเห็นเหมือนกัน\n\n' +
      '**ข้อควรระวัง:** ค่าสถานะของการลงเวลาและการอนุมัติเป็นข้อความภาษาไทย ระบบนับด้วยข้อความนี้ จึงห้ามเปลี่ยนชื่อสถานะ',
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, stats: { totalEmployees: 120, clockedInToday: 98, presentToday: 98, lateToday: 7, onLeaveToday: 5, pendingApprovalsCount: 4, onTimeRate: '93%' } } },
      401: UNAUTHORIZED,
      403: FORBIDDEN_APPROVER,
      500: { description: 'เกิดข้อผิดพลาดภายใน server (ข้อความคือข้อความผิดพลาดดิบจากระบบ)', example: { success: false, message: 'Database error' } },
    },
  },

  'GET /hr/reports/attendance': {
    description:
      '**ทำอะไร:** ดึงรายงานการลงเวลาของพนักงานทั้งบริษัท ตามวันหรือเดือน (เว็บ Attendance ใช้)\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นผู้อนุมัติ/แอดมิน\n2. ถ้าส่ง `date` กรองเฉพาะวันนั้น ถ้าไม่ส่ง `date` แต่ส่ง `month` กรองทั้งเดือน (เทียบจากต้นสตริงวันที่)\n3. ผูกข้อมูลลงเวลากับข้อมูลพนักงาน (ชื่อ รหัส แผนก role) เรียงวันที่ใหม่สุดก่อน\n\n' +
      '**กฎสำคัญ:**\n- `date` ใช้รูปแบบ `YYYY-MM-DD` และ `month` ใช้ `YYYY-MM` (วันที่ตามเวลา Asia/Bangkok) ถ้าส่งทั้งคู่ `date` มาก่อน\n- เป็นข้อมูลทั้งบริษัท ไม่แยกตามแผนกของผู้เรียก\n- `role` ของแถวใช้ให้เว็บรู้ว่าเป็น SuperBoss (ไม่ถูกนับสาย/ทำงานไม่ครบเวลา)\n- ข้อมูลตำแหน่ง GPS ตอนออกงานเก็บแยกจากตอนเข้างาน: `locationName` คือที่เข้างาน, `checkOut*` คือที่ออกงาน ถ้าเป็นแถวเก่าหรือยังไม่ออกงานอาจเป็น `null`\n\n' +
      '**ข้อควรระวัง:** ถ้าไม่ส่ง `month` และ `date` จะได้ข้อมูลลงเวลา **ทั้งหมดทุกวัน** (ไม่ใช่เฉพาะเดือนปัจจุบัน แม้ฟิลด์ `month` ในผลลัพธ์จะแสดงคำว่า `ปัจจุบัน`) อาจมีข้อมูลมาก; ค่าพิกัด `checkOutLatitude`/`checkOutLongitude` อาจถูกส่งเป็นข้อความตัวเลข (เช่น `"13.75640000"`); `status` เป็นข้อความภาษาไทย เช่น `ปกติ`, `สาย`',
    query: [
      { name: 'date', type: 'string', required: false, description: 'วันที่ที่ต้องการ รูปแบบ `YYYY-MM-DD` (เวลาไทย) ถ้าส่งจะใช้แทน month', example: '2026-10-27' },
      { name: 'month', type: 'string', required: false, description: 'เดือนที่ต้องการ รูปแบบ `YYYY-MM` ใช้เมื่อไม่ส่ง date', example: '2026-10' },
    ],
    responses: {
      200: {
        description: 'สำเร็จ `month` จะเป็นค่าที่ส่งมา หรือ `ปัจจุบัน` ถ้าไม่ได้ส่ง และ `date` เป็น null ถ้าไม่ได้ส่ง',
        example: {
          success: true,
          month: 'ปัจจุบัน',
          date: '2026-10-27',
          totalRecords: 1,
          report: [
            {
              id: 'att-1761525300000-x9k2',
              employeeId: 'EMP-001',
              employeeCode: 'EMP-001',
              employeeName: 'Somchai Jaidee',
              role: 'Employee',
              firstName: 'Somchai',
              lastName: 'Jaidee',
              department: 'Sales',
              dateIso: '2026-10-27',
              checkIn: '08:55 น.',
              checkOut: '18:02 น.',
              duration: '09:07:00 ชม.',
              status: 'ปกติ',
              statusColor: '#10B981',
              locationName: 'สำนักงานใหญ่ สีลม',
              checkOutLatitude: '13.75640000',
              checkOutLongitude: '100.50190000',
              checkOutLocationName: 'สำนักงานใหญ่ สีลม',
            },
          ],
        },
      },
      401: UNAUTHORIZED,
      403: FORBIDDEN_APPROVER,
      500: { description: 'เกิดข้อผิดพลาดภายใน server (ข้อความคือข้อความผิดพลาดดิบจากระบบ)', example: { success: false, message: 'Database error' } },
    },
  },

  // ==================================================================
  // Audit logs & holidays
  // ==================================================================
  'GET /audit-logs': {
    description:
      '**ทำอะไร:** แอดมินดูบันทึกการทำงาน (Audit log) ว่าใครทำอะไร เมื่อไหร่ จาก IP ไหน เพื่อตรวจสอบย้อนหลัง\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. อ่านบันทึกจากฐานข้อมูล เรียงใหม่สุดก่อน กรองตาม query ที่ส่งมา (ทุกตัวกรองใช้ร่วมกันแบบ "และ" เทียบตรงตัว)\n3. ตัดตามจำนวน `limit` เริ่มจากตำแหน่ง `offset`\n\n' +
      '**กฎสำคัญ:**\n- `limit` ค่าเริ่มต้น 50, `offset` ค่าเริ่มต้น 0 (ใช้ทำหน้าถัดไป: offset = 50, 100, ...)\n- ผลลัพธ์ใส่ไว้ทั้งใน `data` และ `logs` (ข้อมูลชุดเดียวกัน) เพื่อให้ client เก่า/ใหม่ใช้ได้\n- `action` ที่พบ เช่น `LOGIN_SUCCESS`, `LOGIN_FAILED`, `CREATE_EMPLOYEE`, `UPDATE_EMPLOYEE`, `EMPLOYEE_RESIGNED`, `DELETE_EMPLOYEE`, `RESET_EMPLOYEE_PASSWORD`, `CREATE_WORK_LOCATION`, `UPDATE_WORK_LOCATION`, `DELETE_WORK_LOCATION`, `CREATE_ANNOUNCEMENT`, `APPROVE_REQUEST`, `UPDATE_WORK_TIME_SETTINGS`, `CREATE_QUEST`; `resourceType` เช่น `employee`, `admin`, `auth`, `work_location`, `announcement`, `quest`, `settings`\n- บันทึกเป็นแบบเขียนอย่างเดียว ไม่มี API แก้หรือลบ\n\n' +
      '**ข้อควรระวัง:** ไม่มีตัวกรองช่วงวันที่ และการจัดการแผนก (departments) ยังไม่ถูกบันทึกใน Audit log; `details` เป็น JSON ที่โครงสร้างต่างกันตาม action',
    query: [
      { name: 'limit', type: 'integer', required: false, description: 'จำนวนรายการต่อหน้า ค่าเริ่มต้น 50', example: 50 },
      { name: 'offset', type: 'integer', required: false, description: 'ข้ามกี่รายการแรก (ใช้แบ่งหน้า) ค่าเริ่มต้น 0', example: 0 },
      { name: 'actorId', type: 'string', required: false, description: 'กรองเฉพาะผู้กระทำ (id ของพนักงานหรือแอดมิน)', example: 'ADM-001' },
      { name: 'action', type: 'string', required: false, description: 'กรองตามชื่อการกระทำ (ตรงตัว ตัวพิมพ์ใหญ่)', example: 'CREATE_WORK_LOCATION' },
      { name: 'resourceType', type: 'string', required: false, description: 'กรองตามประเภททรัพยากร (ตรงตัว ตัวพิมพ์เล็ก)', example: 'work_location' },
    ],
    responses: {
      200: {
        description: 'สำเร็จ `count` คือจำนวนรายการในหน้านี้ (ไม่ใช่จำนวนทั้งหมด)',
        example: {
          success: true,
          count: 1,
          data: [
            {
              id: 'audit-1761525300000-k3j9a',
              actorId: 'ADM-001',
              actorName: 'Admin',
              actorRole: 'Super Admin',
              action: 'CREATE_WORK_LOCATION',
              resourceType: 'work_location',
              resourceId: 'loc-mh3k9a1b2c3d',
              details: { name: 'สำนักงานใหญ่ สีลม' },
              ipAddress: '203.0.113.10',
              userAgent: 'Mozilla/5.0',
              createdAt: '2026-10-27T02:35:00.000Z',
            },
          ],
          logs: [
            {
              id: 'audit-1761525300000-k3j9a',
              actorId: 'ADM-001',
              actorName: 'Admin',
              actorRole: 'Super Admin',
              action: 'CREATE_WORK_LOCATION',
              resourceType: 'work_location',
              resourceId: 'loc-mh3k9a1b2c3d',
              details: { name: 'สำนักงานใหญ่ สีลม' },
              ipAddress: '203.0.113.10',
              userAgent: 'Mozilla/5.0',
              createdAt: '2026-10-27T02:35:00.000Z',
            },
          ],
        },
      },
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      500: { description: 'ดึงข้อมูลไม่สำเร็จ', example: { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Audit Logs' } },
    },
  },

  'GET /holidays': {
    description:
      '**ทำอะไร:** ดึงรายการวันหยุดนักขัตฤกษ์ของไทย (ใช้แสดงในปฏิทิน/ประกอบการลา)\n\n' +
      '**server ทำอย่างไร:**\n1. ไม่ต้องล็อกอิน (เปิดสาธารณะ)\n2. อ่านวันหยุดจากตาราง `company_holidays` เรียงตามวันที่เก่าไปใหม่\n3. ถ้าส่ง `year` กรองเฉพาะปีนั้น\n\n' +
      '**กฎสำคัญ:**\n- ข้อมูลตั้งต้นเป็นวันหยุดราชการของไทย ปี 2025-2027 ซึ่งระบบสร้างให้ครั้งแรกที่ตารางว่าง (ปีอื่นไม่มีข้อมูล)\n- `date` เป็นข้อความรูปแบบ `YYYY-MM-DD`\n- ไม่มี API เพิ่ม/แก้/ลบวันหยุด\n\n' +
      '**ข้อควรระวัง:** ต้องเชื่อมต่อฐานข้อมูลได้จึงจะใช้งานได้ ถ้าส่ง `year` ที่ไม่ใช่ตัวเลข ระบบจะตอบ 500; ควรตรวจกับประกาศวันหยุดอย่างเป็นทางการอีกครั้งเมื่อใช้งานจริง',
    query: [
      { name: 'year', type: 'integer', required: false, description: 'ปี ค.ศ. ที่ต้องการ เช่น 2026 ถ้าไม่ส่งได้ทุกปี', example: 2026 },
    ],
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          total: 2,
          holidays: [
            { id: 'hol-2026-10-13', date: '2026-10-13', name: 'วันนวมินทรมหาราช (King Rama IX Memorial Day)', year: 2026 },
            { id: 'hol-2026-10-23', date: '2026-10-23', name: 'วันปิยมหาราช (Chulalongkorn Day)', year: 2026 },
          ],
        },
      },
      500: { description: 'คิวรีฐานข้อมูลล้มเหลว (เช่น `year` ไม่ใช่ตัวเลข หรือฐานข้อมูลไม่พร้อม) ข้อความจะต่อท้ายด้วยรายละเอียดข้อผิดพลาด', example: { success: false, message: 'Database query error: invalid input syntax for type integer: "NaN"' } },
    },
  },
};
