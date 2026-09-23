import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Layers,
  Building2,
  Users,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  CheckCircle,
  X,
  ArrowLeft,
  Search,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function OrgManagement({ type = 'department', initialTab }) {
  const currentTab = initialTab || type;
  const [activeTabState, setActiveTabState] = useState(currentTab);

  useEffect(() => {
    if (initialTab) setActiveTabState(initialTab);
    else if (type) setActiveTabState(type);
  }, [initialTab, type]);
  const [data, setData] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeDetailDept, setActiveDetailDept] = useState(null);
  const [searchMemberTerm, setSearchMemberTerm] = useState('');
  const [deleteTargetItem, setDeleteTargetItem] = useState(null);
  const [editTargetItem, setEditTargetItem] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [extraInput, setExtraInput] = useState('');
  const [editNameInput, setEditNameInput] = useState('');
  const [editExtraInput, setEditExtraInput] = useState('');
  const [notification, setNotification] = useState(null);

  const getTitleInfo = () => {
    if (type === 'position') {
      return { title: 'การจัดการตำแหน่งงาน (Position)', icon: <Briefcase size={24} />, placeholder: 'เช่น Senior Software Engineer', extraLabel: 'แผนกที่สังกัด' };
    }
    return { title: 'การจัดการฝ่าย/แผนกหลัก (Department)', icon: <Building2 size={24} />, placeholder: 'เช่น ฝ่ายเทคโนโลยีสารสนเทศ (IT)', extraLabel: 'รหัสฝ่าย' };
  };

  const info = getTitleInfo();

  const fetchData = async () => {
    setLoading(true);
    let endpoint = type === 'position' ? `${API_BASE}/positions` : `${API_BASE}/departments`;

    try {
      const [resData, resEmp] = await Promise.all([
        fetch(endpoint).then((r) => r.json()),
        fetch(`${API_BASE}/employees`).then((r) => r.json()),
      ]);

      if (resData.success) {
        setData(resData.departments || resData.positions || []);
      }
      if (resEmp.success) {
        setAllEmployees(resEmp.employees || []);
      }
    } catch (err) {
      console.error('Failed to fetch org data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveDetailDept(null);
    fetchData();
  }, [type]);

  const openMembersModal = (item) => {
    setSelectedDeptItem(item);
    setShowMembersModal(true);
  };

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!nameInput) {
      alert('กรุณากรอกชื่อรายการ');
      return;
    }

    let endpoint = `${API_BASE}/departments`;
    let payload = { name: nameInput, code: extraInput || nameInput, manager: extraInput || 'ไม่ระบุ' };

    if (type === 'position') {
      endpoint = `${API_BASE}/positions`;
      payload = { title: nameInput, department: extraInput || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)' };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        triggerNotification(`เพิ่ม ${nameInput} เรียบร้อยแล้ว`);
        setNameInput('');
        setExtraInput('');
        setShowAddModal(false);
        fetchData();
      } else {
        alert(json.message || 'บันทึกข้อมูลไม่สำเร็จ');
      }
    } catch (err) {
      console.warn('Network fetch error, fallback to local update', err);
      const newItem = { id: `DEP-${Date.now().toString().slice(-4)}`, code: extraInput || nameInput, name: nameInput, manager: extraInput || 'ไม่ระบุ', employeeCount: 0 };
      setData((prev) => [newItem, ...prev]);
      triggerNotification(`เพิ่ม ${nameInput} เรียบร้อยแล้ว`);
      setNameInput('');
      setExtraInput('');
      setShowAddModal(false);
    }
  };

  const openEditModal = (item) => {
    setEditTargetItem(item);
    setEditNameInput(item.name || item.title || '');
    setEditExtraInput(item.manager || item.code || item.department || item.description || '');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!editTargetItem || !editNameInput) return;

    let endpoint = `${API_BASE}/departments/${editTargetItem.id}`;
    let payload = { id: editTargetItem.id, name: editNameInput, code: editExtraInput || editTargetItem.code, manager: editExtraInput || 'ไม่ระบุ' };

    if (type === 'position') {
      endpoint = `${API_BASE}/positions/${editTargetItem.id}`;
      payload = { id: editTargetItem.id, title: editNameInput, department: editExtraInput || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)' };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        triggerNotification(`แก้ไขข้อมูล ${editNameInput} เรียบร้อยแล้ว`);
        setShowEditModal(false);
        fetchData();
      } else {
        alert(json.message || 'แก้ไขข้อมูลไม่สำเร็จ');
      }
    } catch (err) {
      console.warn('Network fetch error on edit, updating local state', err);
      setData((prev) =>
        prev.map((item) =>
          item.id === editTargetItem.id
            ? { ...item, name: editNameInput, title: editNameInput, manager: editExtraInput, description: editExtraInput, code: editExtraInput || item.code }
            : item
        )
      );
      triggerNotification(`แก้ไขข้อมูล ${editNameInput} เรียบร้อยแล้ว`);
      setShowEditModal(false);
    }
  };

  const openDeleteModal = (item) => {
    setDeleteTargetItem(item);
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTargetItem) return;
    const id = deleteTargetItem.id;
    let endpoint = type === 'position' ? `${API_BASE}/positions/${id}` : `${API_BASE}/departments/${id}`;

    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        triggerNotification(`ลบข้อมูลเรียบร้อยแล้ว`);
        setShowDeleteModal(false);
        setDeleteTargetItem(null);
        fetchData();
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const openDetailView = (item) => {
    setActiveDetailDept(item);
  };

  // If user clicked on a department card -> Render Full Page Detail View
  if (activeDetailDept) {
    const deptName = (activeDetailDept.name || activeDetailDept.title || '').trim().toLowerCase();
    const members = allEmployees.filter(
      (e) => e && e.department && e.department.trim().toLowerCase() === deptName
    );

    const getRoleLevelInfo = (roleStr) => {
      const r = (roleStr || '').trim();
      if (r.includes('Super') || r === 'CEO') {
        return {
          level: 3,
          name: 'SuperBoss',
          label: '👑 SuperBoss',
          badge: 'bg-purple-950/90 text-purple-300 border-purple-700/60 shadow-md shadow-purple-950/50'
        };
      }
      if (r === 'Boss' || r === 'Manager' || r.includes('Admin')) {
        return {
          level: 2,
          name: 'Boss',
          label: '👔 Boss',
          badge: 'bg-amber-950/90 text-amber-300 border-amber-700/60 shadow-md shadow-amber-950/50'
        };
      }
      return {
        level: 1,
        name: 'Employee',
        label: '👤 Employee',
        badge: 'bg-[#1E293B] text-slate-300 border-slate-700'
      };
    };

    const term = (searchMemberTerm || '').trim().toLowerCase();
    const filteredMembers = members.filter((m) => {
      if (!m) return false;
      if (!term) return true;
      const nameMatch = m.name ? m.name.toLowerCase().includes(term) : false;
      const emailMatch = m.email ? m.email.toLowerCase().includes(term) : false;
      const codeMatch = m.code ? m.code.toLowerCase().includes(term) : false;
      const idMatch = m.id ? m.id.toLowerCase().includes(term) : false;
      return nameMatch || emailMatch || codeMatch || idMatch;
    }).sort((a, b) => {
      const levelA = getRoleLevelInfo(a.role).level;
      const levelB = getRoleLevelInfo(b.role).level;
      return levelA - levelB; // Employee (1) => Boss (2) => SuperBoss (3)
    });

    return (
      <div className="space-y-6 text-slate-100 font-sans animate-in fade-in duration-200">
        {/* Toast Notification */}
        {notification && (
          <div className="fixed top-5 right-5 z-50 bg-emerald-950 border border-emerald-700/60 text-emerald-300 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2.5 animate-bounce">
            <CheckCircle size={18} className="text-emerald-400" />
            <span>{notification}</span>
          </div>
        )}

        {/* Top Navigation & Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setActiveDetailDept(null);
                setSearchMemberTerm('');
              }}
              className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-[#0B0D13] hover:bg-red-950/60 border border-red-900/40 text-slate-300 font-bold text-xs transition-all shadow-md"
            >
              <ArrowLeft size={16} />
              <span>ย้อนกลับไปแผนกหลัก</span>
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                  {activeDetailDept.code || activeDetailDept.id}
                </span>
                <h1 className="text-xl font-black text-white uppercase tracking-wide">
                  {activeDetailDept.name || activeDetailDept.title}
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">รายละเอียดสายงานและรายชื่อพนักงานทั้งหมดในแผนกนี้</p>
            </div>
          </div>
        </div>

        {/* Info Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">สมาชิกพนักงานในฝ่าย</p>
              <h3 className="text-2xl font-black text-white font-mono">{members.length} คน</h3>
            </div>
          </div>

          <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">หัวหน้าฝ่ายประจำแผนก</p>
              <h3 className="text-sm font-bold text-white truncate max-w-[170px]">
                {activeDetailDept.manager || 'ไม่ระบุหัวหน้าฝ่าย'}
              </h3>
            </div>
          </div>

          <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
              <Briefcase size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">สังกัดฝ่ายหลัก</p>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">{activeDetailDept.name || activeDetailDept.title}</h3>
            </div>
          </div>

          <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">สถานะสายงาน</p>
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Active (เปิดใช้งาน)</h3>
            </div>
          </div>
        </div>

        {/* Member Search & List Section */}
        <div className="bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg space-y-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-red-900/30">
            <div className="flex items-center gap-2.5">
              <Users size={20} className="text-[#EF4444]" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wide">
                รายชื่อพนักงานสังกัดแผนกนี้ ({filteredMembers.length})
              </h2>
            </div>

            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัสพนักงาน, หรืออีเมล..."
                value={searchMemberTerm}
                onChange={(e) => setSearchMemberTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs text-white placeholder-slate-500 outline-none focus:border-[#EF4444] transition-all"
              />
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="bg-[#0B0D13] p-12 rounded-2xl border border-red-900/20 text-center flex flex-col items-center justify-center gap-3">
              <Users size={44} className="text-slate-600 mb-1" />
              <p className="text-base font-bold text-slate-300">ไม่พบพนักงานสังกัดแผนกนี้</p>
              <p className="text-xs text-slate-500">
                {searchMemberTerm ? 'ลองค้นหาด้วยคำใหม่อีกครั้ง' : 'ยังไม่มีพนักงานลงทะเบียนในแผนกนี้ สามารถเพิ่มพนักงานใหม่ได้ที่หน้า Employee Management'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMembers.map((emp) => (
                <div
                  key={emp.id}
                  className="bg-[#0B0D13] p-4.5 rounded-2xl border border-red-900/30 shadow flex items-center justify-between hover:border-red-600/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={emp.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={emp.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-red-800/40 shadow-md shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white">{emp.name}</h4>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                          {emp.code || emp.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Mail size={12} /> {emp.email}</span>
                        <span className="flex items-center gap-1"><Phone size={12} /> {emp.phone || '-'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {(() => {
                      const roleInfo = getRoleLevelInfo(emp.role);
                      return (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${roleInfo.badge}`}>
                          {roleInfo.label} (Level {roleInfo.level})
                        </span>
                      );
                    })()}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.status === 'Active'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                          : 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                      }`}
                    >
                      ● {emp.status || 'Active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-950 border border-emerald-700/60 text-emerald-300 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2.5 animate-bounce">
          <CheckCircle size={18} className="text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">{info.icon}</div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-wide">{info.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">จัดการโครงสร้างองค์กรสำหรับ Admin HR</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 text-sm transition-all uppercase tracking-wide"
          >
            <Plus size={18} />
            <span>เพิ่มรายการใหม่</span>
          </button>
        </div>
      </div>

      {/* List / Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full bg-[#141722] border border-red-900/30 p-12 text-center text-slate-500 font-mono rounded-2xl">
            กำลังโหลดข้อมูล...
          </div>
        ) : data.length === 0 ? (
          <div className="col-span-full bg-[#141722] border border-red-900/30 p-12 text-center text-slate-500 font-mono rounded-2xl">
            ยังไม่มีรายการในขณะนี้
          </div>
        ) : (
          data.map((item) => (
            <div
              key={item.id}
              onClick={() => openDetailView(item)}
              className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow-lg flex flex-col justify-between hover:border-red-500/80 hover:shadow-red-950/60 transition-all cursor-pointer group"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-red-950/80 text-[#EF4444] border border-red-800/40">
                    {item.code || item.id}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(item);
                      }}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-950/50 rounded-lg transition-colors cursor-pointer"
                      title="แก้ไขข้อมูล"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(item);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                      title="ลบ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-[#EF4444] transition-colors">{item.name || item.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {item.department || item.manager || item.description || 'โครงสร้างหลัก'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-red-900/30 flex justify-between items-center text-xs text-slate-400 font-medium">
                <span>สมาชิกในระบบ</span>
                <span className="font-bold text-[#EF4444] font-mono">
                  {typeof item.employeeCount === 'number' ? item.employeeCount : (typeof item.memberCount === 'number' ? item.memberCount : 0)} คน
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-red-900/30">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">เพิ่มรายการใหม่</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-red-950/40"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ชื่อรายการ *</label>
                <input
                  type="text"
                  placeholder={info.placeholder}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">{info.extraLabel}</label>
                <input
                  type="text"
                  placeholder="กรอกรายละเอียดเพิ่มเติม"
                  value={extraInput}
                  onChange={(e) => setExtraInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  onClick={handleAddSubmit}
                  className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ITEM MODAL */}
      {showEditModal && editTargetItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 animate-pop-in">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-red-900/30">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">แก้ไขรายการ ({editTargetItem.code || editTargetItem.id})</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-red-950/40"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ชื่อรายการ *</label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">{info.extraLabel}</label>
                <input
                  type="text"
                  value={editExtraInput}
                  onChange={(e) => setEditExtraInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  onClick={handleEditSubmit}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-all uppercase tracking-wide cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDeleteModal && deleteTargetItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Red Trash Icon */}
            <div className="w-14 h-14 rounded-2xl bg-red-950/90 text-red-500 border border-red-700/60 flex items-center justify-center mb-5 shadow-lg shadow-red-950/50">
              <Trash2 size={28} />
            </div>

            {/* Header/Title */}
            <h3 className="text-xl font-black text-white uppercase tracking-wide mb-2">
              ยืนยันการลบ {info.title.split(' ')[0].replace('การจัดการ', '')} ({deleteTargetItem.name || deleteTargetItem.title})?
            </h3>

            {/* Body/Description */}
            <p className="text-sm text-slate-300 leading-relaxed mb-7 bg-[#0B0D13] p-4 rounded-2xl border border-red-900/30">
              คุณกำลังจะลบข้อมูล <span className="font-bold text-white">{deleteTargetItem.name || deleteTargetItem.title}</span> ({deleteTargetItem.code || deleteTargetItem.id}) ออกจากระบบ ระบบจะไม่สามารถกู้คืนข้อมูลนี้ได้
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3">
              {/* Secondary Cancel Button */}
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTargetItem(null);
                }}
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
