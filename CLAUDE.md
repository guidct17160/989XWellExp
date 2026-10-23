# WellX989

แอป HR สำหรับบริษัทไทย: ลงเวลา, ลา, การอนุมัติ และระบบสุขภาพ/แต้มสะสม
มี 3 โปรเจกต์ใน repo เดียว ใช้ backend API ร่วมกัน

| โฟลเดอร์ | คืออะไร | Stack |
|---|---|---|
| `backend/` | REST API พอร์ต 5000 (`PORT`) route อยู่ใต้ `/api` | Node, Express, PostgreSQL (`pg`), JWT, bcryptjs |
| `frontend/` | เว็บแอดมิน / HR Dashboard (UI ภาษาไทย) | React, Vite, Tailwind, lucide-react |
| `app/` | แอปพนักงาน (iOS/Android/Web) | Expo 57, React Native, react-navigation, nativewind |

## คำสั่ง

รันทั้ง 3 พร้อมกัน: `npm run dev:all` (หรือ `npm run dev`) ครั้งแรกให้ `npm install` ที่ราก, `backend/`, `frontend/`, `app/` ก่อน
แอปรันผ่าน Metro (Expo) ในหน้าต่างเดียวกัน: สแกน QR ด้วย Expo Go/dev build บนมือถือ หรือกด `w` เปิดเว็บ, `a` เปิด Android emulator (คีย์ส่งเข้า Expo โดยตรง)
รันทีละตัวจากรากโปรเจกต์: `npm run dev:backend`, `npm run start:frontend`, `npm run dev:app` (Expo web), `npm run start:app` (Metro)

- เช็ก build เว็บ: `cd frontend && npx vite build`
- เช็ก syntax backend: `node --check <ไฟล์>` (`backend/tests/` ถูกลบแล้ว)
- **E2E เว็บ (Playwright):** `npm run test:e2e` จากราก (หรือ `cd frontend && npm run test:e2e`, `test:e2e:ui` เปิดโหมดดูภาพ) เทสอยู่ใน `frontend/e2e/` ตอนนี้ครอบคลุมหน้า Login + Forgot password (`TC-LOGIN-*`, `TC-FORGOT-*`) **ออโต้เฉพาะเคสระดับ Critical/High** (`npm run test:e2e:critical` รันเฉพาะ Critical) ระดับ Medium/Low ทดสอบมือ รายการทั้งหมดอยู่ที่ `docs/Login-TestCases.md` mock API ทั้งหมด ไม่ต้องเปิด backend/DB รันใน Google Chrome ที่ติดตั้งในเครื่อง (`channel: chrome`) ไม่ต้องโหลดเบราว์เซอร์เพิ่ม ต้องใช้ Playwright 1.5x ขึ้นไปเพราะรุ่นเก่ากว่าค้างบน Node 24
- เช็ก bundle แอป: `cd app && npx expo export --platform android --output-dir <โฟลเดอร์ชั่วคราว>`
- แอปใช้ native module (`expo-location`, AsyncStorage) อาจใช้ Expo Go ไม่ครบ ให้ใช้ dev build (`npx expo run:android`) หรือ EAS
- `backend/src/scripts/reset_database.js` จะ **TRUNCATE ตารางจริง** ห้ามรันถ้าไม่ได้ถูกสั่ง

## สถาปัตยกรรม backend

- `routes/api.js` → `controllers/*` → `services/dbStore.js` → `stores/*Store.js` โดย SQL อยู่ใน stores
- Stores ใช้ PostgreSQL เมื่อ `db.isPgConnected()` เป็นจริง ถ้าไม่ได้ใช้ `stores/memoryStore.js` แทน
  PostgreSQL คือแหล่งข้อมูลจริงเมื่อเชื่อมต่อได้ ถ้าเขียน PG ล้มเหลวต้อง **throw** ห้ามกลืน error แล้วตอบว่าสำเร็จ
