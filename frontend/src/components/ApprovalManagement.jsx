import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Filter,
  Lock,
  Crown,
  RefreshCw
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function ApprovalManagement({ initialTab = 'approval' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Current active login identity for testing role hierarchy
  const [activeUserRole, setActiveUserRole] = useState('Boss_IT'); // Options: 'SuperBoss', 'Boss_IT', 'Boss_MKT', 'Employee_IT'
  
  // Pending requests list from real API / DB
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingApprovals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/approvals/pending?managerId=${activeUserRole}`);
      const json = await res.json();
      if (json.success) {
        setRequests(json.approvals || []);
      }
    } catch (err) {
      console.error('Failed to fetch approvals from API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, [activeUserRole]);

  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [notification, setNotification] = useState(null);

  const triggerNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper to determine logged in user's role and department
  const getUserInfo = (roleKey) => {
    switch (roleKey) {
      case 'SuperBoss':
        return {
          title: 'คุณ วิชัย เดชอุดม (SuperBoss / CEO)',
          role: 'SuperBoss',
          department: 'ผู้บริหารระดับสูง (Executive Board)',
          badgeColor: 'bg-purple-100 text-purple-800 border-purple-300'
        };
      case 'Boss_IT':
        return {
          title: 'คุณ สมชาย ใจดี (Boss IT)',
          role: 'Boss',
          department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
          badgeColor: 'bg-sky-100 text-sky-800 border-sky-300'
        };
      case 'Boss_MKT':
        return {
          title: 'คุณ กานดา วงษ์สว่าง (Boss Marketing)',
          role: 'Boss',
          department: 'ฝ่ายการตลาด (Marketing)',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300'
        };
      case 'Employee_IT':
      default:
        return {
          title: 'เดชาธร ทองทิพย์ (Employee IT)',
          role: 'Employee',
          department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-300'
        };
    }
  };

  const currentUser = getUserInfo(activeUserRole);

  const canApproveRequest = (req) => {
    const isReqBoss =
      req.requesterRole === 'Boss' ||
      req.role === 'Boss' ||
      req.requesterRole === 'Manager' ||
      req.role === 'Manager' ||
      req.requesterRole === 'HR Admin';

    if (currentUser.role === 'SuperBoss') {
      return {
        allowed: true,
        reason: isReqBoss
          ? '👑 อนุมัติคำขอของ Boss ได้โดยตรง (สิทธิ์ SuperBoss / CEO)'
          : '👑 อนุมัติได้ (สิทธิ์ SuperBoss / CEO ผู้บริหารสูงสุด)',
      };
    }

    if (currentUser.role === 'Employee') {
      return { allowed: false, reason: '🔒 เฉพาะ Boss หรือ SuperBoss เท่านั้นที่อนุมัติได้' };
    }

    if (isReqBoss) {
      return { allowed: false, reason: '🔒 คำร้องของ Boss ต้องให้ SuperBoss (CEO) เป็นผู้อนุมัติเท่านั้น' };
    }

    if (currentUser.role === 'Boss') {
      if (currentUser.department === req.department) {
        return { allowed: true, reason: `อนุมัติได้ (หัวหน้าสายงาน ${req.department})` };
      } else {
        return {
          allowed: false,
          reason: `🔒 ไม่สามารถกดอนุมัติได้ (ต่างสายงาน! คุณเป็น Boss ฝ่าย ${currentUser.department} ไม่สามารถกดให้ฝ่าย ${req.department} ได้)`
        };
      }
    }

    return { allowed: false, reason: 'ไม่มีสิทธิ์อนุมัติ' };
  };

  const handleAction = async (reqId, action) => {
    const target = requests.find((r) => r.id === reqId);
    if (!target) return;

    const check = canApproveRequest(target);
    if (!check.allowed) {
      triggerNotif(check.reason, 'error');
      return;
    }

    try {
      const reqType = target.requestType || (target.leaveType ? 'leave' : target.hours ? 'ot' : 'time-correction');
      const actionPayload = action === 'approve' ? 'approved' : 'rejected';

      const res = await fetch(`${API_BASE}/approvals/${reqType}/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionPayload,
          approverName: currentUser.title,
          approverRole: currentUser.role,
          remark: action === 'approve' ? `อนุมัติผ่านระบบ Web Admin (${currentUser.title})` : 'ปฏิเสธคำขอ',
        }),
      });

      const json = await res.json();
      if (json.success) {
        triggerNotif(
          `ดำเนินการ ${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'} คำร้อง ${target.id} ของ ${target.employeeName || 'พนักงาน'} สำเร็จแล้ว!`,
          action === 'approve' ? 'success' : 'warning'
        );
        fetchPendingApprovals();
      }
    } catch (err) {
      triggerNotif('เกิดข้อผิดพลาดในการทำรายการ กรุณาลองอีกครั้ง', 'error');
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (selectedDeptFilter && r.department !== selectedDeptFilter) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 font-sans animate-fade-in-up">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-bold flex items-center gap-2.5 transition-all animate-bounce ${
            notification.type === 'error'
              ? 'bg-red-950 border-red-700/60 text-red-300'
              : notification.type === 'warning'
              ? 'bg-amber-950 border-amber-700/60 text-amber-300'
              : 'bg-emerald-950 border-emerald-700/60 text-emerald-300'
          }`}
        >
          {notification.type === 'error' ? <XCircle size={20} className="text-[#EF4444]" /> : <CheckCircle size={20} />}
          <span>{notification.msg}</span>
        </div>
      )}

      <div className="bg-gradient-to-r from-[#991B1B] via-[#7F1D1D] to-[#0B0D13] rounded-3xl p-6 text-white shadow-2xl border border-red-900/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-red-300 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck size={16} className="text-[#EF4444]" />
            <span>Tactical Multi-Tier Role & Line of Work Approval Hub</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wide">ศูนย์อนุมัติคำร้องแยกสายงาน (Employee / Boss / SuperBoss)</h1>
          <p className="text-sm text-slate-300 mt-1">
            ระบบตรวจสอบสิทธิ์: Boss อนุมัติได้เฉพาะพนักงานสายงานตนเอง | SuperBoss (CEO) อนุมัติคำร้องของ Boss และพนักงานได้ทุกฝ่าย
          </p>
        </div>

        <div className="bg-[#0B0D13]/80 backdrop-blur-md p-3.5 rounded-2xl border border-red-900/40 flex flex-col gap-2 min-w-[280px]">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>🎭 สลับบทบาทผู้ใช้งานเพื่อทดสอบ:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveUserRole('SuperBoss')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                activeUserRole === 'SuperBoss'
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/40'
                  : 'bg-[#141722] text-slate-400 border-red-900/30 hover:text-white'
              }`}
            >
              <Crown size={14} />
              <span>SuperBoss (CEO)</span>
            </button>

            <button
              onClick={() => setActiveUserRole('Boss_IT')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                activeUserRole === 'Boss_IT'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/40'
                  : 'bg-[#141722] text-slate-400 border-red-900/30 hover:text-white'
              }`}
            >
              <Users size={14} />
              <span>Boss (IT)</span>
            </button>

            <button
              onClick={() => setActiveUserRole('Boss_MKT')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                activeUserRole === 'Boss_MKT'
                  ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-900/40'
                  : 'bg-[#141722] text-slate-400 border-red-900/30 hover:text-white'
              }`}
            >
              <Users size={14} />
              <span>Boss (Marketing)</span>
            </button>

            <button
              onClick={() => setActiveUserRole('Employee_IT')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                activeUserRole === 'Employee_IT'
                  ? 'bg-slate-700 text-white border-slate-500 shadow-md'
                  : 'bg-[#141722] text-slate-400 border-red-900/30 hover:text-white'
              }`}
            >
              <span>👤 Employee (IT)</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#141722] rounded-2xl p-4 border border-red-900/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${currentUser.role === 'SuperBoss' ? 'bg-purple-950 text-purple-400 border-purple-800/40' : 'bg-red-950 text-red-400 border-red-800/40'}`}>
            {currentUser.role === 'SuperBoss' ? <Crown size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{currentUser.title}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentUser.badgeColor}`}>
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              สังกัด: <span className="text-slate-300 font-semibold">{currentUser.department}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">กรองตามฝ่าย:</span>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="bg-[#0B0D13] border border-red-900/40 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
          >
            <option value="">ทุกฝ่ายงาน (All Departments)</option>
            <option value="ฝ่ายเทคโนโลยีสารสนเทศ (IT)">ฝ่ายเทคโนโลยีสารสนเทศ (IT)</option>
            <option value="ฝ่ายการตลาด (Marketing)">ฝ่ายการตลาด (Marketing)</option>
            <option value="ฝ่ายทรัพยากรบุคคล (HR)">ฝ่ายทรัพยากรบุคคล (HR)</option>
            <option value="ฝ่ายบัญชีและการเงิน (Accounting)">ฝ่ายบัญชีและการเงิน (Accounting)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRequests.map((req) => {
          const check = canApproveRequest(req);
          const isPending = !req.status?.includes('อนุมัติแล้ว') && !req.status?.includes('ไม่อนุมัติ') && !req.status?.includes('ปฏิเสธ');
          const isReqBoss = req.requesterRole === 'Boss' || req.role === 'Boss' || req.requesterRole === 'Manager';

          return (
            <div
              key={req.id}
              className={`bg-[#141722] rounded-3xl border shadow-lg p-6 flex flex-col justify-between transition-all ${
                req.status === 'อนุมัติแล้ว'
                  ? 'border-emerald-700/50 bg-emerald-950/20'
                  : req.status === 'ปฏิเสธแล้ว' || req.status === 'ไม่อนุมัติ'
                  ? 'border-red-700/50 bg-red-950/20'
                  : check.allowed
                  ? 'border-red-900/40 hover:border-red-600/50'
                  : 'border-slate-800 bg-[#0E1018] opacity-80'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="inline-block bg-[#0B0D13] text-slate-400 text-[11px] font-mono font-bold px-2.5 py-1 rounded-md mb-1.5 border border-red-900/30">
                      {req.id} • {req.date}
                    </span>
                    <h3 className="font-bold text-white text-base">{req.type || req.title}</h3>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      req.status === 'อนุมัติแล้ว'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                        : req.status === 'ปฏิเสธแล้ว' || req.status === 'ไม่อนุมัติ'
                        ? 'bg-red-950 text-red-400 border border-red-700/50'
                        : 'bg-amber-950 text-amber-400 border border-amber-700/50'
                    }`}
                  >
                    ● {req.status}
                  </span>
                </div>

                <div className="bg-[#0B0D13] p-3.5 rounded-2xl border border-red-900/30 mb-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">ผู้ยื่นคำร้อง:</span>
                    <span className="font-bold text-white">{req.employeeName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">สายงาน / ฝ่าย:</span>
                    <span className="font-semibold text-slate-300">{req.department}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">ระดับบทบาท:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                        isReqBoss
                          ? 'bg-purple-950 text-purple-300 border border-purple-800/40'
                          : 'bg-slate-900 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isReqBoss ? '👔 Boss (หัวหน้าฝ่าย)' : '👤 Employee (พนักงาน)'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-medium mb-4 leading-relaxed bg-[#0B0D13] p-3 rounded-xl border border-red-900/30">
                  <span className="font-bold text-white">รายละเอียด:</span> {req.details}
                </p>

                <div className="mb-4">
                  {check.allowed ? (
                    <div className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-2 rounded-xl border border-emerald-700/40 flex items-center gap-2">
                      <CheckCircle size={14} />
                      <span>{check.reason}</span>
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-amber-300 bg-amber-950/60 px-3 py-2 rounded-xl border border-amber-700/40 flex items-start gap-2">
                      <Lock size={15} className="mt-0.5 flex-shrink-0 text-amber-400" />
                      <span>{check.reason}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-red-900/30">
                {isPending ? (
                  <>
                    <button
                      onClick={() => handleAction(req.id, 'reject')}
                      disabled={!check.allowed}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        check.allowed
                          ? 'bg-red-950 text-red-400 hover:bg-red-900/80 border border-red-700/60'
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                      }`}
                    >
                      <XCircle size={15} />
                      <span>ปฏิเสธ</span>
                    </button>

                    <button
                      onClick={() => handleAction(req.id, 'approve')}
                      disabled={!check.allowed}
                      className={`flex-2 px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 text-white shadow-lg transition-all ${
                        check.allowed
                          ? currentUser.role === 'SuperBoss'
                            ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:opacity-95'
                            : 'bg-[#DC2626] hover:bg-[#B91C1C] shadow-red-600/40'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {currentUser.role === 'SuperBoss' ? <Crown size={15} /> : <CheckCircle size={15} />}
                      <span>{currentUser.role === 'SuperBoss' ? 'อนุมัติ (SuperBoss/CEO)' : 'อนุมัติคำร้อง'}</span>
                    </button>
                  </>
                ) : (
                  <div className="w-full text-center py-2 text-xs font-bold text-slate-400 bg-[#0B0D13] rounded-xl border border-red-900/30">
                    ดำเนินการเรียบร้อยแล้ว ({req.status})
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredRequests.length === 0 && !loading && (
        <div className="bg-[#141722] rounded-3xl p-12 text-center border border-red-900/30 shadow-lg">
          <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">ไม่มีคำร้องที่รอการอนุมัติสำหรับบทบาทนี้</h3>
          <p className="text-xs text-slate-400">ทุกคำร้องได้รับการจัดการเรียบร้อยแล้ว หรือยังไม่มีคำขอใหม่ที่ตรงกับสายงาน</p>
        </div>
      )}
    </div>
  );
}
