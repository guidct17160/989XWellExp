import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
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

import { API_BASE } from '../config';
import FilterBar from './FilterBar';

export default function RewardManagement() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [categories, setCategories] = useState([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const rewardStock = (r) => Number(r.stock ?? r.stockQuantity ?? 0);
  const rewardTerm = searchTerm.trim().toLowerCase();
  const filteredRewards = rewards.filter((r) => {
    const stock = rewardStock(r);
    if (categoryFilter !== 'ALL' && r.categoryId !== categoryFilter) return false;
    if (stockFilter === 'IN' && stock <= 10) return false;
    if (stockFilter === 'LOW' && (stock <= 0 || stock > 10)) return false;
    if (stockFilter === 'OUT' && stock > 0) return false;
    if (!rewardTerm) return true;
    return [r.id, r.title, r.description, r.category].some((v) => v && String(v).toLowerCase().includes(rewardTerm));
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [codeInput, setCodeInput] = useState('');
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
      if (res.ok && json.success && json.rewards) {
        setRewards(json.rewards);
      } else {
        setRewards([]);
        triggerNotif(json.message || 'Unable to load rewards', 'error');
      }

      const resCats = await fetch(`${API_BASE}/reward-categories`);
      const jsonCats = await resCats.json();
      if (resCats.ok && jsonCats.success) {
        setCategories(jsonCats.categories || []);
      } else {
        setCategories([]);
        triggerNotif(jsonCats.message || 'Unable to load categories', 'error');
      }

      // NOTE: backend only exposes the logged-in account's own coupons (no company-wide redemption list)
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
      triggerNotif('Unable to connect to the server to load rewards', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  const triggerNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddReward = async (e) => {
    e.preventDefault();
    if (!titleInput) return;
    if (!categoryInput) {
      triggerNotif('Please select a category for the reward', 'error');
      return;
    }

    const payload = {
      code: codeInput.trim(), // blank = the system gives the next short code (rew-005)
      title: titleInput,
      description: descInput || 'Employee appreciation reward',
      // Field names must match backend addReward(): pointsRequired / stock
      pointsRequired: Number(pointsInput) || 0,
      stock: Number(stockInput) || 0,
      categoryId: categoryInput,
      imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400'
    };

    try {
      const res = await fetch(`${API_BASE}/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerNotif(`Reward "${titleInput}" added successfully`);
        setCodeInput('');
        setTitleInput('');
        setDescInput('');
        setCategoryInput('');
        setShowAddModal(false);
        fetchRewards();
      } else {
        triggerNotif(json.message || 'Failed to add reward', 'error');
      }
    } catch (err) {
      console.error('Failed to create reward', err);
      triggerNotif('Unable to connect to the server to add the reward', 'error');
    }
  };

  const handleDeleteReward = async (id) => {
    setDeleteTarget(null);
    try {
      const res = await fetch(`${API_BASE}/rewards/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerNotif(`Reward deleted successfully`);
        fetchRewards();
      } else {
        triggerNotif(json.message || 'Failed to delete reward', 'error');
      }
    } catch (err) {
      console.error('Failed to delete reward', err);
      triggerNotif('Unable to connect to the server to delete the reward', 'error');
    }
  };

  const totalStock = rewards.reduce((acc, curr) => acc + (Number(curr.stock ?? curr.stockQuantity) || 0), 0);

  return (
    <div className="space-y-6 text-slate-100 font-sans animate-in fade-in duration-200">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2.5 animate-bounce border ${
            notification.type === 'error'
              ? 'bg-red-950 border-red-700/60 text-red-300'
              : 'bg-emerald-950 border-emerald-700/60 text-emerald-300'
          }`}
        >
          <CheckCircle size={18} className={notification.type === 'error' ? 'text-[#EF4444]' : 'text-emerald-400'} />
          <span>{notification.msg}</span>
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

              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                 Reward Management 
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Create rewards, set redemption points, check remaining stock and employee coupon redemption history
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
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/40">
            <Gift size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total rewards</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">{rewards.length} items</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total remaining stock</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">{totalStock} pcs</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-sky-950/80 text-sky-400 border border-sky-800/40">
            <Ticket size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Coupons redeemed by the signed-in account</p>
            <h3 className="text-2xl font-black text-sky-400 font-mono">{redeemedCouponsCount} items</h3>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <FilterBar
        right={
          <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto cursor-pointer"
          >
          <Plus size={16} />
          <span>Add New Reward</span>
          </button>
        }
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Search by code, title, description or category..."
        filters={[
          {
            label: 'Category',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: [{ value: 'ALL', label: 'All' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
          },
          {
            label: 'Stock',
            value: stockFilter,
            onChange: setStockFilter,
            options: [
              { value: 'ALL', label: 'All' },
              { value: 'IN', label: 'In stock (over 10)' },
              { value: 'LOW', label: 'Low stock (1 - 10)' },
              { value: 'OUT', label: 'Out of stock' },
            ],
          },
        ]}
      />

      {/* Rewards Catalog Table */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B0D13] border-b border-red-900/30 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap">Code</th>
                <th className="py-3.5 px-4 w-full">Reward</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Category</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Description</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Points Required</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Stock</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20 text-sm font-medium text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 font-mono">Loading...</td>
                </tr>
              ) : filteredRewards.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 font-mono">No rewards yet</td>
                </tr>
              ) : (
                filteredRewards.map((item) => (
                  <tr key={item.id} className="hover:bg-red-950/20 transition-colors">
                    <td className="py-3 px-4 align-middle">
                      <span
                        title={item.id}
                        className="block max-w-[8.5rem] truncate whitespace-nowrap text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-red-950/80 text-[#EF4444] border border-red-800/40"
                      >
                        {item.id}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-middle min-w-[14rem]">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-12 h-12 rounded-lg object-cover border border-red-900/40 shrink-0"
                          />
                        ) : null}
                        <span className="font-bold text-white leading-snug">{item.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 align-middle whitespace-nowrap">
                      <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-950/70 text-violet-300 border border-violet-700/50">
                        {item.category || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-middle w-64 max-w-[16rem]">
                      <div className="text-xs text-slate-400 leading-snug line-clamp-2" title={item.description}>{item.description || '-'}</div>
                    </td>
                    <td className="py-3 px-4 align-middle text-center font-bold text-amber-400 font-mono whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Award size={15} />
                        {Number(item.pointsRequired ?? item.pointsCost ?? item.points ?? 0).toLocaleString()} Points
                      </span>
                    </td>
                    <td className="py-3 px-4 align-middle text-center font-bold text-emerald-400 font-mono whitespace-nowrap">
                      {Number(item.stock ?? item.stockQuantity ?? 0).toLocaleString()} pcs
                    </td>
                    <td className="py-3 px-4 align-middle text-center">
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4" data-testid="delete-reward-confirm">
          <div className="bg-[#141722] rounded-3xl max-w-sm w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-black text-white">Delete "{deleteTarget.title}"?</h3>
            <p className="text-xs text-slate-400 mt-2">
              This reward will be removed from the catalog. A reward that employees have already redeemed cannot be deleted.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteReward(deleteTarget.id)}
                className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-lg shadow-red-600/30 uppercase tracking-wide cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Reward Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-red-900/30">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">Add New Reward</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddReward} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Code
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate (e.g. rew-005)"
                  value={codeInput}
                  maxLength={30}
                  onChange={(e) => setCodeInput(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-mono text-white outline-none focus:border-[#EF4444]"
                />
                <p className="text-[11px] text-slate-500 mt-1">Letters, numbers, - and _ only (up to 30). Each reward needs its own code.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Reward Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. ☕ Starbucks gift card 200 THB"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm text-white outline-none focus:border-[#EF4444]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm text-white outline-none focus:border-[#EF4444] cursor-pointer"
                  required
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">No categories yet. Create one first in Reward → Reward Categories.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Reward Description
                </label>
                <textarea
                  placeholder="Reward details and terms of use..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs text-white outline-none focus:border-[#EF4444] h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Points Required
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
                    Stock Quantity
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-lg shadow-red-600/30 uppercase tracking-wide"
                >
                  Save Reward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
