# WellX989

ระบบ HR สำหรับบริษัทไทย: ลงเวลา, ลา, การอนุมัติ, ภารกิจ (Quest) และระบบแต้มสะสม/ของรางวัล
ใช้ backend API ชุดเดียวกัน 3 ส่วน: เว็บแอดมิน, แอปพนักงาน และ REST API

| โฟลเดอร์ | คืออะไร | Stack | พอร์ต |
|---|---|---|---|
| [`backend/`](backend) | REST API (route อยู่ใต้ `/api`) | Node.js, Express, PostgreSQL (`pg`), JWT, bcryptjs | 5000 |
| [`frontend/`](frontend) | เว็บแอดมิน / HR Dashboard | React 18, Vite, Tailwind, react-router, lucide-react, Leaflet | 3008 |
| [`app/`](app) | แอปพนักงาน (iOS / Android / Web) | Expo SDK 57, React Native, react-navigation, nativewind | 8081 (Metro) |

```
WellX989/
├── app/        แอปพนักงาน (Expo / React Native)
├── backend/    REST API
├── frontend/   เว็บแอดมิน
├── docs/       ER Diagram, Class Diagram, รายการเทสต์ Login
└── CLAUDE.md   กฎของระบบและข้อตกลงการทำงานโดยละเอียด
```

## เริ่มต้นใช้งาน

**สิ่งที่ต้องมี:** Node.js (ทดสอบกับ v24), PostgreSQL, Google Chrome (สำหรับเทสต์ E2E) และแอป Expo Go บนมือถือ (SDK 57) ถ้าจะลองแอปบนเครื่องจริง

```bash
# 1) ติดตั้ง package (ครั้งแรก)
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix app install

# 2) ตั้งค่า environment (ดูหัวข้อถัดไป)
cp backend/.env.example backend/.env     # แล้วแก้ค่าให้ตรงกับเครื่อง

# 3) รันทั้ง 3 ส่วนพร้อมกัน
npm run dev:all
```

เมื่อรันแล้ว:
- **Backend:** http://localhost:5000 (API ที่ `/api`) สร้าง/ปรับตารางในฐานข้อมูลให้เองตอนเริ่ม
- **เว็บแอดมิน:** http://localhost:3008
- **แอป:** Metro รันในหน้าต่างเดียวกัน สแกน QR ด้วย Expo Go บนมือถือ หรือกด `w` เปิดเว็บ, `a` เปิด Android emulator

รันทีละส่วน:

| คำสั่ง (จากรากโปรเจกต์) | ทำอะไร |
|---|---|
| `npm run dev:backend` | backend ด้วย nodemon |
| `npm run start:backend` | backend แบบปกติ |
| `npm run start:frontend` | เว็บแอดมิน (Vite) |
| `npm run dev:app` | แอปบน Expo Web |
| `npm run start:app` | Metro bundler ของแอป |

## ตั้งค่า Environment

`backend/.env` เก็บค่า DB, SMTP และ `JWT_SECRET` **ห้ามแสดงหรือ commit** (อยู่ใน `.gitignore` แล้ว) ใช้ [`backend/.env.example`](backend/.env.example) เป็นแม่แบบ

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `DATABASE_URL` หรือ `PG*` | การเชื่อมต่อ PostgreSQL |
| `JWT_SECRET` | คีย์เซ็น JWT (เปลี่ยนเมื่อใช้งานจริง) |
| `PORT` | พอร์ต backend (ค่าเริ่มต้น 5000) |
| SMTP | ส่งอีเมลลิงก์ตั้งรหัสผ่าน |

ฝั่งเว็บเรียก API ผ่าน `API_BASE` ใน `frontend/src/config.js` (ค่าเริ่มต้น `/api`, Vite proxy ไปที่ `localhost:5000`)
ฝั่งแอปหา IP ของเครื่องที่รัน backend จาก Expo เอง (`app/.env.example` มีแค่ `BROWSER=none`)

## เส้นทางของเว็บแอดมิน

หน้า Login ใช้ `/login`, `/forgot-password`, `/set-password` ส่วนหน้าหลังล็อกอินใช้ react-router เมนูละ 1 path (กำหนดที่ [`frontend/src/routes.js`](frontend/src/routes.js))

| เมนู | Path |
|---|---|
| Dashboard | `/dashboard` |
| Administrators & Roles (Super Admin) | `/admins` |
| Security & Audit Logs (Super Admin) | `/audit-logs` |
| Main Departments | `/departments` (รายละเอียด `/departments/<code>`) |
| All Employees | `/employees` |
| Points Balance & History | `/points` |
| Daily Attendance | `/attendance` |
| Settings → Work Locations | `/settings/work-locations` |
| Settings → Work Time Settings | `/settings/work-time` |
| Settings → Leave Quotas & Policies | `/settings/leave-policies` |
| Quest Management | `/missions` (สร้าง `/missions/new`, แก้ `/missions/<code>`) |
| Announcements | `/announcements` |
| Rewards Catalog | `/rewards` |
| Reward → Reward Categories | `/rewards/categories` (รายละเอียด `/rewards/categories/<code>`) |

ลิงก์เก่าแบบ `/?tab=<เมนู>&id=<รหัส>` ยังเปิดได้และถูกแปลงเป็น path ใหม่เอง
**ตอนขึ้นระบบจริง** เซิร์ฟเวอร์ต้องส่งทุก path กลับไปที่ `index.html` (SPA fallback) ไม่งั้น Refresh แล้วได้ 404

## ฟีเจอร์หลัก

