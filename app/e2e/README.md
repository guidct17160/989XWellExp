# เทส E2E ของแอปพนักงาน (Expo รันบนเว็บ + Playwright)

ทดสอบแอปพนักงาน (`app/`) โดย export เป็นเว็บ (`expo export --platform web`) แล้วเปิดใน Google Chrome ด้วย Playwright
**ทุกคำขอ `/api/**` ถูก mock ด้วย `page.route` ไม่ต้องเปิด backend หรือฐานข้อมูล** (และกันไม่ให้หลุดไป backend จริงที่อาจรันอยู่ที่พอร์ต 5000)
เป็นเทสระดับ Critical/High เท่านั้น (เคส Medium/Low ทดสอบมือ) ข้อความไทยในเทสคัดลอกมาจากซอร์สของแต่ละหน้า

## วิธีรัน

```bash
# จากโฟลเดอร์ app/  (ครั้งแรกต้อง npm install ใน app/ และ frontend/ แล้ว เพราะใช้ @playwright/test ของ frontend)
npm run test:e2e              # ทุกเคส
npm run test:e2e:critical     # เฉพาะเคสที่ติดแท็ก @critical
npm run test:e2e:report       # เปิดรายงาน HTML ของรอบล่าสุด

# จากรากโปรเจกต์
npm run test:e2e:app

# รันบางไฟล์ / บางเคส (ส่งอาร์กิวเมนต์ต่อท้ายหลัง -- เมื่อรันจาก app/)
npm run test:e2e -- login.spec.js
npm run test:e2e -- -g "TC-APP-CLOCK-01"
npm run test:e2e -- --headed          # ดูหน้าต่างเบราว์เซอร์
```

- **ครั้งแรก** (หรือเมื่อโค้ดใน `app/` ใหม่กว่า export เดิม) ระบบจะ export เว็บให้เองประมาณ 1 นาทีก่อนเริ่มเทส
  ผลลัพธ์ export เก็บที่โฟลเดอร์ชั่วคราวของเครื่อง (`%TEMP%/wellx989-app-e2e-export`) ไม่อยู่ใน repo
- ใช้ Google Chrome ที่ติดตั้งในเครื่อง (`channel: 'chrome'`) ไม่ต้องโหลดเบราว์เซอร์เพิ่ม ต้องใช้ Playwright 1.5x ขึ้นไป (frontend ใช้ 1.64)
- ไม่มี dependency ใหม่ใน `app/package.json` — `e2e/pw.js` ชี้ไปที่ `frontend/node_modules/@playwright/test`

ตัวแปรสภาพแวดล้อมที่ปรับได้

| ตัวแปร | ความหมาย | ค่าเริ่มต้น |
|---|---|---|
| `E2E_PORT` | พอร์ตที่เสิร์ฟเว็บ export | `4391` |
| `E2E_EXPORT_DIR` | โฟลเดอร์ export | `%TEMP%/wellx989-app-e2e-export` |
| `E2E_REBUILD=1` | บังคับ export ใหม่ | - |
| `E2E_SKIP_BUILD=1` | ข้ามการ export (ใช้ของเดิม) | - |

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `playwright.config.js` | ตั้งค่า (จอมือถือ 412x860, เวลา Asia/Bangkok, พิกัด GPS จำลอง, webServer) |
| `serve.js` | export (ถ้าจำเป็น) แล้วเสิร์ฟ static + fallback `index.html` (webServer เรียกไฟล์นี้) |
| `pw.js` | ตัวเชื่อมไป `@playwright/test` ของ frontend |
| `helpers.js` | `setup()` = mock API + ใส่ session ใน localStorage (`wellx989_session`), ผู้ใช้จำลอง (`USERS`), ข้อมูลสถานที่ (`LOCATIONS`) |
| `login.spec.js` | Login, ตั้ง PIN, ปลดล็อก PIN, กู้ session |
| `attendance.spec.js` | เข้า/ออกงานด้วยสถานที่+GPS, ข้อความไม่มีสถานที่ใกล้เคียง, 403 นอกรัศมี, แต้มตอนออกงาน, SuperBoss ไม่ถูกนับสาย/ไม่ครบเวลา |
| `approvals.spec.js` | หน้าอนุมัติ (Employee เปิดไม่ได้, Boss อนุมัติ/ไม่อนุมัติ, ข้อความ 403 จาก server, ประวัติ) |
| `requests.spec.js` | ขอลา (แนบไฟล์/จำนวนวัน/เวลาไทย), ปรับปรุงเวลา, สถานะคำขอ |
| `quests.spec.js` | รายการ Quest, ยืนยันก่อนส่ง, ผ่าน/ไม่ผ่าน, 409 ทำไปแล้ว |
| `rewards.spec.js` | แลกของรางวัล (POST ครั้งเดียว, แต้มไม่พอ) และ Leaderboard 1-3 / 4-10 |
| `notifications.spec.js` | กระดิ่ง/ประกาศ/แบนเนอร์ และสวิตช์ general/news ต่อผู้ใช้ |
| `profile.spec.js` | โปรไฟล์, ตั้งค่า (ไม่มีเมนูที่ถูกตัดออก), ออกจากระบบ, สมุดรายชื่อทีมงาน |

## วิธีเขียนเทสเพิ่ม

