// รายละเอียดสำหรับหน้า Swagger: กลุ่ม Quest (ภารกิจ), ของรางวัล/แต้ม และประกาศ
// key = "METHOD /express/path" ตรงกับ routes/api.js

// ---------- ข้อความ error กลางที่ middleware ส่งกลับ ----------
const E401 = {
  description: 'ไม่ได้ส่ง token หรือ token ไม่ถูกต้อง/หมดอายุ (ต้องส่งหัว `Authorization: Bearer <token>`)',
  example: { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)' },
};
const E403_ADMIN = {
  description: 'ล็อกอินแล้วแต่ role ไม่ใช่แอดมิน (ต้องเป็น Admin / Super Admin / HR Admin / System Admin) เช่น พนักงานที่ใช้แอป หรือ SuperBoss ถูกปฏิเสธ',
  example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบ (Admin)เท่านั้น (Forbidden)' },
};

// ---------- ตัวอย่างข้อมูลที่ใช้ซ้ำ ----------
const questSummary = {
  id: 'QST-m2x9k1a4f7c2e1',
  code: 'SAFE-01',
  title: 'แบบทดสอบความปลอดภัยในการทำงาน',
  description: 'ทำแบบทดสอบสั้นๆ เพื่อรับแต้มสะสม',
  imageUrl: '',
  sendMode: 'now',
  startDate: '2026-10-27',
  startTime: '09:30',
  endDate: '2026-12-31',
  endTime: '23:45',
  assignType: 'all',
  autoApprove: true,
  rewardPoints: 100,
  passCount: 2,
  rewardId: 'rew-001',
  rewardTitle: 'บัตรกำนัลกาแฟ',
  createdBy: 'ADM-001',
  createdByName: 'HR Admin',
  createdDate: '2026-10-27',
  createdTime: '09:30',
  sectionCount: 1,
  questionCount: 3,
  totalPoints: 100,
  assignedCount: 120,
  completedCount: 8,
  approvedCount: 6,
  status: 'Active',
};

const questSections = [
  {
    title: 'ความปลอดภัยเบื้องต้น',
    description: 'ตอบคำถามเกี่ยวกับความปลอดภัยในโรงงาน',
    timeLimitMinutes: 10,
    editType: 'can_edit',
    questions: [
      {
        type: 'single',
        title: 'เมื่อพบไฟไหม้ ต้องทำอย่างไรเป็นอันดับแรก',
        description: '',
        imageUrl: '',
        choices: [
          { text: 'กดสัญญาณเตือนไฟไหม้', isCorrect: true },
          { text: 'รอให้ไฟดับเอง', isCorrect: false },
          { text: 'ถ่ายรูปลงโซเชียล', isCorrect: false },
        ],
      },
      {
        type: 'multi',
        title: 'ข้อใดคืออุปกรณ์ป้องกันส่วนบุคคล (เลือกได้หลายข้อ)',
        description: '',
        imageUrl: '',
        choices: [
          { text: 'หมวกนิรภัย', isCorrect: true },
          { text: 'ถุงมือ', isCorrect: true },
          { text: 'หูฟังเล่นเพลง', isCorrect: false },
        ],
      },
    ],
  },
];

const questFull = {
  ...questSummary,
  sections: [
    {
      id: 'qs-m2x9k1a4f7c2e1',
      type: 'quiz',
      title: 'ความปลอดภัยเบื้องต้น',
      description: 'ตอบคำถามเกี่ยวกับความปลอดภัยในโรงงาน',
      timeLimitMinutes: 10,
      editType: 'can_edit',
      questions: [
        {
          id: 'qq-m2x9k1a4f7c2e2',
          type: 'single',
          title: 'เมื่อพบไฟไหม้ ต้องทำอย่างไรเป็นอันดับแรก',
          description: '',
          imageUrl: '',
          points: 0,
          choices: [
            { id: 'qc-m2x9k1a4f7c2e3', text: 'กดสัญญาณเตือนไฟไหม้', isCorrect: true },
            { id: 'qc-m2x9k1a4f7c2e4', text: 'รอให้ไฟดับเอง', isCorrect: false },
            { id: 'qc-m2x9k1a4f7c2e5', text: 'ถ่ายรูปลงโซเชียล', isCorrect: false },
          ],
        },
      ],
    },
  ],
  members: [],
};

const questBodyExample = {
  code: 'SAFE-01',
  title: 'แบบทดสอบความปลอดภัยในการทำงาน',
  description: 'ทำแบบทดสอบสั้นๆ เพื่อรับแต้มสะสม',
  sendMode: 'now',
  endDate: '2026-12-31',
  endTime: '23:45',
  assignType: 'all',
  rewardPoints: 100,
  passCount: 2,
  rewardId: 'rew-001',
  sections: questSections,
};

// รายการ field ของ body Quest (ใช้ร่วมกันระหว่าง POST และ PUT)
const questBodyFields = [
  { name: 'code', type: 'string', required: true, description: 'รหัส Quest ที่แอดมินตั้งเอง ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข `-` และ `_` ยาว 1-30 ตัว ห้ามซ้ำกับ Quest อื่น (ไม่สนตัวพิมพ์เล็ก/ใหญ่ เช่น `SAFE-01` ซ้ำกับ `safe-01`) ซ้ำจะได้ 409', example: 'SAFE-01' },
  { name: 'title', type: 'string', required: true, description: 'ชื่อ Quest ไม่เกิน 255 ตัวอักษร (ตัดช่องว่างหัวท้ายให้)', example: 'แบบทดสอบความปลอดภัยในการทำงาน' },
  { name: 'description', type: 'string', required: true, description: 'รายละเอียด Quest ไม่เกิน 2,000 ตัวอักษร', example: 'ทำแบบทดสอบสั้นๆ เพื่อรับแต้มสะสม' },
  { name: 'imageUrl', type: 'string', required: false, description: 'ลิงก์รูปปกของ Quest (ไม่บังคับ)', example: '' },
  { name: 'sendMode', type: 'string', required: false, description: '`now` = เริ่มทันที (server ใช้วัน/เวลาปัจจุบันเวลาไทยเป็นวันเริ่ม และเมินค่า startDate/startTime ที่ส่งมา) / `date` = กำหนดวันเริ่มเอง ถ้าไม่ส่งหรือส่งค่าอื่นจะถือเป็น `now`', example: 'now', enum: ['now', 'date'] },
  { name: 'startDate', type: 'string', required: false, description: 'วันเริ่ม รูปแบบ `YYYY-MM-DD` (เวลาไทย) ต้องส่งเมื่อ sendMode = `date` (เมื่อเป็น `now` server เติมให้เอง)', example: '2026-11-01' },
  { name: 'startTime', type: 'string', required: false, description: 'เวลาเริ่ม รูปแบบ `HH:mm` (24 ชม.) ต้องส่งเมื่อ sendMode = `date`', example: '08:00' },
  { name: 'endDate', type: 'string', required: true, description: 'วันสิ้นสุด `YYYY-MM-DD` ต้องอยู่หลังวัน/เวลาเริ่ม และตอนสร้างต้องไม่เป็นอดีต (เวลาไทย)', example: '2026-12-31' },
  { name: 'endTime', type: 'string', required: false, description: 'เวลาสิ้นสุด `HH:mm` ถ้าไม่ส่งใช้ `23:45`', example: '23:45' },
  { name: 'assignType', type: 'string', required: false, description: 'มอบหมายให้ใคร: `all` = พนักงานทุกคน, `new_employee` = พนักงานที่เริ่มงานตั้งแต่วันเริ่ม Quest เป็นต้นไป, `members` = เฉพาะพนักงานที่เลือกใน memberIds ถ้าไม่ส่งใช้ `all`', example: 'all', enum: ['all', 'new_employee', 'members'] },
  { name: 'memberIds', type: 'array', items: { type: 'string' }, required: false, description: 'รหัสพนักงาน (employees.id) ที่ได้รับ Quest ใช้เมื่อ assignType = `members` ต้องมีอย่างน้อย 1 คน ถ้ามีรหัสที่ไม่มีอยู่จริงจะได้ 400', example: ['EMP-001', 'EMP-002'] },
  { name: 'rewardPoints', type: 'integer', required: false, description: 'แต้มก้อนเดียวที่ผู้ผ่าน Quest ได้ (ไม่มีแต้มรายข้อ) เป็นจำนวนเต็ม 0-1,000,000 ถ้าไม่ส่งถือเป็น 0', example: 100 },
  { name: 'passCount', type: 'integer', required: false, description: 'ต้องตอบถูกอย่างน้อยกี่ข้อถึงจะผ่าน (นับรวมทุกข้อในทุก section) เป็นจำนวนเต็ม 1 ถึงจำนวนข้อทั้งหมด ถ้าไม่ส่งหรือเว้นว่าง = ต้องถูกทุกข้อ', example: 2 },
  { name: 'rewardId', type: 'string', required: false, description: 'รหัสของรางวัล (rewards.id) ที่แจกฟรี (ไม่หักแต้ม) ให้ผู้ผ่าน ต้องเป็นของรางวัลที่มีอยู่และยัง Active', example: 'rew-001' },
  { name: 'sections', type: 'array', required: true, description: 'เนื้อหา Quiz อย่างน้อย 1 section แต่ละ section มี: `title` (บังคับ), `description` (บังคับ), `timeLimitMinutes` (จำนวนเต็ม 1-600 ค่าเริ่มต้น 10), `editType` (`can_edit` หรือ `no_edit` ค่าเริ่มต้น `can_edit`), `questions` (อย่างน้อย 1 ข้อ) แต่ละข้อมี: `type` (`single` หรือ `multi` เท่านั้น), `title` (บังคับ), `description`, `imageUrl` (ไม่บังคับ), `choices` (อย่างน้อย 2 ตัวเลือก แต่ละตัวมี `text` ห้ามว่าง และ `isCorrect`) ข้อ `single` ต้องมีคำตอบถูก "พอดี 1" ตัวเลือก ข้อ `multi` ต้องมีถูกอย่างน้อย 1 ตัวเลือก', example: questSections },
];