- **ตั้งเวลาทำงาน (Work Time Settings):** แอดมินตั้งเวลาเริ่มงาน (นับชั่วโมงจากเวลานี้), เวลาสาย (เข้าหลังเวลานี้ = สาย), ชั่วโมงทำงานต่อวัน และแต้ม ระบบแจกแต้มให้ตอนกดออกงาน ถ้าเข้างานตรงเวลาและทำงานครบชั่วโมง (วันละครั้ง) เว็บและแอปใช้ค่าเดียวกัน
- **ประกาศ (Announcements):** แอดมินสร้างประกาศพร้อมรูป (PNG/GIF ขนาดเท่าไหร่ก็ได้ ไม่เกิน 5 MB) กำหนดช่วงเวลาแสดง (หรือไม่มีวันสิ้นสุด) พนักงานเห็นในแอปเฉพาะประกาศที่กำลังแสดงอยู่ ข้อมูลทั้งหมดมาจากฐานข้อมูลจริง
- **ลงเวลา + สถานที่ (Work Locations):** แอดมินกำหนดสถานที่ รัศมี และผู้ใช้ได้ (ทุกคน/แผนก/รายบุคคล) บนแผนที่ พนักงานต้องอยู่ในรัศมีจึงลงเวลาได้ server คำนวณระยะเอง
  สถานะ: สาย (เข้าหลัง 09:00) → ทำงานไม่ครบ 9 ชั่วโมง → ปกติ
- **ลา (Leave):** นโยบายตั้งที่เว็บ (โควตา เพศที่ใช้ได้ ต้องแนบเอกสาร) บังคับที่ server พนักงานแนบรูป/PDF/Word ไม่เกิน 5 MB จากแอป
- **อนุมัติ:** ผู้อนุมัติทั่วไปอนุมัติระดับ 1 ส่วน Super Admin / SuperBoss / CEO / Director อนุมัติขั้นสุดท้าย (ทำผ่านแอป)
- **Quest (เมนู Mission):** แอดมินสร้าง Quest 4 ขั้น (Settings → Content → Reward → Summary) มี Code ที่ไม่ซ้ำ, Quiz แบบ Single/Multi Choice, ตั้งจำนวนข้อที่ต้องถูก, แต้มก้อนเดียว และของรางวัลฟรี พนักงานทำในแอป (ทำได้ครั้งเดียวต่อ Quest ถ้าไม่ผ่านจะทำซ้ำไม่ได้) server ตรวจคำตอบและจ่ายแต้มใน transaction เดียว
- **แต้มและของรางวัล:** แลกของรางวัลแบบ atomic (ใช้แต้มเกินไม่ได้) Reward มีหมวดหมู่ (Reward Categories) และ Code ของตัวเอง
- **บัญชีและรหัสผ่าน:** PIN 6 หลักผู้ใช้ตั้งเอง พนักงานรีเซ็ตรหัสผ่านเองในแอปไม่ได้ ต้องให้ Admin กด Reset password ที่เว็บ (ระบบส่งลิงก์ตั้งรหัสผ่านทางอีเมล)
- **รูปโปรไฟล์:** พนักงานเปลี่ยนรูปตัวเองได้ในแอป

กฎของระบบฉบับเต็ม (Role, สถานะภาษาไทยที่ห้ามเปลี่ยนชื่อ, ฟีเจอร์ที่ถูกตัดออก ฯลฯ) อยู่ใน [`CLAUDE.md`](CLAUDE.md)

## ฐานข้อมูล

- PostgreSQL คือแหล่งข้อมูลจริง schema อยู่ใน `backend/src/config/database.js` (`CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS`) ปรับให้เองทุกครั้งที่ backend เริ่ม
- เวลาทั้งหมดใช้ Asia/Bangkok
- ผัง: [`docs/ER-Diagram.md`](docs/ER-Diagram.md) (ฐานข้อมูล) และ [`docs/Class-Diagram.md`](docs/Class-Diagram.md) (controller → store)
- สำรองข้อมูล: `npm --prefix backend run backup`
- **อันตราย:** `backend/src/scripts/reset_database.js` (`npm run reset:db`) จะ **TRUNCATE ตารางจริง** ห้ามรันถ้าไม่ได้ตั้งใจ

## เทสต์ และ ตรวจ build

```bash
# E2E เว็บแอดมิน (Playwright + Chrome ในเครื่อง, mock API ทั้งหมด ไม่ต้องมี backend/DB)
npm run test:e2e
npm run test:e2e:critical     # เฉพาะเคส Critical

# build เว็บ
cd frontend && npx vite build

# เช็ก syntax backend
node --check backend/src/<ไฟล์>.js

# เช็ก bundle แอป
cd app && npx expo export --platform android --output-dir <โฟลเดอร์ชั่วคราว>
```

เทสต์อยู่ใน [`frontend/e2e/`](frontend/e2e) ครอบคลุม Login / Forgot / Set password, Work Locations, Reward Categories, เส้นทาง (routing) และ Reset password รายการเทสต์ Login ทั้งหมดอยู่ที่ [`docs/Login-TestCases.md`](docs/Login-TestCases.md) (ออโต้เฉพาะระดับ Critical/High)

> แอปใช้ native module (`expo-location`, `expo-image-picker`, AsyncStorage ฯลฯ) บางตัวใช้ Expo Go ได้ไม่ครบ ถ้าจำเป็นให้ใช้ dev build (`npx expo run:android`) หรือ EAS

## ข้อตกลงการทำงาน

- ปัจจุบัน UI ของเว็บแอดมินเป็นภาษาอังกฤษ ส่วน UI ของแอปพนักงานเป็นภาษาไทย
- แก้เฉพาะจุด ไม่ refactor หรือเปลี่ยนหน้าตาถ้าไม่ได้ขอ
- ถามก่อนลบข้อมูลจริงใน database และสำรองข้อมูลก่อนเสมอ
- ห้าม commit `backend/.env` หรือไฟล์ที่มีรหัสลับ
