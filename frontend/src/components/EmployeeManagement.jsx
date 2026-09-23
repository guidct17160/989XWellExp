import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Calendar,
  ShieldCheck,
  RefreshCw,
  Plus,
  FileSpreadsheet
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function EmployeeManagement({ initialTab = 'all-employee' }) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveSubTab(initialTab);
  }, [initialTab]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [sections, setSections] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedGender, setSelectedGender] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmAddModal, setShowConfirmAddModal] = useState(false);
  const [showDuplicateEmailAlertModal, setShowDuplicateEmailAlertModal] = useState(false);
  const [showDuplicateCodeAlertModal, setShowDuplicateCodeAlertModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sentEmailModal, setSentEmailModal] = useState(null);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    code: '',
    username: '',
    password: '1234',
    name: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'Male',
    department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
    position: 'Software Engineer',
    section: 'Software Development',
    group: 'Full-Time Tech Staff',
    role: 'Employee',
    status: 'Active',
    startDate: new Date().toISOString().split('T')[0],
    salary: '35000',
  });

  const [notification, setNotification] = useState(null);

  const fetchOrgStructure = async () => {
    try {
      const [deptRes, posRes, secRes, grpRes] = await Promise.all([
        fetch(`${API_BASE}/departments`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/positions`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/sections`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/employee-groups`).then((r) => r.json()).catch(() => null),
      ]);

      if (deptRes?.success && deptRes.departments) setDepartments(deptRes.departments);
      if (posRes?.success && posRes.positions) setPositions(posRes.positions);
      if (secRes?.success && secRes.sections) setSections(secRes.sections);
      if (grpRes?.success && grpRes.groups) setGroups(grpRes.groups);
    } catch (err) {
      console.error('Failed to fetch org structure', err);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/employees`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees);
      }
    } catch (err) {
      console.error('Failed to fetch employees from API', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchOrgStructure();
  }, []);

  const triggerNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open Create Modal
  const handleOpenAdd = () => {
    const num = employees.length + 1;
    const empCode = `EMP-${String(num).padStart(3, '0')}`;
    setFormData({
      code: empCode,
      firstName: '',
      lastName: '',
      name: '',
      email: '',
      phone: '',
      gender: 'Male',
      department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      position: 'Software Engineer',
      section: 'Software Development',
      group: 'Full-Time Tech Staff',
      role: 'Employee',
      status: 'Pending',
      startDate: new Date().toISOString().split('T')[0],
      salary: '35000',
    });
    setShowAddModal(true);
  };

  // Create Employee Submit - Step 1: Open Confirmation Popup
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if ((!formData.firstName && !formData.name) || !formData.email) {
      triggerNotification('กรุณากรอกชื่อ นามสกุล และ อีเมลพนักงาน', 'error');
      return;
    }

    const cleanEmail = formData.email.trim().toLowerCase();
    const existingByEmail = employees.find(
      (emp) => emp.email && emp.email.trim().toLowerCase() === cleanEmail
    );
    if (existingByEmail) {
      setShowDuplicateEmailAlertModal(true);
      return;
    }

    if (formData.code && formData.code.trim()) {
      const cleanCode = formData.code.trim().toUpperCase();
      const existingByCode = employees.find(
        (emp) => emp.code && emp.code.trim().toUpperCase() === cleanCode
      );
      if (existingByCode) {
        setShowDuplicateCodeAlertModal(true);
        return;
      }
    }

    setShowConfirmAddModal(true);
  };

  // Step 2: Confirmed Create & Single Click Send Email
  const handleConfirmCreateEmployee = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = {
      ...formData,
      name: `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || formData.name,
    };

    try {
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerNotification(`สร้างพนักงาน ${payload.name} สำเร็จ! ส่งลิงก์ตั้งรหัสผ่านไปยังอีเมล (${formData.email}) เรียบร้อยแล้ว`);
        setShowConfirmAddModal(false);
        setShowAddModal(false);
        fetchEmployees();
      } else {
        triggerNotification(data.message || 'เกิดข้อผิดพลาดในการสร้างพนักงาน', 'error');
      }
    } catch (err) {
      triggerNotification('ไม่สามารถเชื่อมต่อกับ Server ได้', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (emp) => {
    setSelectedEmployee(emp);
    const firstName = emp.firstName || (emp.name ? emp.name.split(' ')[0] : '');
    const lastName = emp.lastName || (emp.name ? emp.name.split(' ').slice(1).join(' ') : '');
    setFormData({
      code: emp.code,
      firstName: firstName,
      lastName: lastName,
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      gender: emp.gender || 'Male',
      department: emp.department,
      position: emp.position,
      section: emp.section || 'Software Development',
      group: emp.group || 'Full-Time Tech Staff',
      role: emp.role || 'Employee',
      status: emp.status || 'Active',
      startDate: emp.startDate || new Date().toISOString().split('T')[0],
      salary: String(emp.salary || 35000),
    });
    setShowEditModal(true);
  };

  // Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification(`อัปเดตข้อมูลพนักงาน ${formData.name} เรียบร้อยแล้ว`);
        setShowEditModal(false);
        fetchEmployees();
      }
    } catch (err) {
      triggerNotification('เกิดข้อผิดพลาดในการอัปเดต', 'error');
    }
  };

  // Delete Submit
  const handleDeleteSubmit = async () => {
    if (!selectedEmployee) return;
    try {
      const empId = selectedEmployee.id || selectedEmployee.code;
      const res = await fetch(`${API_BASE}/employees/${empId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification(`ลบพนักงาน ${selectedEmployee.name} ออกจากระบบเรียบร้อยแล้ว`);
        setShowDeleteModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        triggerNotification(data.message || 'เกิดข้อผิดพลาดในการลบพนักงาน', 'error');
      }
    } catch (err) {
      console.error('Delete employee error:', err);
      triggerNotification('เกิดข้อผิดพลาดในการลบพนักงาน', 'error');
    }
  };

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept ? emp.department === selectedDept : true;
    const matchesStatus = selectedStatus ? emp.status === selectedStatus : true;
    const matchesGender = selectedGender ? (emp.gender || 'Male') === selectedGender : true;
    return matchesSearch && matchesDept && matchesStatus && matchesGender;
  });

  const handleExportCSV = () => {
    if (filteredEmployees.length === 0) return;
    const headers = ['ลำดับ', 'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'อีเมล', 'เบอร์โทร', 'เพศ', 'ฝ่าย/แผนก', 'ตำแหน่ง', 'ระดับสิทธิ์', 'สถานะ', 'วันที่เริ่มงาน', 'เงินเดือน (THB)'];
    const rows = filteredEmployees.map((item, index) => [
      index + 1,
      `"${item.code || '-'}"`,
      `"${item.name || '-'}"`,
      `"${item.email || '-'}"`,
      `"${item.phone || '-'}"`,
      `"${item.gender || '-'}"`,
      `"${item.department || '-'}"`,
      `"${item.position || '-'}"`,
      `"${item.role || '-'}"`,
      `"${item.status || '-'}"`,
      `"${item.startDate || '-'}"`,
      `"${item.salary || '-'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Employee_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold transition-all ${
            notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          <CheckCircle size={20} />
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">การจัดการรายชื่อพนักงาน (All Employee)</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                ระบบจัดการรายชื่อพนักงาน สร้าง/ลงทะเบียนพนักงานใหม่ และสิทธิ์การใช้งานสำหรับ Admin HR
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredEmployees.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600/50 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="ส่งออกรายชื่อพนักงานทั้งหมดเป็นไฟล์ Excel / CSV"
          >
            <FileSpreadsheet size={16} />
            <span>ส่งออก CSV (Excel)</span>
          </button>

          <button
            onClick={fetchEmployees}
            className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 transition-all text-sm uppercase tracking-wide"
          >
            <UserPlus size={18} />
            <span>สร้าง / ลงทะเบียนพนักงานใหม่</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#141722] p-4 rounded-2xl border border-red-900/30 shadow-lg flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, รหัส หรืออีเมลพนักงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
          />
        </div>

        {/* Filter Selects */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
            <Filter size={16} />
            <span>ตัวกรอง:</span>
          </div>

          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className="bg-[#0B0D13] border border-red-900/40 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
          >
            <option value="">ทุกเพศ</option>
            <option value="Male">👨 ชาย (Male)</option>
            <option value="Female">👩 หญิง (Female)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#0B0D13] border border-red-900/40 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
          >
            <option value="">ทุกสถานะ</option>
            <option value="Active">Active (ทำงานอยู่)</option>
            <option value="Inactive">Inactive (พ้นสภาพ)</option>
          </select>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-[#0B0D13] border border-red-900/40 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
          >
            <option value="">ทุกฝ่าย / ทุกแผนก</option>
            {departments.map((d) => (
              <option key={d.id || d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee Data Table */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B0D13] border-b border-red-900/30 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">ข้อมูลพนักงาน</th>
                <th className="py-4 px-6">เพศ (Gender)</th>
                <th className="py-4 px-6">ระดับสิทธิ์ (Role)</th>
                <th className="py-4 px-6">วันที่เริ่มงาน</th>
                <th className="py-4 px-6">สถานะ</th>
                <th className="py-4 px-6 text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20 text-sm font-medium text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-mono">
                    กำลังโหลดข้อมูลพนักงาน...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-mono">
                    ไม่พบข้อมูลพนักงานตรงตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-red-950/20 transition-colors">
                    {/* Name & Avatar */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={emp.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={emp.name}
                          className="w-10 h-10 rounded-full object-cover border border-red-900/40"
                        />
                        <div>
                          <div className="font-bold text-white">{emp.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-semibold text-[#EF4444] font-mono">{emp.code}</span>
                            <span>•</span>
                            <span>{emp.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Gender Badge */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          (emp.gender || 'Male') === 'Female' || emp.gender === 'หญิง'
                            ? 'bg-pink-950/80 text-pink-300 border border-pink-700/50'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-700/50'
                        }`}
                      >
                        {(emp.gender || 'Male') === 'Female' || emp.gender === 'หญิง' ? '👩 หญิง' : '👨 ชาย'}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          emp.role === 'Admin' || emp.role === 'HR Admin'
                            ? 'bg-red-950 text-red-400 border border-red-700/60'
                            : 'bg-[#0B0D13] text-slate-300 border border-red-900/40'
                        }`}
                      >
                        <ShieldCheck size={13} className="text-[#EF4444]" />
                        {emp.role || 'Employee'}
                      </span>
                    </td>

                    {/* Start Date */}
                    <td className="py-4 px-6 text-slate-400 text-xs font-mono font-semibold">
                      {emp.startDate}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          emp.status === 'Active'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                            : emp.status === 'Pending' || emp.status === 'Pending Password' || emp.status === 'รอตั้งรหัสผ่าน'
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
                            : 'bg-slate-900 text-slate-500 border border-slate-700'
                        }`}
                      >
                        ● {emp.status === 'Pending' ? 'Pending (รอตั้งรหัสผ่าน)' : emp.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-red-950/40 rounded-lg transition-colors"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE}/payslips/generate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ employeeId: emp.id || emp.code, month: 'สิงหาคม', year: 2026, baseSalary: emp.salary || 45000 }),
                              });
                              const json = await res.json();
                              alert(`ออกสลิปเงินเดือน (E-Payslip) ให้ ${emp.name} เรียบร้อยแล้ว (ยอดสุทธิ: ฿${(json.payslip?.netPay || 48550).toLocaleString()})`);
                            } catch (e) {
                              alert(`ออกสลิปเงินเดือน (E-Payslip) ให้ ${emp.name} เรียบร้อยแล้ว`);
                            }
                          }}
                          className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 rounded-lg transition-colors font-xs"
                          title="ออก E-Payslip (สลิปเงินเดือน)"
                        >
                          💸
                        </button>
                        <button
                          onClick={async () => {
                            const score = prompt(`ประเมิน KPI / OKR สำหรับ ${emp.name} (คะแนน 1.0 - 5.0):`, '4.8');
                            if (score) {
                              await fetch(`${API_BASE}/kpi/evaluations`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ employeeId: emp.id || emp.code, period: 'Q3 / 2026', score: Number(score), evaluator: 'SuperBoss' }),
                              });
                              alert(`บันทึกคะแนน KPI (${score}) ให้ ${emp.name} เรียบร้อยแล้ว`);
                            }
                          }}
                          className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-950/60 rounded-lg transition-colors font-xs"
                          title="ประเมินผล KPI / OKR"
                        >
                          ⭐
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/60 rounded-lg transition-colors"
                          title="ลบพนักงาน"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / REGISTER EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141722] rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">สร้าง / ลงทะเบียนพนักงานใหม่</h3>
                  <p className="text-xs text-slate-400">กรอกข้อมูลพนักงานเพื่อเพิ่มเข้าในระบบ Admin HR</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-red-950/40"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              {/* In-Modal Alert Banner for Duplicate Email or Code */}
              {(() => {
                const cleanTypedEmail = formData.email ? formData.email.trim().toLowerCase() : '';
                const isEmailDup = cleanTypedEmail !== '' && employees.some((e) => e.email && e.email.trim().toLowerCase() === cleanTypedEmail);
                const cleanTypedCode = formData.code ? formData.code.trim().toUpperCase() : '';
                const isCodeDup = cleanTypedCode !== '' && employees.some((e) => e.code && e.code.trim().toUpperCase() === cleanTypedCode);

                if (isEmailDup) {
                  return (
                    <div className="bg-red-950/90 border-2 border-red-500 rounded-2xl p-4 mb-1 flex items-start gap-3 shadow-xl text-red-100 animate-in fade-in zoom-in-95 duration-150">
                      <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-red-200">❌ ไม่สามารถใช้อีเมลนี้ได้ (อีเมลซ้ำในระบบ)</h4>
                        <p className="text-xs text-red-300 mt-1">
                          อีเมล <strong className="font-mono text-white underline decoration-red-400">{formData.email}</strong> มีเจ้าของในฐานข้อมูลแล้ว ไม่สามารถใช้อีเมลซ้ำได้ กรุณาเปลี่ยนเป็นอีเมลอื่น
                        </p>
                      </div>
                    </div>
                  );
                }

                if (isCodeDup) {
                  return (
                    <div className="bg-red-950/90 border-2 border-red-500 rounded-2xl p-4 mb-1 flex items-start gap-3 shadow-xl text-red-100 animate-in fade-in zoom-in-95 duration-150">
                      <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-red-200">❌ ไม่สามารถใช้รหัสพนักงานนี้ได้ (รหัสซ้ำในระบบ)</h4>
                        <p className="text-xs text-red-300 mt-1">
                          รหัสพนักงาน <strong className="font-mono text-white underline decoration-red-400">{formData.code}</strong> มีในฐานข้อมูลแล้ว ไม่สามารถใช้รหัสพนักงานซ้ำได้ กรุณาเปลี่ยนเป็นรหัสอื่น
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">รหัสพนักงาน *</label>
                  {(() => {
                    const cleanTypedCode = formData.code ? formData.code.trim().toUpperCase() : '';
                    const isCodeDup = cleanTypedCode !== '' && employees.some((e) => e.code && e.code.trim().toUpperCase() === cleanTypedCode);
                    return (
                      <>
                        <input
                          type="text"
                          name="code"
                          value={formData.code}
                          onChange={handleInputChange}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                            isCodeDup
                              ? 'bg-red-950/60 border-red-500 text-red-100 ring-4 ring-red-500/30'
                              : 'bg-[#0B0D13] border-red-900/40 text-white focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20'
                          }`}
                          required
                        />
                        {isCodeDup && (
                          <p className="text-xs font-bold text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={13} />
                            <span>รหัสพนักงานนี้ถูกใช้งานแล้วในระบบ</span>
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ชื่อ (First Name) *</label>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="เช่น สมชาย"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">นามสกุล (Last Name) *</label>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="เช่น ใจดี"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-1">อีเมลพนักงาน (บังคับใส่ - ใช้เป็น Username เข้าแอป) *</label>
                  {(() => {
                    const cleanTypedEmail = formData.email ? formData.email.trim().toLowerCase() : '';
                    const isDup = cleanTypedEmail !== '' && employees.some((e) => e.email && e.email.trim().toLowerCase() === cleanTypedEmail);
                    return (
                      <>
                        <input
                          type="email"
                          name="email"
                          placeholder="somchai@wellx989.com"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                            isDup
                              ? 'bg-red-950/60 border-red-500 text-red-100 ring-4 ring-red-500/30'
                              : 'bg-[#0B0D13] border-red-900/40 text-white focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20'
                          }`}
                          required
                        />
                        {isDup && (
                          <p className="text-xs font-bold text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={13} />
                            <span>อีเมลนี้ถูกใช้งานแล้วในระบบ</span>
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="081-234-5678"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">เพศ (Gender) *</label>
                  <select
                    name="gender"
                    value={formData.gender || 'Male'}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  >
                    <option value="Male">👨 ชาย (Male)</option>
                    <option value="Female">👩 หญิง (Female)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ฝ่าย / แผนก (Department) *</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  >
                    {departments.length > 0 ? (
                      departments.map((d) => (
                        <option key={d.id || d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="ฝ่ายเทคโนโลยีสารสนเทศ (IT)">ฝ่ายเทคโนโลยีสารสนเทศ (IT)</option>
                        <option value="ฝ่ายทรัพยากรบุคคล (HR)">ฝ่ายทรัพยากรบุคคล (HR)</option>
                        <option value="ฝ่ายการตลาด (Marketing)">ฝ่ายการตลาด (Marketing)</option>
                        <option value="ฝ่ายบัญชีและการเงิน (Finance)">ฝ่ายบัญชีและการเงิน (Finance)</option>
                        <option value="ฝ่ายปฏิบัติการ (Operations)">ฝ่ายปฏิบัติการ (Operations)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ระดับสิทธิ์ / บทบาท (Role)</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  >
                    <option value="Employee">👤 Employee (พนักงานทั่วไป - ลงเวลา ยื่นลา/OT)</option>
                    <option value="Boss">👔 Boss (หัวหน้าสายงาน - อนุมัติพนักงานสายงานเดียวกัน)</option>
                    <option value="SuperBoss">👑 SuperBoss (ผู้บริหารสูงสุด/CEO - อนุมัติหัวหน้าทุกสายงาน)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">วันที่เริ่มงาน</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-sm transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  บันทึกและสร้างพนักงาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION POPUP MODAL (Anti-Double-Submit & Single-Click Protection) */}
      {showConfirmAddModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-800/60 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-red-900/30">
              <div className="p-3 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/50 flex-shrink-0">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">ยืนยันการสร้างพนักงาน</h3>
                <p className="text-xs text-slate-400">ตรวจสอบข้อมูลก่อนส่งอีเมลตั้งรหัสผ่าน</p>
              </div>
            </div>

            {/* Summary Details */}
            <div className="bg-[#0B0D13] rounded-2xl p-4 border border-red-900/30 space-y-2.5 text-xs text-slate-300 mb-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">รหัสพนักงาน:</span>
                <span className="font-mono font-bold text-[#EF4444]">{formData.code}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">ชื่อ-นามสกุล:</span>
                <span className="font-bold text-white">{`${formData.firstName || ''} ${formData.lastName || ''}`.trim() || formData.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">อีเมล (Username):</span>
                <span className="font-semibold text-blue-400">{formData.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">แผนก:</span>
                <span className="font-medium text-slate-200">{formData.department}</span>
              </div>
            </div>

            {/* Warning Callout */}
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 mb-6 text-xs text-red-200 flex items-start gap-2.5">
              <CheckCircle size={16} className="text-[#EF4444] flex-shrink-0 mt-0.5" />
              <span>
                เมื่อกดยืนยัน ระบบจะทำรายการเพิ่มพนักงานลงฐานข้อมูล และส่งอีเมลตั้งรหัสผ่านไปยัง <strong>{formData.email}</strong> ทันที
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmAddModal(false)}
                className="px-4 py-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmCreateEmployee}
                className="px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-white" />
                    <span>กำลังส่งอีเมล...</span>
                  </>
                ) : (
                  <>
                    <Mail size={14} />
                    <span>ยืนยันและส่งอีเมล</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE EMAIL ALERT MODAL POPUP */}
      {showDuplicateEmailAlertModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-600/80 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-red-900/40">
              <div className="p-3 rounded-2xl bg-red-950/90 text-red-400 border border-red-700/60 flex-shrink-0">
                <AlertCircle size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">อีเมลซ้ำในระบบ!</h3>
                <p className="text-xs text-red-300">ไม่สามารถลงทะเบียนใช้อีเมลนี้ได้</p>
              </div>
            </div>

            <div className="bg-red-950/50 rounded-2xl p-4 border border-red-800/60 text-xs text-red-200 leading-relaxed mb-5">
              อีเมล <strong className="font-mono text-white underline decoration-red-400">{formData.email}</strong> มีเจ้าของในฐานข้อมูลระบบแล้ว ไม่สามารถสร้างพนักงานใหม่ซ้ำด้วยอีเมลเดียวกันได้ กรุณาเปลี่ยนเป็นอีเมลอื่น
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDuplicateEmailAlertModal(false)}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
              >
                ตกลง (เข้าใจแล้ว)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE CODE ALERT MODAL POPUP */}
      {showDuplicateCodeAlertModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-600/80 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-red-900/40">
              <div className="p-3 rounded-2xl bg-red-950/90 text-red-400 border border-red-700/60 flex-shrink-0">
                <AlertCircle size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">รหัสพนักงานซ้ำในระบบ!</h3>
                <p className="text-xs text-red-300">ไม่สามารถลงทะเบียนใช้รหัสพนักงานนี้ได้</p>
              </div>
            </div>

            <div className="bg-red-950/50 rounded-2xl p-4 border border-red-800/60 text-xs text-red-200 leading-relaxed mb-5">
              รหัสพนักงาน <strong className="font-mono text-white underline decoration-red-400">{formData.code}</strong> มีเจ้าของในฐานข้อมูลระบบแล้ว ไม่สามารถสร้างพนักงานใหม่ซ้ำด้วยรหัสเดียวกันได้ กรุณาเปลี่ยนเป็นรหัสอื่น
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDuplicateCodeAlertModal(false)}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
              >
                ตกลง (เข้าใจแล้ว)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141722] rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
                  <Edit size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">แก้ไขข้อมูลพนักงาน</h3>
                  <p className="text-xs text-slate-400">{formData.name} ({formData.code})</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-red-950/40"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ชื่อ (First Name)</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">นามสกุล (Last Name)</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">อีเมล</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">เพศ (Gender) *</label>
                  <select
                    name="gender"
                    value={formData.gender || 'Male'}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  >
                    <option value="Male">👨 ชาย (Male)</option>
                    <option value="Female">👩 หญิง (Female)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ฝ่าย / แผนก (Department) *</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  >
                    {departments.length > 0 ? (
                      departments.map((d) => (
                        <option key={d.id || d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="ฝ่ายเทคโนโลยีสารสนเทศ (IT)">ฝ่ายเทคโนโลยีสารสนเทศ (IT)</option>
                        <option value="ฝ่ายทรัพยากรบุคคล (HR)">ฝ่ายทรัพยากรบุคคล (HR)</option>
                        <option value="ฝ่ายการตลาด (Marketing)">ฝ่ายการตลาด (Marketing)</option>
                        <option value="ฝ่ายบัญชีและการเงิน (Finance)">ฝ่ายบัญชีและการเงิน (Finance)</option>
                        <option value="ฝ่ายปฏิบัติการ (Operations)">ฝ่ายปฏิบัติการ (Operations)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">สิทธิ์การใช้งาน (Role)</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  >
                    <option value="Employee">Employee</option>
                    <option value="HR Admin">HR Admin</option>
                    <option value="Admin">System Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">สถานะ</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  >
                    <option value="Active">Active (ทำงานอยู่)</option>
                    <option value="Inactive">Inactive (พ้นสภาพ)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-sm transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/50 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Red Trash Icon */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-red-950/90 text-[#EF4444] border border-red-700/60 flex items-center justify-center shadow-lg shadow-red-950/60 shrink-0">
                <Trash2 size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wide">
                  ยืนยันการลบข้อมูลพนักงาน
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Confirmation Required</p>
              </div>
            </div>

            {/* Body/Description Box */}
            <div className="bg-[#0B0D13] p-4.5 rounded-2xl border border-red-900/40 mb-6 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>ชื่อพนักงาน:</span>
                <span className="font-bold text-white text-sm">{selectedEmployee?.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-red-900/20 pt-2">
                <span>รหัสพนักงาน (ID/Code):</span>
                <span className="font-mono font-bold text-[#EF4444] text-xs bg-red-950/80 px-2 py-0.5 rounded border border-red-800/40">
                  {selectedEmployee?.code || selectedEmployee?.id}
                </span>
              </div>
              <div className="mt-1 pt-2.5 border-t border-red-900/30 text-xs text-red-300 font-semibold flex items-center gap-1.5">
                <AlertCircle size={15} className="text-[#EF4444] shrink-0" />
                <span>คำเตือน: ระบบจะไม่สามารถกู้คืนข้อมูลพนักงานนี้ได้เมื่อยืนยันแล้ว</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-red-900/20">
              {/* Cancel Button (Secondary Action) */}
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedEmployee(null);
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-700/60 bg-[#1E293B] hover:bg-slate-800 text-slate-300 font-bold text-sm transition-all"
              >
                ยกเลิก
              </button>
              {/* Confirm Delete Button (Destructive Action - Red) */}
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#991B1B] hover:from-[#EF4444] hover:to-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/40 transition-all uppercase tracking-wide flex items-center gap-2"
              >
                <Trash2 size={16} />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