// ตัวอย่างคำตอบแบบ error ของการบันทึก Quest
const questValidation400 = {
  description: 'ข้อมูลไม่ถูกต้อง ข้อความจะบอกจุดที่ผิด เช่น ไม่มี code, ชื่อ/รายละเอียดว่าง, ไม่มี section, ตัวเลือกไม่ถึง 2, ไม่ได้ติ๊กคำตอบถูก, passCount เกินจำนวนข้อ, rewardPoints ติดลบ, เลือก members แต่ไม่ได้เลือกคน, วันสิ้นสุดไม่หลังวันเริ่ม/เป็นอดีต, รางวัลที่เลือกไม่มีอยู่ หรือพนักงานที่เลือกไม่มีอยู่',
  example: { success: false, message: 'Section 1, question 1: mark exactly one correct choice' },
};
const questCodeUsed409 = {
  description: 'รหัส Quest ซ้ำกับ Quest อื่น (ไม่สนตัวพิมพ์เล็ก/ใหญ่)',
  example: { success: false, message: 'Quest code "SAFE-01" is already used, please choose another code' },
};

// ตัวอย่างข้อมูลหมวดหมู่ของรางวัล / ของรางวัล
const categoryExample = { id: 'rcat-1730000000000-ab12', code: 'CAT-005', name: 'บัตรกำนัล', rewardCount: 0, createdAt: '2026-10-27T02:30:00.000Z' };
const rewardExample = {
  id: 'rew-005',
  title: 'บัตรกำนัลกาแฟ 100 บาท',
  description: 'ใช้ได้ที่ร้านกาแฟพันธมิตร',
  pointsRequired: 100,
  category: 'บัตรกำนัล',
  categoryId: 'rcat-1730000000000-ab12',
  imageUrl: 'https://example.com/images/coffee.png',
  stock: 20,
  status: 'Active',
};

// ตัวอย่างประกาศ
const announcementExample = {
  id: 'anno-m2x9k1a4ab12',
  title: 'ประกาศวันหยุดบริษัท',
  description: 'บริษัทปิดทำการวันที่ 13 ตุลาคม 2569',
  content: 'บริษัทปิดทำการวันที่ 13 ตุลาคม 2569',
  desc: 'บริษัทปิดทำการวันที่ 13 ตุลาคม 2569',
  author: 'HR Admin',
  isPinned: false,
  hasImage: true,
  imageUrl: 'http://localhost:5000/api/announcements/anno-m2x9k1a4ab12/image?v=1761532200000',
  startDate: '2026-10-27',
  startTime: '08:00',
  endDate: '2026-10-31',
  endTime: '17:00',
  noEndDate: false,
  status: 'Active',
  createdAt: '2026-10-27T01:00:00.000Z',
  createdDate: '2026-10-27',
  createdTime: '08:00',
  time: '2026-10-27',
};