- Schema อยู่ใน `config/database.js` (`CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS`)
  คอลัมน์ใหม่ต้องเพิ่มที่นี่ และ map snake_case → camelCase ใน store ข้อมูลพนักงานผ่าน `mapEmployeeRow`
  ใน `stores/userStore.js` ฟิลด์พนักงานใหม่ต้องเพิ่มที่นั่น
- Auth: JWT ผ่าน `utils/security.js` ตัวตรวจสิทธิ์อยู่ใน `middlewares/authMiddleware.js`:
  `requireAuth`, `requireAdmin`, `requireApprover`, `requireSuperAdmin` (เฉพาะ role `Super Admin`)
  ตัวตนผู้ใช้ต้องมาจาก token เท่านั้น ห้ามเชื่อ body, header หรือ query
- Error: ใช้ `utils/httpError.js` ตอบ `{ success:false, message }` พร้อมสถานะ 400/403/404/409 ฝั่ง client แสดง `message`
- วันที่และเวลาทั้งหมดใช้เวลา Asia/Bangkok (`utils/time.js`) ไม่ใช่ UTC
- `backend/.env` เก็บค่า DB, SMTP และ `JWT_SECRET` ห้ามแสดงหรือ commit

## กฎของระบบ

- **Role:** `Employee`, `Boss`, `SuperBoss`, `HR Admin`, `Admin`, `Super Admin` แอดมินใช้เว็บ พนักงานใช้แอป
- **การอนุมัติ** (ลา / แก้เวลา): ผู้อนุมัติทั่วไปอนุมัติได้ระดับ 1 (`รออนุมัติระดับ 2 (Superboss)`)
  ส่วน `Super Admin` / `SuperBoss` / `CEO` / `Director` อนุมัติขั้นสุดท้ายเป็น `อนุมัติแล้ว`
  Boss อนุมัติคำขอของตัวเองหรือของแผนกอื่นไม่ได้ สถานะที่ขึ้นต้นด้วย `รออนุมัติ` ถือว่ายังรออยู่
  ค่าสถานะเป็นข้อความภาษาไทยและ client จับคู่ด้วย substring จึงห้ามเปลี่ยนชื่อ
- **PIN เข้าสู่ระบบ** ผู้ใช้ตั้งเอง (`/auth/set-pin`) ไม่มีค่าเริ่มต้นจากวันเกิด
- **รีเซ็ตรหัสผ่าน:** พนักงาน (แอป) รีเซ็ตเองไม่ได้ ต้องแจ้ง Admin ให้รีเซ็ตให้ — Admin กด Reset password ที่เว็บ เมนู All Employees (`POST /employees/:id/reset-password` ระบบส่งลิงก์ตั้งรหัสผ่านไปที่อีเมลพนักงาน เปิดในแอป)
  `/auth/forgot-password` ใช้ได้เฉพาะแอดมินจากหน้าเว็บ (`portal: web`, ลิงก์เปิดหน้าเว็บ) ถ้าไม่ส่ง portal จะตอบ 403 ห้ามเพิ่มระบบรีเซ็ตรหัสผ่านเองในแอป
  บัญชีแอดมิน (`admins`) กับพนักงาน (`employees`) แยกกัน มีรหัสผ่านคนละชุด
- **ฟีเจอร์ที่ถูกตัดออกแล้ว:** สลิปเงินเดือน (Payslip, PIN ดูสลิป), เงินเดือนพนักงาน (salary), Employee Group และภารกิจเดินก้าว daily/weekly (`missions`) และ OT (ล่วงเวลา, ตารางถูกลบจาก DB แล้ว) ไม่มีในเว็บ แอป และ API อีกต่อไป
  ห้ามเพิ่มกลับโดยไม่ได้ถูกสั่ง ตาราง `payslips` / `employee_groups` / `missions` / `user_missions` และคอลัมน์ `employees.salary` จะถูก DROP ตอน backend เริ่มก็ต่อเมื่อ **ว่าง** เท่านั้น
  ถ้ายังมีข้อมูลจะถูกปล่อยทิ้งไว้เฉยๆ (ไม่มีโค้ดใช้) จนกว่าผู้ใช้จะสั่งลบเองหลังสำรองข้อมูล
