// Builds the OpenAPI 3 document for the Swagger page straight from the live Express router,
// so every route is listed even if nobody remembered to document it.
//   docs/apiMeta.js   short Thai summary + tag for each route (and the tag descriptions)
//   docs/details/*.js long Thai explanation, query / body fields, examples and error codes per route
const apiRouter = require('../routes/api');
const { requireAuth, requireAdmin, requireSuperAdmin, requireApprover } = require('../middlewares/authMiddleware');
const { ROUTES, TAGS, TAG_DESCRIPTIONS } = require('./apiMeta');
const DETAILS = require('./details');

const GUARDS = [
  { fn: requireSuperAdmin, text: 'เฉพาะ Super Admin' },
  { fn: requireAdmin, text: 'เฉพาะแอดมิน (Admin, Super Admin, HR Admin)' },
  { fn: requireApprover, text: 'แอดมินและผู้อนุมัติ (Boss, SuperBoss, Manager, CEO, Director ฯลฯ)' },
  { fn: requireAuth, text: 'ผู้ใช้ที่ล็อกอินแล้ว (ทุก Role)' },
];

const metaByKey = new Map(ROUTES.map((r) => [`${r[0]} ${r[1]}`, { tag: r[2], summary: r[3], ...(r[4] || {}) }]));

const ERROR_SCHEMA = { $ref: '#/components/schemas/Error' };
const jsonResponse = (description, example, schema) => ({
  description,
  content: { 'application/json': { schema: schema || { type: 'object', additionalProperties: true }, ...(example !== undefined ? { example } : {}) } },
});
const errorResponse = (description, message) => jsonResponse(description, { success: false, message: message || 'ข้อความอธิบายข้อผิดพลาด' }, ERROR_SCHEMA);

function listRoutes() {
  const out = [];
  for (const layer of apiRouter.stack) {
    if (!layer.route) continue;
    const handlers = layer.route.stack.map((s) => s.handle);
    const guard = GUARDS.find((g) => handlers.includes(g.fn)) || null;
    for (const method of Object.keys(layer.route.methods)) {
      out.push({ method: method.toUpperCase(), path: layer.route.path, guard });
    }
  }
  return out;
}

