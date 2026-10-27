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
- เช็ก syntax backend: `node --check <ไฟล์>`
- **รันเทสทั้ง 3 ชุดต่อกัน:** `npm run test:all` จากราก (backend → เว็บ → แอป หยุดทันทีที่ชุดใดล้ม) แนะนำรันก่อน push
- **เทส backend (API):** `npm run test:backend` จากราก (หรือ `cd backend && npm test`) ใช้ `node:test` + `fetch` ไม่มี package เพิ่ม เทสอยู่ใน `backend/tests/` (ตอนนี้ 111 เคส ใช้เวลาราว 1 นาที) เปิด backend จริงบน **ฐานทดสอบแยก `wellx989_test` เท่านั้น** ไม่แตะฐานจริง (`helpers/harness.js` บังคับ `DATABASE_URL` เป็นฐานทดสอบ เพราะ `backend/.env` มี `DATABASE_URL` ของฐานจริง และตัด SMTP ไม่ให้ส่งอีเมลจริง) ครั้งแรกสร้างฐานก่อนด้วย `npm run test:backend:db` (ใช้ผู้ใช้ PostgreSQL เดียวกับ `.env`) แต่ละไฟล์ล้างข้อมูลในฐานทดสอบเอง ห้ามชี้เทสไปฐานจริง ครอบคลุม: ล็อกอิน/สิทธิ์ role, ลงเวลา + สถานที่ + แต้มตรงเวลา + ตัดเที่ยงคืน, อนุมัติ (Boss จบเอง, SuperBoss, ประวัติแยกบัญชี), ลา/นโยบาย/ไฟล์แนบ, แต้ม/รางวัล (atomic), Quest, แผนก/พนักงาน/ประกาศ/แจ้งเตือน/audit, PIN, บัญชีแอดมิน เคสที่ขึ้นกับเวลาปัจจุบันจะ skip เองใกล้เที่ยงคืนหรือก่อน 01:02 น.
- **E2E เว็บ (Playwright):** `npm run test:e2e` จากราก (หรือ `cd frontend && npm run test:e2e`, `test:e2e:ui` เปิดโหมดดูภาพ) เทสอยู่ใน `frontend/e2e/` ครอบคลุมทุกเมนู (Login/Forgot/Set password, Dashboard, Attendance, All Employees, Points, Mission/Quest, Rewards + Categories, Announcements, Departments, Admins, Audit Logs, Settings ทั้ง 3 หน้า, Routing, Session หมดอายุ) ตอนนี้ 173 เคส (ผ่านครบ ไม่มี `test.fixme` เหลือ) **ออโต้เฉพาะเคสระดับ Critical/High** (`npm run test:e2e:critical` รันเฉพาะ Critical) ระดับ Medium/Low ทดสอบมือ รายการ Login อยู่ที่ `docs/Login-TestCases.md` mock API ทั้งหมด ไม่ต้องเปิด backend/DB รันใน Google Chrome ที่ติดตั้งในเครื่อง (`channel: chrome`) ไม่ต้องโหลดเบราว์เซอร์เพิ่ม ต้องใช้ Playwright 1.5x ขึ้นไปเพราะรุ่นเก่ากว่าค้างบน Node 24 ตั้ง `workers: 2` ใน config เพราะ Vite dev server ตัวเดียวรับขนานมากกว่านี้ไม่ไหว (เคสสุ่มหมดเวลา)
- **E2E แอปพนักงาน (Playwright บน Expo เวอร์ชันเว็บ):** `npm run test:e2e:app` จากราก (หรือ `cd app && npm run test:e2e`, `test:e2e:critical`) เทสอยู่ใน `app/e2e/` (อ่าน `app/e2e/README.md`) ตอนนี้ 103 เคส (ผ่านครบ ไม่มี `test.fixme` เหลือ) `serve.js` สั่ง `expo export --platform web` ให้เองเมื่อโค้ดใน `app/` ใหม่กว่า export (ครั้งแรกราว 1 นาที เก็บใน temp ไม่อยู่ใน repo) mock `/api/**` ทั้งหมด ตรวจได้เฉพาะสิ่งที่แอปส่งและแสดง ตรรกะ server อยู่ในเทส backend กล้อง/แกลเลอรีและ native module ของมือถือจริงจำลองบนเว็บไม่ได้
- **CI:** `.github/workflows/ci.yml` รัน 3 ชุดข้างบนทุกครั้งที่ push / pull request (backend ใช้ PostgreSQL service `wellx989_test`) ไฟล์นี้ยังไม่เคยรันบน GitHub จริง รอบแรกอาจต้องปรับ
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
- **การอนุมัติ** (ลา / แก้เวลา): **การอนุมัติครั้งเดียวจบ ไม่ส่งต่อ** Boss อนุมัติ/ไม่อนุมัติคำขอของ **Employee** ในแผนกเดียวกันได้โดยตรง ผลเป็น `อนุมัติแล้ว` / `ไม่อนุมัติ` ทันที (สถานะเริ่มต้นของคำขอ Employee ที่มี Boss ในแผนก = `รออนุมัติระดับ 1 (Boss)`)
  คำขอของ Boss และของพนักงานในแผนกที่ไม่มี Boss เป็น `รออนุมัติระดับ 2 (Superboss)` ให้ `Super Admin` / `SuperBoss` / `CEO` / `Director` ตัดสินขั้นสุดท้าย
  Boss อนุมัติคำขอของตัวเอง ของ Boss ด้วยกัน หรือของแผนกอื่นไม่ได้ สถานะที่ขึ้นต้นด้วย `รออนุมัติ` ถือว่ายังรออยู่
  ประวัติการอนุมัติแยกตามบัญชี (`GET /approvals/history` ส่งเฉพาะที่ผู้ใช้ตัดสินใจเอง ดูจาก `decided_by`/`level1_by` ในตาราง `leave_requests` / `time_corrections`) Employee เปิดหน้าอนุมัติไม่ได้
  ค่าสถานะเป็นข้อความภาษาไทยและ client จับคู่ด้วย substring จึงห้ามเปลี่ยนชื่อ
