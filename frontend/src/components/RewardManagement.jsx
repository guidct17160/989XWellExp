import React, { useState, useEffect } from 'react';
import {
  Gift,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  Award,
  Package,
  Ticket,
  Search,
  X
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function RewardManagement() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [pointsInput, setPointsInput] = useState('500');
  const [stockInput, setStockInput] = useState('20');
  const [notification, setNotification] = useState(null);
  const [redeemedCouponsCount, setRedeemedCouponsCount] = useState(0);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rewards`);
      const json = await res.json();
      if (json.success && json.rewards) {
        setRewards(json.rewards);
      } else {
        setRewards([]);
      }

      const resCoupons = await fetch(`${API_BASE}/rewards/my-coupons`);
      const jsonCoupons = await resCoupons.json();
      if (jsonCoupons.success && Array.isArray(jsonCoupons.coupons)) {
        setRedeemedCouponsCount(jsonCoupons.coupons.length);
      } else {
        setRedeemedCouponsCount(0);
      }
    } catch (err) {
      console.error('Failed to fetch rewards', err);
      setRewards([]);
      setRedeemedCouponsCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  const triggerNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddReward = async (e) => {
    e.preventDefault();
    if (!titleInput) return;

    const payload = {
      title: titleInput,
      description: descInput || 'ของรางวัลสมนาคุณพนักงาน',
      pointsCost: Number(pointsInput) || 500,
      stockQuantity: Number(stockInput) || 20,
      category: 'General',
      imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400'
    };

    try {
      const res = await fetch(`${API_BASE}/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        triggerNotif(`เพิ่มของรางวัล "${titleInput}" เรียบร้อยแล้ว`);
        setTitleInput('');
        setDescInput('');
        setShowAddModal(false);
        fetchRewards();
      }
    } catch (err) {
      console.error('Failed to create reward', err);
    }
  };

  const handleDeleteReward = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/rewards/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        triggerNotif(`ลบของรางวัลเรียบร้อยแล้ว`);
        fetchRewards();
      }
    } catch (err) {
      console.error('Failed to delete reward', err);
    }
  };

  const totalStock = rewards.reduce((acc, curr) => acc + (curr.stockQuantity || 0), 0);

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
            <Gift size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                MODULE 7
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                7. Reward Management (การจัดการของรางวัล & การแลกพอยท์)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              สร้างของรางวัล กำหนดพอยท์แลก ตรวจสอบจำนวนคลังคงเหลือ และประวัติการแลกคูปองพนักงาน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRewards}
            className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 text-sm transition-all uppercase tracking-wide"
          >
            <Plus size={18} />
            <span>เพิ่มของรางวัลใหม่</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/40">
            <Gift size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">รายการของรางวัลทั้งหมด</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">{rewards.length} รายการ</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">จำนวนคลังสินค้าคงเหลือรวม</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">{totalStock} ชิ้น</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-sky-950/80 text-sky-400 border border-sky-800/40">
            <Ticket size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">รายการแลกคูปองพนักงาน</p>
            <h3 className="text-2xl font-black text-sky-400 font-mono">{redeemedCouponsCount} รายการ</h3>
          </div>
        </div>
      </div>

      {/* Rewards Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {rewards.map((item) => (
          <div
            key={item.id}
            className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden flex flex-col justify-between hover:border-red-600/50 transition-all"
          >
            <div>
              <div className="h-40 relative bg-slate-900 overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute top-3 left-3 text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-black/80 text-[#EF4444] border border-red-800/40 backdrop-blur-md">
                  {item.id}
                </span>
                <button
                  onClick={() => handleDeleteReward(item.id)}
                  className="absolute top-3 right-3 p-2 bg-black/80 text-slate-300 hover:text-red-400 rounded-xl backdrop-blur-md transition-colors"
                  title="ลบ"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="p-5 space-y-2">
                <h3 className="text-base font-bold text-white leading-snug">{item.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
              </div>
            </div>

            <div className="p-5 pt-0 border-t border-red-900/30 flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-sm">
                <Award size={16} />
                <span>{(item.pointsCost || item.points || 500).toLocaleString()} Points</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#0B0D13] text-emerald-400 border border-red-900/40 font-mono">
                คลัง: {item.stockQuantity ?? item.stock ?? 10} ชิ้น
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Reward Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-red-900/30">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">เพิ่มของรางวัลใหม่</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddReward} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  ชื่อของรางวัล (Title) *
                </label>
                <input
                  type="text"
                  placeholder="เช่น ☕ บัตร Starbucks 200 บาท"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm text-white outline-none focus:border-[#EF4444]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  คำอธิบายของรางวัล (Description)
                </label>
                <textarea
                  placeholder="รายละเอียดและเงื่อนไขการใช้ของรางวัล..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs text-white outline-none focus:border-[#EF4444] h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    พอยท์ใช้แลก (Points)
                  </label>
                  <input
                    type="number"
                    value={pointsInput}
                    onChange={(e) => setPointsInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-mono text-white outline-none focus:border-[#EF4444]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    จำนวนคลัง (Stock)
                  </label>
                  <input
                    type="number"
                    value={stockInput}
                    onChange={(e) => setStockInput(e.target.value)}
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
                  บันทึกของรางวัล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
