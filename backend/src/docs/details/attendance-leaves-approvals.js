// รายละเอียดสำหรับหน้า Swagger: กลุ่ม การลงเวลา / ไฟล์แนบใบลา / ใบลา / นโยบายการลา / การอนุมัติ
// key = "METHOD /express/path" ตรงกับ routes/api.js (ข้อมูลในตัวอย่างเป็นข้อมูลสมมติทั้งหมด)

const E401 = {
  description: 'ยังไม่ได้ล็อกอิน หรือ token ไม่ถูกต้อง/หมดอายุ (ต้องส่ง header `Authorization: Bearer <token>`)',
  example: { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)' },
};
const E403_APPROVER = {
  description: 'ล็อกอินแล้วแต่ role ไม่ใช่ผู้อนุมัติ/แอดมิน (เช่น Employee ทั่วไป)',
  example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบ/หัวหน้างานเท่านั้น (Forbidden)' },
};
const E403_ADMIN = {
  description: 'ล็อกอินแล้วแต่ role ไม่ใช่แอดมิน (Admin / HR Admin / Super Admin)',
  example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบ (Admin)เท่านั้น (Forbidden)' },
};

// แถวลงเวลา 1 วัน (รูปแบบเดียวกันใน today / history / clock-in / clock-out)
const attendanceRow = {
  id: 'att-1793089320000-k3x9',
  employeeId: 'EMP-001',
  dateIso: '2026-10-27',
  checkIn: '08:42 น.',
  checkOut: '17:55 น.',
  duration: '09:13:00 ชม.',
  status: 'ปกติ',
  statusColor: '#10B981',
  latitude: 13.7563,
  longitude: 100.5018,
  locationName: 'สำนักงานใหญ่ (HQ)',
  checkOutLatitude: 13.7564,
  checkOutLongitude: 100.5019,
  checkOutLocationName: 'สำนักงานใหญ่ (HQ)',
  photoUrl: null,
};

const leaveRequestExample = {
  id: 'leave-1793089320000-ab12',
  employeeId: 'EMP-001',
  employeeName: 'สมชาย ใจดี',
  employeeCode: 'EMP-001',
  department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
  requesterRole: 'Employee',
  leaveType: 'ลากิจ (Personal Leave)',
  startDate: '2026-11-03',
  endDate: '2026-11-03',
  totalDays: 1,
  reason: 'ไปทำธุระที่ธนาคาร',
  attachmentUrl: null,
  status: 'รออนุมัติระดับ 1 (Boss)',
  approvalLevel: 1,
  currentApproverId: 'EMP-010',
  currentApproverName: 'วิภา หัวหน้างาน',
  directManagerId: 'EMP-010',
  superbossId: 'EMP-099',
  createdAt: '2026-10-27',
};

const policyExample = {
  id: 'LP-01',
  typeName: 'ลาพักร้อน (Annual Leave)',
  categoryKey: 'annual',
  defaultQuota: 10,
  isPaid: true,
  applicableGender: 'all',
  requireAttachment: false,
  description: 'ลาพักผ่อนประจำปี',
  status: 'Active',
  createdAt: '2026-01-02T03:00:00.000Z',
  updatedAt: '2026-01-02T03:00:00.000Z',
};

const correctionExample = {
  id: 'tc-1793089320000-q7w2',
  employeeId: 'EMP-001',
  employeeName: 'สมชาย ใจดี',
  employeeCode: 'EMP-001',
  department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
  requesterRole: 'Employee',
  dateIso: '2026-10-26',
  oldCheckIn: '10:30 น.',
  newCheckIn: '08:00',
  oldCheckOut: '-',
  newCheckOut: '17:00',
  reason: 'ลืมกดเข้างานเพราะระบบขัดข้อง',
  status: 'รออนุมัติระดับ 1 (Boss)',
  approvalLevel: 1,
  currentApproverId: 'EMP-010',
  currentApproverName: 'วิภา หัวหน้างาน',
  directManagerId: 'EMP-010',
  superbossId: 'EMP-099',
  createdAt: '2026-10-27',
};

const correctionListRow = {
  id: 'tc-1793089320000-q7w2',
  employeeId: 'EMP-001',
  employeeName: 'สมชาย ใจดี',
  dateIso: '2026-10-26',
  oldCheckIn: '10:30 น.',
  newCheckIn: '08:00',
  oldCheckOut: '-',
  newCheckOut: '17:00',
  reason: 'ลืมกดเข้างานเพราะระบบขัดข้อง',
  status: 'อนุมัติแล้ว',
  approver: 'วิภา หัวหน้างาน',
  remark: 'อนุมัติสมบูรณ์',
  createdAt: '2026-10-27T02:15:00.000Z',
};