- **Role `SuperBoss` ไม่ถูกจำกัดเวลา และไม่ต้องรออนุมัติ:** เข้างาน/ออกงานได้ทุกเวลา ไม่ถูกบันทึกเป็น `สาย` (server ดู role จาก employee record ใน `addClockIn`) และไม่ถูกนับว่า ทำงานไม่ครบเวลา (เว็บ Attendance ใช้ `role` จากรายงาน, แอปใช้ `workRules.isLateAt` / `requiredSeconds` ที่คืนค่าไม่จำกัดเมื่อ session เป็น SuperBoss) ยังต้องอยู่ในพื้นที่สถานที่ลงเวลา (Work Locations) เหมือนเดิม และคำขอปรับปรุงเวลาของ SuperBoss อนุมัติและบันทึกทันที (`addTimeCorrection` เรียก `processApprovalRequest` ด้วยตัวเอง + audit log) ใบลายังต้องอนุมัติตามเดิม
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
- **สถานที่ลงเวลา (Work Locations):** แอดมินกำหนดที่เว็บ เมนู Settings → Work Locations (ชื่อ ประเภท พิกัดจากแผนที่ รัศมีเมตร ใช้ได้ทุกคน/ตามแผนก/รายบุคคล)
  ตำแหน่งตอนเข้างานเก็บใน `attendance.latitude/longitude/location_name` ตอนออกงานเก็บใน `check_out_latitude/check_out_longitude/check_out_location_name` (server เติมชื่อสถานที่จาก `locationId` ที่ตรวจแล้ว) เว็บ Attendance แสดงเป็นคอลัมน์ GPS Clock In / GPS Clock Out แถวเก่าก่อนมีคอลัมน์นี้และกะที่ยังไม่ออกงานแสดง `-`
  ฟอร์มมีช่องค้นหาตำแหน่ง (`frontend/src/components/locationSearch.js`): วางพิกัด / ลิงก์ Google Maps ที่มีพิกัด ปักหมุดทันที ส่วนที่อยู่หรือชื่อสถานที่ค้นผ่าน OpenStreetMap Nominatim (ไม่ใช้ Google API ไม่ต้องมี key ลิงก์สั้น maps.app.goo.gl อ่านไม่ได้)
  เก็บใน `work_locations` / `work_location_departments` / `work_location_members` แอปแสดงสถานที่เรียงตามระยะ (`GET /attendance/locations`) ให้พนักงานเลือก
  `clock-in` / `clock-out` ต้องส่ง `locationId` + พิกัด และ **server คำนวณระยะเอง** ถ้าอยู่นอกรัศมีตอบ 403 ห้ามเชื่อระยะที่แอปส่งมา
  **ต้องอยู่ในพื้นที่ที่กำหนดเท่านั้นถึงลงเวลาได้ ไม่มีปุ่มยืนยัน:** ถ้ายังไม่มีสถานที่ Active เลยสักแห่ง (หรือไม่มีสถานที่ที่พนักงานใช้ได้/อยู่ใกล้) พนักงานเข้างาน/ออกงานไม่ได้ server ตอบ 403 และแอปไม่แสดงปุ่มยืนยัน ต้องให้แอดมินสร้างสถานที่อย่างน้อย 1 แห่งก่อน
