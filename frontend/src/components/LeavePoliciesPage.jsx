import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  Search,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function LeavePoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaid, setFilterPaid] = useState('all'); // 'all' | 'paid' | 'unpaid'
  const [filterDateRange, setFilterDateRange] = useState('all'); // 'all' | 'restricted' | 'open'
  const [filterGender, setFilterGender] = useState('all'); // 'all' | 'all_gender' | 'male' | 'female'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, policyId: '', policyName: '' });

  // Form State
  const [formId, setFormId] = useState('');
  const [formTypeName, setFormTypeName] = useState('');
  const [formCategoryKey, setFormCategoryKey] = useState('annual');
  const [formDefaultQuota, setFormDefaultQuota] = useState(10);
  const [formIsPaid, setFormIsPaid] = useState(true);
  const [formApplicableGender, setFormApplicableGender] = useState('all');
  const [formDateRangeEnabled, setFormDateRangeEnabled] = useState(false);
  const [formAllowedStartDate, setFormAllowedStartDate] = useState('');
  const [formAllowedEndDate, setFormAllowedEndDate] = useState('');
  const [formMinAdvanceDays, setFormMinAdvanceDays] = useState(1);
  const [formMaxConsecutiveDays, setFormMaxConsecutiveDays] = useState(10);
  const [formAllowBackdated, setFormAllowBackdated] = useState(false);
  const [formMaxBackdatedDays, setFormMaxBackdatedDays] = useState(0);
  const [formRequireAttachment, setFormRequireAttachment] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('Active');

  const fetchPolicies = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/leave-policies`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.policies)) {
        setPolicies(data.policies);
      } else {
        setPolicies([]);
      }
    } catch (err) {
      console.error('Error fetching policies:', err);
      setErrorMsg('ไม่สามารถเชื่อมต่อ API นโยบายการลาได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 4000);
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    const nextNum = policies.length + 1;
    setFormId(`LP-${String(nextNum).padStart(2, '0')}`);
    setFormTypeName('');
    setFormCategoryKey('annual');
    setFormDefaultQuota(10);
    setFormIsPaid(true);
    setFormApplicableGender('all');
    setFormDateRangeEnabled(false);
    setFormAllowedStartDate('');
    setFormAllowedEndDate('');
    setFormMinAdvanceDays(1);
    setFormMaxConsecutiveDays(10);
    setFormAllowBackdated(false);
    setFormMaxBackdatedDays(0);
    setFormRequireAttachment(false);
    setFormDescription('');
    setFormStatus('Active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p) => {
    setModalMode('edit');
    setCurrentPolicy(p);
    setFormId(p.id);
    setFormTypeName(p.typeName);
    setFormCategoryKey(p.categoryKey || 'annual');
    setFormDefaultQuota(p.defaultQuota || 0);
    setFormIsPaid(p.isPaid !== undefined ? p.isPaid : true);
    setFormApplicableGender(p.applicableGender || 'all');
    setFormDateRangeEnabled(!!p.dateRangeEnabled);
    setFormAllowedStartDate(p.allowedStartDate || '');
    setFormAllowedEndDate(p.allowedEndDate || '');
    setFormMinAdvanceDays(p.minAdvanceDays || 0);
    setFormMaxConsecutiveDays(p.maxConsecutiveDays || 30);
    setFormAllowBackdated(!!p.allowBackdated);
    setFormMaxBackdatedDays(p.maxBackdatedDays || 0);
    setFormRequireAttachment(!!p.requireAttachment);
    setFormDescription(p.description || '');
    setFormStatus(p.status || 'Active');
    setIsModalOpen(true);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    if (!formTypeName.trim()) {
      alert('กรุณาระบุชื่อประเภทการลา');
      return;
    }

    if (formDateRangeEnabled) {
      if (!formAllowedStartDate || !formAllowedEndDate) {
        alert('กรุณาระบุทั้งวันที่เริ่มต้นและวันที่สิ้นสุดเมื่อเปิดใช้งานการจำกัดช่วงวันที่');
        return;
      }
      if (formAllowedEndDate < formAllowedStartDate) {
        alert('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: formId,
        typeName: formTypeName.trim(),
        categoryKey: formCategoryKey,
        defaultQuota: parseInt(formDefaultQuota, 10) || 0,
        isPaid: formIsPaid,
        applicableGender: formApplicableGender || 'all',
        allowedStartDate: formDateRangeEnabled ? formAllowedStartDate : null,
        allowedEndDate: formDateRangeEnabled ? formAllowedEndDate : null,
        dateRangeEnabled: formDateRangeEnabled,
        minAdvanceDays: parseInt(formMinAdvanceDays, 10) || 0,
        maxConsecutiveDays: parseInt(formMaxConsecutiveDays, 10) || 30,
        allowBackdated: formAllowBackdated,
        maxBackdatedDays: formAllowBackdated ? parseInt(formMaxBackdatedDays, 10) || 0 : 0,
        requireAttachment: formRequireAttachment,
        description: formDescription.trim(),
        status: formStatus,
      };

      let res;
      if (modalMode === 'create') {
        res = await fetch(`${API_BASE}/leave-policies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/leave-policies/${formId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const resData = await res.json();
      if (res.ok && resData.success) {
        showToast(modalMode === 'create' ? '✨ เพิ่มประเภทนโยบายการลาสำเร็จ' : '💾 บันทึกการตั้งค่านโยบายการลาเรียบร้อยแล้ว');
        setIsModalOpen(false);
        fetchPolicies();
      } else {
        alert(resData.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกข้อมูลได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDeletePolicy = (id, name) => {
    setDeleteConfirmModal({ isOpen: true, policyId: id, policyName: name });
  };

  const handleConfirmDeletePolicy = async () => {
    const { policyId, policyName } = deleteConfirmModal;
    if (!policyId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leave-policies/${policyId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`🗑️ ลบนโยบายการลา ${policyName} เรียบร้อยแล้ว`);
        setDeleteConfirmModal({ isOpen: false, policyId: '', policyName: '' });
        fetchPolicies();
      } else {
        setErrorMsg(data.message || 'ไม่สามารถลบข้อมูลได้');
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered list
  const filteredPolicies = policies.filter((p) => {
    const matchSearch =
      (p.typeName && p.typeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.id && p.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.categoryKey && p.categoryKey.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchPaid =
      filterPaid === 'all' ? true : filterPaid === 'paid' ? p.isPaid === true : p.isPaid === false;

    const matchDateRange =
      filterDateRange === 'all'
        ? true
        : filterDateRange === 'restricted'
        ? p.dateRangeEnabled === true
        : p.dateRangeEnabled === false;

    const matchGender =
      filterGender === 'all'
        ? true
        : (p.applicableGender || 'all') === filterGender;

    return matchSearch && matchPaid && matchDateRange && matchGender;
  });

  const totalPolicies = policies.length;
  const activePolicies = policies.filter((p) => p.status === 'Active').length;
  const paidPolicies = policies.filter((p) => p.isPaid).length;
  const dateRestrictedPolicies = policies.filter((p) => p.dateRangeEnabled).length;

  return (
    <div className="space-y-6 text-slate-100 font-sans animate-in fade-in duration-200">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-950 border border-emerald-500/60 text-emerald-200 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <span className="text-sm font-bold">{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <UserCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                LEAVE POLICIES & QUOTAS
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                Leave Quotas & Policies (โควต้าวันลาและนโยบายการลาองค์กร)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              กำหนดสิทธิ์วันลาพักร้อน ลากิจ ลาป่วย และกฎเกณฑ์วันเวลาที่อนุญาตให้ลา (100% Real Database Sync & Mobile App Control)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchPolicies}
            disabled={isLoading}
            className="flex items-center gap-2 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 hover:text-white px-3.5 py-2.5 rounded-xl border border-red-900/40 text-xs font-bold transition-all"
            title="รีเฟรชข้อมูลจากฐานข้อมูล"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-red-500' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
          >
            <Plus size={16} />
            <span>เพิ่มประเภทนโยบายการลา</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#141722] rounded-2xl p-4 border border-red-900/30 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">นโยบายทั้งหมด</span>
            <div className="text-2xl font-black text-white mt-1">{totalPolicies} <span className="text-xs font-normal text-slate-400">ประเภท</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center text-red-400">
            <Layers size={20} />
          </div>
        </div>

        <div className="bg-[#141722] rounded-2xl p-4 border border-red-900/30 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">สถานะเปิดใช้งาน</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{activePolicies} <span className="text-xs font-normal text-slate-400">ประเภท</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-[#141722] rounded-2xl p-4 border border-red-900/30 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">ได้รับค่าจ้าง (Paid)</span>
            <div className="text-2xl font-black text-blue-400 mt-1">{paidPolicies} <span className="text-xs font-normal text-slate-400">ประเภท</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-[#141722] rounded-2xl p-4 border border-red-900/30 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">จำกัดช่วงวันเวลาที่ลาได้</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{dateRestrictedPolicies} <span className="text-xs font-normal text-slate-400">ประเภท</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400">
            <Calendar size={20} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#141722] p-4 rounded-2xl border border-red-900/30 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อประเภทการลา หรือ รหัสนโยบาย..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          {/* Gender Filter */}
          <div className="flex items-center gap-2 bg-[#0B0D13] p-1 rounded-xl border border-red-900/30 text-xs shrink-0">
            <span className="text-slate-400 pl-2 font-bold text-[11px]">เพศ:</span>
            <button
              onClick={() => setFilterGender('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterGender === 'all' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setFilterGender('male')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterGender === 'male' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              👨 ชาย
            </button>
            <button
              onClick={() => setFilterGender('female')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterGender === 'female' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              👩 หญิง
            </button>
          </div>

          <div className="flex items-center gap-2 bg-[#0B0D13] p-1 rounded-xl border border-red-900/30 text-xs shrink-0">
            <span className="text-slate-400 pl-2 font-bold text-[11px]">การจ่ายเงิน:</span>
            <button
              onClick={() => setFilterPaid('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterPaid === 'all' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setFilterPaid('paid')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterPaid === 'paid' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Paid
            </button>
            <button
              onClick={() => setFilterPaid('unpaid')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterPaid === 'unpaid' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Unpaid
            </button>
          </div>

          <div className="flex items-center gap-2 bg-[#0B0D13] p-1 rounded-xl border border-red-900/30 text-xs shrink-0">
            <span className="text-slate-400 pl-2 font-bold text-[11px]">เงื่อนไขวันที่:</span>
            <button
              onClick={() => setFilterDateRange('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterDateRange === 'all' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setFilterDateRange('restricted')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterDateRange === 'restricted' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              จำกัดช่วงวันที่
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Policies Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPolicies.map((p) => (
          <div
            key={p.id}
            className="bg-[#141722] rounded-2xl p-6 border border-red-900/30 shadow-lg hover:border-red-600/50 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-red-400 bg-red-950 px-2.5 py-1 rounded-lg border border-red-800/40">
                    {p.id}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.status === 'Active' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/40' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                    {p.status === 'Active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    p.applicableGender === 'female'
                      ? 'bg-pink-950/80 text-pink-300 border-pink-700/50'
                      : p.applicableGender === 'male'
                      ? 'bg-blue-950/80 text-blue-300 border-blue-700/50'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}>
                    {p.applicableGender === 'female' ? '👩 เฉพาะเพศหญิง' : p.applicableGender === 'male' ? '👨 เฉพาะเพศชาย' : '🌐 ทุกเพศ'}
                  </span>
                </div>

                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${p.isPaid ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800/40' : 'text-amber-400 bg-amber-950/80 border-amber-800/40'}`}>
                  {p.isPaid ? 'ได้รับค่าจ้าง (Paid)' : 'ไม่ได้รับค่าจ้าง (Unpaid)'}
                </span>
              </div>

              {/* Title & Quota */}
              <h3 className="text-base font-bold text-white mb-2 leading-snug">{p.typeName}</h3>

              <div className="flex items-baseline gap-2 mb-4 bg-[#0B0D13] p-3 rounded-xl border border-red-900/20">
                <span className="text-2xl font-black text-amber-400 font-mono">{p.defaultQuota}</span>
                <span className="text-xs font-semibold text-slate-400">วัน / ปี (โควต้าพื้นฐาน)</span>
              </div>

              {/* Allowed Date Range Badge (Feature Focus) */}
              <div className="mb-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-red-400" />
                  <span>กำหนดช่วงวันเวลาที่ลาได้</span>
                </div>
                {p.dateRangeEnabled && p.allowedStartDate && p.allowedEndDate ? (
                  <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-2.5 text-xs">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Clock size={13} />
                      <span>{p.allowedStartDate} ถึง {p.allowedEndDate}</span>
                    </div>
                    <p className="text-[11px] text-amber-400/80 mt-1 leading-tight">
                      ⚠️ พนักงานลาได้เฉพาะช่วงนี้เท่านั้น (หากเกินกำหนดจะไม่สามารถลาได้)
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span>ไม่จำกัดช่วงวันที่ (สามารถยื่นลาได้ตลอดทั้งปี)</span>
                  </div>
                )}
              </div>

              {/* Rules List */}
              <div className="space-y-1.5 text-xs text-slate-300 bg-[#0B0D13]/60 p-3 rounded-xl border border-red-900/10 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">เพศที่ใช้สิทธิ์ได้:</span>
                  <span className="font-bold text-white">
                    {p.applicableGender === 'female' ? '👩 เฉพาะเพศหญิง' : p.applicableGender === 'male' ? '👨 เฉพาะเพศชาย' : '🌐 ทุกเพศ'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ขอล่วงหน้าอย่างน้อย:</span>
                  <span className="font-bold text-white">{p.minAdvanceDays > 0 ? `${p.minAdvanceDays} วัน` : 'ไม่กำหนด (ลาฉุกเฉินได้)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ลาติดต่อกันได้สูงสุด:</span>
                  <span className="font-bold text-white">{p.maxConsecutiveDays} วัน</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">การลาย้อนหลัง:</span>
                  <span className="font-bold text-white">{p.allowBackdated ? `อนุญาต (ไม่เกิน ${p.maxBackdatedDays} วัน)` : 'ไม่อนุญาต'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">เอกสารรับรอง:</span>
                  <span className={`font-bold ${p.requireAttachment ? 'text-amber-400' : 'text-slate-400'}`}>
                    {p.requireAttachment ? 'บังคับแนบเอกสาร' : 'ไม่บังคับ'}
                  </span>
                </div>
              </div>

              {/* Description */}
              {p.description ? (
                <p className="text-xs text-slate-400 italic mb-4 line-clamp-2">
                  หมายเหตุ: {p.description}
                </p>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-red-900/20">
              <button
                onClick={() => handleOpenEditModal(p)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-950/60 hover:bg-red-900/60 text-red-300 hover:text-white py-2 rounded-xl border border-red-800/40 text-xs font-bold transition-all"
              >
                <Edit size={14} />
                <span>กำหนดการตั้งค่า / แก้ไข</span>
              </button>
              <button
                onClick={() => requestDeletePolicy(p.id, p.typeName)}
                className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-900/30 transition-all"
                title="ลบนโยบาย"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredPolicies.length === 0 && !isLoading && (
        <div className="bg-[#141722] rounded-2xl p-12 text-center border border-red-900/30 shadow-lg">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">ไม่พบนโยบายการลาตามเงื่อนไขที่ค้นหา</h3>
          <p className="text-xs text-slate-400 mb-4">ลองปรับเปลี่ยนคำค้นหา หรือกดปุ่มเพิ่มประเภทนโยบายการลาใหม่</p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2 rounded-xl text-xs font-bold"
          >
            <Plus size={15} />
            <span>เพิ่มประเภทนโยบายการลา</span>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* Policy Configuration Modal (Popup Dialog) */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#141722] rounded-3xl border border-red-800/50 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950 text-red-400 border border-red-800/40">
                  <Edit size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase">
                    {modalMode === 'create' ? 'เพิ่มประเภทนโยบายการลาใหม่' : `กำหนดการตั้งค่านโยบาย: ${formTypeName || formId}`}
                  </h2>
                  <p className="text-xs text-slate-400">
                    กำหนดโควต้า วันเวลาที่สามารถลาได้ และกฎเกณฑ์การอนุมัติ (เชื่อมโยงฐานข้อมูลจริง)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-red-950/40 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePolicy} className="space-y-5">
              {/* Row 1: ID, Type Name, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">รหัสนโยบาย (Policy ID)</label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    disabled={modalMode === 'edit'}
                    className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-red-500 disabled:opacity-60"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block mb-1">ชื่อประเภทการลา (Leave Type Name) *</label>
                  <input
                    type="text"
                    value={formTypeName}
                    onChange={(e) => setFormTypeName(e.target.value)}
                    placeholder="เช่น ลาพักร้อนประจำปี (Annual Leave)"
                    className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Category Key & Quotas & Paid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">หมวดหมู่ระบบ (Category Key)</label>
                  <select
                    value={formCategoryKey}
                    onChange={(e) => setFormCategoryKey(e.target.value)}
                    className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="annual">annual (ลาพักร้อน)</option>
                    <option value="sick">sick (ลาป่วย)</option>
                    <option value="personal">personal (ลากิจ)</option>
                    <option value="maternity">maternity (ลาคลอด)</option>
                    <option value="ordination">ordination (ลาบวช)</option>
                    <option value="paternity">paternity (ลาภริยาคลอดบุตร)</option>
                    <option value="other">other (ลาอื่นๆ)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">โควต้าพื้นฐาน (วัน/ปี)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={formDefaultQuota}
                    onChange={(e) => setFormDefaultQuota(e.target.value)}
                    className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">การจ่ายค่าจ้าง</label>
                  <select
                    value={formIsPaid ? 'true' : 'false'}
                    onChange={(e) => setFormIsPaid(e.target.value === 'true')}
                    className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="true">ได้รับค่าจ้าง (Paid)</option>
                    <option value="false">ไม่ได้รับค่าจ้าง (Unpaid)</option>
                  </select>
                </div>
              </div>

              {/* Gender Applicability Selection Section */}
              <div className="bg-[#0B0D13] p-4 rounded-2xl border border-red-900/30 space-y-2">
                <label className="text-xs font-bold text-slate-200 block">
                  เพศที่สามารถใช้สิทธิ์การลานี้ได้ (Applicable Gender) *
                </label>
                <p className="text-[11px] text-slate-400">
                  ระบบจะเปิดให้ยื่นลาและแสดงโควต้านี้ใน Mobile App เฉพาะพนักงานที่มีเพศตรงตามที่เลือกไว้
                </p>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormApplicableGender('all')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      formApplicableGender === 'all'
                        ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                        : 'bg-[#141722] text-slate-400 border-red-900/30 hover:text-white'
                    }`}
                  >
                    <span>🌐</span>
                    <span>ทุกเพศ (All)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormApplicableGender('male')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      formApplicableGender === 'male'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                        : 'bg-[#141722] text-slate-400 border-red-900/30 hover:text-white'
                    }`}
                  >
                    <span>👨</span>
                    <span>เฉพาะเพศชาย (Male)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormApplicableGender('female')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      formApplicableGender === 'female'
                        ? 'bg-pink-600 text-white border-pink-500 shadow-md shadow-pink-600/30'
                        : 'bg-[#141722] text-slate-400 border-red-900/30 hover:text-white'
                    }`}
                  >
                    <span>👩</span>
                    <span>เฉพาะเพศหญิง (Female)</span>
                  </button>
                </div>
              </div>

              {/* ======================================================== */}
              {/* Highlight Section: Allowed Date Range Constraint */}
              {/* ======================================================== */}
              <div className="bg-gradient-to-r from-red-950/50 via-[#1A1E2E] to-red-950/30 p-5 rounded-2xl border border-red-700/40 shadow-inner space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-red-900/60 text-red-400">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        กำหนดช่วงวันเวลาที่อนุญาตให้ลา (Allowed Leave Date Range)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        บังคับใช้ใน Mobile App — ถ้าเกินวันที่กำหนดให้ต้องไม่สามารถลาได้อีก
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formDateRangeEnabled}
                      onChange={(e) => setFormDateRangeEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>

                {formDateRangeEnabled && (
                  <div className="pt-3 border-t border-red-800/30 space-y-3 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-amber-300 block mb-1">
                          วันที่เริ่มต้นที่อนุญาตให้ลา (Start Date) *
                        </label>
                        <input
                          type="date"
                          value={formAllowedStartDate}
                          onChange={(e) => setFormAllowedStartDate(e.target.value)}
                          className="w-full bg-[#0B0D13] border border-amber-700/50 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                          required={formDateRangeEnabled}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-amber-300 block mb-1">
                          วันที่สิ้นสุดที่อนุญาตให้ลา (End Date / Cutoff Date) *
                        </label>
                        <input
                          type="date"
                          value={formAllowedEndDate}
                          onChange={(e) => setFormAllowedEndDate(e.target.value)}
                          className="w-full bg-[#0B0D13] border border-amber-700/50 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                          required={formDateRangeEnabled}
                        />
                      </div>
                    </div>

                    <div className="bg-amber-950/60 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">ระบบตรวจสอบแบบ Real-time บน Mobile App:</span> เมื่อเปิดใช้งาน พนักงานจะสามารถยื่นลาประเภทนี้ได้เฉพาะช่วงวันที่ระบุเท่านั้น หากเลือกวันที่นอกเหนือจากนี้หรือเกินกำหนด ระบบในแอปจะบล็อกและแสดงข้อความปฏิเสธทันที
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 3: Submission Rules & Advance Notice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">ขอล่วงหน้าอย่างน้อย (วัน)</label>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={formMinAdvanceDays}
                    onChange={(e) => setFormMinAdvanceDays(e.target.value)}
                    className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">ใส่ 0 หากอนุญาตให้ลาฉุกเฉินได้ในวันเดียวกัน</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">ลาติดต่อกันได้สูงสุด (วัน)</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={formMaxConsecutiveDays}
                    onChange={(e) => setFormMaxConsecutiveDays(e.target.value)}
                    className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Row 4: Backdated & Attachment Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0B0D13] p-4 rounded-2xl border border-red-900/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">อนุญาตให้ลาย้อนหลัง</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formAllowBackdated}
                        onChange={(e) => setFormAllowBackdated(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                  {formAllowBackdated && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400">ย้อนหลังได้ไม่เกิน:</span>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={formMaxBackdatedDays}
                        onChange={(e) => setFormMaxBackdatedDays(e.target.value)}
                        className="w-16 bg-[#141722] border border-red-900/40 rounded-lg px-2 py-1 text-xs text-white text-center"
                      />
                      <span className="text-[11px] text-slate-400">วัน</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-300 block">บังคับแนบเอกสาร</span>
                    <span className="text-[10px] text-slate-500 block">เช่น ใบรับรองแพทย์ หรือ เอกสารรับรอง</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRequireAttachment}
                      onChange={(e) => setFormRequireAttachment(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>
              </div>

              {/* Description & Status */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">หมายเหตุ / รายละเอียดนโยบายการลา</label>
                <textarea
                  rows="2"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="เช่น ต้องมีใบรับรองแพทย์กรณีลาติดต่อกันเกิน 3 วัน หรือ นโยบายการใช้สิทธิ์สำหรับพนักงานผ่านโปร"
                  className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">สถานะเปิดใช้งานในระบบ</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-[#0B0D13] border border-red-900/40 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  <option value="Active">เปิดใช้งาน (Active - แสดงใน App พนักงาน)</option>
                  <option value="Inactive">ปิดใช้งานชั่วคราว (Inactive - ซ่อนใน App)</option>
                </select>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 text-xs font-bold border border-red-900/40 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold shadow-lg shadow-red-600/40 transition-all uppercase tracking-wide disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกการตั้งค่า</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* Delete Confirmation Popup Modal */}
      {/* ======================================================== */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#141722] border border-red-900/60 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-red-950/50 space-y-5 animate-scale-up">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-700/50 flex items-center justify-center text-[#EF4444] shadow-inner flex-shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ยืนยันการลบนโยบายการลา</h3>
                <p className="text-xs text-slate-400">กรุณาตรวจสอบก่อนยืนยันการทำรายการ</p>
              </div>
            </div>

            <div className="bg-[#0B0D13] p-4 rounded-2xl border border-red-900/30 text-xs text-slate-300 leading-relaxed space-y-2">
              <p>
                คุณต้องการลบนโยบายการลา <span className="font-bold text-white">"{deleteConfirmModal.policyName}"</span> (รหัส <span className="font-mono text-red-400 font-bold">{deleteConfirmModal.policyId}</span>) ใช่หรือไม่?
              </p>
              <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold pt-1">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>การลบนี้จะปิดการใช้งานสิทธิ์ของพนักงาน และไม่สามารถเรียกคืนได้</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, policyId: '', policyName: '' })}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-[#0B0D13] hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePolicy}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold shadow-lg shadow-red-600/40 transition-all uppercase tracking-wide disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>ยืนยันการลบ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
