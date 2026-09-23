const dbStore = require('../services/dbStore');
const db = require('../config/database');
const memoryStore = require('../stores/memoryStore');

// ============================================================
// Departments
// ============================================================
exports.getDepartments = async (req, res) => {
  try {
    const departments = await dbStore.getDepartments();
    res.json({ success: true, departments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Department name is required' });
    const dept = await dbStore.addDepartment(req.body);
    res.status(201).json({ success: true, department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// MED-2 FIX: updateDepartment now explicitly calls addDepartment with `id` to trigger
// upsert logic in userStore.addDepartment (which already handles UPDATE vs INSERT).
// This is functionally correct because addDepartment does upsert, but we rename for clarity.
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await dbStore.addDepartment({ ...req.body, id });
    res.json({ success: true, message: 'อัปเดตแผนกเรียบร้อยแล้ว', department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    await dbStore.deleteDepartment(req.params.id);
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// Positions
// ============================================================
exports.getPositions = async (req, res) => {
  try {
    const positions = await dbStore.getPositions();
    res.json({ success: true, positions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPosition = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Position title is required' });
    const pos = await dbStore.addPosition(req.body);
    res.status(201).json({ success: true, position: pos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// MED-2 FIX: updatePosition also uses addPosition (which is upsert via ON CONFLICT).
exports.updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const pos = await dbStore.addPosition({ ...req.body, id });
    res.json({ success: true, message: 'อัปเดตตำแหน่งเรียบร้อยแล้ว', position: pos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePosition = async (req, res) => {
  try {
    await dbStore.deletePosition(req.params.id);
    res.json({ success: true, message: 'Position deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// MED-3 FIX: Sections — Now using dbStore (PostgreSQL) with memoryStore fallback
// ============================================================

// Initialize memory fallback for sections & groups (used when PG is down)
if (!memoryStore.memorySections) {
  memoryStore.memorySections = [
    { id: 'SEC-001', name: 'Software Development', department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', memberCount: 8 },
    { id: 'SEC-002', name: 'Cloud Infrastructure & DevOps', department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', memberCount: 3 },
    { id: 'SEC-003', name: 'People Operations & HR', department: 'ฝ่ายทรัพยากรบุคคล (HR)', memberCount: 5 },
    { id: 'SEC-004', name: 'Financial Accounting & Payroll', department: 'ฝ่ายการเงินและบัญชี', memberCount: 4 },
    { id: 'SEC-005', name: 'Brand & Digital Marketing', department: 'ฝ่ายการตลาด (Marketing)', memberCount: 6 },
  ];
}

if (!memoryStore.memoryGroups) {
  memoryStore.memoryGroups = [
    { id: 'GRP-001', name: 'Full-Time Tech Staff', description: 'วิศวกรซอฟต์แวร์และไอทีประจำ', memberCount: 10 },
    { id: 'GRP-002', name: 'Management & Executives', description: 'ผู้บริหารระดับ C-Level และผู้จัดการ', memberCount: 4 },
    { id: 'GRP-003', name: 'Probation Staff', description: 'พนักงานใหม่ที่อยู่ในระยะทดลองงาน', memberCount: 2 },
    { id: 'GRP-004', name: 'Contract / Outsource', description: 'พนักงานสัญญาจ้างโครงการ', memberCount: 3 },
  ];
}

const getSectionsFromDb = async () => {
  if (db.isPgConnected()) {
    try {
      const res = await db.query('SELECT * FROM sections ORDER BY id ASC');
      if (res.rows && res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: r.id,
          name: r.name,
          department: r.department,
          memberCount: r.member_count || 0,
        }));
      }
    } catch (e) {
      console.error('PG error in getSections:', e);
    }
  }
  return memoryStore.memorySections;
};

const getGroupsFromDb = async () => {
  if (db.isPgConnected()) {
    try {
      const res = await db.query('SELECT * FROM employee_groups ORDER BY id ASC');
      if (res.rows && res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          memberCount: r.member_count || 0,
        }));
      }
    } catch (e) {
      console.error('PG error in getGroups:', e);
    }
  }
  return memoryStore.memoryGroups;
};

exports.getSections = async (req, res) => {
  try {
    const sections = await getSectionsFromDb();
    res.json({ success: true, total: sections.length, sections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSection = async (req, res) => {
  try {
    const { name, department } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Section name is required' });
    const newSec = { id: `SEC-${Date.now().toString().slice(-4)}`, name, department: department || 'General', memberCount: 0 };

    if (db.isPgConnected()) {
      try {
        await db.query(
          'INSERT INTO sections (id, name, department, member_count) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department',
          [newSec.id, newSec.name, newSec.department, 0]
        );
      } catch (e) { console.error('PG insert section error:', e); }
    }
    memoryStore.memorySections.push(newSec);

    res.status(201).json({ success: true, section: newSec });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const { id } = req.params;

    if (db.isPgConnected()) {
      try {
        const cols = [];
        const vals = [];
        let idx = 1;
        if (req.body.name) { cols.push(`name = $${idx++}`); vals.push(req.body.name); }
        if (req.body.department) { cols.push(`department = $${idx++}`); vals.push(req.body.department); }
        if (cols.length > 0) {
          vals.push(id);
          await db.query(`UPDATE sections SET ${cols.join(', ')} WHERE id = $${idx}`, vals);
        }
      } catch (e) { console.error('PG update section error:', e); }
    }

    const memIdx = memoryStore.memorySections.findIndex((s) => s.id === id);
    if (memIdx !== -1) {
      memoryStore.memorySections[memIdx] = { ...memoryStore.memorySections[memIdx], ...req.body };
      return res.json({ success: true, section: memoryStore.memorySections[memIdx] });
    }
    res.status(404).json({ success: false, message: 'Section not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    if (db.isPgConnected()) {
      try { await db.query('DELETE FROM sections WHERE id = $1', [req.params.id]); } catch (e) {}
    }
    memoryStore.memorySections = memoryStore.memorySections.filter((s) => s.id !== req.params.id);
    res.json({ success: true, message: 'Section deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// MED-3 FIX: Groups — Now using dbStore (PostgreSQL) with memoryStore fallback
// ============================================================

exports.getGroups = async (req, res) => {
  try {
    const groups = await getGroupsFromDb();
    res.json({ success: true, total: groups.length, groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Group name is required' });
    const newGrp = { id: `GRP-${Date.now().toString().slice(-4)}`, name, description: description || '', memberCount: 0 };

    if (db.isPgConnected()) {
      try {
        await db.query(
          'INSERT INTO employee_groups (id, name, description, member_count) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description',
          [newGrp.id, newGrp.name, newGrp.description, 0]
        );
      } catch (e) { console.error('PG insert group error:', e); }
    }
    memoryStore.memoryGroups.push(newGrp);

    res.status(201).json({ success: true, group: newGrp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (db.isPgConnected()) {
      try {
        const cols = [];
        const vals = [];
        let idx = 1;
        if (req.body.name) { cols.push(`name = $${idx++}`); vals.push(req.body.name); }
        if (req.body.description !== undefined) { cols.push(`description = $${idx++}`); vals.push(req.body.description); }
        if (cols.length > 0) {
          vals.push(id);
          await db.query(`UPDATE employee_groups SET ${cols.join(', ')} WHERE id = $${idx}`, vals);
        }
      } catch (e) { console.error('PG update group error:', e); }
    }

    const memIdx = memoryStore.memoryGroups.findIndex((g) => g.id === id);
    if (memIdx !== -1) {
      memoryStore.memoryGroups[memIdx] = { ...memoryStore.memoryGroups[memIdx], ...req.body };
      return res.json({ success: true, group: memoryStore.memoryGroups[memIdx] });
    }
    res.status(404).json({ success: false, message: 'Group not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    if (db.isPgConnected()) {
      try { await db.query('DELETE FROM employee_groups WHERE id = $1', [req.params.id]); } catch (e) {}
    }
    memoryStore.memoryGroups = memoryStore.memoryGroups.filter((g) => g.id !== req.params.id);
    res.json({ success: true, message: 'Group deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