- **ประกาศ (Announcements):** แอดมินจัดการที่เว็บ เมนู Announcements (`/announcements`) ข้อมูลจริงจากตาราง `announcements` เท่านั้น **ห้ามใส่ข้อมูลจำลอง/seed** (ลบ `seed_announcements.js` และแถวตัวอย่างออกจาก DB แล้ว ไม่มีโค้ดสร้างประกาศตัวอย่าง)
  ฟิลด์: ชื่อ, รายละเอียด (**ไม่มีหมวดหมู่ Category** คอลัมน์ `category` เดิมยังอยู่ใน DB แต่ไม่มีโค้ดใช้), รูป (PNG/GIF **ขนาดเท่าไหร่ก็ได้** ไม่เกิน 5 MB server ตรวจชนิดจากเนื้อไฟล์จริง เก็บเป็น BYTEA และเสิร์ฟที่ `GET /announcements/:id/image`), วันที่/เวลาเริ่ม, วันที่/เวลาสิ้นสุด หรือติ๊ก "No end date"
  สถานะ Scheduled / Active / Expired คำนวณที่ server เวลาไทย วันสิ้นสุดต้องหลังวันเริ่ม และตั้งค่าเป็นอดีตไม่ได้ (ยกเว้นตอนแก้ไขโดยไม่เปลี่ยนวันสิ้นสุด)
  **ในแอป หน้า Home ไม่แสดงประกาศ** ประกาศที่ Active จะเข้าไปอยู่ในกระดิ่งแจ้งเตือน (`notificationStorage.sync()` ดึง `/announcements` มารวมกับ `/notifications` เป็นรายการ `anno-<id>` สถานะอ่านแล้วเก็บในเครื่อง แอปเช็กทุก 1 นาทีขณะเปิดหน้า Home และเด้งแบนเนอร์เมื่อมีประกาศใหม่ ยังไม่ใช่ push จริง) ส่วน Home แสดงภารกิจ (Quest) ที่ยังทำได้แทน แอป **ไม่มีหน้ารายการประกาศ** `AnnouncementsScreen` เป็นหน้ารายละเอียดอย่างเดียว เปิดจากกระดิ่ง/แบนเนอร์ (ปุ่มกลับและ รับทราบ ไปหน้าแจ้งเตือน) ถ้าเปิดโดยไม่มีประกาศส่งมา (เช่น รีเฟรชเว็บ) จะเด้งไปหน้าแจ้งเตือน
  แอป ตั้งค่า → การแจ้งเตือน มีสวิตช์ 2 ตัว (เก็บในเครื่องต่อผู้ใช้ `notification_prefs_<user>` ผ่าน `notificationStorage.getPrefs/setPrefs`): `general` (แจ้งเตือนงาน) และ `news` (ประกาศ) ปิดแล้วรายการยังอยู่ในหน้าแจ้งเตือน แต่ไม่เด้งแบนเนอร์และไม่นับในตัวเลขกระดิ่ง ยังไม่มีการเตือนบันทึกเวลา (เอาสวิตช์ออกแล้ว) และยังไม่ใช่ push จริง
  API: `GET /announcements` (สาธารณะ เฉพาะที่ Active ตอนนี้ แอปใช้) , `GET /announcements/all` (แอดมิน ทุกสถานะ), `POST` / `PUT /:id` / `DELETE /:id` (แอดมิน)