```js
const { test, expect } = require('./pw');
const { USERS, setup, openApp, expectScreen } = require('./helpers');

test('ตัวอย่าง', async ({ page }) => {
  // ข้อมูลที่ endpoint GET ต่างๆ ตอบ (ดูค่าเริ่มต้นใน helpers.defaultData) และ handler ที่ต้องการทับ
  const api = await setup(page, {
    user: USERS.boss,
    data: { approvalsPending: [/* ... */] },
    routes: { 'PATCH /approvals/leave/lv-1': { status: 403, body: { success: false, message: '...' } } },
  });
  await openApp(page, '/manager-approval');   // เปิดตรงที่ path ของแอป (ดู linking ใน App.js)
  await expectScreen(page, 'manager-approval'); // ตรวจจาก testID `screen-<ชื่อ>`
  // ตรวจสิ่งที่แอปส่งไป server
  expect(api.callsTo('PATCH', /^\/approvals\//)).toHaveLength(1);
});
```

ข้อควรรู้
- เปิด URL ตรงๆ ข้ามหน้าหลักได้ แต่หน้าที่อ่านข้อมูลจาก singleton ตอน mount (รายการปรับปรุงเวลา, แจ้งเตือน) ควรเข้าผ่านหน้าหลักก่อนเหมือนผู้ใช้จริง (ดูบั๊กในหัวข้อถัดไป)
- บนเว็บ หน้าที่เปิดแล้วยังค้างอยู่ใน stack/แท็บ ทำให้ `testID` ซ้ำ ให้จำกัดขอบเขต (`screen-home` ...) หรือใช้ `visible(locator)` จาก `helpers.js`
- `setup()` เตือนในคอนโซลเมื่อแอปเรียก endpoint ที่ยังไม่ได้ mock (`[e2e] ไม่ได้ mock: ...`) ให้เพิ่ม handler ใน `helpers.js`

## เคสที่ปิดไว้เป็น `test.fixme` (บั๊กจริงของแอป พบจากการเขียนเทส)

เทสพวกนี้จะ "ข้าม" ไปก่อน เมื่อแก้บั๊กแล้วให้เปลี่ยน `test.fixme` เป็น `test`

| เคส | บั๊ก | ไฟล์ที่ต้องแก้ |
|---|---|---|
| `TC-APP-TCORR-01b` | วันที่ของคำขอปรับปรุงเวลาที่เลือกจากรายการถูกส่งเป็น "วันนี้" แทนวันที่ที่เลือก เพราะ regex `/^d{4}-d{2}-d{2}/` ขาด `\` (ต้องเป็น `\d`) | `app/src/services/leaveStorage.js` (และ `pointsStorage.js` บรรทัดเดียวกัน) |
| `TC-APP-REWARD-02b` | ป๊อปอัป "คะแนนสะสมไม่เพียงพอ" อยู่หลัง Modal รายละเอียดรางวัล ผู้ใช้มองไม่เห็นและกดตกลงไม่ได้ | `app/src/screens/RewardsScreen.js` |
| `TC-APP-PROFILE-02`, `TC-APP-SETTINGS-00` | หน้าโปรไฟล์/ตั้งค่าแสดงคีย์ดิบ (`phone`, `email`, `department`, `role`, `startDate`, `PERSONALINFO`, `pinSettings`, `language`, `disablePin` ...) เพราะ `t(key) \|\| 'ข้อความไทย'` ไม่เคยใช้ข้อความสำรอง (`t()` คืนชื่อคีย์เมื่อไม่มีคำแปล) | `app/src/context/ThemeContext.js` / `ProfileScreen.js` / `SettingsScreen.js` |
| `TC-APP-TCORR-00`, `TC-APP-NOTIF-03b` | เปิด/รีเฟรชที่ `/time-correction` หรือ `/notifications` โดยตรง รายการว่างค้าง เพราะ storage แก้ state ในที่เดิมแล้วส่ง reference เดิมให้ `setState` (React ไม่ re-render) | `app/src/services/attendanceStorage.js`, `notificationStorage.js` |
| `TC-APP-SESSION-03` | ข้อสังเกตความปลอดภัยเบา: เปิดที่ URL ลึก (เช่น `/main/profile`) ขณะ session มี PIN จะไม่ถูกถาม PIN | `App.js` / `AppNavigator.js` |

## สิ่งที่เทสชุดนี้ไม่ครอบคลุม

- ฟีเจอร์ที่ต้องใช้ native จริง: กล้อง/แกลเลอรี (รูปโปรไฟล์ ถ่ายรูปแนบใบลา), `expo-location` บนมือถือ (บนเว็บใช้ `navigator.geolocation` ที่จำลองไว้), `expo-secure-store`, แผนที่ `react-native-maps` (บนเว็บใช้ Leaflet และบล็อกแผนที่จากอินเทอร์เน็ต)
- ตรรกะฝั่ง server (คำนวณระยะ, สิทธิ์ Boss/แผนก, การจ่ายแต้ม, SuperBoss ไม่ถูกบันทึกสาย) — เทสนี้ตรวจเฉพาะสิ่งที่แอปส่ง/แสดง ส่วน server ต้องมีเทสฝั่ง backend แยก
- Push notification จริง (ปัจจุบันแอปยังเป็นแบนเนอร์ในแอปที่ซิงก์ทุก 1 นาที)