// field list -> JSON schema ({ name, type, required, description, example, enum, items })
function fieldsToSchema(fields = []) {
  const properties = {};
  const required = [];
  for (const f of fields) {
    const p = { type: f.type || 'string' };
    if (f.description) p.description = f.description;
    if (f.example !== undefined) p.example = f.example;
    if (f.enum) p.enum = f.enum;
    if (f.format) p.format = f.format;
    if (p.type === 'array') p.items = f.items || {};
    properties[f.name] = p;
    if (f.required) required.push(f.name);
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

function buildOperation({ method, path, guard }) {
  const key = `${method} ${path}`;
  const meta = metaByKey.get(key) || { tag: 'อื่นๆ', summary: `${method} ${path}` };
  const d = DETAILS[key] || {};

  const pathParams = [...path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]).map((name) => {
    const custom = (d.pathParams || {})[name] || {};
    return {
      name,
      in: 'path',
      required: true,
      description: custom.description || (name === 'requestType' ? 'ประเภทคำขอ' : 'รหัสของรายการ'),
      schema: name === 'requestType' ? { type: 'string', enum: ['leave', 'time-correction'] } : { type: 'string' },
      ...(custom.example !== undefined ? { example: custom.example } : {}),
    };
  });
  const queryParams = (d.query || []).map((q) => ({
    name: q.name,
    in: 'query',
    required: !!q.required,
    description: q.description || '',
    schema: { type: q.type || 'string', ...(q.enum ? { enum: q.enum } : {}) },
    ...(q.example !== undefined ? { example: q.example } : {}),
  }));

  const notes = [guard ? `**สิทธิ์ที่ใช้เรียก:** ${guard.text}` : '**สิทธิ์ที่ใช้เรียก:** สาธารณะ (ไม่ต้องล็อกอิน)'];
  if (meta.limited) notes.push('**จำกัดการเรียก:** ไม่เกิน 10 ครั้งต่อ 15 นาที (เกินแล้วตอบ 429)');
  if (d.description) notes.push(d.description);

  const responses = {
    200: meta.binary
      ? { description: 'ไฟล์ / รูปภาพ', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }
      : jsonResponse('สำเร็จ (ส่ง JSON ที่มี success: true)'),
  };
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
  if (hasBody) responses[400] = errorResponse('ข้อมูลที่ส่งมาไม่ถูกต้อง', 'ข้อความบอกว่าผิดตรงไหน');
  if (guard) {
    responses[401] = errorResponse('ยังไม่ได้ล็อกอิน หรือ token หมดอายุ', 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)');
    if (guard.fn !== requireAuth) responses[403] = errorResponse('Role ไม่มีสิทธิ์ใช้งาน', 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (Forbidden)');
  }
  for (const [code, text] of Object.entries(meta.errors || {})) responses[code] = errorResponse(text);
  for (const [code, r] of Object.entries(d.responses || {})) {
    if (meta.binary && code === '200') {
      // a file / image response stays binary; only its description is taken from the details
      if (r.description) responses[200].description = r.description;
      continue;
    }
    const isError = Number(code) >= 400;
    responses[code] = isError ? errorResponse(r.description || 'ข้อผิดพลาด', r.example && r.example.message) : jsonResponse(r.description || 'สำเร็จ', r.example);
    if (isError && r.example) responses[code].content['application/json'].example = r.example;
  }

  const op = {
    tags: [meta.tag],
    summary: meta.summary,
    description: notes.join('\n\n'),
    operationId: `${method.toLowerCase()}_${path.replace(/[/:]+/g, '_').replace(/^_|_$/g, '') || 'root'}`,
    parameters: [...pathParams, ...queryParams],
    responses,
  };
  if (guard) op.security = [{ bearerAuth: [] }];
  if (hasBody) {
    const body = d.body || {};
    const schema = body.fields && body.fields.length ? fieldsToSchema(body.fields) : { type: 'object', additionalProperties: true };
    const example = body.example !== undefined ? body.example : meta.body;
    op.requestBody = {
      required: body.fields ? body.fields.some((f) => f.required) : false,
      ...(body.description ? { description: body.description } : {}),
      content: { 'application/json': { schema, ...(example !== undefined ? { example } : {}) } },
    };
  }
  return op;
}

function buildOpenApiSpec() {
  const paths = {};
  for (const r of listRoutes()) {
    const openApiPath = r.path.replace(/:([A-Za-z]+)/g, '{$1}');
    (paths[openApiPath] = paths[openApiPath] || {})[r.method.toLowerCase()] = buildOperation(r);
  }
  const usesOther = Object.values(paths).some((p) => Object.values(p).some((o) => o.tags.includes('อื่นๆ')));
  return {
    openapi: '3.0.3',
    info: {
      title: 'WellX989 API',
      version: '1.0.0',
      description: [
        'REST API ของระบบ HR WellX989 (ลงเวลา ลา อนุมัติ แต้มสะสม และรางวัล) ใช้ร่วมกันโดยเว็บผู้ดูแลระบบและแอปพนักงาน',
        '',
        '### เริ่มใช้งาน 3 ขั้นตอน',
        '1. เปิดกลุ่ม **การยืนยันตัวตน** แล้วเรียก `POST /auth/login` ด้วยชื่อผู้ใช้และรหัสผ่าน จะได้ `token` กลับมา',
        '2. กดปุ่ม **Authorize** (มุมขวาบน) วาง token ลงไป (ไม่ต้องพิมพ์คำว่า Bearer) แล้วกด Authorize',
        '3. เปิด API ที่ต้องการ กด **Try it out** แก้ค่า แล้วกด **Execute** จะเห็นคำตอบจริงจาก server',
        '',
        '### ควรรู้ก่อนอ่าน',
        '- เส้นทางทั้งหมดอยู่ใต้ `/api` (มีชื่อสำรอง `/api/v1`)',
        '- ทุกคำตอบเป็น JSON รูปแบบ `{ "success": true, ... }` และเมื่อผิดพลาดเป็น `{ "success": false, "message": "..." }` ซึ่งแอปและเว็บนำ `message` ไปแสดงให้ผู้ใช้',
        '- รหัสสถานะที่พบบ่อย: **400** ข้อมูลไม่ถูกต้อง, **401** ยังไม่ล็อกอิน/token หมดอายุ, **403** Role ไม่มีสิทธิ์ (หรืออยู่นอกพื้นที่ลงเวลา), **404** ไม่พบข้อมูล, **409** ทำซ้ำไม่ได้ (เช่น ทำ Quest ไปแล้ว), **429** เรียกถี่เกินไป',
        '- วันที่และเวลาทั้งหมดเป็นเวลา **Asia/Bangkok** วันที่ใช้รูปแบบ `YYYY-MM-DD`',
        '- ตัวตนผู้ใช้อ่านจาก **token เท่านั้น** server ไม่เชื่อ id ที่ส่งมาใน body, header หรือ query',
        '- **Role:** `Employee`, `Boss`, `SuperBoss`, `HR Admin`, `Admin`, `Super Admin` (แอดมินใช้เว็บ พนักงานใช้แอป)',
        '- เอกสารนี้สร้างจากเส้นทางจริงของ server อัตโนมัติ ฟิลด์และตัวอย่างอ้างอิงจากโค้ด controller และชุดทดสอบ',
      ].join('\n'),
    },
    servers: [{ url: '/api', description: 'เซิร์ฟเวอร์นี้' }],
    tags: [...TAGS, ...(usesOther ? ['อื่นๆ'] : [])].map((name) => ({ name, ...(TAG_DESCRIPTIONS[name] ? { description: TAG_DESCRIPTIONS[name] } : {}) })),
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'token ที่ได้จาก POST /auth/login' } },
      schemas: {
        Error: {
          type: 'object',
          description: 'รูปแบบคำตอบเมื่อผิดพลาด',
          properties: { success: { type: 'boolean', example: false }, message: { type: 'string', description: 'ข้อความภาษาไทยที่แสดงให้ผู้ใช้ได้' } },
        },
      },
    },
    paths,
  };
}

// For checks: routes without a Thai summary, summary entries that no longer match a route, and detail entries that match no route
function coverage() {
  const routes = listRoutes();
  const keys = new Set(routes.map((r) => `${r.method} ${r.path}`));
  return {
    routes: routes.length,
    undocumented: routes.filter((r) => !metaByKey.has(`${r.method} ${r.path}`)).map((r) => `${r.method} ${r.path}`),
    stale: [...metaByKey.keys()].filter((k) => !keys.has(k)),
    withDetails: routes.filter((r) => DETAILS[`${r.method} ${r.path}`]).length,
    withoutDetails: routes.filter((r) => !DETAILS[`${r.method} ${r.path}`]).map((r) => `${r.method} ${r.path}`),
    staleDetails: Object.keys(DETAILS).filter((k) => !keys.has(k)),
  };
}

module.exports = { buildOpenApiSpec, coverage, listRoutes };