- พนักงานเชื่อมกับแผนกด้วย id จริง (`employees.department_id` เป็น FK) ส่วนคอลัมน์ `department` เป็นค่าสำหรับแสดงผล
  ที่ store เขียนให้ตรงกันทุกครั้งที่ insert/update การเปลี่ยนชื่อแผนกจะ cascade ชื่อไปยังพนักงาน และลบแผนกไม่ได้ถ้ายังมีสมาชิก
- **Foreign key / constraint** สร้างโดย `INTEGRITY_MIGRATION_SQL` ใน `config/database.js` ทุกครั้งที่ backend เริ่ม (idempotent
  และถ้า FK ใดมีข้อมูลกำพร้า จะแจ้งเตือนแล้วข้าม ไม่ล้ม) `notifications` และ `audit_logs` จงใจไม่มี FK เพราะผู้รับ/ผู้กระทำเป็นได้ทั้ง
  employee และ admin วันที่ยังเก็บเป็น `VARCHAR` รูปแบบ `YYYY-MM-DD` (มี CHECK) ห้ามเปลี่ยนเป็น `DATE` เพราะเว็บ แอป และ backend
  เทียบวันที่เป็นสตริง
- ผังฐานข้อมูลอยู่ที่ `docs/ER-Diagram.md` ต้องอัปเดตทุกครั้งที่แก้สคีมา
- ผัง Class Diagram ของ backend (controller → store) อยู่ที่ `docs/Class-Diagram.md` อัปเดตเมื่อเพิ่ม/เปลี่ยนชื่อ controller, store หรือ method
- กฎนโยบายลาที่ HR ตั้ง (โควตา เพศที่ใช้ได้ ต้องแนบเอกสาร) ถูกบังคับที่ server กฎแจ้งล่วงหน้า / ลาย้อนหลัง / ลาติดต่อกันสูงสุด / ช่วงวันที่ลาได้ **ถูกตัดออกแล้ว** (คอลัมน์เดิมใน `leave_policies` ยังอยู่ใน DB แต่ไม่มีโค้ดใช้) ห้ามเพิ่มกลับโดยไม่ได้ถูกสั่ง
- แต้มและรางวัลทำใน transaction (แลกของรางวัลแบบ atomic, ใช้แต้มเกินไม่ได้)
- **สถานที่ลงเวลา (Work Locations):** แอดมินกำหนดที่เว็บ เมนู Attendance → Work Locations (ชื่อ ประเภท พิกัดจากแผนที่ รัศมีเมตร ใช้ได้ทุกคน/ตามแผนก/รายบุคคล)
  เก็บใน `work_locations` / `work_location_departments` / `work_location_members` แอปแสดงสถานที่เรียงตามระยะ (`GET /attendance/locations`) ให้พนักงานเลือก
  `clock-in` / `clock-out` ต้องส่ง `locationId` + พิกัด และ **server คำนวณระยะเอง** ถ้าอยู่นอกรัศมีตอบ 403 ห้ามเชื่อระยะที่แอปส่งมา
  ถ้ายังไม่มีสถานที่ Active เลยสักแห่ง จะไม่จำกัด (ลงเวลาได้จากที่ไหนก็ได้) จนกว่าแอดมินจะสร้างแห่งแรก