module.exports = {
  // ===================== ATTENDANCE =====================
  'POST /attendance/clock-in': {
    description:
      '**ทำอะไร:** พนักงานกดเข้างาน ระบบบันทึกเวลาเข้างานของวันนี้ (เวลาไทย) พร้อมตำแหน่ง GPS และสถานที่ลงเวลา\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจว่าแอดมินสร้างสถานที่ลงเวลา (Work Location) ที่ Active ไว้อย่างน้อย 1 แห่ง ถ้าไม่มีเลย ตอบ 403\n' +
      '2. ตรวจว่าส่ง `locationId` และพิกัด `latitude` / `longitude` มาครบ\n' +
      '3. ตรวจว่าพนักงานมีสิทธิ์ใช้สถานที่นั้น (ใช้ได้ทุกคน / ตามแผนก / รายบุคคล)\n' +
      '4. **server คำนวณระยะห่างเองจากพิกัดที่ส่งมา** ถ้าอยู่นอกรัศมีของสถานที่ ตอบ 403\n' +
      '5. ตรวจว่าวันนี้ยังไม่เคยเข้างาน (ล็อกแถวพนักงานกันกดซ้ำพร้อมกัน) แล้วบันทึกเวลาเข้างาน\n' +
      '6. ถ้าเข้างานหลัง "เวลาสาย" ที่ตั้งใน Work Time Settings สถานะเป็น `สาย` ถ้าไม่เกินเป็น `ปกติ`\n\n' +
      '**กฎสำคัญ:**\n' +
      '- ต้องอยู่ในพื้นที่ที่กำหนดเท่านั้นถึงลงเวลาได้ ไม่มีปุ่มยืนยันให้ข้าม\n' +
      '- ตัวตนพนักงานมาจาก token เท่านั้น (ไม่อ่าน employeeId จาก body)\n' +
      '- role `SuperBoss` ไม่ถูกบันทึกเป็น `สาย` (แต่ยังต้องอยู่ในพื้นที่สถานที่ลงเวลา)\n' +
      '- เข้างานได้วันละ 1 ครั้ง\n\n' +
      '**ข้อควรระวัง:** ชื่อสถานที่ที่เก็บคือชื่อที่ server ตรวจแล้วจาก `locationId` ไม่ใช่ `locationName` ที่แอปส่งมา ค่า `status` เป็นข้อความภาษาไทย (`ปกติ` / `สาย`) ฝั่ง client จับคู่ด้วยข้อความนี้ จึงห้ามเปลี่ยนชื่อ รูปถ่าย `photoUrl` ยังเป็น placeholder (ยังไม่มี endpoint อัปโหลดรูป)',
    body: {
      description: 'ต้องส่ง `locationId` และพิกัดเสมอ ระยะห่างที่แอปคำนวณเองจะไม่ถูกเชื่อถือ',
      fields: [
        { name: 'locationId', type: 'string', required: true, description: 'รหัสสถานที่ลงเวลาที่พนักงานเลือก (ได้จาก `GET /attendance/locations`) ต้องเป็นสถานที่ Active ที่พนักงานคนนี้ใช้ได้', example: 'loc-001' },
        { name: 'latitude', type: 'number', required: true, description: 'ละติจูดปัจจุบันของพนักงานจาก GPS (ส่ง null/ไม่ส่ง = 400)', example: 13.7563 },
        { name: 'longitude', type: 'number', required: true, description: 'ลองจิจูดปัจจุบันของพนักงานจาก GPS (ส่ง null/ไม่ส่ง = 400)', example: 100.5018 },
        { name: 'locationName', type: 'string', required: false, description: 'ชื่อสถานที่ที่แอปส่งมา (ถูกเมินเมื่อ server ตรวจ locationId สำเร็จ เก็บชื่อจริงของสถานที่แทน)', example: 'สำนักงานใหญ่ (HQ)' },
        { name: 'photoUrl', type: 'string', required: false, description: 'ลิงก์รูปถ่ายตอนลงเวลา (ตอนนี้เป็น placeholder เก็บค่าที่ส่งมาตามนั้น)', example: '' },
      ],
      example: { locationId: 'loc-001', latitude: 13.7563, longitude: 100.5018 },
    },
    responses: {
      200: {
        description: 'บันทึกเวลาเข้างานสำเร็จ (`attendance` คือแถวลงเวลาของวันนี้ `checkOut` ยังเป็น null)',
        example: {
          success: true,
          message: 'บันทึกเวลาเข้างานสำเร็จเรียบร้อยแล้ว',
          attendance: {
            id: 'att-1793089320000-k3x9',
            employeeId: 'EMP-001',
            dateIso: '2026-10-27',
            checkIn: '08:42 น.',
            checkOut: null,
            duration: '00:00:00 ชม.',
            status: 'ปกติ',
            statusColor: '#10B981',
            latitude: 13.7563,
            longitude: 100.5018,
            isOutRange: false,
            locationName: 'สำนักงานใหญ่ (HQ)',
            workLocationId: 'loc-001',
            photoUrl: null,
          },
        },
      },
      400: {
        description: 'ข้อมูลไม่ครบ หรือเข้างานของวันนี้ไปแล้ว (ตัวอย่างข้อความที่เป็นไปได้: ไม่ส่ง locationId = "กรุณาเลือกสถานที่ลงเวลา", ไม่ส่งพิกัด = "ไม่พบตำแหน่งของคุณ กรุณาเปิดตำแหน่ง (GPS) แล้วลองใหม่อีกครั้ง", เข้างานซ้ำ = "คุณได้ลงเวลาเข้างานของวันนี้แล้ว")',
        example: { success: false, message: 'คุณได้ลงเวลาเข้างานของวันนี้แล้ว' },
      },
      401: E401,
      403: {
        description: 'ลงเวลาไม่ได้เพราะเรื่องสถานที่ มีได้ 4 แบบ: (1) ยังไม่มีสถานที่ Active เลย "ยังไม่ได้กำหนดสถานที่ทำงาน ไม่สามารถลงเวลาได้ กรุณาติดต่อ HR" (2) พนักงานไม่มีสถานที่ที่ใช้ได้ "ยังไม่มีสถานที่ทำงานที่คุณลงเวลาได้ กรุณาติดต่อ HR" (3) เลือกสถานที่ที่ไม่มีสิทธิ์/ไม่พบ "คุณไม่มีสิทธิ์ลงเวลาที่สถานที่นี้" (4) อยู่นอกรัศมี (ตัวอย่างด้านล่าง ระบุระยะที่ server คำนวณ)',
        example: { success: false, message: 'คุณอยู่นอกพื้นที่ "สำนักงานใหญ่ (HQ)" (ห่าง 2224 ม. อนุญาตภายใน 200 ม.) กรุณาเดินทางไปยังสถานที่ก่อนลงเวลา' },
      },
      500: {
        description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ',
        example: { success: false, message: 'ไม่สามารถบันทึกเวลาเข้างานลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง' },
      },
    },
  },

  'POST /attendance/clock-out': {
    description:
      '**ทำอะไร:** พนักงานกดออกงาน ระบบบันทึกเวลาออก ตำแหน่ง GPS ตอนออก คำนวณชั่วโมงทำงาน และแจกแต้มเข้างานตรงเวลาถ้าครบเงื่อนไข\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจสถานที่และระยะห่างแบบเดียวกับ `clock-in` (ต้องส่ง `locationId` + พิกัด นอกรัศมีตอบ 403 และไม่บันทึกอะไร)\n' +
      '2. หาแถวเข้างานของวันนี้ ถ้าไม่มีหรือออกงานไปแล้ว ตอบ 400\n' +
      '3. คำนวณชั่วโมงทำงานจากเวลาเข้างาน (คนที่มาก่อน "เวลาเริ่มงาน" ใน Work Time Settings นับจากเวลาเริ่มงาน) ถึงตอนนี้\n' +
      '4. บันทึกเวลาออก + พิกัดออก + ชื่อสถานที่ที่ server ตรวจแล้ว\n' +
      '5. แจกแต้ม (`onTimePoints`) ถ้า **เข้างานตรงเวลา (สถานะไม่ใช่ `สาย`) และทำงานครบชั่วโมงที่ตั้ง** และตั้งแต้มไว้ (>0) โดยเพิ่มแต้ม + บันทึกใน `point_transactions` (หมวด `Attendance`) ใน transaction เดียวกับการบันทึกเวลาออก (atomic)\n\n' +
      '**กฎสำคัญ:**\n' +
      '- แต้มจ่ายครั้งเดียวต่อวัน (ออกงานซ้ำไม่ได้ จึงไม่จ่ายซ้ำ)\n' +
      '- ถ้าลืมออกงาน ระบบปิดให้อัตโนมัติ 23:59 น. ของวันนั้น แต่ไม่ได้แต้ม\n' +
      '- คำขอแก้เวลาที่อนุมัติแล้วยังไม่แจกแต้ม\n\n' +
      '**ข้อควรระวัง:** `pointsAwarded` เป็น 0 เมื่อสาย / ทำงานไม่ครบ / ปิดแต้มไว้ (0) แอปใช้ค่านี้แสดงข้อความแสดงความยินดี',
    body: {
      description: 'ต้องส่ง `locationId` และพิกัดเสมอ เหมือนการเข้างาน',
      fields: [
        { name: 'locationId', type: 'string', required: true, description: 'รหัสสถานที่ลงเวลาที่พนักงานเลือก (ได้จาก `GET /attendance/locations`)', example: 'loc-001' },
        { name: 'latitude', type: 'number', required: true, description: 'ละติจูดปัจจุบันของพนักงาน', example: 13.7564 },
        { name: 'longitude', type: 'number', required: true, description: 'ลองจิจูดปัจจุบันของพนักงาน', example: 100.5019 },
        { name: 'locationName', type: 'string', required: false, description: 'ชื่อสถานที่ที่แอปส่งมา (ถูกเมินเมื่อ server ตรวจ locationId สำเร็จ)', example: 'สำนักงานใหญ่ (HQ)' },
      ],
      example: { locationId: 'loc-001', latitude: 13.7564, longitude: 100.5019 },
    },
    responses: {
      200: {
        description: 'บันทึกเวลาออกงานสำเร็จ `pointsAwarded` คือแต้มที่ได้ครั้งนี้ (0 = ไม่ได้)',
        example: {
          success: true,
          message: 'บันทึกเวลาออกงานสำเร็จเรียบร้อยแล้ว',
          attendance: { ...attendanceRow, pointsAwarded: 20 },
          pointsAwarded: 20,
        },
      },
      400: {
        description: 'ข้อมูลไม่ครบ หรือสถานะวันนี้ไม่ตรง: ไม่ส่ง locationId/พิกัด, ยังไม่ได้เข้างานวันนี้ ("ยังไม่พบการลงเวลาเข้างานของวันนี้ กรุณาลงเวลาเข้างานก่อนออกงาน หรือยื่นคำขอปรับปรุงเวลา"), หรือออกงานไปแล้ว ("คุณได้ลงเวลาออกงานของวันนี้แล้ว")',
        example: { success: false, message: 'คุณได้ลงเวลาออกงานของวันนี้แล้ว' },
      },
      401: E401,
      403: {
        description: 'เรื่องสถานที่เหมือน `clock-in` (ยังไม่มีสถานที่ / ไม่มีสิทธิ์ใช้สถานที่นี้ / อยู่นอกรัศมี)',
        example: { success: false, message: 'คุณอยู่นอกพื้นที่ "สำนักงานใหญ่ (HQ)" (ห่าง 2224 ม. อนุญาตภายใน 200 ม.) กรุณาเดินทางไปยังสถานที่ก่อนลงเวลา' },
      },
      500: {
        description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ',
        example: { success: false, message: 'ไม่สามารถบันทึกเวลาออกงานลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง' },
      },
    },
  },

  'GET /attendance/today': {
    description:
      '**ทำอะไร:** ดูสถานะการลงเวลา "วันนี้" ของผู้ที่ล็อกอิน (ใช้ตัดสินใจว่าแอปจะแสดงปุ่มเข้างานหรือออกงาน)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. อ่าน id พนักงานจาก token\n' +
      '2. หาแถวลงเวลาของวันนี้ (เวลาไทย) ถ้ามีหลายแถวใช้แถวล่าสุด\n\n' +
      '**กฎสำคัญ:**\n' +
      '- ถ้ายังไม่เคยลงเวลาวันนี้ ได้ `status: "ยังไม่ได้ลงเวลา"` และ `checkIn` / `checkOut` เป็น `null`\n' +
      '- เข้างานแล้วแต่ยังไม่ออก `checkOut` เป็น `null`\n\n' +
      '**ข้อควรระวัง:** วันที่ `dateIso` เป็นรูปแบบ `YYYY-MM-DD` ตามเวลา Asia/Bangkok',
    responses: {
      200: {
        description: 'สำเร็จ (ตัวอย่างตอนยังไม่ได้ลงเวลา; ถ้ามีข้อมูลจะได้แถวลงเวลาเต็ม เช่นเดียวกับรายการใน `/attendance/history`)',
        example: { success: true, attendance: { employeeId: 'EMP-001', dateIso: '2026-10-27', checkIn: null, checkOut: null, status: 'ยังไม่ได้ลงเวลา' } },
      },
      401: E401,
    },
  },

  'GET /attendance/locations': {
    description:
      '**ทำอะไร:** ขอรายการสถานที่ลงเวลาที่พนักงานคนนี้ใช้ได้ เรียงจากใกล้ไปไกล เพื่อให้เลือกก่อนกดเข้างาน/ออกงาน\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจว่ามีสถานที่ Active หรือไม่ (ถ้าไม่มีเลย `required: false` และ `locations` เป็น `[]`)\n' +
      '2. กรองเฉพาะสถานที่ที่พนักงานใช้ได้ (ทุกคน / ตามแผนก / รายบุคคล)\n' +
      '3. ถ้าส่งพิกัดมา server คำนวณ `distanceM` (เมตร) และ `inRange` (อยู่ในรัศมีหรือไม่) ให้ และเรียงใกล้ไปไกล\n\n' +
      '**กฎสำคัญ:**\n' +
      '- ถ้าไม่ส่งพิกัด `distanceM` เป็น `null` และ `inRange` เป็น `false`\n' +
      '- สถานที่ Inactive ไม่แสดง\n' +
      '- ถ้ารายการว่าง (ยังไม่มีสถานที่ที่ใช้ได้) พนักงานจะเข้างาน/ออกงานไม่ได้ (server ตอบ 403) ต้องให้แอดมินสร้างสถานที่ก่อน\n\n' +
      '**ข้อควรระวัง:** ค่า `inRange` ใช้แสดงผลเท่านั้น ตอนเข้า/ออกงานจริง server คำนวณระยะใหม่เองทุกครั้ง',
    query: [
      { name: 'latitude', type: 'number', required: false, description: 'ละติจูดปัจจุบันของพนักงาน (ต้องส่งคู่กับ longitude ถึงจะคำนวณระยะ)', example: '13.7563' },
      { name: 'longitude', type: 'number', required: false, description: 'ลองจิจูดปัจจุบันของพนักงาน', example: '100.5018' },
    ],
    responses: {
      200: {
        description: 'สำเร็จ `required` = true เมื่อมีสถานที่ Active อยู่ในระบบ',
        example: {
          success: true,
          required: true,
          locations: [
            { id: 'loc-001', name: 'สำนักงานใหญ่ (HQ)', type: 'Office', address: '123 ถนนสีลม กรุงเทพฯ', latitude: 13.7563, longitude: 100.5018, radiusM: 200, distanceM: 35, inRange: true },
            { id: 'loc-002', name: 'ไซต์งานบางนา', type: 'Site', address: '', latitude: 13.7763, longitude: 100.5018, radiusM: 100, distanceM: 2224, inRange: false },
          ],
        },
      },
      401: E401,
    },
  },

  'GET /attendance/history': {
    description:
      '**ทำอะไร:** ดูประวัติการลงเวลาของตัวเอง (ทุกวัน หรือกรองเป็นเดือน) เรียงวันล่าสุดก่อน\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. อ่าน id พนักงานจาก token (ดูของคนอื่นไม่ได้)\n' +
      '2. ถ้ามี `month` กรองวันที่ที่ขึ้นต้นด้วยค่านั้น\n\n' +
      '**กฎสำคัญ:**\n' +
      '- `month` เป็นรูปแบบ `YYYY-MM` (เวลาไทย) ถ้าไม่ส่งจะได้ทุกวัน\n' +
      '- แถวเก่าที่ยังไม่มีพิกัดตอนออกงาน หรือกะที่ยังไม่ออกงาน ฟิลด์ออกงานจะเป็น `null`\n\n' +
      '**ข้อควรระวัง:** ไม่มีการแบ่งหน้า (ส่งทั้งหมดที่เข้าเงื่อนไข) ฟิลด์ `status` เป็นข้อความไทย เช่น `ปกติ`, `สาย`, `ลงเวลาเข้า-ออกครบถ้วน` (หลังคำขอแก้เวลาอนุมัติ)',
    query: [
      { name: 'month', type: 'string', required: false, description: 'เดือนที่ต้องการ รูปแบบ YYYY-MM', example: '2026-10' },
    ],
    responses: {
      200: {
        description: 'สำเร็จ `total` คือจำนวนแถวใน `history`',
        example: { success: true, total: 1, history: [attendanceRow] },
      },
      401: E401,
    },
  },

  'GET /attendance/summary': {
    description:
      '**ทำอะไร:** สรุปสถิติการลงเวลาของตัวเองจากประวัติทั้งหมด (จำนวนวันทำงาน วันตรงเวลา วันสาย ชั่วโมงรวม)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ดึงประวัติลงเวลาทั้งหมดของผู้ที่ล็อกอิน\n' +
      '2. นับสถานะ `ปกติ`/`ลงเวลาเข้า-ออกครบถ้วน` เป็นตรงเวลา, `สาย`/`เข้างานสาย` เป็นสาย, สถานะที่มีคำว่า `ไม่ลงเวลา` เป็น absent\n' +
      '3. รวมเวลาจากฟิลด์ `duration` ทุกแถวเป็นชั่วโมง ปัดทศนิยม 1 ตำแหน่ง\n\n' +
      '**ข้อควรระวัง:** ไม่มีตัวกรองช่วงเวลา นับทุกวันที่เคยมีบันทึก `totalHours` เป็นข้อความ เช่น `"164.5 ชม."`',
    responses: {
      200: {
        description: 'สำเร็จ',
        example: { success: true, summary: { totalWorkDays: 20, onTimeDays: 18, lateDays: 2, absentDays: 0, totalHours: '181.5 ชม.' } },
      },
      401: E401,
    },
  },

  'GET /attendance/corrections': {
    description:
      '**ทำอะไร:** ดูรายการคำขอปรับปรุงเวลาเข้า-ออกงานของพนักงาน (ผู้อนุมัติ/แอดมินใช้ตรวจสอบ) ไม่ส่ง `employeeId` = ทุกคน\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจ role ต้องเป็นผู้อนุมัติหรือแอดมิน (Boss, SuperBoss, HR, Admin, Super Admin, CEO, Director ฯลฯ)\n' +
      '2. ถ้ามี `employeeId` กรองเฉพาะคนนั้น\n' +
      '3. เรียงใหม่สุดก่อน\n\n' +
      '**ข้อควรระวัง:** Employee ทั่วไปเรียกไม่ได้ (403) ใช้ `/attendance/corrections/my-requests` ดูของตัวเองแทน endpoint นี้ไม่กรองตามแผนกของผู้เรียก ถ้าต้องการเฉพาะที่ตัวเองตัดสินได้ ให้ใช้ `/approvals/pending`',
    query: [
      { name: 'employeeId', type: 'string', required: false, description: 'กรองเฉพาะคำขอของพนักงานคนนี้ (รหัสพนักงาน/อีเมล) ไม่ส่ง = ทุกคน', example: 'EMP-001' },
    ],
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, total: 1, corrections: [correctionListRow] } },
      401: E401,
      403: E403_APPROVER,
    },
  },

  'POST /attendance/corrections': {
    description:
      '**ทำอะไร:** พนักงานยื่นคำขอปรับปรุง (แก้ไข) เวลาเข้างาน/ออกงานของวันหนึ่ง เช่น ลืมกดเข้างาน หรือระบบขัดข้อง\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจวันที่ (`dateIso`) ต้องเป็น `YYYY-MM-DD` และไม่ใช่วันในอนาคต ถ้าไม่ส่งใช้วันนี้\n' +
      '2. ต้องระบุเวลาใหม่อย่างน้อย 1 อย่าง (`newCheckIn` หรือ `newCheckOut`) รูปแบบ `HH:MM`\n' +
      '3. ถ้าไม่ส่งเวลาเดิม (`oldCheckIn`/`oldCheckOut`) server ดึงจากบันทึกลงเวลาของวันนั้นให้ ผู้อนุมัติจะเห็นเวลาเดิมเทียบกับเวลาใหม่\n' +
      '4. กำหนดผู้อนุมัติ: ถ้าผู้ยื่นเป็น Employee และแผนกมี Boss = `รออนุมัติระดับ 1 (Boss)` ถ้าผู้ยื่นเป็น Boss / HR Admin / SuperBoss หรือแผนกไม่มี Boss = `รออนุมัติระดับ 2 (Superboss)`\n' +
      '5. แจ้งเตือนผู้อนุมัติ\n\n' +
      '**กฎสำคัญ:**\n' +
      '- **การอนุมัติครั้งเดียวจบ ไม่ส่งต่อ** (เลข "ระดับ 1/2" บอกเพียงว่าใครต้องตัดสิน)\n' +
      '- role `SuperBoss` ยื่นแล้ว **อนุมัติและแก้เวลาให้ทันที** ไม่ต้องรอใคร (บันทึก audit log) response จะมี `status: "อนุมัติแล้ว"` และข้อความต่างออกไป\n' +
      '- ใช้ตัวตนจาก token เท่านั้น\n\n' +
      '**ข้อควรระวัง:** คำขอที่อนุมัติแล้วจะแก้แถวลงเวลาให้ (สถานะกลายเป็น `ลงเวลาเข้า-ออกครบถ้วน`) แต่ยังไม่แจกแต้มเข้างาน ค่า `status` เป็นข้อความไทยที่ client ใช้ substring จับคู่ (`รออนุมัติ...`) ห้ามเปลี่ยนชื่อ',
    body: {
      description: 'ต้องมีอย่างน้อย `newCheckIn` หรือ `newCheckOut` อย่างใดอย่างหนึ่ง (ค่า `-` หรือว่าง ถือว่าไม่ได้ระบุ)',
      fields: [
        { name: 'dateIso', type: 'string', required: false, description: 'วันที่ที่ต้องการแก้ รูปแบบ YYYY-MM-DD ห้ามเป็นวันในอนาคต (ไม่ส่ง = วันนี้ตามเวลาไทย)', example: '2026-10-26' },
        { name: 'newCheckIn', type: 'string', required: false, description: 'เวลาเข้างานใหม่ รูปแบบ HH:MM (ต้องระบุอย่างน้อยหนึ่งใน newCheckIn / newCheckOut)', example: '08:00' },
        { name: 'newCheckOut', type: 'string', required: false, description: 'เวลาออกงานใหม่ รูปแบบ HH:MM', example: '17:00' },
        { name: 'oldCheckIn', type: 'string', required: false, description: 'เวลาเข้างานเดิม (ไม่ส่ง server ดึงจากบันทึกให้)', example: '10:30 น.' },
        { name: 'oldCheckOut', type: 'string', required: false, description: 'เวลาออกงานเดิม (ไม่ส่ง server ดึงจากบันทึกให้)', example: '-' },
        { name: 'reason', type: 'string', required: false, description: 'เหตุผล (ไม่ส่ง = "ขอปรับปรุงเวลาเข้า-ออกงาน")', example: 'ลืมกดเข้างานเพราะระบบขัดข้อง' },
      ],
      example: { dateIso: '2026-10-26', newCheckIn: '08:00', newCheckOut: '17:00', reason: 'ลืมกดเข้างานเพราะระบบขัดข้อง' },
    },
    responses: {
      201: {
        description: 'ยื่นคำขอสำเร็จ รอการอนุมัติ (ถ้าเป็น SuperBoss: `message` = "ปรับปรุงเวลาเรียบร้อยแล้ว (SuperBoss ไม่ต้องรออนุมัติ)", `correction.status` = "อนุมัติแล้ว", `approvalLevel` = 0)',
        example: { success: true, message: 'ยื่นคำขอปรับปรุงเวลาเรียบร้อยแล้ว รอการอนุมัติ', correction: correctionExample },
      },
      400: {
        description: 'ข้อมูลไม่ถูกต้อง มี 4 แบบ: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)", "ไม่สามารถขอปรับปรุงเวลาของวันที่ในอนาคตได้", "กรุณาระบุเวลาเข้างานหรือเวลาออกงานที่ต้องการแก้ไข", "รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)"',
        example: { success: false, message: 'ไม่สามารถขอปรับปรุงเวลาของวันที่ในอนาคตได้' },
      },
      401: E401,
      500: {
        description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ',
        example: { success: false, message: 'ไม่สามารถบันทึกคำขอปรับปรุงเวลาลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง' },
      },
    },
  },

  'GET /attendance/corrections/my-requests': {
    description:
      '**ทำอะไร:** ดูคำขอปรับปรุงเวลาที่ตัวเองเคยยื่น พร้อมสถานะ (รออนุมัติ / อนุมัติแล้ว / ไม่อนุมัติ)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. อ่าน id จาก token\n' +
      '2. ดึงเฉพาะคำขอของบัญชีนี้ เรียงใหม่สุดก่อน\n\n' +
      '**กฎสำคัญ:** ดูของคนอื่นไม่ได้ ถ้าไม่เคยยื่นจะได้ `total: 0` และ `corrections: []`\n\n' +
      '**ข้อควรระวัง:** `status` เป็นข้อความไทย (เช่น `รออนุมัติระดับ 1 (Boss)`, `อนุมัติแล้ว`, `ไม่อนุมัติ`) ส่วน `approver`/`remark` จะมีค่าเมื่อมีการตัดสินแล้วเท่านั้น (ก่อนหน้านั้นเป็น null)',
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, total: 1, corrections: [correctionListRow] } },
      401: E401,
    },
  },

  // ===================== UPLOADS (leave attachments) =====================
  'POST /uploads/leave-attachment': {
    description:
      '**ทำอะไร:** อัปโหลดไฟล์แนบใบลา (เช่น ใบรับรองแพทย์) แล้วได้ `url` กลับมาใช้แนบตอนยื่นใบลา (`attachmentUrl` ของ `POST /leaves`) ไฟล์ส่งเป็น base64 ใน JSON\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจ `mimeType` ว่าอยู่ในรายการที่รองรับ: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)\n' +
      '2. แปลง base64 เป็นไฟล์ (ตัดส่วนหัว `data:...;base64,` ออกให้ถ้ามี) ตรวจว่าไม่ว่าง และไม่เกิน 5 MB\n' +
      '3. **ตรวจเนื้อหาไฟล์จริง** (ลายเซ็นไฟล์/magic bytes) ว่าตรงกับ `mimeType` กันการเอาสคริปต์มาตั้งชื่อเป็นรูป\n' +
      '4. ทำความสะอาดชื่อไฟล์ (ตัดอักขระต้องห้าม ยาวไม่เกิน 120 ตัว เติมนามสกุลถ้าไม่มี) แล้วเก็บไฟล์ในฐานข้อมูลผูกกับเจ้าของ\n\n' +
      '**กฎสำคัญ:**\n' +
      '- ขนาดไฟล์ไม่เกิน 5 MB\n' +
      '- ไฟล์เป็นของผู้อัปโหลด (จาก token) ตอนยื่นใบลา server จะรับเฉพาะไฟล์ของตัวเองเท่านั้น\n\n' +
      '**ข้อควรระวัง:** body JSON ทั้งก้อนต้องไม่เกิน 10 MB (ข้อจำกัดของ server) ก่อนถึงขั้นตรวจไฟล์ ถ้าเกินจะถูกปฏิเสธก่อน (ยังไม่ได้ยืนยันรหัสสถานะที่ตอบกลับ) `url` ที่ได้เป็น path ภายใน (`/uploads/leave/<id>`) ใช้เปิดดูต้องขอลิงก์ชั่วคราวผ่าน `GET /uploads/leave/:id/link`',
    body: {
      description: 'ส่งไฟล์เป็น base64 (ไม่ใช่ multipart/form-data)',
      fields: [
        { name: 'fileName', type: 'string', required: false, description: 'ชื่อไฟล์ (ไม่ส่ง = "attachment") ระบบล้างอักขระต้องห้ามและตัดให้ไม่เกิน 120 ตัว', example: 'ใบรับรองแพทย์.pdf' },
        { name: 'mimeType', type: 'string', required: true, description: 'ชนิดไฟล์ ต้องเป็นหนึ่งในรายการที่รองรับ', example: 'application/pdf', enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
        { name: 'dataBase64', type: 'string', required: true, description: 'เนื้อไฟล์เข้ารหัส base64 (มีหรือไม่มีคำนำหน้า data:...;base64, ก็ได้) ต้องไม่ว่างและไม่เกิน 5 MB หลังถอดรหัส', example: 'JVBERi0xLjQKJXRlc3QK' },
      ],
      example: { fileName: 'medical-certificate.pdf', mimeType: 'application/pdf', dataBase64: 'JVBERi0xLjQKJXRlc3QK' },
    },
    responses: {
      201: {
        description: 'อัปโหลดสำเร็จ นำ `attachment.url` ไปใส่ `attachmentUrl` ตอนยื่นใบลา (`size` เป็นไบต์)',
        example: {
          success: true,
          message: 'อัปโหลดไฟล์เรียบร้อยแล้ว',
          attachment: { id: 'att-mh3k9x1a2b3c4d5e', fileName: 'medical-certificate.pdf', mimeType: 'application/pdf', size: 15, url: '/uploads/leave/att-mh3k9x1a2b3c4d5e' },
        },
      },
      400: {
        description: 'ไฟล์ไม่ผ่านการตรวจ ข้อความที่เป็นไปได้: "รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP), PDF และเอกสาร Word เท่านั้น" (mimeType ไม่รองรับ/ไม่ส่ง), "ไม่พบข้อมูลไฟล์" (ไม่มี dataBase64), "ไฟล์ว่างเปล่า", "ไฟล์ใหญ่เกิน 5 MB กรุณาเลือกไฟล์ที่เล็กลง", "เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ที่ระบุ"',
        example: { success: false, message: 'เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ที่ระบุ' },
      },
      401: E401,
      500: {
        description: 'บันทึกไฟล์ลงฐานข้อมูลไม่สำเร็จ',
        example: { success: false, message: 'ไม่สามารถบันทึกไฟล์แนบลงฐานข้อมูลได้' },
      },
    },
  },

  'GET /uploads/leave/:id/link': {
    description:
      '**ทำอะไร:** ขอลิงก์ชั่วคราว (อายุ 5 นาที) สำหรับเปิดดูไฟล์แนบใบลาในเบราว์เซอร์/โปรแกรมดูไฟล์ของมือถือ\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. หาไฟล์ตาม `id` ไม่พบ ตอบ 404\n' +
      '2. ตรวจสิทธิ์: ต้องเป็นเจ้าของไฟล์ หรือ role ที่อนุมัติใบลาได้ (Boss, SuperBoss, HR, Admin ฯลฯ) ไม่เช่นนั้น 403\n' +
      '3. ออก token สั้น (5 นาที) ที่ผูกกับไฟล์นี้ไฟล์เดียว แล้วประกอบเป็น `url` ชี้ไปที่ `GET /uploads/leave/:id/file?ft=<token>`\n\n' +
      '**กฎสำคัญ:**\n' +
      '- เปิดไฟล์ได้เฉพาะเจ้าของและผู้อนุมัติ\n' +
      '- token ของไฟล์หนึ่งใช้เปิดไฟล์อื่นไม่ได้ และหมดอายุใน 5 นาที\n\n' +
      '**ข้อควรระวัง:** `url` เป็น URL เต็ม (รวม host) ที่ฝัง token ไว้ ห้ามแชร์หรือเก็บถาวร ให้ขอใหม่ทุกครั้งที่จะเปิดดู',
    pathParams: { id: { description: 'รหัสไฟล์แนบ ได้จาก `attachment.id` ตอนอัปโหลด (ขึ้นต้นด้วย `att-`)', example: 'att-mh3k9x1a2b3c4d5e' } },
    responses: {
      200: {
        description: 'สำเร็จ ใช้ `url` เปิดไฟล์ภายใน 5 นาที',
        example: {
          success: true,
          url: 'http://localhost:5000/api/uploads/leave/att-mh3k9x1a2b3c4d5e/file?ft=<token-อายุ-5-นาที>',
          fileName: 'medical-certificate.pdf',
          mimeType: 'application/pdf',
        },
      },
      401: E401,
      403: { description: 'ไม่ใช่เจ้าของไฟล์ และไม่ใช่ผู้อนุมัติ', example: { success: false, message: 'คุณไม่มีสิทธิ์เปิดไฟล์แนบนี้' } },
      404: { description: 'ไม่พบไฟล์แนบตามรหัสนี้', example: { success: false, message: 'ไม่พบไฟล์แนบ' } },
    },
  },

  'GET /uploads/leave/:id/file': {
    description:
      '**ทำอะไร:** ดาวน์โหลด/เปิดดูไฟล์แนบใบลาจริง ใช้กับลิงก์ที่ได้จาก `GET /uploads/leave/:id/link` เท่านั้น (ไม่ต้องส่ง header Authorization เพราะเปิดจากเบราว์เซอร์ตรงๆ)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจ token ใน query `ft`: ต้องถูกต้อง ยังไม่หมดอายุ เป็น token ชนิดไฟล์แนบ และผูกกับ `id` เดียวกับใน path ไม่เช่นนั้น 401\n' +
      '2. หาไฟล์ ไม่พบ ตอบ 404\n' +
      '3. ส่งเนื้อไฟล์กลับ (ไม่ใช่ JSON) โดยตั้ง `Content-Type` ตามชนิดไฟล์ และ `Content-Disposition: inline`\n\n' +
      '**กฎสำคัญ:**\n' +
      '- ความปลอดภัยอยู่ที่ token `ft` อายุ 5 นาที ที่ผูกกับไฟล์นี้ไฟล์เดียว\n' +
      '- ส่ง header `X-Content-Type-Options: nosniff` และ `Cache-Control: private, max-age=60`\n\n' +
      '**ข้อควรระวัง:** response สำเร็จเป็นไฟล์ไบนารี (รูป/PDF/Word) ไม่ใช่ JSON ส่วน error เป็น JSON ปกติ',
    pathParams: { id: { description: 'รหัสไฟล์แนบ (ต้องตรงกับรหัสที่ผูกอยู่ใน token ft)', example: 'att-mh3k9x1a2b3c4d5e' } },
    query: [
      { name: 'ft', type: 'string', required: true, description: 'token ชั่วคราวที่ได้จาก `GET /uploads/leave/:id/link` (ส่งมาในลิงก์อยู่แล้ว)', example: '<token-อายุ-5-นาที>' },
    ],
    responses: {
      200: { description: 'สำเร็จ ได้เนื้อไฟล์ตามชนิดจริง (เช่น `application/pdf`) ไม่ใช่ JSON', example: '(binary file content)' },
      401: {
        description: 'ไม่มี token `ft` / token ไม่ถูกต้อง / หมดอายุ / token เป็นของไฟล์อื่น',
        example: { success: false, message: 'ลิงก์เปิดไฟล์หมดอายุหรือไม่ถูกต้อง กรุณาเปิดจากแอปอีกครั้ง' },
      },
      404: { description: 'token ถูกต้องแต่ไม่พบไฟล์ในระบบ', example: { success: false, message: 'ไม่พบไฟล์แนบ' } },
    },
  },

  // ===================== LEAVES =====================
  'GET /leaves/balances': {
    description:
      '**ทำอะไร:** ดูสิทธิ์วันลาคงเหลือของตัวเองในแต่ละประเภทการลา (โควตา / ใช้ไปแล้ว / คงเหลือ)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ดึงนโยบายการลาที่ `Active` และเข้าเงื่อนไขเพศของพนักงาน (นโยบายเฉพาะหญิง/ชาย แสดงเฉพาะเพศที่ตรง)\n' +
      '2. ดึงใบลาของพนักงานที่ **เริ่มลาในปีปฏิทินปัจจุบัน** (เวลาไทย) ที่ไม่ใช่ `ไม่อนุมัติ` / `ยกเลิก`\n' +
      '3. คำนวณ `used` = ผลรวม `totalDays` ของใบลาที่ตรงกับนโยบายนั้น และ `remaining` = โควตา - used (ต่ำสุด 0)\n\n' +
      '**กฎสำคัญ:**\n' +
      '- โควตานับต่อปีปฏิทิน ใบลาปีก่อนไม่กินโควตาปีนี้\n' +
      '- ใบลาที่ยัง **รออนุมัติ** ถูกนับเป็นวันที่ใช้ไปแล้วด้วย (กันยื่นเกินสิทธิ์)\n' +
      '- ค่า `color` / `icon` ใช้แสดงผลในแอปเท่านั้น\n\n' +
      '**ข้อควรระวัง:** การจับคู่ใบลากับนโยบายใช้ชื่อประเภท/`categoryKey` แบบยืดหยุ่น (ตรงชื่อ หรือมีคำนั้นอยู่)',
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          balances: [
            { id: 'annual', policyId: 'LP-01', label: 'ลาพักร้อน', fullName: 'ลาพักร้อน (Annual Leave)', categoryKey: 'annual', total: 10, used: 3, remaining: 7, applicableGender: 'all', color: '#F5A623', icon: 'umbrella-outline' },
            { id: 'sick', policyId: 'LP-02', label: 'ลาป่วย', fullName: 'ลาป่วย (Sick Leave)', categoryKey: 'sick', total: 30, used: 0, remaining: 30, applicableGender: 'all', color: '#F5A623', icon: 'medical-outline' },
          ],
        },
      },
      401: E401,
    },
  },

  'POST /leaves': {
    description:
      '**ทำอะไร:** พนักงานยื่นใบลา ระบบตรวจกฎนโยบายการลาแล้วส่งไปยังผู้อนุมัติ\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจฟิลด์บังคับ (`leaveType`, `startDate`, `endDate`, `reason`) และรูปแบบวันที่ `YYYY-MM-DD` และวันสิ้นสุดต้องไม่ก่อนวันเริ่ม\n' +
      '2. คำนวณจำนวนวัน: ถ้าไม่ส่ง `totalDays` ใช้จำนวนวันตามช่วงวันที่ (นับรวมวันแรกและวันสุดท้าย) ถ้าส่งมาต้องมากกว่า 0, ไม่เกินช่วงวันที่เลือก และเป็นจำนวนเต็มหรือครึ่งวัน (0.5)\n' +
      '3. ถ้าส่ง `attachmentUrl` ต้องเป็นไฟล์ที่ตัวเองอัปโหลดผ่าน `POST /uploads/leave-attachment` เท่านั้น\n' +
      '4. หานโยบายการลาที่ตรงกับ `leaveType` แล้วบังคับกฎที่ HR ตั้ง: เพศที่ใช้ได้, ต้องแนบเอกสาร (Require Attachment), โควตาคงเหลือ (เกิน/ใช้ครบไม่ได้)\n' +
      '5. กำหนดผู้อนุมัติและสถานะเริ่มต้น แล้วแจ้งเตือนผู้อนุมัติ\n\n' +
      '**กฎสำคัญ:**\n' +
      '- ยื่นในนามเจ้าของ token เท่านั้น (`employeeId` ใน body ถูกเมิน)\n' +
      '- สถานะเริ่มต้น: Employee ที่แผนกมี Boss = `รออนุมัติระดับ 1 (Boss)`; ใบลาของ Boss / HR Admin / SuperBoss และของพนักงานในแผนกที่ไม่มี Boss = `รออนุมัติระดับ 2 (Superboss)`\n' +
      '- **การอนุมัติครั้งเดียวจบ ไม่ส่งต่อ** ใบลาของ SuperBoss ก็ยังต้องมีผู้อนุมัติ\n' +
      '- กฎแจ้งล่วงหน้า / ลาย้อนหลัง / ลาติดต่อกันสูงสุด ไม่มีแล้ว (ถูกตัดออก)\n\n' +
      '**ข้อควรระวัง:** ถ้า `leaveType` ไม่ตรงกับนโยบายใดเลย กฎโควตา/เพศ/เอกสารจะไม่ถูกตรวจ จึงควรส่งชื่อประเภทตามที่ได้จาก `GET /leave-policies` (`typeName` หรือ `categoryKey`) ค่า `status` เป็นข้อความไทยที่ client จับคู่ด้วย substring ห้ามเปลี่ยนชื่อ',
    body: {
      description: 'วันที่ทุกช่องใช้รูปแบบ YYYY-MM-DD (เวลาไทย)',
      fields: [
        { name: 'leaveType', type: 'string', required: true, description: 'ประเภทการลา ให้ตรงกับ `typeName` หรือ `categoryKey` ของนโยบายการลา', example: 'ลากิจ (Personal Leave)' },
        { name: 'startDate', type: 'string', required: true, description: 'วันเริ่มลา YYYY-MM-DD', example: '2026-11-03' },
        { name: 'endDate', type: 'string', required: true, description: 'วันสิ้นสุดการลา YYYY-MM-DD ต้องไม่ก่อน startDate', example: '2026-11-04' },
        { name: 'reason', type: 'string', required: true, description: 'เหตุผลการลา (ห้ามว่าง)', example: 'ไปทำธุระที่ธนาคาร' },
        { name: 'totalDays', type: 'number', required: false, description: 'จำนวนวันลา มากกว่า 0 ไม่เกินช่วงวันที่เลือก และเป็นจำนวนเต็มหรือครึ่งวัน เช่น 0.5, 1, 1.5 (ไม่ส่ง = นับตามช่วงวันที่)', example: 2 },
        { name: 'attachmentUrl', type: 'string', required: false, description: 'ลิงก์ไฟล์แนบ ได้จาก `attachment.url` ของ `POST /uploads/leave-attachment` ต้องเป็นไฟล์ของตัวเอง (บังคับเมื่อนโยบายตั้ง Require Attachment)', example: '/uploads/leave/att-mh3k9x1a2b3c4d5e' },
      ],
      example: { leaveType: 'ลากิจ (Personal Leave)', startDate: '2026-11-03', endDate: '2026-11-04', totalDays: 2, reason: 'ไปทำธุระที่ธนาคาร' },
    },
    responses: {
      201: {
        description: 'ยื่นใบลาสำเร็จ รอการอนุมัติ (`request.status` บอกว่ารอใคร)',
        example: { success: true, message: 'ยื่นใบลาเรียบร้อยแล้ว รอการอนุมัติจากหัวหน้างาน', request: { ...leaveRequestExample, endDate: '2026-11-04', totalDays: 2 } },
      },
      400: {
        description: 'ข้อมูลหรือกฎนโยบายไม่ผ่าน ข้อความที่เป็นไปได้: "กรุณากรอกข้อมูลประเภทการลา วันที่ และเหตุผลให้ครบถ้วน", "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)", "วันสิ้นสุดการลาต้องไม่ก่อนวันเริ่มลา", "จำนวนวันลาไม่ถูกต้อง (ต้องมากกว่า 0 และไม่เกิน N วันตามช่วงวันที่เลือก)", "ไฟล์แนบไม่ถูกต้อง กรุณาอัปโหลดไฟล์ใหม่อีกครั้ง", "ประเภทการลา "X" ต้องแนบเอกสารประกอบการลา", "ไม่อนุญาตให้ยื่นลาประเภท "X" เนื่องจากสิทธิ์การลานี้เปิดให้เฉพาะพนักงานเพศหญิง/ชายเท่านั้น", "คุณใช้สิทธิ์ "X" ครบตามกำหนดแล้ว (เหลือ 0 วัน) ไม่สามารถยื่นลาเพิ่มได้", "จำนวนวันลาที่ระบุ (N วัน) เกินสิทธิ์คงเหลือของคุณ (คงเหลือ M วัน)"',
        example: { success: false, message: 'จำนวนวันลาที่ระบุ (3 วัน) เกินสิทธิ์คงเหลือของคุณ (คงเหลือ 2 วัน)' },
      },
      401: E401,
      500: {
        description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ',
        example: { success: false, message: 'ไม่สามารถบันทึกใบลาลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง' },
      },
    },
  },

  'GET /leaves/my-requests': {
    description:
      '**ทำอะไร:** ดูรายการใบลาที่ตัวเองเคยยื่นทั้งหมด พร้อมสถานะและผู้อนุมัติ เรียงใหม่สุดก่อน\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. อ่าน id จาก token\n' +
      '2. ดึงเฉพาะใบลาของบัญชีนี้\n\n' +
      '**กฎสำคัญ:** ดูของคนอื่นไม่ได้ ไม่มีการแบ่งหน้า\n\n' +
      '**ข้อควรระวัง:** `status` เป็นข้อความไทย: `รออนุมัติระดับ 1 (Boss)`, `รออนุมัติระดับ 2 (Superboss)`, `อนุมัติแล้ว`, `ไม่อนุมัติ`, `ยกเลิก` ฝั่ง client ถือว่าสถานะที่ขึ้นต้นด้วย `รออนุมัติ` คือยังรออยู่ `approver` / `remark` จะมีค่าเมื่อมีการตัดสินแล้ว',
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          total: 1,
          requests: [
            {
              id: 'leave-1793089320000-ab12',
              employeeId: 'EMP-001',
              employeeName: 'สมชาย ใจดี',
              leaveType: 'ลากิจ (Personal Leave)',
              startDate: '2026-11-03',
              endDate: '2026-11-03',
              totalDays: 1,
              reason: 'ไปทำธุระที่ธนาคาร',
              attachmentUrl: null,
              status: 'อนุมัติแล้ว',
              approver: 'วิภา หัวหน้างาน',
              remark: 'อนุมัติสมบูรณ์',
              createdAt: '2026-10-27T02:00:00.000Z',
            },
          ],
        },
      },
      401: E401,
    },
  },

  'GET /leaves/:id': {
    description:
      '**ทำอะไร:** ดูรายละเอียดใบลา 1 ใบ\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. หาใบลาตาม `id` ไม่พบ ตอบ 404\n' +
      '2. ตรวจสิทธิ์: ต้องเป็นเจ้าของใบลา หรือ role ผู้อนุมัติ/แอดมิน (Boss, SuperBoss, HR, Admin ฯลฯ)\n\n' +
      '**กฎสำคัญ:** Employee ทั่วไปดูใบลาของคนอื่นไม่ได้ (403) ส่วนผู้อนุมัติดูได้\n\n' +
      '**ข้อควรระวัง:** ถ้าต้องการไฟล์แนบ ให้ใช้ `attachmentUrl` ในใบลาไปขอลิงก์ที่ `GET /uploads/leave/:id/link` (id คือส่วนท้ายของ attachmentUrl)',
    pathParams: { id: { description: 'รหัสใบลา เช่น leave-1793089320000-ab12 (ได้จาก `request.id` ตอนยื่น)', example: 'leave-1793089320000-ab12' } },
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, request: leaveRequestExample } },
      401: E401,
      403: { description: 'ไม่ใช่เจ้าของใบลา และไม่ใช่ผู้อนุมัติ', example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงใบลาของพนักงานคนอื่น (Forbidden)' } },
      404: { description: 'ไม่พบใบลาตามรหัสนี้', example: { success: false, message: 'ไม่พบรายการใบลา' } },
    },
  },

  'DELETE /leaves/:id/cancel': {
    description:
      '**ทำอะไร:** เจ้าของใบลายกเลิกใบลาของตัวเอง (เปลี่ยนสถานะเป็น `ยกเลิก` ไม่ได้ลบข้อมูลทิ้ง)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. หาใบลา ไม่พบ ตอบ 404\n' +
      '2. ตรวจว่าเป็นเจ้าของใบลาเท่านั้น (ผู้อนุมัติ/แอดมินก็ยกเลิกแทนคนอื่นไม่ได้) ไม่ใช่ ตอบ 403\n' +
      '3. ตรวจสถานะ: ถ้าเป็น `ไม่อนุมัติ` หรือ `ยกเลิก` อยู่แล้ว ตอบ 400\n' +
      '4. ถ้า `อนุมัติแล้ว` และวันเริ่มลาผ่านไปแล้ว (ก่อนวันนี้ เวลาไทย) ตอบ 400 ให้ติดต่อ HR\n' +
      '5. เปลี่ยนสถานะเป็น `ยกเลิก` และเก็บหมายเหตุ `ยกเลิกโดยผู้ยื่น`\n\n' +
      '**กฎสำคัญ:** ยกเลิกได้เมื่อใบลายังรออนุมัติ หรืออนุมัติแล้วแต่ยังไม่ถึงวันลา ใบที่ยกเลิกแล้วจะไม่ถูกนับในสิทธิ์ที่ใช้ไป (คืนโควตา)\n\n' +
      '**ข้อควรระวัง:** ฟิลด์ `request` ใน response อาจไม่มี (ไม่ถูกส่งมา) ในกรณีที่ใบลานั้นไม่อยู่ในหน่วยความจำของ server (เช่น หลัง restart) แต่สถานะในฐานข้อมูลถูกเปลี่ยนแล้ว',
    pathParams: { id: { description: 'รหัสใบลาที่ต้องการยกเลิก', example: 'leave-1793089320000-ab12' } },
    responses: {
      200: { description: 'ยกเลิกสำเร็จ', example: { success: true, message: 'ยกเลิกคำขอใบลาเรียบร้อยแล้ว', request: { ...leaveRequestExample, status: 'ยกเลิก', remark: 'ยกเลิกโดยผู้ยื่น' } } },
      400: {
        description: 'ยกเลิกไม่ได้ มี 2 แบบ: ใบลาเป็น `ไม่อนุมัติ`/`ยกเลิก` อยู่แล้ว (ตัวอย่างด้านล่าง) หรืออนุมัติแล้วและเริ่มลาไปแล้ว ("ไม่สามารถยกเลิกใบลาที่อนุมัติแล้วและเริ่มลาไปแล้วได้ กรุณาติดต่อ HR")',
        example: { success: false, message: 'ไม่สามารถยกเลิกได้ เนื่องจากใบลานี้อยู่ในสถานะ "ยกเลิก" แล้ว' },
      },
      401: E401,
      403: { description: 'ไม่ใช่เจ้าของใบลา', example: { success: false, message: 'คุณไม่มีสิทธิ์ยกเลิกใบลาของพนักงานคนอื่น (Forbidden)' } },
      404: { description: 'ไม่พบใบลาตามรหัสนี้', example: { success: false, message: 'ไม่พบรายการใบลา' } },
    },
  },

  // ===================== LEAVE POLICIES =====================
  'GET /leave-policies': {
    description:
      '**ทำอะไร:** ดูรายการนโยบายการลาทั้งหมดที่ HR ตั้งไว้ (ประเภทการลา โควตาต่อปี เพศที่ใช้ได้ ต้องแนบเอกสารหรือไม่) ผู้ใช้ที่ล็อกอินทุกคนเรียกได้ (แอปใช้แสดงประเภทการลา เว็บแอดมินใช้จัดการ)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. อ่านนโยบายจากฐานข้อมูล เรียงตามรหัส (ถ้าอ่านฐานข้อมูลไม่ได้ จะตอบ error แทนการใช้ข้อมูลสำรองที่อาจไม่ตรงกัน)\n\n' +
      '**กฎสำคัญ:**\n' +
      '- ส่งทุกสถานะ (`Active` และ `Inactive`) ไม่กรอง ถ้าต้องการสิทธิ์คงเหลือที่ใช้ได้จริงให้ดู `GET /leaves/balances`\n' +
      '- กฎนโยบายที่ server บังคับตอนยื่นใบลา: โควตา, เพศที่ใช้ได้, ต้องแนบเอกสาร (กฎแจ้งล่วงหน้า/ลาย้อนหลัง/ลาติดต่อกัน ถูกตัดออกแล้ว)\n\n' +
      '**ข้อควรระวัง:** `applicableGender` มีค่าที่ใช้ทั่วไปคือ `all`, `male`, `female`',
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, total: 1, policies: [policyExample] } },
      401: E401,
      500: { description: 'อ่านฐานข้อมูลไม่ได้', example: { success: false, message: 'ไม่สามารถโหลดนโยบายการลาจากฐานข้อมูลได้' } },
    },
  },

  'POST /leave-policies': {
    description:
      '**ทำอะไร:** แอดมินสร้างนโยบายการลาใหม่ (ประเภทการลาใหม่ พร้อมโควตาและกฎ)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจสิทธิ์: ต้องเป็นแอดมิน\n' +
      '2. ตรวจ `typeName` ต้องมี\n' +
      '3. ถ้ากรอก `id` เอง ตรวจรูปแบบ (ตัวอักษรอังกฤษ ตัวเลข `-` `_` ไม่เกิน 30 ตัว) และห้ามซ้ำกับที่มีอยู่ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) ถ้าไม่กรอก ระบบสร้างรหัสให้\n' +
      '4. ใส่ค่าเริ่มต้นให้ช่องที่ไม่ส่ง แล้วบันทึก\n\n' +
      '**กฎสำคัญ:**\n' +
      '- ค่าเริ่มต้น: `defaultQuota` = 10, `isPaid` = true, `applicableGender` = `all`, `requireAttachment` = false, `status` = `Active`, `categoryKey` = รหัสนโยบาย\n' +
      '- โควตา/เพศ/ต้องแนบเอกสาร ถูกบังคับที่ server ตอนพนักงานยื่นใบลา\n\n' +
      '**ข้อควรระวัง:** `status` และ `applicableGender` ไม่ถูกตรวจค่าที่อนุญาต ควรใช้ `Active`/`Inactive` และ `all`/`male`/`female` ตามที่ระบบใช้ ถ้าตั้ง `status` เป็นอย่างอื่น นโยบายจะไม่แสดงในสิทธิ์คงเหลือ (นับเฉพาะ `Active`)',
    body: {
      fields: [
        { name: 'typeName', type: 'string', required: true, description: 'ชื่อประเภทการลา (ห้ามว่าง) พนักงานเลือกชื่อนี้ตอนยื่นใบลา', example: 'ลากิจ (Personal Leave)' },
        { name: 'id', type: 'string', required: false, description: 'รหัสนโยบาย (Policy ID) กรอกเองได้: A-Z a-z 0-9 - _ ไม่เกิน 30 ตัว ห้ามซ้ำ (ไม่สนตัวพิมพ์) ไม่กรอก = ระบบสร้างให้', example: 'LP-07' },
        { name: 'categoryKey', type: 'string', required: false, description: 'รหัสหมวดสำหรับจับคู่ใบลากับโควตา เช่น annual, sick, personal (ไม่ส่ง = ใช้รหัสนโยบาย)', example: 'personal' },
        { name: 'defaultQuota', type: 'integer', required: false, description: 'โควตาวันลาต่อปี (จำนวนเต็ม) ไม่ส่ง = 10', example: 6 },
        { name: 'isPaid', type: 'boolean', required: false, description: 'ลาแบบได้รับค่าจ้างหรือไม่ ไม่ส่ง = true', example: true },
        { name: 'applicableGender', type: 'string', required: false, description: 'เพศที่ใช้สิทธิ์ได้ ไม่ส่ง = all', example: 'all', enum: ['all', 'male', 'female'] },
        { name: 'requireAttachment', type: 'boolean', required: false, description: 'ต้องแนบเอกสารตอนยื่นใบลาหรือไม่ ไม่ส่ง = false', example: false },
        { name: 'description', type: 'string', required: false, description: 'คำอธิบายนโยบาย', example: 'ลากิจส่วนตัว' },
        { name: 'status', type: 'string', required: false, description: 'สถานะนโยบาย ไม่ส่ง = Active (Inactive = ปิดใช้)', example: 'Active', enum: ['Active', 'Inactive'] },
      ],
      example: { id: 'LP-07', typeName: 'ลากิจ (Personal Leave)', categoryKey: 'personal', defaultQuota: 6, isPaid: true, applicableGender: 'all', requireAttachment: false, description: 'ลากิจส่วนตัว', status: 'Active' },
    },
    responses: {
      201: { description: 'สร้างสำเร็จ', example: { success: true, message: 'สร้างนโยบายการลาใหม่สำเร็จ', policy: { ...policyExample, id: 'LP-07', typeName: 'ลากิจ (Personal Leave)', categoryKey: 'personal', defaultQuota: 6, description: 'ลากิจส่วนตัว' } } },
      400: {
        description: 'ไม่ส่ง typeName ("กรุณาระบุชื่อประเภทการลา (typeName)") หรือ Policy ID รูปแบบไม่ถูกต้อง (ตัวอย่างด้านล่าง)',
        example: { success: false, message: 'Policy ID ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข - และ _ (ไม่เกิน 30 ตัว)' },
      },
      401: E401,
      403: E403_ADMIN,
      409: { description: 'Policy ID ซ้ำกับที่มีอยู่แล้ว (ไม่สนตัวพิมพ์)', example: { success: false, message: 'Policy ID "LP-07" มีอยู่แล้ว กรุณาใช้รหัสอื่น' } },
      500: { description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ', example: { success: false, message: 'ไม่สามารถบันทึกนโยบายการลาลงฐานข้อมูลได้' } },
    },
  },

  'PUT /leave-policies/:id': {
    description:
      '**ทำอะไร:** แอดมินแก้ไขนโยบายการลา ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยนได้ (เช่น ส่งแค่ `{ "status": "Inactive" }` เพื่อปิดใช้)\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจสิทธิ์: ต้องเป็นแอดมิน\n' +
      '2. หานโยบายตาม `id` ไม่พบ ตอบ 404\n' +
      '3. นำค่าที่ส่งมาไปรวมกับค่าปัจจุบันที่เก็บอยู่ (ฟิลด์ที่ไม่ส่งไม่ถูกลบ) แล้วบันทึก\n\n' +
      '**กฎสำคัญ:**\n' +
      '- เปลี่ยนรหัสนโยบายไม่ได้ (`id` ใน body ถูกเมิน ใช้ตาม path)\n' +
      '- `defaultQuota` ที่ไม่ใช่ตัวเลขจะคงค่าเดิม\n' +
      '- การเปลี่ยนโควตา/เพศ/ต้องแนบเอกสาร มีผลกับใบลาที่ยื่นใหม่ตั้งแต่ตอนนั้น\n\n' +
      '**ข้อควรระวัง:** ไม่มีการตรวจค่าที่อนุญาตของ `status` / `applicableGender`',
    pathParams: { id: { description: 'รหัสนโยบายการลา (Policy ID)', example: 'LP-07' } },
    body: {
      description: 'ส่งเฉพาะฟิลด์ที่ต้องการแก้ ฟิลด์ที่ไม่ส่งคงค่าเดิม',
      fields: [
        { name: 'typeName', type: 'string', required: false, description: 'ชื่อประเภทการลา', example: 'ลากิจ (Personal Leave)' },
        { name: 'categoryKey', type: 'string', required: false, description: 'รหัสหมวดสำหรับจับคู่โควตา', example: 'personal' },
        { name: 'defaultQuota', type: 'integer', required: false, description: 'โควตาวันลาต่อปี (จำนวนเต็ม)', example: 7 },
        { name: 'isPaid', type: 'boolean', required: false, description: 'ลาแบบได้รับค่าจ้างหรือไม่', example: true },
        { name: 'applicableGender', type: 'string', required: false, description: 'เพศที่ใช้สิทธิ์ได้', example: 'all', enum: ['all', 'male', 'female'] },
        { name: 'requireAttachment', type: 'boolean', required: false, description: 'ต้องแนบเอกสารหรือไม่', example: true },
        { name: 'description', type: 'string', required: false, description: 'คำอธิบายนโยบาย', example: 'ลากิจส่วนตัว (แนบเอกสาร)' },
        { name: 'status', type: 'string', required: false, description: 'สถานะนโยบาย', example: 'Active', enum: ['Active', 'Inactive'] },
      ],
      example: { defaultQuota: 7, requireAttachment: true },
    },
    responses: {
      200: { description: 'แก้ไขสำเร็จ (`policy` คือค่าล่าสุดหลังรวมแล้ว)', example: { success: true, message: 'บันทึกการตั้งค่านโยบายการลาสำเร็จ', policy: { ...policyExample, id: 'LP-07', defaultQuota: 7, requireAttachment: true } } },
      401: E401,
      403: E403_ADMIN,
      404: { description: 'ไม่พบนโยบายตามรหัสนี้', example: { success: false, message: 'ไม่พบนโยบายการลาที่ต้องการแก้ไข' } },
      500: { description: 'บันทึกลงฐานข้อมูลไม่สำเร็จ', example: { success: false, message: 'ไม่สามารถบันทึกนโยบายการลาลงฐานข้อมูลได้' } },
    },
  },

  'DELETE /leave-policies/:id': {
    description:
      '**ทำอะไร:** แอดมินลบนโยบายการลา\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจสิทธิ์: ต้องเป็นแอดมิน\n' +
      '2. ลบนโยบายตามรหัส\n\n' +
      '**กฎสำคัญ:** ลบแล้วนโยบายนั้นหายจากรายการและจากสิทธิ์วันลาของพนักงาน ใบลาเดิมที่เคยยื่นไม่ถูกลบ\n\n' +
      '**ข้อควรระวัง:** ถ้ารหัสที่ส่งมาไม่มีอยู่จริง ก็ยังตอบ 200 (ไม่มี 404) หากต้องการเก็บประวัติแต่ไม่ให้ใช้ ให้แก้ `status` เป็น `Inactive` ด้วย `PUT` แทนการลบ',
    pathParams: { id: { description: 'รหัสนโยบายการลา (Policy ID)', example: 'LP-07' } },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'ลบนโยบายการลาเรียบร้อยแล้ว' } },
      401: E401,
      403: E403_ADMIN,
      500: { description: 'ลบจากฐานข้อมูลไม่สำเร็จ', example: { success: false, message: 'ไม่สามารถลบนโยบายการลาออกจากฐานข้อมูลได้' } },
    },
  },

  // ===================== APPROVALS =====================
  'GET /approvals/pending': {
    description:
      '**ทำอะไร:** ผู้อนุมัติดูรายการคำขอ (ใบลา + คำขอปรับปรุงเวลา) ที่ยังรออนุมัติและตัวเองมีสิทธิ์ตัดสิน\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจ role ต้องเป็นผู้อนุมัติหรือแอดมิน\n' +
      '2. ดึงคำขอทั้งหมด เก็บเฉพาะสถานะที่ขึ้นต้นด้วย `รออนุมัติ`\n' +
      '3. กรองตามผู้เรียก (ดูกฎด้านล่าง) แล้วรวมใบลาและคำขอแก้เวลาไว้ในรายการเดียว แยกชนิดด้วย `requestType`\n\n' +
      '**กฎสำคัญ:**\n' +
      '- **Boss** เห็นเฉพาะคำขอของ **Employee ในแผนกเดียวกัน** ที่อยู่ระดับ 1 ไม่เห็นของตัวเอง ของ Boss คนอื่น ของแผนกอื่น และคำขอที่เป็นระดับ 2\n' +
      '- **SuperBoss / Super Admin / CEO / Director** เห็นคำขอที่รออนุมัติทั้งหมด (รวมของ Boss และของแผนกที่ไม่มี Boss)\n' +
      '- role อื่นที่เข้า endpoint ได้ แต่ไม่ใช่ Boss/Manager/HR Admin และไม่ใช่ SuperBoss ระดับสูง จะได้รายการว่าง\n' +
      '- ตัวตนของผู้เรียกมาจาก token เท่านั้น\n\n' +
      '**ข้อควรระวัง:** Employee เปิดหน้าอนุมัติไม่ได้ (403) ใช้ `requestType` (`leave` หรือ `time-correction`) และ `id` ของแต่ละแถวไปเรียก `PATCH /approvals/:requestType/:id`',
    responses: {
      200: {
        description: 'สำเร็จ (ตัวอย่างมี 1 ใบลา และ 1 คำขอแก้เวลา; `role` = role ของผู้ยื่นคำขอ)',
        example: {
          success: true,
          total: 2,
          approvals: [
            {
              id: 'leave-1793089320000-ab12',
              employeeId: 'EMP-001',
              employeeName: 'สมชาย ใจดี',
              employeeCode: 'EMP-001',
              department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
              requesterRole: 'Employee',
              role: 'Employee',
              leaveType: 'ลากิจ (Personal Leave)',
              startDate: '2026-11-03',
              endDate: '2026-11-03',
              totalDays: 1,
              reason: 'ไปทำธุระที่ธนาคาร',
              attachmentUrl: null,
              status: 'รออนุมัติระดับ 1 (Boss)',
              approver: null,
              remark: null,
              createdAt: '2026-10-27T02:00:00.000Z',
              requestType: 'leave',
              type: 'ยื่นลากิจ (Personal Leave) (1 วัน)',
              title: 'ยื่นลากิจ (Personal Leave) (1 วัน)',
              date: '2026-11-03',
              details: 'ไปทำธุระที่ธนาคาร',
            },
            {
              id: 'tc-1793089320000-q7w2',
              employeeId: 'EMP-002',
              employeeName: 'สมหญิง รักงาน',
              employeeCode: 'EMP-002',
              department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
              requesterRole: 'Employee',
              role: 'Employee',
              dateIso: '2026-10-26',
              oldCheckIn: '10:30 น.',
              newCheckIn: '08:00',
              oldCheckOut: '-',
              newCheckOut: '17:00',
              reason: 'ลืมกดเข้างานเพราะระบบขัดข้อง',
              status: 'รออนุมัติระดับ 1 (Boss)',
              approver: null,
              remark: null,
              createdAt: '2026-10-27T02:10:00.000Z',
              requestType: 'time-correction',
              type: 'ขอปรับปรุงเวลาเข้า-ออกงาน',
              title: 'ขอปรับปรุงเวลาเข้า-ออกงาน',
              date: '2026-10-26',
              details: 'ลืมกดเข้างานเพราะระบบขัดข้อง',
            },
          ],
        },
      },
      401: E401,
      403: E403_APPROVER,
    },
  },

  'GET /approvals/history': {
    description:
      '**ทำอะไร:** ดูประวัติคำขอที่ **บัญชีของตัวเองเป็นคนตัดสินใจ** (อนุมัติหรือไม่อนุมัติ) ทั้งใบลาและคำขอแก้เวลา\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. อ่านตัวตนผู้ดูจาก token (ไม่เชื่อ body/query)\n' +
      '2. ดึงใบลาและคำขอแก้เวลาที่ผู้ตัดสิน (`decided_by` / `level1_by`) คือบัญชีนี้ ที่ตัดสินแล้ว (โดยปกติคือสถานะ อนุมัติแล้ว / ไม่อนุมัติ)\n' +
      '3. เรียงใหม่สุดก่อน\n\n' +
      '**กฎสำคัญ:**\n' +
      '- **ประวัติแยกตามบัญชี** แต่ละคนเห็นเฉพาะที่ตัวเองตัดสิน (เช่น Boss ของแผนกอื่นจะได้รายการว่าง)\n' +
      '- ถ้าไม่อนุมัติ จะมี `rejectReason` (เหตุผลที่ผู้ตัดสินพิมพ์) ถ้าไม่ได้ระบุเหตุผล จะเป็น null\n' +
      '- Employee เปิดไม่ได้ (403)\n\n' +
      '**ข้อควรระวัง:** รูปแบบแถวต่างกันเล็กน้อยตาม `requestType`: ใบลา (`leave`) มี `leaveType`, `days`, `startDate`, `endDate`; คำขอแก้เวลา (`time-correction`) มี `dateIso`, `oldCheckIn`/`newCheckIn`, `oldCheckOut`/`newCheckOut` `actionTime` เป็นข้อความวันเวลาแบบไทยที่ server จัดรูปแบบให้',
    responses: {
      200: {
        description: 'สำเร็จ (ตัวอย่างมี 1 ใบลาที่อนุมัติ และ 1 คำขอแก้เวลาที่ไม่อนุมัติ)',
        example: {
          success: true,
          total: 2,
          history: [
            {
              id: 'leave-1793089320000-ab12',
              requestType: 'leave',
              employeeId: 'EMP-001',
              employeeName: 'สมชาย ใจดี',
              employeeCode: 'EMP-001',
              department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
              requesterRole: 'Employee',
              leaveType: 'ลากิจ (Personal Leave)',
              days: 1,
              startDate: '2026-11-03',
              endDate: '2026-11-03',
              date: '2026-11-03',
              reason: 'ไปทำธุระที่ธนาคาร',
              status: 'อนุมัติแล้ว',
              approverName: 'วิภา หัวหน้างาน',
              remark: 'อนุมัติสมบูรณ์',
              rejectReason: null,
              actionTime: '27/10/2569 09:15:00',
              createdAt: '2026-10-27T02:00:00.000Z',
            },
            {
              id: 'tc-1793089320000-q7w2',
              requestType: 'time-correction',
              employeeId: 'EMP-002',
              employeeName: 'สมหญิง รักงาน',
              employeeCode: 'EMP-002',
              department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
              requesterRole: 'Employee',
              date: '2026-10-26',
              dateIso: '2026-10-26',
              oldCheckIn: '10:30 น.',
              newCheckIn: '08:00',
              oldCheckOut: '-',
              newCheckOut: '17:00',
              reason: 'ลืมกดเข้างานเพราะระบบขัดข้อง',
              details: 'เข้า: 08:00 / ออก: 17:00',
              status: 'ไม่อนุมัติ',
              approverName: 'วิภา หัวหน้างาน',
              remark: 'ไม่มีหลักฐานยืนยัน',
              rejectReason: 'ไม่มีหลักฐานยืนยัน',
              actionTime: '27/10/2569 09:10:00',
              createdAt: '2026-10-27T02:10:00.000Z',
            },
          ],
        },
      },
      401: E401,
      403: E403_APPROVER,
    },
  },

  'PATCH /approvals/:requestType/:id': {
    description:
      '**ทำอะไร:** ผู้อนุมัติตัดสินคำขอ 1 รายการ: อนุมัติ (`approved`) หรือไม่อนุมัติ (`rejected`) ใช้ได้ทั้งใบลาและคำขอปรับปรุงเวลา\n\n' +
      '**server ทำอย่างไร:**\n' +
      '1. ตรวจ role ต้องเป็นผู้อนุมัติหรือแอดมิน และตรวจ `action`\n' +
      '2. ตรวจ `requestType` ใน path ต้องเป็น `leave` หรือ `time-correction`\n' +
      '3. หาคำขอ (ไม่พบ ตอบ 404) และตรวจว่ายังรออนุมัติอยู่ (ถ้าตัดสินไปแล้ว ตอบ 409)\n' +
      '4. ตรวจสิทธิ์ผู้ตัดสินกับคำขอนี้ (ดูกฎด้านล่าง ไม่ผ่านตอบ 403)\n' +
      '5. อัปเดตสถานะแบบมีเงื่อนไข (เฉพาะตอนที่ยังรออนุมัติ) กัน 2 คนกดพร้อมกัน คนที่ช้ากว่าได้ 409 บันทึกผู้ตัดสิน (`decided_by`) และหมายเหตุ\n' +
      '6. ถ้าเป็นคำขอแก้เวลาที่ **อนุมัติ** จะนำเวลาใหม่ไปแก้แถวลงเวลาของวันนั้น (สถานะกลายเป็น `ลงเวลาเข้า-ออกครบถ้วน` คำนวณชั่วโมงใหม่ ถ้าวันนั้นไม่มีแถวลงเวลา ระบบสร้างให้) ถ้า **ไม่อนุมัติ** เวลาเดิมไม่ถูกแตะ\n' +
      '7. แจ้งเตือนผู้ยื่นคำขอ และบันทึก audit log (`APPROVE_REQUEST` / `REJECT_REQUEST`)\n\n' +
      '**กฎสำคัญ:**\n' +
      '- **การอนุมัติครั้งเดียวจบ ไม่ส่งต่อ** ผลเป็น `อนุมัติแล้ว` หรือ `ไม่อนุมัติ` ทันที\n' +
      '- **Boss** ตัดสินคำขอของ **Employee ในแผนกเดียวกัน** ได้โดยตรง\n' +
      '- Boss อนุมัติ/ปฏิเสธคำขอ **ของตัวเอง** ไม่ได้ (403) ของ **Boss ด้วยกัน** หรือ **แผนกอื่น** ไม่ได้ (403) และคำขอที่อยู่ระดับ 2 (`รออนุมัติระดับ 2 (Superboss)`) ต้องให้ SuperBoss เป็นคนตัดสิน (403)\n' +
      '- คำขอของ Boss และของพนักงานในแผนกที่ไม่มี Boss ให้ **SuperBoss / Super Admin / CEO / Director** ตัดสินขั้นสุดท้าย\n' +
      '- ตัวตนและ role ของผู้ตัดสินมาจาก token เท่านั้น (`approverName` ใน body ใช้เป็นชื่อสำรองสุดท้ายเท่านั้น)\n' +
      '- ตัดสินแล้วทำซ้ำไม่ได้ (409)\n\n' +
      '**ข้อควรระวัง:** ค่า `status` ที่ได้เป็นข้อความไทย (`อนุมัติแล้ว` / `ไม่อนุมัติ`) ฝั่ง client จับคู่ด้วยข้อความนี้ จึงห้ามเปลี่ยนชื่อ นอกจาก `time-correction` แล้วยังรับ `time_correction` (ขีดล่าง) ในการจับคู่ประเภทด้วย แต่ควรใช้แบบมีขีดกลาง',
    pathParams: {
      requestType: { description: 'ชนิดคำขอ: `leave` (ใบลา) หรือ `time-correction` (คำขอปรับปรุงเวลา) ดูจาก `requestType` ของรายการใน `/approvals/pending`', example: 'leave' },
      id: { description: 'รหัสคำขอ (id ของใบลาหรือคำขอแก้เวลา)', example: 'leave-1793089320000-ab12' },
    },
    body: {
      description: 'ต้องระบุ `action` เสมอ ส่วนเหตุผล (`remark`) แนะนำให้ใส่เมื่อไม่อนุมัติ (ผู้ยื่นจะเห็น)',
      fields: [
        { name: 'action', type: 'string', required: true, description: 'ผลการตัดสิน รับ `approved` (อนุมัติ) หรือ `rejected` (ไม่อนุมัติ) ไม่สนตัวพิมพ์เล็ก/ใหญ่ รับภาษาไทย `อนุมัติ` / `ไม่อนุมัติ` ด้วย', example: 'approved', enum: ['approved', 'rejected', 'อนุมัติ', 'ไม่อนุมัติ'] },
        { name: 'remark', type: 'string', required: false, description: 'หมายเหตุ/เหตุผล (ไม่ส่ง: อนุมัติเก็บ "อนุมัติสมบูรณ์", ไม่อนุมัติเก็บ "ไม่อนุมัติคำขอ")', example: 'ช่วงนี้งานเยอะ ขอให้ลาวันอื่น' },
        { name: 'approverName', type: 'string', required: false, description: 'ชื่อผู้อนุมัติสำรอง ใช้เฉพาะเมื่อใน token ไม่มีชื่อ (ปกติไม่ต้องส่ง)', example: '' },
      ],
      example: { action: 'rejected', remark: 'ช่วงนี้งานเยอะ ขอให้ลาวันอื่น' },
    },
    responses: {
      200: {
        description: 'ตัดสินสำเร็จ `result.status` คือผลสุดท้าย (`อนุมัติแล้ว` หรือ `ไม่อนุมัติ`)',
        example: {
          success: true,
          message: 'ทำรายการ ไม่อนุมัติ เรียบร้อยแล้ว',
          result: { id: 'leave-1793089320000-ab12', status: 'ไม่อนุมัติ', message: 'ปฏิเสธคำขอเรียบร้อยแล้ว' },
        },
      },
      400: {
        description: 'action ไม่ถูกต้อง/ไม่ส่งมา (ตัวอย่างด้านล่าง) หรือ `requestType` ไม่ใช่ `leave`/`time-correction` ("ประเภทคำขอไม่ถูกต้อง (ต้องเป็น leave หรือ time-correction)")',
        example: { success: false, message: "Action ต้องเป็น 'approved' หรือ 'rejected'" },
      },
      401: E401,
      403: {
        description: 'role ไม่ใช่ผู้อนุมัติ (ข้อความ "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบ/หัวหน้างานเท่านั้น (Forbidden)") หรือไม่มีสิทธิ์ตัดสินคำขอนี้ ข้อความที่เป็นไปได้: "ไม่สามารถอนุมัติ/ปฏิเสธคำขอของตนเองได้", "คำขอนี้อยู่ในขั้นอนุมัติระดับ 2 ต้องให้ Superboss เป็นผู้พิจารณา", "คำขอของหัวหน้างานต้องให้ Superboss เป็นผู้พิจารณา", "คุณสามารถอนุมัติได้เฉพาะคำขอของพนักงานในแผนกเดียวกันเท่านั้น"',
        example: { success: false, message: 'ไม่สามารถอนุมัติ/ปฏิเสธคำขอของตนเองได้' },
      },
      404: { description: 'ไม่พบคำขอตามรหัสนี้', example: { success: false, message: 'ไม่พบคำขอที่ต้องการดำเนินการ' } },
      409: {
        description: 'คำขอถูกตัดสินไปแล้ว (ตัวอย่างด้านล่าง) หรือมีผู้อื่นตัดสินพร้อมกันและชนะก่อน ("คำขอนี้ถูกดำเนินการไปแล้วโดยผู้อื่น กรุณารีเฟรชรายการ")',
        example: { success: false, message: 'คำขอนี้ถูกดำเนินการไปแล้ว (สถานะปัจจุบัน: อนุมัติแล้ว)' },
      },
    },
  },
};