- **เวลาทำงาน / ชั่วโมง / แต้มเข้างานตรงเวลา (Work Time Settings):** แอดมินตั้งที่เว็บ เมนู Settings → Work Time Settings (`/settings/work-time`, `GET/PUT /settings/work-time`, PUT เฉพาะแอดมิน) 4 ค่า:
  เวลาเริ่มงาน `workStartTime` (นับชั่วโมงจากเวลานี้ คนมาก่อนก็นับจากนี้ เช่น 08:00), เวลาสาย `lateAfterTime` (เข้าหลังเวลานี้ = สาย เช่น 09:00), ชั่วโมงทำงานต่อวัน `requiredHours` (ต่ำกว่า = ทำงานไม่ครบเวลา, 9) และแต้ม `onTimePoints` (0 = ปิด)
  เก็บใน `system_settings` (JSON `app_settings` คีย์ `workTimeStart` / `lateThresholdTime` / `workHoursPerDay` / `onTimePoints` ไม่มีตารางใหม่) ตรวจค่าที่ `utils/workRules.js` (เวลาเริ่มงานต้องไม่ช้ากว่าเวลาสาย, ชั่วโมง 1-16 ทีละ 0.5, แต้มเป็นจำนวนเต็ม 0-100,000)
  **ห้ามฮาร์ดโค้ด 09:00 / 08:00 / 9 ชม.** เว็บอ่านจาก API แอปอ่านผ่าน `app/src/services/workRules.js` และ server ใช้ `workRules.fromSettings`
  **แจกแต้ม 2 เงื่อนไข ตอนกดออกงาน (`clock-out`):** 1) เข้างานตรงเวลา (สถานะตอนเข้างานไม่ใช่ `สาย`) 2) ทำงานครบชั่วโมงที่ตั้ง (นับจากเวลาเริ่มงาน) ถ้าครบทั้งสองและตั้งแต้มไว้ server เพิ่มแต้ม + บันทึก `point_transactions` (หมวด `Attendance`) ใน transaction เดียวกับการบันทึกเวลาออก ล็อกแถวพนักงานก่อนเพื่อกันกดซ้ำ จ่ายครั้งเดียวต่อวัน และตอบ `pointsAwarded` ให้แอปแสดง (ออกงานอัตโนมัติตอนเที่ยงคืนไม่ได้แต้ม; คำขอแก้เวลาที่อนุมัติแล้วยังไม่แจกแต้ม)
  เวลาสายใหม่มีผลกับการเข้างานตั้งแต่ตอนนั้น แถวที่บันทึกว่าสาย/ปกติไปแล้วคงสถานะเดิม ส่วนกฎชั่วโมงใช้ตอนแสดงผล (ย้อนหลังด้วย)
- **หมวดหมู่ของรางวัล (Reward Categories):** แอดมินจัดการที่เว็บ เมนู Reward → Reward Categories (`/reward-categories*` เฉพาะแอดมิน) เก็บใน `reward_categories` (ชื่อและ `code` ห้ามซ้ำ ไม่สนตัวพิมพ์ แอดมินกรอก code เองได้ ถ้าเว้นว่างระบบให้ `CAT-005` …)
  ทุก Reward ต้องเลือกหมวดหมู่ตอนสร้าง (`rewards.category_id` เป็น FK RESTRICT, `rewards.category` เป็นชื่อที่สำเนาไว้แสดงผล/ให้แอปกรองหมวด) เปลี่ยนชื่อหมวดจะอัปเดตชื่อใน Reward ทั้งหมด และลบหมวดที่ยังมี Reward ไม่ได้ (409)
  Reward เดิมที่มีแต่ข้อความ category จะถูกแปลงเป็นหมวดหมู่ให้เองตอน backend เริ่ม (เพิ่มข้อมูลอย่างเดียว ไม่ลบ)