- **หมวดหมู่ของรางวัล (Reward Categories):** แอดมินจัดการที่เว็บ เมนู Reward → Reward Categories (`/reward-categories*` เฉพาะแอดมิน) เก็บใน `reward_categories` (ชื่อและ `code` ห้ามซ้ำ ไม่สนตัวพิมพ์ แอดมินกรอก code เองได้ ถ้าเว้นว่างระบบให้ `CAT-005` …)
  ทุก Reward ต้องเลือกหมวดหมู่ตอนสร้าง (`rewards.category_id` เป็น FK RESTRICT, `rewards.category` เป็นชื่อที่สำเนาไว้แสดงผล/ให้แอปกรองหมวด) เปลี่ยนชื่อหมวดจะอัปเดตชื่อใน Reward ทั้งหมด และลบหมวดที่ยังมี Reward ไม่ได้ (409)
  Reward เดิมที่มีแต่ข้อความ category จะถูกแปลงเป็นหมวดหมู่ให้เองตอน backend เริ่ม (เพิ่มข้อมูลอย่างเดียว ไม่ลบ)
- **รหัส Reward (`rewards.id`):** แอดมินกรอกเองได้ (ตัวอักษร/ตัวเลข/-/_ ไม่เกิน 30 ห้ามซ้ำ ไม่สนตัวพิมพ์) ถ้าเว้นว่างระบบให้รหัสสั้นถัดไปเอง (`rew-005`, `rew-006` …) ห้ามใช้รหัสแบบ timestamp ยาว
- **Quest** (เมนู Mission ในเว็บ): แอดมินกรอก **Code** ของ Quest เอง (`quests.code` ห้ามซ้ำ ตัวอักษร/ตัวเลข/-/_ ไม่เกิน 30) และสร้าง Quest 4 ขั้น (Settings → Content → Reward → Summary) ปัจจุบันเนื้อหามีแค่ Quiz
  เก็บใน `quests` / `quest_sections` / `quest_questions` / `quest_choices` / `quest_members` / `quest_progress` (API `/quests*` เฉพาะแอดมิน)
  คำถามมีแค่ Single Choice / Multi Choice และอนุมัติแบบ **Auto Approve** อย่างเดียว (ยังไม่มี Manual approve) Admin ตั้ง "Pass score" (ตอบถูกกี่ข้อถึงผ่าน) และเลือกรางวัลฟรีได้ (ไม่หักแต้ม)
  ฝั่งพนักงานในแอป (เมนู ภารกิจ): `GET /my-quests`, `GET /my-quests/:id` (ไม่ส่งเฉลย), `POST /my-quests/:id/submit` server ตรวจคำตอบเอง ถ้าผ่านและอยู่ในช่วงเวลา → อนุมัติทันที เพิ่มแต้มก้อนเดียวตามที่ Admin ตั้งทั้ง Quest (`quests.reward_points` ไม่มีแต้มรายข้อ เช่น ถูก 20 จาก 30 ข้อ ได้ 100 แต้ม) และแจกคูปองรางวัล ใน transaction เดียว (ผ่านแล้วทำซ้ำไม่ได้ ไม่จ่ายซ้ำ)
  ผ่านเมื่อตอบถูก >= `quests.pass_count` ข้อ (ค่า 0 = ต้องถูกทุกข้อ) ถ้ารางวัลหมดสต็อกยังจ่ายแต้มตามปกติ Quiz ที่ตั้ง "No edit allow" แก้เนื้อหาไม่ได้เมื่อ Quest เริ่มแล้ว (ตรวจที่ server)

## เว็บ (frontend)

- ทุก API call ใช้ `API_BASE` จาก `frontend/src/config.js` (ค่าเริ่มต้น `/api`) `main.jsx` ครอบ `fetch` ให้ใส่ Bearer token
  เฉพาะ URL ที่มี `/api` และ logout เมื่อได้ 401 ดังนั้น `VITE_API_BASE` ต้องมี `/api`