const announcementBodyFields = [
  { name: 'title', type: 'string', required: true, description: 'หัวข้อประกาศ ไม่เกิน 255 ตัวอักษร', example: 'ประกาศวันหยุดบริษัท' },
  { name: 'description', type: 'string', required: true, description: 'รายละเอียดประกาศ ไม่เกิน 5,000 ตัวอักษร (ไม่มีหมวดหมู่ Category)', example: 'บริษัทปิดทำการวันที่ 13 ตุลาคม 2569' },
  { name: 'startDate', type: 'string', required: true, description: 'วันเริ่มแสดง รูปแบบ `YYYY-MM-DD` (เวลาไทย)', example: '2026-10-27' },
  { name: 'startTime', type: 'string', required: false, description: 'เวลาเริ่มแสดง `HH:mm` ถ้าไม่ส่งใช้ `00:00`', example: '08:00' },
  { name: 'noEndDate', type: 'boolean', required: false, description: 'ส่ง `true` = ไม่มีวันสิ้นสุด (ประกาศไม่หมดอายุ) ค่าอื่นหรือไม่ส่ง = ต้องส่ง endDate', example: false },
  { name: 'endDate', type: 'string', required: false, description: 'วันสิ้นสุด `YYYY-MM-DD` บังคับเมื่อ noEndDate ไม่ใช่ `true` ต้องอยู่หลังวัน/เวลาเริ่ม', example: '2026-10-31' },
  { name: 'endTime', type: 'string', required: false, description: 'เวลาสิ้นสุด `HH:mm` ถ้าไม่ส่งใช้ `00:00`', example: '17:00' },
  { name: 'image', type: 'string', required: false, description: 'รูปประกอบ ส่งเป็น data URL รูปแบบ `data:image/png;base64,....` หรือ `data:image/gif;base64,....` เท่านั้น (PNG/GIF ขนาดภาพเท่าไหร่ก็ได้ แต่ไฟล์ไม่เกิน 5 MB) server ตรวจชนิดจากเนื้อไฟล์จริง ไม่เชื่อชนิดที่ระบุ ส่ง `null` = ลบรูปเดิม (ใช้ตอนแก้ไข) ไม่ส่ง = ไม่เปลี่ยนรูป (ตอนสร้าง = ไม่มีรูป) หมายเหตุ ตัว body ทั้งก้อนรับได้ไม่เกิน 10 MB', example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' },
];

const announcementBodyExample = {
  title: 'ประกาศวันหยุดบริษัท',
  description: 'บริษัทปิดทำการวันที่ 13 ตุลาคม 2569',
  startDate: '2026-10-27',
  startTime: '08:00',
  noEndDate: false,
  endDate: '2026-10-31',
  endTime: '17:00',
  image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
};

const announcement400 = {
  description: 'ข้อมูลไม่ถูกต้อง เช่น ไม่มีหัวข้อ/รายละเอียด, หัวข้อยาวเกิน 255 หรือรายละเอียดเกิน 5,000 ตัวอักษร, วันที่/เวลาผิดรูปแบบ, ไม่ส่ง endDate (และไม่ได้ติ๊ก noEndDate), วันสิ้นสุดไม่หลังวันเริ่ม, วันสิ้นสุดเป็นอดีต (ตอนแก้ไขถ้าไม่เปลี่ยนวันสิ้นสุดจะไม่ตรวจข้อนี้), รูปไม่ใช่ PNG/GIF จริง หรือรูปใหญ่เกิน 5 MB',
  example: { success: false, message: 'End date / time must be after the start date / time' },
};
const announcement503 = {
  description: 'ฐานข้อมูล PostgreSQL ยังเชื่อมต่อไม่ได้ (ประกาศใช้ข้อมูลจริงจากฐานข้อมูลเท่านั้น ไม่มีข้อมูลจำลอง)',
  example: { success: false, message: 'ต้องเชื่อมต่อฐานข้อมูลเพื่อจัดการประกาศ' },
};

module.exports = {
  // =====================================================================
  // QUEST (แอดมินจัดการ)
  // =====================================================================
  'GET /quests': {
    description:
      '**ทำอะไร:** แอดมินดูรายการ Quest (ภารกิจ) ทั้งหมดในระบบ เรียงจากสร้างล่าสุดก่อน พร้อมสถานะและสถิติ (จำนวนคนที่ได้รับมอบหมาย/ทำเสร็จ/ได้รับอนุมัติ)\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าผู้เรียกเป็นแอดมิน\n2. อ่าน Quest ทั้งหมดจากตาราง `quests` พร้อมนับ section / ข้อสอบ / ผู้ทำ\n3. คำนวณ `status` จากเวลาปัจจุบันเวลาไทย\n\n' +
      '**กฎสำคัญ:**\n- `status` มี 3 ค่า: `Scheduled` (ยังไม่ถึงเวลาเริ่ม), `Active` (กำลังเปิดให้ทำ), `Expired` (หมดเวลาแล้ว)\n- รายการนี้ไม่ส่งตัวข้อสอบ (sections) มาด้วย ถ้าต้องการเนื้อหาเต็มให้เรียก `GET /quests/{id}`\n- พนักงานเรียกไม่ได้ (ได้ 403) พนักงานใช้ `GET /my-quests` แทน',
    responses: {
      200: { description: 'สำเร็จ ได้รายการ Quest', example: { success: true, total: 1, quests: [questSummary] } },
      401: E401,
      403: E403_ADMIN,
    },
  },

  'GET /quests/:id': {
    description:
      '**ทำอะไร:** แอดมินดู Quest 1 รายการแบบเต็ม รวมเนื้อหา Quiz ทุกข้อ ตัวเลือก และเฉลย (`isCorrect`) พร้อมรายชื่อสมาชิกที่ถูกมอบหมาย (กรณี assignType = `members`)\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. หา Quest ตาม id\n3. ดึง sections, questions, choices และ members มารวมกัน\n\n' +
      '**ข้อควรระวัง:** endpoint นี้ส่ง **เฉลย** ออกไป จึงจำกัดเฉพาะแอดมิน ฝั่งพนักงานใช้ `GET /my-quests/{id}` ซึ่งไม่ส่งเฉลย',
    pathParams: { id: { description: 'รหัส Quest (ฟิลด์ `id` เช่น QST-m2x9k1a4f7c2e1 ไม่ใช่ `code`)', example: 'QST-m2x9k1a4f7c2e1' } },
    responses: {
      200: { description: 'สำเร็จ ได้ Quest พร้อมเนื้อหาเต็ม', example: { success: true, quest: questFull } },
      401: E401,
      403: E403_ADMIN,
      404: { description: 'ไม่พบ Quest ตาม id', example: { success: false, message: 'Quest not found' } },
    },
  },

  'POST /quests': {
    description:
      '**ทำอะไร:** แอดมินสร้าง Quest ใหม่ (ปัจจุบันเนื้อหามีแค่ Quiz ที่ถามแบบเลือกคำตอบ) พร้อมกำหนดแต้ม รางวัล และผู้ที่ได้รับมอบหมาย\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจและทำความสะอาดข้อมูลทั้งหมด (ไม่เชื่อรูปแบบที่ client ส่งมา)\n2. ถ้า sendMode = `now` ตั้งวัน/เวลาเริ่มเป็นเวลาไทยปัจจุบัน\n3. ตรวจว่าวันสิ้นสุดไม่เป็นอดีต\n4. ตรวจว่า `code` ไม่ซ้ำ และรางวัลที่เลือก (ถ้ามี) มีอยู่จริง\n5. บันทึก Quest, sections, questions, choices และสมาชิกใน transaction เดียว (ล้มเหลวจะไม่บันทึกอะไรเลย) แล้วเขียน audit log `CREATE_QUEST`\n\n' +
      '**กฎสำคัญ:**\n- อนุมัติแบบ **Auto Approve** อย่างเดียว: พนักงานที่ตอบถูกถึงเกณฑ์ (`passCount`) ภายในเวลาจะได้แต้มและรางวัลทันที ค่า `autoApprove` ที่ส่งมาจะถูกเมิน (ระบบตั้งเป็น `true` เสมอ)\n- คำถามรองรับเฉพาะ `single` (เลือก 1 คำตอบ) และ `multi` (เลือกได้หลายคำตอบ ต้องเลือกให้ตรงชุดคำตอบถูกทั้งหมดถึงนับว่าถูก)\n- แต้มเป็นก้อนเดียวต่อทั้ง Quest (`rewardPoints`) ไม่มีแต้มรายข้อ\n- section ที่ตั้ง `editType` = `no_edit` จะแก้เนื้อหา Quiz ไม่ได้อีกเมื่อ Quest เริ่มแล้ว (ดูที่ PUT)\n\n' +
      '**ข้อควรระวัง:** ผู้เรียกต้องเป็นแอดมิน ตัวตนผู้สร้างมาจาก token เท่านั้น วันที่ใช้ `YYYY-MM-DD` เวลา `HH:mm` เวลาไทย (Asia/Bangkok)',
    body: {
      description: 'ข้อมูล Quest ทั้งหมดในครั้งเดียว (รวม sections / questions / choices)',
      fields: questBodyFields,
      example: questBodyExample,
    },
    responses: {
      201: { description: 'สร้างสำเร็จ ส่ง Quest ที่สร้างกลับมา (รวม sections และ members)', example: { success: true, quest: questFull } },
      400: questValidation400,
      401: E401,
      403: E403_ADMIN,
      409: questCodeUsed409,
    },
  },

  'PUT /quests/:id': {
    description:
      '**ทำอะไร:** แอดมินแก้ไข Quest ที่มีอยู่ ใช้ข้อมูลรูปแบบเดียวกับตอนสร้าง และเป็นการ **แทนที่ทั้งก้อน** (ต้องส่งทุกฟิลด์ครบ ไม่ใช่ส่งเฉพาะที่เปลี่ยน)\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจข้อมูลแบบเดียวกับตอนสร้าง\n2. ตรวจ `code` ไม่ซ้ำกับ Quest อื่น และรางวัลที่เลือกมีอยู่จริง\n3. หา Quest เดิม (ไม่พบ = 404)\n4. ถ้า "วัน/เวลาสิ้นสุด" เปลี่ยนไปจากเดิม ค่าใหม่ต้องไม่เป็นอดีต (Quest เก่าที่ไม่แก้วันสิ้นสุดบันทึกซ้ำได้)\n5. ถ้า Quest เริ่มไปแล้ว และมี section ที่ตั้ง `no_edit` จะไม่ยอมให้เนื้อหา Quiz เปลี่ยน\n6. ลบ sections/สมาชิกเดิมแล้วสร้างใหม่จากข้อมูลที่ส่ง ใน transaction เดียว และเขียน audit log `UPDATE_QUEST`\n\n' +
      '**กฎสำคัญ:**\n- Quiz ที่ตั้ง "No edit allow" (`no_edit`) แก้เนื้อหาไม่ได้เมื่อ Quest เริ่มแล้ว (ตรวจที่ server) แต่ยังแก้ชื่อ/รายละเอียด/แต้ม/รางวัลได้โดยส่งเนื้อหา Quiz เดิมกลับมาเหมือนเดิม\n- id ของ section/question/choice จะถูกสร้างใหม่ทุกครั้งที่บันทึก\n\n' +
      '**ข้อควรระวัง:** ถ้าส่ง `sendMode` = `now` ตอนแก้ไข server จะตั้งวัน/เวลาเริ่มเป็นเวลาปัจจุบันใหม่ทุกครั้ง ถ้าต้องการคงวันเริ่มเดิมให้ส่ง `sendMode` = `date` พร้อม startDate/startTime เดิม การตรวจข้อมูล (400) ทำก่อนการหา Quest จึงอาจได้ 400 แม้ id ไม่มีจริง',
    pathParams: { id: { description: 'รหัส Quest ที่จะแก้ (ฟิลด์ `id` เช่น QST-m2x9k1a4f7c2e1)', example: 'QST-m2x9k1a4f7c2e1' } },
    body: {
      description: 'รูปแบบเดียวกับ POST /quests ต้องส่งครบทุกฟิลด์',
      fields: questBodyFields,
      example: { ...questBodyExample, title: 'แบบทดสอบความปลอดภัย (ฉบับแก้ไข)', sendMode: 'date', startDate: '2026-10-27', startTime: '09:30' },
    },
    responses: {
      200: { description: 'แก้ไขสำเร็จ ส่ง Quest ที่อัปเดตแล้วกลับมา', example: { success: true, quest: questFull } },
      400: questValidation400,
      401: E401,
      403: E403_ADMIN,
      404: { description: 'ไม่พบ Quest ตาม id', example: { success: false, message: 'Quest not found' } },
      409: {
        description: 'มี 2 กรณี: (1) รหัส Quest ซ้ำกับ Quest อื่น (2) Quest เริ่มแล้วและมี Quiz ที่ตั้ง "No edit allow" แต่ส่งเนื้อหา Quiz ที่ต่างจากเดิมมา',
        example: { success: false, message: 'This quest has already started and contains a quiz marked "No edit allow", so its quiz content can no longer be changed' },
      },
    },
  },

  'DELETE /quests/:id': {
    description:
      '**ทำอะไร:** แอดมินลบ Quest พร้อมเนื้อหาข้อสอบ สมาชิก และความคืบหน้าของพนักงานที่ผูกกับ Quest นั้น\n\n' +
      '**server ทำอย่างไร:**\n1. ลบ Quest ตาม id (ข้อมูลลูกถูกลบตามด้วย cascade)\n2. เขียน audit log `DELETE_QUEST`\n\n' +
      '**ข้อควรระวัง:** ลบแล้วกู้คืนไม่ได้ แต้มที่พนักงานได้รับไปแล้วจะไม่ถูกหักคืน',
    pathParams: { id: { description: 'รหัส Quest ที่จะลบ', example: 'QST-m2x9k1a4f7c2e1' } },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'Quest deleted' } },
      401: E401,
      403: E403_ADMIN,
      404: { description: 'ไม่พบ Quest ตาม id', example: { success: false, message: 'Quest not found' } },
    },
  },

  // =====================================================================
  // QUEST (พนักงานในแอป)
  // =====================================================================
  'GET /my-quests': {
    description:
      '**ทำอะไร:** พนักงานดูรายการ Quest ที่ได้รับมอบหมาย เฉพาะที่ "ทำได้ตอนนี้" (Active) หรือที่เคยทำแล้ว (ผ่านแล้ว / ส่งแล้วไม่ผ่าน)\n\n' +
      '**server ทำอย่างไร:**\n1. หาพนักงานจาก token (ตัวตนมาจาก token เท่านั้น)\n2. เลือก Quest ที่มอบหมายให้พนักงานคนนี้ (`all`, `members` ที่มีชื่อ, หรือ `new_employee` ที่พนักงานเริ่มงานตั้งแต่วันเริ่ม Quest)\n3. แนบผลการทำของพนักงานคนนี้ (ผ่านไหม คะแนน แต้มที่ได้)\n4. กรองเหลือเฉพาะที่ Active, ผ่านแล้ว หรือปิดไปแล้วเพราะไม่ผ่าน\n\n' +
      '**กฎสำคัญ:**\n- `passed` = ผ่านแล้ว, `failed` = เคยส่งแล้วไม่ผ่าน (Quest นั้นถูกปิดสำหรับคนนี้ ทำซ้ำไม่ได้)\n- ทำได้ **ครั้งเดียวต่อ Quest**\n- `totalPoints` คือแต้มก้อนเดียวที่ได้เมื่อผ่าน, `pointsAwarded` คือแต้มที่คนนี้ได้จริง\n\n' +
      '**ข้อควรระวัง:** ต้องล็อกอินด้วยบัญชีพนักงาน (บัญชีแอดมินจะไม่พบบัญชีพนักงาน ได้ 404) และต้องเชื่อมต่อฐานข้อมูล (ไม่เช่นนั้น 503)',
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          quests: [{
            id: 'QST-m2x9k1a4f7c2e1', title: 'แบบทดสอบความปลอดภัยในการทำงาน', description: 'ทำแบบทดสอบสั้นๆ เพื่อรับแต้มสะสม', imageUrl: '',
            startDate: '2026-10-27', startTime: '09:30', endDate: '2026-12-31', endTime: '23:45', status: 'Active',
            questionCount: 3, passCount: 2, totalPoints: 100, rewardTitle: 'บัตรกำนัลกาแฟ',
            passed: false, attempts: 0, failed: false, score: 0, pointsAwarded: 0,
          }],
        },
      },
      401: E401,
      404: { description: 'ไม่พบบัญชีพนักงานของ token นี้ (เช่น ใช้ token ของแอดมิน)', example: { success: false, message: 'ไม่พบบัญชีพนักงาน' } },
      503: { description: 'ยังเชื่อมต่อฐานข้อมูลไม่ได้', example: { success: false, message: 'ต้องเชื่อมต่อฐานข้อมูลเพื่อทำ Quest' } },
    },
  },

  'GET /my-quests/:id': {
    description:
      '**ทำอะไร:** พนักงานเปิดดู Quest 1 รายการเพื่อทำแบบทดสอบ ได้เนื้อหา section/คำถาม/ตัวเลือก **โดยไม่มีเฉลย**\n\n' +
      '**server ทำอย่างไร:**\n1. หาพนักงานจาก token\n2. ตรวจว่า Quest นี้มอบหมายให้พนักงานคนนี้จริง\n3. ดึงข้อสอบแต่ไม่ดึงฟิลด์คำตอบที่ถูก (ตัวเลือกมีแค่ `id` กับ `text`)\n\n' +
      '**กฎสำคัญ:**\n- ไม่ส่งเฉลยเด็ดขาด การตรวจคำตอบทำที่ server ตอนส่งคำตอบ (`POST /my-quests/{id}/submit`)\n- พนักงานที่ไม่ได้รับมอบหมายได้ 404 (ไม่บอกว่า Quest มีอยู่หรือไม่)\n\n' +
      '**ข้อควรระวัง:** endpoint นี้เปิดดูข้อสอบได้แม้ Quest ไม่อยู่ในช่วงเวลาที่ทำได้ ตรวจช่วงเวลาตอนส่งคำตอบ ใช้ `id` ของ question/choice ในผลลัพธ์นี้ไปสร้าง body ของการส่งคำตอบ',
    pathParams: { id: { description: 'รหัส Quest (ฟิลด์ `id` ไม่ใช่ `code`)', example: 'QST-m2x9k1a4f7c2e1' } },
    responses: {
      200: {
        description: 'สำเร็จ ได้ข้อสอบโดยไม่มีเฉลย',
        example: {
          success: true,
          quest: {
            id: 'QST-m2x9k1a4f7c2e1', title: 'แบบทดสอบความปลอดภัยในการทำงาน', description: 'ทำแบบทดสอบสั้นๆ เพื่อรับแต้มสะสม', imageUrl: '',
            startDate: '2026-10-27', startTime: '09:30', endDate: '2026-12-31', endTime: '23:45', status: 'Active',
            questionCount: 3, passCount: 2, totalPoints: 100, rewardTitle: 'บัตรกำนัลกาแฟ',
            passed: false, attempts: 0, failed: false, score: 0, pointsAwarded: 0,
            sections: [{
              id: 'qs-m2x9k1a4f7c2e1', title: 'ความปลอดภัยเบื้องต้น', description: 'ตอบคำถามเกี่ยวกับความปลอดภัยในโรงงาน', timeLimitMinutes: 10,
              questions: [{
                id: 'qq-m2x9k1a4f7c2e2', type: 'single', title: 'เมื่อพบไฟไหม้ ต้องทำอย่างไรเป็นอันดับแรก', description: '', imageUrl: '', points: 0,
                choices: [
                  { id: 'qc-m2x9k1a4f7c2e3', text: 'กดสัญญาณเตือนไฟไหม้' },
                  { id: 'qc-m2x9k1a4f7c2e4', text: 'รอให้ไฟดับเอง' },
                ],
              }],
            }],
          },
        },
      },
      401: E401,
      404: { description: 'ไม่พบ Quest นี้ หรือพนักงานไม่ได้รับมอบหมาย (หรือ token ไม่ใช่บัญชีพนักงานจะได้ "ไม่พบบัญชีพนักงาน")', example: { success: false, message: 'ไม่พบ Quest นี้ หรือคุณไม่ได้รับมอบหมาย' } },
      503: { description: 'ยังเชื่อมต่อฐานข้อมูลไม่ได้', example: { success: false, message: 'ต้องเชื่อมต่อฐานข้อมูลเพื่อทำ Quest' } },
    },
  },

  'POST /my-quests/:id/submit': {
    description:
      '**ทำอะไร:** พนักงานส่งคำตอบของ Quest server ตรวจคำตอบเอง ถ้าผ่านจะอนุมัติอัตโนมัติ เพิ่มแต้ม และแจกคูปองรางวัลฟรี (ถ้า Quest ตั้งไว้) ทันที\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่า body มี `answers` เป็นอ็อบเจกต์\n2. เริ่ม transaction และล็อกแถว Quest + ความคืบหน้าของพนักงาน (กันกดซ้ำพร้อมกัน)\n3. ตรวจว่าพนักงานได้รับมอบหมาย และ Quest อยู่ในช่วงเวลา Active\n4. ตรวจว่ายังไม่เคยทำ (ผ่านแล้ว = 409, เคยส่งแล้วไม่ผ่าน = 409)\n5. ตรวจทีละข้อ: ข้อที่ไม่ตอบ หรือตอบตัวเลือกที่ไม่ใช่ของข้อนั้น ถือว่าผิด ข้อ `multi` ต้องเลือกตรงชุดคำตอบถูกทั้งหมดเป๊ะๆ (เลือกถูกแค่บางตัวถือว่าผิด)\n6. เทียบ `correctCount` กับเกณฑ์ผ่าน (`passCount` ของ Quest; ถ้าเป็น 0 = ต้องถูกทุกข้อ)\n7. ถ้าไม่ผ่าน: บันทึกว่าทำแล้ว (ปิด Quest นี้สำหรับคนนี้) ตอบ 200 พร้อม `result.passed = false`\n8. ถ้าผ่าน: เพิ่มแต้มก้อนเดียวตาม `rewardPoints` + บันทึก `point_transactions` (หมวด `Quest`) + ตัดสต็อกและออกคูปองรางวัลฟรี (ไม่หักแต้ม) ทั้งหมดใน transaction เดียว และเขียน audit log `QUEST_PASSED`\n\n' +
      '**กฎสำคัญ:**\n- ทำได้ **ครั้งเดียวต่อ Quest** ผ่านแล้วทำซ้ำไม่ได้และไม่จ่ายซ้ำ ถ้าส่งแล้วไม่ผ่านก็ปิด Quest นั้นของคนนั้น (409) แต่ Quest อื่นยังทำได้ปกติ\n- ถ้ารางวัลหมดสต็อก (หรือไม่ Active) ยังจ่ายแต้มตามปกติ และ `result.rewardSkipped = true`\n- ส่งซ้ำพร้อมกันหลายครั้ง สำเร็จได้ครั้งเดียว\n- การตอบ "ไม่ผ่าน" ยังได้ HTTP 200 (ให้ดูที่ `result.passed`) ไม่ใช่ error\n\n' +
      '**ข้อควรระวัง:** ตัวตนพนักงานมาจาก token เท่านั้น ห้ามเชื่อ id ใน body รูปแบบ `answers` คือ `{ "<questionId>": ["<choiceId>", ...] }` โดยใช้ id จาก `GET /my-quests/{id}`',
    pathParams: { id: { description: 'รหัส Quest ที่ส่งคำตอบ', example: 'QST-m2x9k1a4f7c2e1' } },
    body: {
      description: 'คำตอบของพนักงาน เป็นอ็อบเจกต์ที่ key คือรหัสคำถาม และ value คืออาร์เรย์รหัสตัวเลือกที่เลือก (ข้อ single ใส่ 1 ตัว ข้อ multi ใส่ได้หลายตัว)',
      fields: [
        { name: 'answers', type: 'object', required: true, description: 'อ็อบเจกต์ `{ "<questionId>": ["<choiceId>", ...] }` ต้องเป็นอ็อบเจกต์ (ส่ง array หรือไม่ส่งจะได้ 400) ข้อที่ไม่ส่งมาถือว่าไม่ได้ตอบ', example: { 'qq-m2x9k1a4f7c2e2': ['qc-m2x9k1a4f7c2e3'], 'qq-m2x9k1a4f7c2e6': ['qc-m2x9k1a4f7c2e7', 'qc-m2x9k1a4f7c2e8'] } },
      ],
      example: { answers: { 'qq-m2x9k1a4f7c2e2': ['qc-m2x9k1a4f7c2e3'], 'qq-m2x9k1a4f7c2e6': ['qc-m2x9k1a4f7c2e7', 'qc-m2x9k1a4f7c2e8'] } },
    },
    responses: {
      200: {
        description: 'ตรวจคำตอบแล้ว (ทั้งกรณีผ่านและไม่ผ่าน) ให้ดู `result.passed` กรณีผ่านจะมี `newTotalPoints` (แต้มสะสมใหม่) และ `reward` (ข้อมูลคูปองถ้ามีรางวัลและยังมีสต็อก) กรณีรางวัลหมดสต็อกจะมี `rewardSkipped: true` กรณีไม่ผ่าน `pointsAwarded` = 0 และ `reward` = null ตัวอย่างนี้เป็นกรณีผ่าน',
        example: {
          success: true,
          message: 'ยินดีด้วย คุณผ่าน Quest นี้แล้ว',
          result: {
            passed: true, correctCount: 3, totalQuestions: 3, passCount: 2, pointsAwarded: 100,
            reward: { title: 'บัตรกำนัลกาแฟ', imageUrl: 'https://example.com/images/coffee.png', couponCode: 'WX-1A2B3C4D' },
            newTotalPoints: 350,
          },
        },
      },
      400: {
        description: 'มี 2 กรณี: (1) ไม่ได้ส่ง `answers` หรือส่งผิดรูปแบบ (ไม่ใช่อ็อบเจกต์) (2) Quest ไม่อยู่ในช่วงเวลาที่เปิดให้ทำ (ยังไม่เริ่ม หรือหมดเวลาแล้ว)',
        example: { success: false, message: 'กรุณาส่งคำตอบ (answers)' },
      },
      401: E401,
      404: { description: 'ไม่พบ Quest นี้ หรือพนักงานไม่ได้รับมอบหมาย (หรือ token ไม่ใช่บัญชีพนักงานจะได้ "ไม่พบบัญชีพนักงาน")', example: { success: false, message: 'ไม่พบ Quest นี้ หรือคุณไม่ได้รับมอบหมาย' } },
      409: {
        description: 'ทำซ้ำไม่ได้: ผ่านและรับรางวัลไปแล้ว หรือเคยทำแล้วแต่ไม่ผ่าน (Quest ปิดสำหรับคนนี้) ข้อความจึงมี 2 แบบ',
        example: { success: false, message: 'คุณทำ Quest นี้แล้วแต่ไม่ผ่าน ไม่สามารถทำซ้ำได้' },
      },
      503: { description: 'ยังเชื่อมต่อฐานข้อมูลไม่ได้', example: { success: false, message: 'ต้องเชื่อมต่อฐานข้อมูลเพื่อทำ Quest' } },
    },
  },

  // =====================================================================
  // หมวดหมู่ของรางวัล (แอดมิน)
  // =====================================================================
  'GET /reward-categories': {
    description:
      '**ทำอะไร:** แอดมินดูรายการหมวดหมู่ของรางวัลทั้งหมด พร้อมจำนวนของรางวัลในแต่ละหมวด\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. อ่านตาราง `reward_categories` นับของรางวัลที่อยู่ในแต่ละหมวด เรียงตาม code แล้วชื่อ\n\n' +
      '**ข้อควรระวัง:** เฉพาะแอดมิน พนักงานได้ 403 (ฝั่งแอปกรองหมวดจากฟิลด์ `category` ของของรางวัลแทน)',
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, total: 1, categories: [{ ...categoryExample, rewardCount: 4 }] } },
      401: E401,
      403: E403_ADMIN,
    },
  },

  'POST /reward-categories': {
    description:
      '**ทำอะไร:** แอดมินสร้างหมวดหมู่ของรางวัลใหม่ (ทุกของรางวัลต้องเลือกหมวดหมู่ตอนสร้าง)\n\n' +
      '**server ทำอย่างไร:**\n1. ตัดช่องว่างหัวท้ายของชื่อ และยุบช่องว่างซ้อนให้เหลือช่องเดียว\n2. ตรวจชื่อและรูปแบบ code\n3. ถ้าไม่ส่ง `code` ระบบให้ code ถัดไปเอง (เช่น `CAT-005`)\n4. บันทึก ถ้าชื่อหรือ code ซ้ำจะตอบ 409\n\n' +
      '**กฎสำคัญ:**\n- ชื่อและ code ห้ามซ้ำ โดยไม่สนตัวพิมพ์เล็ก/ใหญ่\n- ชื่อไม่เกิน 100 ตัวอักษร\n- code ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข `-` `_` ยาว 1-30 ตัว',
    body: {
      description: 'ชื่อหมวดหมู่ และ code (ไม่บังคับ)',
      fields: [
        { name: 'name', type: 'string', required: true, description: 'ชื่อหมวดหมู่ ไม่เกิน 100 ตัวอักษร ห้ามว่าง และห้ามซ้ำ (ไม่สนตัวพิมพ์)', example: 'บัตรกำนัล' },
        { name: 'code', type: 'string', required: false, description: 'รหัสหมวดหมู่ ตัวอักษรอังกฤษ/ตัวเลข/`-`/`_` ยาว 1-30 ตัว ห้ามซ้ำ ถ้าเว้นว่างระบบให้เอง เช่น `CAT-005`', example: 'VOUCHER' },
      ],
      example: { name: 'บัตรกำนัล', code: 'VOUCHER' },
    },
    responses: {
      201: { description: 'สร้างสำเร็จ', example: { success: true, message: 'Category created', category: { ...categoryExample, code: 'VOUCHER' } } },
      400: { description: 'ชื่อว่าง, ชื่อยาวเกิน 100 ตัวอักษร หรือรูปแบบ code ไม่ถูกต้อง', example: { success: false, message: 'Category name is required' } },
      401: E401,
      403: E403_ADMIN,
      409: { description: 'ชื่อหรือ code ซ้ำกับหมวดที่มีอยู่', example: { success: false, message: 'Category "บัตรกำนัล" already exists' } },
    },
  },

  'PUT /reward-categories/:id': {
    description:
      '**ทำอะไร:** แอดมินแก้ชื่อ/รหัสของหมวดหมู่ของรางวัล\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจชื่อและ code เหมือนตอนสร้าง\n2. ใน transaction เดียว: อัปเดตหมวดหมู่ และเขียนชื่อใหม่ลงฟิลด์ `category` ของของรางวัลทุกชิ้นที่อยู่ในหมวดนี้ (cascade)\n\n' +
      '**กฎสำคัญ:**\n- ถ้าไม่ส่ง `code` (เว้นว่าง) จะคง code เดิมไว้\n- ชื่อและ code ห้ามซ้ำกับหมวดอื่น (ไม่สนตัวพิมพ์)',
    pathParams: { id: { description: 'รหัสหมวดหมู่ (ฟิลด์ `id` ของหมวด เช่น rcat-1730000000000-ab12)', example: 'rcat-1730000000000-ab12' } },
    body: {
      description: 'รูปแบบเดียวกับ POST /reward-categories ต้องส่ง `name` เสมอ',
      fields: [
        { name: 'name', type: 'string', required: true, description: 'ชื่อใหม่ ไม่เกิน 100 ตัวอักษร ห้ามว่าง ห้ามซ้ำกับหมวดอื่น', example: 'บัตรกำนัลและคูปอง' },
        { name: 'code', type: 'string', required: false, description: 'รหัสใหม่ (รูปแบบเดียวกับตอนสร้าง) ถ้าเว้นว่างคงรหัสเดิม', example: 'VOUCHER' },
      ],
      example: { name: 'บัตรกำนัลและคูปอง', code: 'VOUCHER' },
    },
    responses: {
      200: { description: 'แก้ไขสำเร็จ', example: { success: true, message: 'Category updated', category: { id: 'rcat-1730000000000-ab12', code: 'VOUCHER', name: 'บัตรกำนัลและคูปอง', createdAt: '2026-10-27T02:30:00.000Z', rewardCount: 4 } } },
      400: { description: 'ชื่อว่าง, ชื่อยาวเกิน 100 ตัวอักษร หรือรูปแบบ code ไม่ถูกต้อง', example: { success: false, message: 'Category code can only contain letters, numbers, - and _ (up to 30 characters)' } },
      401: E401,
      403: E403_ADMIN,
      404: { description: 'ไม่พบหมวดหมู่ตาม id', example: { success: false, message: 'Category not found' } },
      409: { description: 'ชื่อหรือ code ซ้ำกับหมวดอื่น', example: { success: false, message: 'Category code "VOUCHER" is already used, please choose another code' } },
    },
  },

  'DELETE /reward-categories/:id': {
    description:
      '**ทำอะไร:** แอดมินลบหมวดหมู่ของรางวัล\n\n' +
      '**server ทำอย่างไร:**\n1. นับของรางวัลที่ยังอยู่ในหมวดนี้ ถ้ามี = ปฏิเสธ (409)\n2. ลบหมวดหมู่ ถ้าไม่พบ = 404\n\n' +
      '**กฎสำคัญ:** ลบหมวดที่ยังมีของรางวัลไม่ได้ ต้องย้ายหรือลบของรางวัลเหล่านั้นก่อน',
    pathParams: { id: { description: 'รหัสหมวดหมู่ที่จะลบ', example: 'rcat-1730000000000-ab12' } },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'Category deleted' } },
      401: E401,
      403: E403_ADMIN,
      404: { description: 'ไม่พบหมวดหมู่ตาม id', example: { success: false, message: 'Category not found' } },
      409: { description: 'หมวดนี้ยังมีของรางวัลใช้อยู่ จึงลบไม่ได้ (ข้อความระบุจำนวนที่ใช้อยู่)', example: { success: false, message: 'This category is used by 3 reward(s). Move or delete those rewards first' } },
    },
  },

  // =====================================================================
  // ของรางวัล
  // =====================================================================
  'GET /rewards': {
    description:
      '**ทำอะไร:** ผู้ใช้ที่ล็อกอิน (พนักงานหรือแอดมิน) ดูรายการของรางวัลที่แลกได้ เรียงจากแต้มที่ใช้แลกน้อยไปมาก\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านของรางวัลที่ `status` = `Active` เท่านั้น\n2. ส่งกลับพร้อมหมวดหมู่และจำนวนสต็อก\n\n' +
      '**กฎสำคัญ:**\n- `stock` = 0 หมายถึง "หมดสต็อก" (ยังแสดงในรายการ แต่แลกไม่ได้)\n- ของรางวัลที่ไม่ Active จะไม่แสดง',
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, total: 1, rewards: [rewardExample] } },
      401: E401,
    },
  },

  'POST /rewards': {
    description:
      '**ทำอะไร:** แอดมินสร้างของรางวัลใหม่ในแคตตาล็อก\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจ code (ถ้าส่งมา), ชื่อ, หมวดหมู่, แต้มและสต็อก\n2. ตรวจว่าหมวดหมู่ที่เลือกมีอยู่ และคัดลอกชื่อหมวดมาเก็บไว้ในของรางวัล (ใช้แสดงผล/กรองในแอป)\n3. ถ้าไม่ส่ง `code` ระบบให้รหัสสั้นถัดไปเอง (เช่น `rew-005`) ถ้าส่งมาต้องไม่ซ้ำกับรหัสเดิม (ไม่สนตัวพิมพ์)\n4. บันทึกลงฐานข้อมูล\n\n' +
      '**กฎสำคัญ:**\n- ต้องเลือกหมวดหมู่ (`categoryId`) เสมอ\n- รหัสของรางวัล (`code`) กลายเป็น `id` ของของรางวัล ใช้ตัวอักษรอังกฤษ/ตัวเลข/`-`/`_` ไม่เกิน 30 ตัว\n- ค่าเริ่มต้นเมื่อไม่ส่ง: `pointsRequired` = 100, `stock` = 100, `status` = `Active`, `imageUrl` = รูป placeholder, `description` = ว่าง',
    body: {
      description: 'ข้อมูลของรางวัล',
      fields: [
        { name: 'title', type: 'string', required: true, description: 'ชื่อของรางวัล ห้ามว่าง', example: 'บัตรกำนัลกาแฟ 100 บาท' },
        { name: 'categoryId', type: 'string', required: true, description: 'รหัสหมวดหมู่ (`id` จาก GET /reward-categories) ต้องมีอยู่จริง', example: 'rcat-1730000000000-ab12' },
        { name: 'code', type: 'string', required: false, description: 'รหัสของรางวัลที่แอดมินตั้งเอง (ตัวอักษรอังกฤษ/ตัวเลข/`-`/`_` 1-30 ตัว ห้ามซ้ำ ไม่สนตัวพิมพ์) ถ้าเว้นว่างระบบให้เอง เช่น `rew-005`', example: 'COFFEE-100' },
        { name: 'description', type: 'string', required: false, description: 'รายละเอียดของรางวัล', example: 'ใช้ได้ที่ร้านกาแฟพันธมิตร' },
        { name: 'pointsRequired', type: 'integer', required: false, description: 'แต้มที่ใช้แลก ต้องเป็นตัวเลขไม่ติดลบ (ทศนิยมจะถูกปัดทิ้ง) ถ้าไม่ส่งใช้ 100', example: 100 },
        { name: 'stock', type: 'integer', required: false, description: 'จำนวนสต็อก ต้องเป็นตัวเลขไม่ติดลบ ถ้าไม่ส่งใช้ 100 (0 = หมดสต็อก)', example: 20 },
        { name: 'imageUrl', type: 'string', required: false, description: 'ลิงก์รูปของรางวัล ถ้าไม่ส่งใช้รูป placeholder', example: 'https://example.com/images/coffee.png' },
        { name: 'status', type: 'string', required: false, description: 'สถานะ ค่าเริ่มต้น `Active` (รายการ GET /rewards และการแลกใช้เฉพาะ `Active`) server ไม่ได้จำกัดค่าอื่นไว้ ยังไม่ได้ยืนยันค่าที่ใช้จริงนอกจาก `Active` / `Inactive`', example: 'Active' },
      ],
      example: { title: 'บัตรกำนัลกาแฟ 100 บาท', categoryId: 'rcat-1730000000000-ab12', code: 'COFFEE-100', description: 'ใช้ได้ที่ร้านกาแฟพันธมิตร', pointsRequired: 100, stock: 20, imageUrl: 'https://example.com/images/coffee.png' },
    },
    responses: {
      201: { description: 'สร้างสำเร็จ', example: { success: true, message: 'สร้างของรางวัลสำเร็จ', reward: { ...rewardExample, id: 'COFFEE-100' } } },
      400: {
        description: 'ข้อมูลไม่ถูกต้อง: รูปแบบ code ผิด, ไม่มีชื่อ, ไม่ได้เลือกหมวดหมู่, แต้ม/สต็อกไม่ใช่ตัวเลขหรือติดลบ หรือหมวดหมู่ที่เลือกไม่มีอยู่แล้ว (ตัวอย่างนี้คือไม่ได้เลือกหมวดหมู่)',
        example: { success: false, message: 'Please select a category for the reward' },
      },
      401: E401,
      403: E403_ADMIN,
      409: { description: 'รหัสของรางวัลซ้ำ (ไม่สนตัวพิมพ์)', example: { success: false, message: 'Reward code "COFFEE-100" is already used, please choose another code' } },
    },
  },

  'DELETE /rewards/:id': {
    description:
      '**ทำอะไร:** แอดมินลบของรางวัลออกจากแคตตาล็อก\n\n' +
      '**server ทำอย่างไร:**\n1. สั่งลบของรางวัลตาม id\n2. ถ้าของรางวัลนี้เคยถูกแลกแล้ว (มีประวัติ redemption อ้างอิงอยู่) ฐานข้อมูลไม่ยอมให้ลบ ตอบ 409\n\n' +
      '**ข้อควรระวัง:** ถ้า id ไม่มีอยู่จริง ระบบยังตอบ 200 ว่าลบสำเร็จ (ไม่ตอบ 404) ของรางวัลที่เคยถูกแลกแล้วให้เปลี่ยนสถานะไม่ให้แสดงแทนการลบ',
    pathParams: { id: { description: 'รหัสของรางวัล เช่น rew-005', example: 'rew-005' } },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'ลบของรางวัลสำเร็จ' } },
      401: E401,
      403: E403_ADMIN,
      409: { description: 'ของรางวัลมีประวัติการแลกแล้ว ลบไม่ได้', example: { success: false, message: 'ไม่สามารถลบของรางวัลที่มีประวัติการแลกแล้ว' } },
    },
  },

  'GET /rewards/my-coupons': {
    description:
      '**ทำอะไร:** พนักงานดูคูปองของตัวเอง (ที่ได้จากการแลกด้วยแต้ม หรือได้ฟรีจากการผ่าน Quest) เรียงจากใหม่ไปเก่า\n\n' +
      '**server ทำอย่างไร:**\n1. ใช้ id ของผู้เรียกจาก token (ไม่รับ id จาก query/body)\n2. อ่านตาราง `redemptions` ของคนนั้น แนบชื่อ รูป และหมวดของรางวัล\n\n' +
      '**กฎสำคัญ:**\n- คูปองที่ได้ฟรีจาก Quest จะมี `pointsUsed` = 0\n- `couponCode` มีรูปแบบ `WX-` ตามด้วยตัวอักษร/ตัวเลขฐานสิบหก 8 ตัว\n\n' +
      '**ข้อควรระวัง:** path นี้ต้องอยู่ก่อน `/rewards/{id}` ใน router (มีอยู่แล้ว) จึงไม่ถูกตีความ `my-coupons` เป็นรหัสของรางวัล',
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          total: 1,
          coupons: [{
            id: 'red-1761532200000-a1b2c3', employeeId: 'EMP-001', rewardId: 'rew-005', title: 'บัตรกำนัลกาแฟ 100 บาท',
            imageUrl: 'https://example.com/images/coffee.png', category: 'บัตรกำนัล', couponCode: 'WX-1A2B3C4D', pointsUsed: 100,
            status: 'Active', createdAt: '2026-10-27',
          }],
        },
      },
      401: E401,
    },
  },

  'GET /rewards/:id': {
    description:
      '**ทำอะไร:** ผู้ใช้ที่ล็อกอินดูรายละเอียดของรางวัล 1 ชิ้น\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านรายการของรางวัลที่ `Active`\n2. หาชิ้นที่ id ตรงกัน (ตรงตามตัวพิมพ์)\n\n' +
      '**ข้อควรระวัง:** ของรางวัลที่ไม่ Active จะถือว่า "ไม่พบ" (404)',
    pathParams: { id: { description: 'รหัสของรางวัล เช่น rew-005', example: 'rew-005' } },
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, reward: rewardExample } },
      401: E401,
      404: { description: 'ไม่พบของรางวัล (หรือไม่ใช่สถานะ Active)', example: { success: false, message: 'ไม่พบของรางวัลนี้' } },
    },
  },

  'POST /rewards/:id/redeem': {
    description:
      '**ทำอะไร:** พนักงานใช้แต้มสะสมแลกของรางวัล ได้คูปองกลับมา 1 ใบ\n\n' +
      '**server ทำอย่างไร:** ทำทั้งหมดใน transaction เดียว พร้อมล็อกแถว (row lock) เพื่อกันกดซ้ำ/กดพร้อมกัน\n1. ล็อกและอ่านของรางวัลที่ Active (ไม่พบ = 404)\n2. ตรวจสต็อก ต้องมากกว่า 0 (หมด = 400)\n3. ล็อกแถวพนักงานจาก token และตรวจแต้มพอ (ไม่พอ = 400)\n4. ลดสต็อก 1, หักแต้ม, สร้างคูปอง `WX-XXXXXXXX`, บันทึกประวัติแต้มแบบติดลบ (`spend` หมวด `ของรางวัล (Reward)`)\n\n' +
      '**กฎสำคัญ:**\n- แต้มและรางวัลเป็น **atomic**: ถ้าขั้นใดล้มเหลวจะไม่เปลี่ยนอะไรเลย แต้มไม่ติดลบ สต็อกไม่ติดลบ\n- พนักงานคนเดียวกดซ้ำพร้อมกัน แต้มพอแค่ 1 ครั้งก็แลกได้ครั้งเดียว\n- 2 คนแย่งชิ้นสุดท้ายพร้อมกัน สำเร็จได้เพียงคนเดียว อีกคนได้ 400\n- ไม่ต้องส่ง body ตัวตนพนักงานมาจาก token เท่านั้น\n\n' +
      '**ข้อควรระวัง:** ต้องล็อกอินด้วยบัญชีพนักงาน (บัญชีแอดมินไม่มีแต้ม จะได้ 404 "ไม่พบบัญชีพนักงาน")',
    pathParams: { id: { description: 'รหัสของรางวัลที่ต้องการแลก เช่น rew-005', example: 'rew-005' } },
    responses: {
      200: {
        description: 'แลกสำเร็จ `redemption.newTotalPoints` คือแต้มคงเหลือหลังแลก',
        example: {
          success: true,
          message: 'แลกของรางวัลสำเร็จเรียบร้อยแล้ว!',
          redemption: {
            id: 'red-1761532200000-a1b2c3', employeeId: 'EMP-001', rewardId: 'rew-005', rewardTitle: 'บัตรกำนัลกาแฟ 100 บาท',
            rewardImage: 'https://example.com/images/coffee.png', couponCode: 'WX-1A2B3C4D', pointsUsed: 100, status: 'Active',
            createdAt: '2026-10-27', newTotalPoints: 150,
          },
        },
      },
      400: {
        description: 'แลกไม่ได้: ของรางวัลหมดสต็อก หรือแต้มไม่เพียงพอ (ข้อความระบุแต้มที่ต้องการและที่มี) ไม่มีการหักแต้มหรือลดสต็อก',
        example: { success: false, message: 'คะแนนไม่เพียงพอ (ต้องการ 100 แต้ม แต่คุณมี 99 แต้ม)' },
      },
      401: E401,
      404: { description: 'ไม่พบของรางวัล (หรือไม่ Active) หรือไม่พบบัญชีพนักงานของ token นี้', example: { success: false, message: 'ไม่พบของรางวัลนี้' } },
      500: { description: 'เกิดข้อผิดพลาดภายในฐานข้อมูลระหว่างแลก (ไม่มีการเปลี่ยนแปลงข้อมูล ลองใหม่ได้)', example: { success: false, message: 'ไม่สามารถแลกของรางวัลได้ กรุณาลองใหม่อีกครั้ง' } },
    },
  },

  // =====================================================================
  // แต้มและอันดับ
  // =====================================================================
  'GET /points/history': {
    description:
      '**ทำอะไร:** ดูแต้มสะสมปัจจุบันและประวัติการได้/ใช้แต้ม เรียงจากใหม่ไปเก่า\n\n' +
      '**server ทำอย่างไร:**\n1. ถ้าผู้เรียกเป็นแอดมินและส่ง `employeeId` มา จะดูของพนักงานคนนั้น\n2. นอกนั้น (พนักงานทุกคน แม้ส่ง `employeeId` มาก็ตาม) จะได้ของตัวเองจาก token เสมอ\n3. อ่านแต้มคงเหลือจากตารางพนักงาน และรายการจาก `point_transactions`\n\n' +
      '**กฎสำคัญ:**\n- `points` ในรายการเป็นค่าติดลบเมื่อใช้แต้ม (`type` = `spend`) และบวกเมื่อได้แต้ม (`type` = `earn`)\n- `category` บอกที่มาของแต้ม เช่น `Attendance` (เข้างานตรงเวลา), `Quest`, `ของรางวัล (Reward)`\n\n' +
      '**ข้อควรระวัง:** พนักงานดูแต้มของคนอื่นไม่ได้ ฟิลด์ `date` คำนวณจากเวลา UTC ของ `createdAt` จึงอาจต่างจากวันที่เวลาไทยหนึ่งวันในช่วงเที่ยงคืนถึงเจ็ดโมงเช้า ถ้าต้องการเวลาที่แม่นยำให้ใช้ `createdAt` ถ้าไม่พบพนักงานจะได้ `currentPoints` = 0 และ `history` ว่าง',
    query: [
      { name: 'employeeId', type: 'string', required: false, description: 'รหัสพนักงานที่ต้องการดู ใช้ได้เฉพาะแอดมิน (ถ้าผู้เรียกไม่ใช่แอดมิน ค่านี้ถูกเมิน)', example: 'EMP-001' },
    ],
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          currentPoints: 150,
          history: [
            { id: 'pt-1761532200000-a1b2c3', title: 'แลกของรางวัล: บัตรกำนัลกาแฟ 100 บาท', points: -100, type: 'spend', category: 'ของรางวัล (Reward)', date: '2026-10-27', createdAt: '2026-10-27T02:30:00.000Z' },
            { id: 'pt-1761445800000-d4e5f6', title: 'ผ่าน Quest: แบบทดสอบความปลอดภัยในการทำงาน', points: 100, type: 'earn', category: 'Quest', date: '2026-10-26', createdAt: '2026-10-26T02:30:00.000Z' },
          ],
        },
      },
      401: E401,
    },
  },

  'GET /leaderboard': {
    description:
      '**ทำอะไร:** ดูอันดับพนักงานตามแต้มสะสม จากมากไปน้อย (ผู้ใช้ที่ล็อกอินทุกคนดูได้)\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านพนักงานทั้งหมด\n2. ตัดคนที่ไม่ควรได้แต้มออก: สถานะ `Inactive`, `Resign`, `Resigned`, `Pending`, `Pending Password`\n3. เรียงตามแต้มมากไปน้อย แล้วใส่ `rank` เริ่มที่ 1\n\n' +
      '**ข้อควรระวัง:** ถ้าพนักงานไม่มีรูปโปรไฟล์ ระบบใส่รูปเริ่มต้นให้ใน `avatarUrl` ถ้าแต้มเท่ากัน จะได้ `rank` ต่างกันตามลำดับที่เรียง (ไม่มี rank เท่ากัน)',
    responses: {
      200: {
        description: 'สำเร็จ',
        example: {
          success: true,
          total: 2,
          leaderboard: [
            { id: 'EMP-001', code: 'EMP-001', name: 'สมชาย ใจดี', department: 'ฝ่ายผลิต', position: 'พนักงานทั่วไป', points: 900, avatarUrl: 'https://example.com/avatars/somchai.png', rank: 1 },
            { id: 'EMP-002', code: 'EMP-002', name: 'สมหญิง รักงาน', department: 'ฝ่ายขาย', position: 'เจ้าหน้าที่', points: 500, avatarUrl: 'https://example.com/avatars/somying.png', rank: 2 },
          ],
        },
      },
      401: E401,
    },
  },

  // =====================================================================
  // ประกาศ (Announcements)
  // =====================================================================
  'GET /announcements': {
    description:
      '**ทำอะไร:** ดูประกาศที่ "กำลังเผยแพร่อยู่ตอนนี้" (สถานะ Active) เท่านั้น แอปพนักงานใช้ endpoint นี้ ไม่ต้องล็อกอิน (สาธารณะ)\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านประกาศทั้งหมดจากตาราง `announcements` เรียงใหม่ไปเก่า\n2. คำนวณสถานะตามเวลาไทย แล้วคงไว้เฉพาะ `Active`\n3. ใส่ `imageUrl` เป็นลิงก์เต็มของรูป (ถ้ามีรูป) เพราะแอปอยู่คนละโดเมน\n\n' +
      '**กฎสำคัญ:**\n- สถานะ `Scheduled` (ยังไม่ถึงเวลาเริ่ม) / `Active` / `Expired` (พ้นวันสิ้นสุด) คำนวณที่ server เวลาไทย ประกาศที่ไม่มีวันสิ้นสุด (`noEndDate` = true) ไม่หมดอายุ\n- ข้อมูลมาจากฐานข้อมูลจริงเท่านั้น ไม่มีประกาศตัวอย่าง ถ้าฐานข้อมูลเชื่อมต่อไม่ได้จะได้รายการว่าง\n- ในแอปประกาศแสดงผ่านกระดิ่งแจ้งเตือน ไม่ใช่หน้า Home',
    responses: {
      200: { description: 'สำเร็จ (อาจเป็นรายการว่างถ้าไม่มีประกาศที่ Active)', example: { success: true, total: 1, announcements: [announcementExample] } },
    },
  },

  'GET /announcements/all': {
    description:
      '**ทำอะไร:** แอดมินดูประกาศ **ทุกสถานะ** (Scheduled / Active / Expired) ใช้ในหน้าเว็บจัดการประกาศ\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจว่าเป็นแอดมิน\n2. อ่านประกาศทั้งหมด คำนวณ `status` ตามเวลาไทย ไม่กรองทิ้ง\n\n' +
      '**ข้อควรระวัง:** เฉพาะแอดมิน (พนักงานได้ 403) ถ้าต้องการเฉพาะที่เผยแพร่อยู่ให้ใช้ `GET /announcements`',
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, total: 1, announcements: [announcementExample] } },
      401: E401,
      403: E403_ADMIN,
    },
  },

  'GET /announcements/:id/image': {
    description:
      '**ทำอะไร:** ดึงไฟล์รูปประกอบของประกาศ (ตอบกลับเป็นไฟล์รูป ไม่ใช่ JSON) ไม่ต้องล็อกอิน เพื่อให้แท็ก `<img>` ในเว็บ/แอปเปิดได้โดยตรง\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านรูป (เก็บเป็น BYTEA ในฐานข้อมูล) ของประกาศนั้น\n2. ตอบกลับพร้อม `Content-Type` เป็น `image/png` หรือ `image/gif` ตามชนิดจริง\n3. ใส่ `Cache-Control: public, max-age=300` (แคช 5 นาที) และ `Cross-Origin-Resource-Policy: cross-origin` เพื่อให้แอปที่อยู่คนละโดเมนแสดงรูปได้\n\n' +
      '**กฎสำคัญ:** รูปเป็น PNG/GIF ขนาดไม่เกิน 5 MB (ตรวจตอนอัปโหลด)\n\n' +
      '**ข้อควรระวัง:** ลิงก์ `imageUrl` ในข้อมูลประกาศมีพารามิเตอร์ `?v=` เป็นเวอร์ชันของรูป ใช้เพื่อบังคับโหลดใหม่เมื่อแก้รูป',
    pathParams: { id: { description: 'รหัสประกาศ เช่น anno-m2x9k1a4ab12', example: 'anno-m2x9k1a4ab12' } },
    responses: {
      200: { description: 'สำเร็จ ได้ไฟล์รูป (binary) Content-Type เป็น `image/png` หรือ `image/gif` ตัวอย่างจึงเป็นเพียงคำอธิบาย', example: '(binary image data)' },
      404: { description: 'ไม่พบประกาศ หรือประกาศนั้นไม่มีรูป', example: { success: false, message: 'Image not found' } },
    },
  },

  'GET /announcements/:id': {
    description:
      '**ทำอะไร:** ดูประกาศ 1 รายการตามรหัส ไม่ต้องล็อกอิน (สาธารณะ) ใช้เปิดหน้ารายละเอียดประกาศ\n\n' +
      '**server ทำอย่างไร:**\n1. หาประกาศตาม id\n2. ส่งกลับพร้อม `status` และ `imageUrl` (ถ้ามีรูป)\n\n' +
      '**ข้อควรระวัง:** endpoint นี้ **ไม่กรองตามสถานะ** ประกาศที่ยังไม่เริ่มหรือหมดอายุแล้วก็เปิดดูได้ถ้ารู้ id (รายการที่กรองเฉพาะ Active คือ `GET /announcements`)',
    pathParams: { id: { description: 'รหัสประกาศ เช่น anno-m2x9k1a4ab12', example: 'anno-m2x9k1a4ab12' } },
    responses: {
      200: { description: 'สำเร็จ', example: { success: true, announcement: announcementExample } },
      404: { description: 'ไม่พบประกาศตาม id', example: { success: false, message: 'ไม่พบประกาศข่าวสาร' } },
    },
  },

  'POST /announcements': {
    description:
      '**ทำอะไร:** แอดมินสร้างประกาศใหม่ พร้อมกำหนดช่วงเวลาเผยแพร่และรูปประกอบ (ไม่บังคับ)\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจหัวข้อ รายละเอียด วันเวลา และรูป (ตรวจชนิดไฟล์จากเนื้อไฟล์จริง ไม่เชื่อชนิดที่ client ระบุ)\n2. ถ้ามีวันสิ้นสุด ต้องไม่เป็นอดีต (เวลาไทย)\n3. บันทึก โดยผู้สร้าง (`author`) มาจากชื่อใน token ของแอดมิน\n4. เขียน audit log `CREATE_ANNOUNCEMENT`\n\n' +
      '**กฎสำคัญ:**\n- ฟิลด์: หัวข้อ, รายละเอียด, รูป, วัน/เวลาเริ่ม, วัน/เวลาสิ้นสุด หรือติ๊ก "No end date" (`noEndDate: true`) ไม่มีหมวดหมู่ (Category)\n- วันสิ้นสุดต้องอยู่หลังวันเริ่ม\n- รูป PNG/GIF ขนาดภาพเท่าไหร่ก็ได้ แต่ไฟล์ไม่เกิน 5 MB\n- สถานะ Scheduled/Active/Expired คำนวณที่ server ไม่ต้องส่งมา\n\n' +
      '**ข้อควรระวัง:** ผู้เรียกต้องเป็นแอดมิน ใช้ฐานข้อมูลจริงเท่านั้น (ไม่มีฐานข้อมูล = 503)',
    body: {
      description: 'ข้อมูลประกาศ (รูปส่งเป็น data URL แบบ base64 ภายใน JSON)',
      fields: announcementBodyFields,
      example: announcementBodyExample,
    },
    responses: {
      201: { description: 'สร้างสำเร็จ', example: { success: true, message: 'Announcement created', announcement: announcementExample } },
      400: announcement400,
      401: E401,
      403: E403_ADMIN,
      503: announcement503,
    },
  },

  'PUT /announcements/:id': {
    description:
      '**ทำอะไร:** แอดมินแก้ไขประกาศ ต้องส่งข้อมูลหลักครบเหมือนตอนสร้าง (ชื่อ รายละเอียด วันเวลา) ส่วนรูปควบคุมได้แยกต่างหาก\n\n' +
      '**server ทำอย่างไร:**\n1. ตรวจข้อมูลเหมือนตอนสร้าง\n2. หาประกาศเดิม (ไม่พบ = 404)\n3. ถ้า "วัน/เวลาสิ้นสุด" เปลี่ยนไปจากเดิม ค่าใหม่ต้องไม่เป็นอดีต (ประกาศที่หมดอายุแล้วแก้ข้อความได้โดยไม่แตะวันสิ้นสุด)\n4. อัปเดต และเขียน audit log `UPDATE_ANNOUNCEMENT`\n\n' +
      '**กฎสำคัญ (ฟิลด์ image):**\n- ไม่ส่ง `image` = คงรูปเดิม\n- ส่ง `image: null` = ลบรูป\n- ส่ง data URL ใหม่ = เปลี่ยนรูป\n\n' +
      '**ข้อควรระวัง:** ถ้าต้องการให้ประกาศไม่มีวันสิ้นสุดต้องส่ง `noEndDate: true` มาทุกครั้ง (ไม่ส่งแล้วไม่มี endDate จะได้ 400) การตรวจข้อมูล (400) ทำก่อนการหาประกาศ',
    pathParams: { id: { description: 'รหัสประกาศที่จะแก้ เช่น anno-m2x9k1a4ab12', example: 'anno-m2x9k1a4ab12' } },
    body: {
      description: 'รูปแบบเดียวกับ POST /announcements (ส่ง `image` เฉพาะเมื่อต้องการเปลี่ยน/ลบรูป)',
      fields: announcementBodyFields,
      example: { title: 'ประกาศวันหยุดบริษัท (แก้ไข)', description: 'บริษัทปิดทำการวันที่ 13 ตุลาคม 2569', startDate: '2026-10-27', startTime: '08:00', noEndDate: true },
    },
    responses: {
      200: { description: 'แก้ไขสำเร็จ', example: { success: true, message: 'Announcement updated', announcement: announcementExample } },
      400: announcement400,
      401: E401,
      403: E403_ADMIN,
      404: { description: 'ไม่พบประกาศตาม id', example: { success: false, message: 'Announcement not found' } },
      503: announcement503,
    },
  },

  'DELETE /announcements/:id': {
    description:
      '**ทำอะไร:** แอดมินลบประกาศ (รวมรูปประกอบ)\n\n' +
      '**server ทำอย่างไร:**\n1. อ่านประกาศเดิมไว้สำหรับ audit log\n2. ลบจากฐานข้อมูล (ไม่พบ = 404)\n3. เขียน audit log `DELETE_ANNOUNCEMENT`\n\n' +
      '**ข้อควรระวัง:** ลบแล้วกู้คืนไม่ได้ เฉพาะแอดมิน',
    pathParams: { id: { description: 'รหัสประกาศที่จะลบ เช่น anno-m2x9k1a4ab12', example: 'anno-m2x9k1a4ab12' } },
    responses: {
      200: { description: 'ลบสำเร็จ', example: { success: true, message: 'Announcement deleted' } },
      401: E401,
      403: E403_ADMIN,
      404: { description: 'ไม่พบประกาศตาม id', example: { success: false, message: 'Announcement not found' } },
      503: announcement503,
    },
  },
};
