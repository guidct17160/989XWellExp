// ตัวช่วยเพิ่มเติมสำหรับเทส E2E ชุดที่ 1 (Attendance, All Employees, Leave Policies, Departments)
// ใช้ร่วมกับ helpers.js (mockApi, seedSession) โดยไม่แก้ไฟล์เดิม

/** ตอบกลับแบบ JSON ให้ route.fulfill */
export const jsonRes = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * ดักคำขอ API เฉพาะ method ที่ระบุ (เมธอดอื่นปล่อยต่อให้ route ที่ลงทะเบียนไว้ก่อนหน้า)
 * handler(route, request) ต้องคืนค่าจาก route.fulfill เอง
 */
export async function routeMethod(page, pattern, method, handler) {
  await page.route(pattern, (route) => {
    if (route.request().method() !== method) return route.fallback();
    return handler(route, route.request());
  });
}

/** วันที่วันนี้ตามเวลาเครื่อง ในรูป YYYY-MM-DD (รูปแบบเดียวกับที่หน้า Attendance ใช้เป็นค่าเริ่มต้น) */
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
