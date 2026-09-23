import React, { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  Award,
  Footprints,
  Calendar,
  Users,
  X
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function MissionManagement() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [stepsInput, setStepsInput] = useState('10000');
  const [pointsInput, setPointsInput] = useState('500');
  const [notification, setNotification] = useState(null);

  const fetchMissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/missions`);
      const json = await res.json();
      if (json.success && json.missions) {
        setMissions(json.missions);
      } else {
        setMissions([]);
      }
    } catch (err) {
      console.error('Failed to fetch missions', err);
      setMissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  const triggerNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddMission = async (e) => {
    e.preventDefault();
    if (!titleInput) return;

    const payload = {
      title: titleInput,
      description: descInput || 'ภารกิจกิจกรรมส่งเสริมสุขภาพพนักงาน',
      targetSteps: Number(stepsInput) || 10000,
      rewardPoints: Number(pointsInput) || 500,
      status: 'Active',
    };

    try {
      const res = await fetch(`${API_BASE}/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        triggerNotif(`เพิ่มภารกิจ "${titleInput}" เรียบร้อยแล้ว`);
        setTitleInput('');
        setDescInput('');
        setShowAddModal(false);
        fetchMissions();
      }
    } catch (err) {
      console.error('Failed to create mission', err);
    }
  };

  const handleDeleteMission = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/missions/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        triggerNotif(`ลบภารกิจเรียบร้อยแล้ว`);
        fetchMissions();
      }
    } catch (err) {
      console.error('Failed to delete mission', err);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans animate-in fade-in duration-200">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-950 border border-emerald-700/60 text-emerald-300 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2.5 animate-bounce">
          <CheckCircle size={18} className="text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <Target size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                MODULE 6
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                6. Mission Management (การจัดการภารกิจ & กิจกรรม)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              สร้างภารกิจก้าวเดิน/กิจกรรมสุขภาพ กำหนดเงื่อนไข และพอยท์รางวัลสำหรับพนักงานในแอปพลิเคชัน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMissions}
            className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 text-sm transition-all uppercase tracking-wide"
          >
            <Plus size={18} />
            <span>สร้าง Mission ใหม่</span>
          </button>
        </div>
      </div>

      {/* Mission Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {missions.map((item) => (
          <div
            key={item.id}
            className="bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg flex flex-col justify-between hover:border-red-600/50 transition-all space-y-4"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-red-950/80 text-[#EF4444] border border-red-800/40">
                  {item.id}
                </span>
                <button
                  onClick={() => handleDeleteMission(item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors"
                  title="ลบ"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <h3 className="text-lg font-bold text-white mb-1.5">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed bg-[#0B0D13] p-3 rounded-xl border border-red-900/20">
                {item.description}
              </p>
            </div>

            <div className="pt-3 border-t border-red-900/30 grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#0B0D13] p-2.5 rounded-xl border border-red-900/20">
                <span className="text-[10px] text-slate-400 block mb-0.5">เป้าหมายก้าว</span>
                <span className="text-xs font-bold text-amber-400 font-mono flex items-center justify-center gap-1">
                  <Footprints size={13} />
                  {(item.targetSteps || item.target || 10000).toLocaleString()} ก้าว
                </span>
              </div>

              <div className="bg-[#0B0D13] p-2.5 rounded-xl border border-red-900/20">
                <span className="text-[10px] text-slate-400 block mb-0.5">พอยท์รางวัล</span>
                <span className="text-xs font-bold text-emerald-400 font-mono flex items-center justify-center gap-1">
                  <Award size={13} />
                  +{(item.rewardPoints || item.points || 500)} P
                </span>
              </div>

              <div className="bg-[#0B0D13] p-2.5 rounded-xl border border-red-900/20">
                <span className="text-[10px] text-slate-400 block mb-0.5">ผู้เข้าร่วม</span>
                <span className="text-xs font-bold text-sky-400 font-mono flex items-center justify-center gap-1">
                  <Users size={13} />
                  {(item.participantsCount || item.participants || 0)} คน
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Mission Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-red-900/30">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">สร้าง Mission ภารกิจใหม่</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddMission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  ชื่อภารกิจ (Title) *
                </label>
                <input
                  type="text"
                  placeholder="เช่น 🚶‍♂️ เดินสะสมก้าว 15,000 ก้าวประจำสัปดาห์"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm text-white outline-none focus:border-[#EF4444]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  คำอธิบายภารกิจ (Description)
                </label>
                <textarea
                  placeholder="รายละเอียดคำแนะนำในการทำภารกิจ..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs text-white outline-none focus:border-[#EF4444] h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    เป้าหมายก้าว (Steps)
                  </label>
                  <input
                    type="number"
                    value={stepsInput}
                    onChange={(e) => setStepsInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-mono text-white outline-none focus:border-[#EF4444]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    พอยท์รางวัล (Points)
                  </label>
                  <input
                    type="number"
                    value={pointsInput}
                    onChange={(e) => setPointsInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-mono text-white outline-none focus:border-[#EF4444]"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-lg shadow-red-600/30 uppercase tracking-wide"
                >
                  บันทึก Mission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