- **รหัส Reward (`rewards.id`):** แอดมินกรอกเองได้ (ตัวอักษร/ตัวเลข/-/_ ไม่เกิน 30 ห้ามซ้ำ ไม่สนตัวพิมพ์) ถ้าเว้นว่างระบบให้รหัสสั้นถัดไปเอง (`rew-005`, `rew-006` …) ห้ามใช้รหัสแบบ timestamp ยาว
- **Quest** (เมนู Mission ในเว็บ): แอดมินกรอก **Code** ของ Quest เอง (`quests.code` ห้ามซ้ำ ตัวอักษร/ตัวเลข/-/_ ไม่เกิน 30) และสร้าง Quest 4 ขั้น (Settings → Content → Reward → Summary) ปัจจุบันเนื้อหามีแค่ Quiz
  เก็บใน `quests` / `quest_sections` / `quest_questions` / `quest_choices` / `quest_members` / `quest_progress` (API `/quests*` เฉพาะแอดมิน)
  คำถามมีแค่ Single Choice / Multi Choice และอนุมัติแบบ **Auto Approve** อย่างเดียว (ยังไม่มี Manual approve) Admin ตั้ง "Pass score" (ตอบถูกกี่ข้อถึงผ่าน) และเลือกรางวัลฟรีได้ (ไม่หักแต้ม)
  ฝั่งพนักงานในแอป (เมนู ภารกิจ): `GET /my-quests`, `GET /my-quests/:id` (ไม่ส่งเฉลย), `POST /my-quests/:id/submit` server ตรวจคำตอบเอง ถ้าผ่านและอยู่ในช่วงเวลา → อนุมัติทันที เพิ่มแต้มก้อนเดียวตามที่ Admin ตั้งทั้ง Quest (`quests.reward_points` ไม่มีแต้มรายข้อ เช่น ถูก 20 จาก 30 ข้อ ได้ 100 แต้ม) และแจกคูปองรางวัล ใน transaction เดียว (**ทำได้ครั้งเดียวต่อ Quest** ผ่านแล้วทำซ้ำไม่ได้ไม่จ่ายซ้ำ ถ้าส่งแล้วไม่ผ่านก็ปิด Quest นั้นของคนนั้น ทำซ้ำไม่ได้ ตอบ 409 แต่ Quest อื่นยังทำได้ตามปกติ แอปมีหน้ายืนยันก่อนส่ง)
  ผ่านเมื่อตอบถูก >= `quests.pass_count` ข้อ (ค่า 0 = ต้องถูกทุกข้อ) ถ้ารางวัลหมดสต็อกยังจ่ายแต้มตามปกติ Quiz ที่ตั้ง "No edit allow" แก้เนื้อหาไม่ได้เมื่อ Quest เริ่มแล้ว (ตรวจที่ server)

## เว็บ (frontend)

- ทุก API call ใช้ `API_BASE` จาก `frontend/src/config.js` (ค่าเริ่มต้น `/api`) `main.jsx` ครอบ `fetch` ให้ใส่ Bearer token
  เฉพาะ URL ที่มี `/api` และ logout เมื่อได้ 401 ดังนั้น `VITE_API_BASE` ต้องมี `/api`
- **เส้นทาง (URL) ใช้ react-router (`BrowserRouter` ใน `main.jsx`)** เมนูละ 1 path อ่านง่าย กำหนดที่ `frontend/src/routes.js` (`MENU_PATHS`):
  `/dashboard`, `/admins`, `/audit-logs`, `/departments`, `/employees`, `/points`, `/attendance`, `/missions`, `/announcements`, `/rewards`, `/rewards/categories` และกลุ่ม Settings: `/settings/work-time`, `/settings/work-locations`, `/settings/leave-policies`
  **ลำดับเมนูข้าง:** Dashboard, Employee & Point, Attendance, Mission, Reward (Rewards Catalog, Reward Categories), Announcements, Organization, Settings, Role & Permission (เฉพาะ Super Admin) หน้าที่ตั้งครั้งเดียวอยู่ใน Settings path เก่า (`/attendance/work-locations`, `/attendance/settings`, `/leave-policies`) ยังเปิดได้และถูกพาไป path ใหม่เอง (`movedPath` ใน `routes.js`)
  หน้ารายละเอียดต่อท้ายด้วยรหัส เช่น `/departments/IT`, `/missions/new`, `/missions/<code ของ Quest>`, `/rewards/categories/CAT-002` (ใช้ hook `useDetailRoute('<menu key>')`) ใช้รหัสที่คนอ่านออก ไม่ใช้ id สุ่มภายใน
  ลิงก์เก่า `/?tab=<เมนู>&id=<รหัส>` ถูกแปลงเป็น path ใหม่เอง `/` และ path ที่ไม่มีอยู่ไปที่ `/dashboard` เพิ่มเมนูใหม่ต้องเพิ่มใน `MENU_PATHS` และตอนขึ้นระบบจริงเซิร์ฟเวอร์ต้องส่งทุก path กลับไปที่ `index.html` (SPA fallback) ไม่งั้น Refresh แล้ว 404