- **เส้นทาง (URL) ใช้ react-router (`BrowserRouter` ใน `main.jsx`)** เมนูละ 1 path อ่านง่าย กำหนดที่ `frontend/src/routes.js` (`MENU_PATHS`):
  `/dashboard`, `/admins`, `/audit-logs`, `/departments`, `/employees`, `/points`, `/attendance`, `/attendance/work-locations`, `/leave-policies`, `/missions`, `/rewards`, `/rewards/categories`
  หน้ารายละเอียดต่อท้ายด้วยรหัส เช่น `/departments/IT`, `/missions/new`, `/missions/<code ของ Quest>`, `/rewards/categories/CAT-002` (ใช้ hook `useDetailRoute('<menu key>')`) ใช้รหัสที่คนอ่านออก ไม่ใช้ id สุ่มภายใน
  ลิงก์เก่า `/?tab=<เมนู>&id=<รหัส>` ถูกแปลงเป็น path ใหม่เอง `/` และ path ที่ไม่มีอยู่ไปที่ `/dashboard` เพิ่มเมนูใหม่ต้องเพิ่มใน `MENU_PATHS` และตอนขึ้นระบบจริงเซิร์ฟเวอร์ต้องส่งทุก path กลับไปที่ `index.html` (SPA fallback) ไม่งั้น Refresh แล้ว 404
- ตรวจ `res.ok` / `data.success` เสมอ และแสดงความล้มเหลวให้ผู้ใช้เห็น ห้ามแสดงค่า hardcode หรือ mock เป็นข้อมูลจริง
- เว็บ **ไม่มี** หน้าอนุมัติ (`ApprovalManagement` / `TimeCorrectionsPage` ถูกลบแล้ว) การอนุมัติทำผ่านแอป

## แอปมือถือ

- Services ใน `app/src/services/*` เก็บข้อมูลผ่าน `window.localStorage` บนมือถือ `src/utils/nativeStorage.js`
  ติดตั้งตัวแทนที่เก็บลง AsyncStorage (token ของ session แยกเก็บใน `expo-secure-store`) และ `index.js` โหลดให้เสร็จก่อนเปิด `App` ให้คงแบบนี้ไว้ และห้ามเรียก AsyncStorage ตรงจาก services
- การแก้ไขข้อมูลต้อง **ส่ง server ก่อน**: เรียก API, throw เมื่อล้มเหลว แล้วค่อยอัปเดตสถานะในเครื่อง
  ห้ามบันทึกในเครื่องสิ่งที่ server ปฏิเสธ
- GPS บนมือถือใช้ `expo-location` ถ้าใช้ไม่ได้ให้ส่ง `null` ห้ามใช้พิกัดปลอม
- **ไฟล์แนบใบลา:** ใช้งานจริง พนักงานแนบรูป/PDF/Word (ไม่เกิน 5 MB) ในแอป → `POST /uploads/leave-attachment` เก็บใน `leave_attachments` (BYTEA) ใบลาเก็บ `attachment_url` เป็น `/uploads/leave/<id>`
  server ตรวจชนิดไฟล์จากเนื้อหาจริง และเปิดดูผ่านลิงก์อายุ 5 นาที (`GET /uploads/leave/:id/link` เฉพาะเจ้าของใบลาหรือผู้อนุมัติ) ถ้านโยบายตั้ง "Require Attachment" server ปฏิเสธใบลาที่ไม่มีไฟล์แนบ
- รูปถ่ายตอนลงเวลา (`photoUrl`) ยังเป็น placeholder (ยังไม่มี endpoint อัปโหลด)
- **รูปโปรไฟล์:** พนักงานเปลี่ยนรูปตัวเองได้ในแอป (หน้า Profile กดที่รูป → ถ่ายรูป/เลือกจากคลัง) โดยไม่ต้องพึ่ง Admin
  แอปย่อรูปเป็น JPEG กว้าง 320px แล้วส่ง data URL ไป `PUT /auth/profile/avatar` เก็บใน `employees.avatar_url` (server ตรวจชนิดและขนาด)

## ข้อตกลงการทำงาน

- UI เป็นภาษาไทย ข้อความใหม่ที่ผู้ใช้เห็นต้องเป็นภาษาไทยและเข้ากับสไตล์เดิม
- แก้เฉพาะจุด ไม่ refactor หรือเปลี่ยนหน้าตาถ้าไม่ได้ขอ
- ถามก่อนลบข้อมูลจริงใน database และสำรองข้อมูลก่อนเสมอ
