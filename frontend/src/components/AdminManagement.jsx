import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  CheckCircle,
  KeyRound,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  Building2
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    role: 'Admin',
    department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
    status: 'Active',
  });

  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState(null);

  const [departments, setDepartments] = useState([]);

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admins`);
      const data = await res.json();
      if (data.success && data.admins) {
        setAdmins(data.admins);
      }
    } catch (err) {
      console.error('Failed to fetch admins', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetch(`${API_BASE}/departments`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.departments) setDepartments(data.departments);
      })
      .catch(() => null);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      username: '',
      password: '1234',
      email: '',
      phone: '',
      role: 'Admin',
      department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      status: 'Active',
    });
    setShowAddModal(true);
  };

  const openEditModal = (admin) => {
    setSelectedAdmin(admin);
    setFormData({
      name: admin.name || '',
      username: admin.username || admin.code || '',
      password: admin.password || '',
      email: admin.email || '',
      phone: admin.phone || '',
      role: admin.role || 'Admin',
      department: admin.department || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      status: admin.status || 'Active',
    });
    setShowEditModal(true);
  };

  const openResetPasswordModal = (admin) => {
    setSelectedAdmin(admin);
    setResetPasswordInput('');
    setShowResetPasswordModal(true);
  };

  const openDeleteModal = (admin) => {
    setSelectedAdmin(admin);
    setShowDeleteModal(true);
  };

  // CREATE ADMIN
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.username) {
      alert('กรุณากรอกชื่อ-นามสกุล และ Username');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (json.success) {
        triggerNotification(`สร้างบัญชี Admin "${formData.name}" เรียบร้อยแล้ว`);
        setShowAddModal(false);
        setSearchTerm('');
        setRoleFilter('');
        fetchAdmins();
      } else {
        alert(json.message || 'เกิดข้อผิดพลาดในการสร้าง Admin');
      }
    } catch (err) {
      console.error('Failed to create admin', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  // EDIT ADMIN
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAdmin) return;

    try {
      const res = await fetch(`${API_BASE}/admins/${selectedAdmin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (json.success) {
        triggerNotification(`อัปเดตข้อมูล Admin "${formData.name}" เรียบร้อยแล้ว`);
        setShowEditModal(false);
        fetchAdmins();
      } else {
        alert(json.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
      }
    } catch (err) {
      console.error('Failed to update admin', err);
    }
  };

  // RESET PASSWORD
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPasswordInput || !selectedAdmin) return;

    try {
      const res = await fetch(`${API_BASE}/admins/${selectedAdmin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPasswordInput }),
      });
      const json = await res.json();

      if (json.success) {
        triggerNotification(`เปลี่ยนรหัสผ่านของ "${selectedAdmin.name}" สำเร็จแล้ว`);
        setShowResetPasswordModal(false);
        fetchAdmins();
      }
    } catch (err) {
      console.error('Failed to reset password', err);
    }
  };

  // DELETE ADMIN
  const handleDeleteSubmit = async () => {
    if (!selectedAdmin) return;

    try {
      const res = await fetch(`${API_BASE}/admins/${selectedAdmin.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (json.success) {
        triggerNotification(`ลบบัญชี Admin "${selectedAdmin.name}" เรียบร้อยแล้ว`);
        setShowDeleteModal(false);
        fetchAdmins();
      }
    } catch (err) {
      console.error('Failed to delete admin', err);
    }
  };

  // Filtered List
  const filteredAdmins = admins.filter((admin) => {
    const matchesSearch =
      (admin.name && admin.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.username && admin.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.email && admin.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.code && admin.code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter ? admin.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex flex-col gap-6 font-sans text-slate-100">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-red-950 border border-red-700/60 text-red-300 shadow-2xl text-sm font-bold animate-bounce">
          <CheckCircle size={20} className="text-[#EF4444]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-[#DC2626] text-white shadow-lg shadow-red-600/30">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-wide">จัดการผู้ดูแลระบบ (Admin Management)</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              สร้างและกำหนดสิทธิ์รหัสผ่านสำหรับ Admin ที่คอยดูแลระบบและจัดการพนักงาน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchAdmins(); fetchAuditLogs(); }}
            className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
          >
            <UserPlus size={16} />
            <span>สร้างบัญชี Admin ใหม่</span>
          </button>
        </div>
      </div>



      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-[#141722] rounded-2xl p-5 border border-red-900/30 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">จำนวน Admin ทั้งหมด</span>
            <div className="text-2xl font-black text-[#EF4444]">{admins.length} <span className="text-xs font-normal text-slate-400">บัญชี</span></div>
          </div>
          <div className="p-3 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <ShieldCheck size={22} />
          </div>
        </div>

        <div className="bg-[#141722] rounded-2xl p-5 border border-red-900/30 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Super Admin / CEO</span>
            <div className="text-2xl font-black text-amber-500">
              {admins.filter((a) => a.role === 'Super Admin' || a.role === 'SuperBoss').length} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/80 text-amber-500 border border-amber-800/40">
            <Lock size={22} />
          </div>
        </div>

        <div className="bg-[#141722] rounded-2xl p-5 border border-red-900/30 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">สถานะใช้งานอยู่ (Active)</span>
            <div className="text-2xl font-black text-emerald-400">
              {admins.filter((a) => a.status === 'Active').length} <span className="text-xs font-normal text-slate-400">บัญชี</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#141722] rounded-2xl p-4 border border-red-900/30 shadow-lg flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อ, Username, อีเมล..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#0B0D13] border border-red-900/40 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300">
            <Filter size={14} className="text-red-400" />
            <span>สิทธิ์ใช้งาน:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent font-bold text-[#EF4444] outline-none cursor-pointer"
            >
              <option value="">ทั้งหมด</option>
              <option value="Super Admin">Super Admin</option>
              <option value="HR Admin">HR Admin</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Admin Table */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B0D13] border-b border-red-900/30 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">ชื่อผู้ดูแลระบบ (Admin)</th>
                <th className="py-4 px-6">Username (เข้าเว็บ)</th>
                <th className="py-4 px-6">ระดับสิทธิ์ (Role)</th>
                <th className="py-4 px-6">ฝ่ายที่สังกัด</th>
                <th className="py-4 px-6">สถานะ</th>
                <th className="py-4 px-6 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20 text-sm font-medium text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-mono">
                    กำลังโหลดข้อมูล Admin...
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-mono">
                    ไม่พบข้อมูล Admin ตรงตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((adm) => (
                  <tr key={adm.id} className="hover:bg-red-950/20 transition-colors">
                    {/* Name & Avatar */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={adm.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={adm.name}
                          className="w-10 h-10 rounded-full object-cover border border-red-900/40"
                        />
                        <div>
                          <div className="font-bold text-white">{adm.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                            <span>{adm.email || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="py-4 px-6">
                      <span className="font-bold font-mono text-[#EF4444] bg-red-950/80 px-2.5 py-1 rounded-md border border-red-800/40 text-xs">
                        {adm.username || adm.code || 'admin'}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          adm.role === 'Super Admin' || adm.role === 'SuperBoss'
                            ? 'bg-amber-950 text-amber-400 border border-amber-700/60'
                            : adm.role === 'HR Admin'
                            ? 'bg-purple-950 text-purple-400 border border-purple-700/60'
                            : 'bg-red-950 text-red-400 border border-red-700/60'
                        }`}
                      >
                        {adm.role === 'Super Admin' ? '👑 Super Admin' : adm.role === 'HR Admin' ? '🛡️ HR Admin' : '👤 System Admin'}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="py-4 px-6 text-xs text-slate-300">
                      {adm.department || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)'}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          adm.status === 'Active'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                            : 'bg-slate-900 text-slate-500 border border-slate-700'
                        }`}
                      >
                        ● {adm.status === 'Active' ? 'Active (ใช้งานอยู่)' : 'Inactive'}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(adm)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-red-950/40 rounded-lg transition-colors"
                          title="แก้ไขข้อมูล Admin"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(adm)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-950/50 rounded-lg transition-colors"
                          title="เปลี่ยนรหัสผ่าน"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(adm)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/60 rounded-lg transition-colors"
                          title="ลบบัญชี Admin"
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



      {/* CREATE ADMIN MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141722] rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">สร้างบัญชี Admin ใหม่</h3>
                  <p className="text-xs text-slate-400">สร้างรหัสผ่านสำหรับเข้าจัดการระบบบน Web Admin</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-red-950/40"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ชื่อ-นามสกุล Admin *</label>
                  <input
                    type="text"
                    name="name"
                    placeholder="เช่น สมชาย ใจดี"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Username (เข้าเว็บ) *</label>
                  <input
                    type="text"
                    name="username"
                    placeholder="เช่น admin_somchai"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">รหัสผ่าน (Password) *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="ตั้งรหัสผ่านเข้าเว็บ"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ระดับสิทธิ์ (Role) *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  >
                    <option value="Super Admin">👑 Super Admin (สิทธิ์สูงสุด)</option>
                    <option value="HR Admin">🛡️ HR Admin (จัดการพนักงาน/อนุมัติ)</option>
                    <option value="Admin">👤 System Admin (ผู้ดูแลทั่วไป)</option>
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
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">อีเมล</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="admin@wellx989.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  />
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
                  className="px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
                >
                  บันทึกและสร้าง Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMIN MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141722] rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
                  <Edit size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">แก้ไขข้อมูล Admin</h3>
                  <p className="text-xs text-slate-400">{formData.name} ({formData.username})</p>
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
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Username (เข้าเว็บ)</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ระดับสิทธิ์ (Role)</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  >
                    <option value="Super Admin">👑 Super Admin (สิทธิ์สูงสุด)</option>
                    <option value="HR Admin">🛡️ HR Admin (จัดการพนักงาน/อนุมัติ)</option>
                    <option value="Admin">👤 System Admin (ผู้ดูแลทั่วไป)</option>
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
                    <option value="Active">Active (ใช้งานอยู่)</option>
                    <option value="Inactive">Inactive (ระงับใช้งาน)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">อีเมล</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  />
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

      {/* RESET PASSWORD MODAL */}
      {showResetPasswordModal && selectedAdmin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-950 text-amber-500 border border-amber-800/40">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">เปลี่ยนรหัสผ่าน Admin</h3>
                  <p className="text-xs text-slate-400">{selectedAdmin.name} ({selectedAdmin.username})</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetPasswordModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-red-950/40"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">รหัสผ่านใหม่ *</label>
                <input
                  type="text"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่สำหรับเข้าเว็บ"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setShowResetPasswordModal(false)}
                  className="px-5 py-2 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/30 uppercase tracking-wide"
                >
                  ยืนยันเปลี่ยนรหัสผ่าน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ADMIN MODAL */}
      {showDeleteModal && selectedAdmin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Red Warning Trash Icon */}
            <div className="w-14 h-14 rounded-2xl bg-red-950/90 text-red-500 border border-red-700/60 flex items-center justify-center mb-5 shadow-lg shadow-red-950/50">
              <Trash2 size={28} />
            </div>

            {/* Header/Title */}
            <h3 className="text-xl font-black text-white uppercase tracking-wide mb-2">
              ยืนยันการลบบัญชีผู้ดูแลระบบ ({selectedAdmin?.name})?
            </h3>

            {/* Body/Description */}
            <p className="text-sm text-slate-300 leading-relaxed mb-7 bg-[#0B0D13] p-4 rounded-2xl border border-red-900/30">
              คุณกำลังจะลบบัญชีผู้ดูแลระบบ <span className="font-bold text-white">{selectedAdmin?.name}</span> ({selectedAdmin?.username || selectedAdmin?.code || selectedAdmin?.id}) ออกจากระบบ ระบบจะไม่สามารถกู้คืนข้อมูลนี้ได้
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3">
              {/* Secondary Cancel Button */}
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-700/60 bg-[#1A1D2C] hover:bg-slate-800 text-slate-300 font-bold text-sm transition-all"
              >
                ยกเลิก
              </button>
              {/* Danger Red Confirm Delete Button */}
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