- **ธีมเว็บ: โทนสว่าง พื้นขาว/เทาอ่อน (`bg-slate-50` หน้า, `bg-white` การ์ด, ตัวอักษร `slate-900`) สีม่วงเป็นหลัก (`violet-*`, `#7C3AED`) มีสีฟ้า (`#3B82F6`/sky) เสริม** แถบเมนูซ้ายเป็นสีฟ้า `#3B82F6` ตัวอักษรขาว หน้าที่เปิดอยู่เป็นแคปซูลขาวตัวอักษรน้ำเงิน ห้ามใช้พื้นดำ `#0B0D13` / `#141722` อีก สีแดงเก็บไว้เฉพาะความหมายผิดพลาด/คำเตือน/ลบ/สาย ใช้คลาส `danger-*` (Tailwind ตั้ง `danger` = พาเลต red ใน `tailwind.config.js`) ห้ามใช้ `red-*` ตรงๆ สำหรับสีแบรนด์
- **session หมดอายุ (เว็บ):** ไม่เด้งไปหน้า Login ทันที แต่ขึ้น popup "Session expired" บนหน้าที่ใช้อยู่ (`App.jsx`, เกิดจากไม่ใช้งาน 30 นาที, ครบ 8 ชม. หรือ server ตอบ 401 ผ่าน event `wellx989:session-expired` จาก `main.jsx`) กด OK แล้วออกจากระบบและไป `/login` หน้า Login ไม่แสดงข้อความหมดอายุ
- ตรวจ `res.ok` / `data.success` เสมอ และแสดงความล้มเหลวให้ผู้ใช้เห็น ห้ามแสดงค่า hardcode หรือ mock เป็นข้อมูลจริง
- เว็บ **ไม่มี** หน้าอนุมัติ (`ApprovalManagement` / `TimeCorrectionsPage` ถูกลบแล้ว) การอนุมัติทำผ่านแอป

## แอปมือถือ

- Services ใน `app/src/services/*` เก็บข้อมูลผ่าน `window.localStorage` บนมือถือ `src/utils/nativeStorage.js`
  ติดตั้งตัวแทนที่เก็บลง AsyncStorage (token ของ session แยกเก็บใน `expo-secure-store`) และ `index.js` โหลดให้เสร็จก่อนเปิด `App` ให้คงแบบนี้ไว้ และห้ามเรียก AsyncStorage ตรงจาก services
- การแก้ไขข้อมูลต้อง **ส่ง server ก่อน**: เรียก API, throw เมื่อล้มเหลว แล้วค่อยอัปเดตสถานะในเครื่อง
  ห้ามบันทึกในเครื่องสิ่งที่ server ปฏิเสธ
- **วันที่ "วันนี้" ในแอปต้องเป็นเวลาไทย** ใช้ `todayIsoBkk()` จาก `app/src/utils/bangkokDate.js` ห้ามใช้ `new Date().toISOString().split('T')[0]` เพราะเป็น UTC ช่วง 00:00-06:59 น. จะได้วันเมื่อวาน ทำให้ปุ่มเข้างาน/ออกงานไม่ตรงกับ server
- **PIN ล็อกตอนเปิดแอป:** session ที่กู้คืนจากที่เก็บในเครื่องตอนเริ่มแอปและมี PIN ต้องปลดล็อกก่อน (`authService.isPinLocked()` / `unlockPin()`) `App.js` (`enforcePinLock`) พาไป `PinLock` เมื่อเปิดหน้าอื่นที่ไม่ใช่ Splash/Onboarding/Login/ForgotPassword/SetPassword/PinLock (กันการเปิด URL ลึกบนเว็บที่ข้าม Splash) ใส่ PIN สำเร็จ ล็อกอินด้วยรหัสผ่าน หรือตั้ง PIN สำเร็จจึงปลดล็อก
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
