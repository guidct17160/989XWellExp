import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tags, Plus, Trash2, RefreshCw, Edit, CheckCircle, AlertTriangle, X, Award, ChevronRight, ArrowLeft, Gift, Package } from 'lucide-react';

import { API_BASE } from '../config';
import FilterBar from './FilterBar';
import useDetailRoute from './useDetailRoute';

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all';
const LABEL = 'block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1';

// Full page with the rewards that belong to one category
function CategoryDetail({ category, rewards, loading, onBack, onEdit, onRefresh }) {
  const totalStock = rewards.reduce((n, r) => n + (Number(r.stock) || 0), 0);
  return (
    <div className="space-y-6" data-testid="category-detail">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <button onClick={onBack} className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 cursor-pointer" title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">{category.code || '-'}</span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">{category.name}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Rewards filed under this category</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-200 text-xs font-bold uppercase tracking-wide cursor-pointer"
          >
            <Edit size={15} />
            <span>Edit Category</span>
          </button>
          <button onClick={onRefresh} className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors cursor-pointer" title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/40"><Gift size={24} /></div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Rewards in this category</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">{rewards.length} items</h3>
          </div>
        </div>
        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40"><Package size={24} /></div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total remaining stock</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">{totalStock.toLocaleString()} pcs</h3>
          </div>
        </div>
      </div>

      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B0D13] border-b border-red-900/30 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap">Code</th>
                <th className="py-3.5 px-4 w-full">Reward</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Description</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Points Required</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20 text-sm font-medium text-slate-200">
              {rewards.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500 font-mono">No rewards in this category yet</td>
                </tr>
              ) : (
                rewards.map((r) => (
                  <tr key={r.id} className="hover:bg-red-950/20 transition-colors">
                    <td className="py-3 px-4 align-middle">
                      <span title={r.id} className="block max-w-[8.5rem] truncate whitespace-nowrap text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-red-950/80 text-[#EF4444] border border-red-800/40">{r.id}</span>
                    </td>
                    <td className="py-3 px-4 align-middle min-w-[14rem]">
                      <div className="flex items-center gap-3">
                        {r.imageUrl ? <img src={r.imageUrl} alt={r.title} className="w-12 h-12 rounded-lg object-cover border border-red-900/40 shrink-0" /> : null}
                        <span className="font-bold text-white leading-snug">{r.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 align-middle w-64 max-w-[16rem]">
                      <div className="text-xs text-slate-400 leading-snug line-clamp-2" title={r.description}>{r.description || '-'}</div>
                    </td>
                    <td className="py-3 px-4 align-middle text-center font-bold text-amber-400 font-mono whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5"><Award size={15} />{Number(r.pointsRequired || 0).toLocaleString()} Points</span>
                    </td>
                    <td className="py-3 px-4 align-middle text-center font-bold text-emerald-400 font-mono whitespace-nowrap">{Number(r.stock || 0).toLocaleString()} pcs</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function RewardCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id, name} = rename
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rewards, setRewards] = useState([]);
  // a category's rewards live on their own URL: /rewards/categories/<category code>
  const detailRoute = useDetailRoute('reward-categories');
  // the URL carries the readable category code (/rewards/categories/CAT-002); the internal id is accepted too
  const routeKey = (c) => c.code || c.id;
  const sameKey = (c, key) => String(c.code || '').toLowerCase() === String(key).toLowerCase() || c.id === key;
  const viewing = detailRoute.detailId ? categories.find((c) => sameKey(c, detailRoute.detailId)) || null : null;

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reward-categories`);
      const json = await res.json();
      if (res.ok && json.success) {
        setCategories(json.categories || []);
      } else {
        setCategories([]);
        notify(json.message || 'Unable to load categories', 'error');
      }

      const resRewards = await fetch(`${API_BASE}/rewards`);
      const jsonRewards = await resRewards.json();
      if (resRewards.ok && jsonRewards.success) {
        setRewards(jsonRewards.rewards || []);
      } else {
        setRewards([]);
        notify(jsonRewards.message || 'Unable to load rewards', 'error');
      }
    } catch (err) {
      console.error('Failed to fetch reward categories', err);
      setCategories([]);
      notify('Unable to connect to the server to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openForm = (cat) => {
    setEditing(cat || {});
    setNameInput(cat ? cat.name : '');
    setCodeInput(cat ? cat.code || '' : '');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      const isEdit = Boolean(editing && editing.id);
      const res = await fetch(isEdit ? `${API_BASE}/reward-categories/${encodeURIComponent(editing.id)}` : `${API_BASE}/reward-categories`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: codeInput.trim() }), // blank code = auto (CAT-005) / keep the current one
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notify(isEdit ? `Category "${name}" updated` : `Category "${name}" added`);
        // the code is part of the URL, so follow it when the open category gets a new code
        if (isEdit && json.category && json.category.code && viewing && viewing.id === editing.id) detailRoute.replace(json.category.code);
        setEditing(null);
        fetchCategories();
      } else {
        notify(json.message || 'Failed to save category', 'error');
      }
    } catch (err) {
      console.error('Failed to save category', err);
      notify('Unable to connect to the server to save the category', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`${API_BASE}/reward-categories/${encodeURIComponent(target.id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        notify(`Category "${target.name}" deleted`);
        fetchCategories();
      } else {
        notify(json.message || 'Failed to delete category', 'error');
      }
    } catch (err) {
      console.error('Failed to delete category', err);
      notify('Unable to connect to the server to delete the category', 'error');
    }
  };

  const term = searchTerm.trim().toLowerCase();
  const filtered = categories.filter((c) => !term || c.name.toLowerCase().includes(term) || (c.code || '').toLowerCase().includes(term));
  const totalRewards = categories.reduce((n, c) => n + (c.rewardCount || 0), 0);

  return (
    <div className="space-y-6 text-slate-100 font-sans animate-in fade-in duration-200">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-[60] px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2.5 border ${
            notification.type === 'error' ? 'bg-red-950 border-red-700/60 text-red-300' : 'bg-emerald-950 border-emerald-700/60 text-emerald-300'
          }`}
        >
          <CheckCircle size={18} className={notification.type === 'error' ? 'text-[#EF4444]' : 'text-emerald-400'} />
          <span>{notification.msg}</span>
        </div>
      )}

      {detailRoute.detailId ? (
        loading ? (
          <div className="bg-[#141722] rounded-2xl border border-red-900/30 p-8 text-center text-slate-500 font-mono">Loading...</div>
        ) : !viewing ? (
          <div className="bg-[#141722] rounded-2xl border border-red-900/30 p-8 text-center text-slate-400">
            Category not found.{' '}
            <button onClick={detailRoute.close} className="underline text-white cursor-pointer">Back to the list</button>
          </div>
        ) : (
          <CategoryDetail
            category={viewing}
            rewards={rewards.filter((r) => r.categoryId === viewing.id)}
            loading={loading}
            onBack={detailRoute.close}
            onEdit={() => openForm(viewing)}
            onRefresh={fetchCategories}
          />
        )
      ) : (
      <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <Tags size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-wide">Reward Categories</h1>
            <p className="text-xs text-slate-400 mt-0.5">Group rewards into categories. Every reward is filed under one category.</p>
          </div>
        </div>
        <button
          onClick={fetchCategories}
          className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors self-start md:self-auto cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/40">
            <Tags size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total categories</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">{categories.length} items</h3>
          </div>
        </div>
        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Rewards filed under a category</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">{totalRewards} items</h3>
          </div>
        </div>
      </div>

      <FilterBar
        right={
          <button
            onClick={() => openForm(null)}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Category</span>
          </button>
        }
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Search by code or category name..."
        filters={[]}
      />

      {/* Table */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B0D13] border-b border-red-900/30 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6 whitespace-nowrap">Code</th>
                <th className="py-4 px-6 w-full">Category</th>
                <th className="py-4 px-6 text-center whitespace-nowrap">Rewards</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20 text-sm font-medium text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500 font-mono">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500 font-mono">
                    {categories.length === 0 ? 'No categories yet. Click "Add Category" to create one.' : 'No categories match the search'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => detailRoute.open(routeKey(c))}
                    className="hover:bg-red-950/30 transition-colors cursor-pointer"
                    title="Click to view the rewards in this category"
                  >
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-red-950/80 text-[#EF4444] border border-red-800/40">
                        {c.code || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => detailRoute.open(routeKey(c))}
                        className="font-bold text-white hover:text-[#EF4444] text-left cursor-pointer inline-flex items-center gap-1.5"
                        title="View rewards in this category"
                      >
                        {c.name}
                        <ChevronRight size={14} className="text-slate-500" />
                      </button>
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <button
                        onClick={() => detailRoute.open(routeKey(c))}
                        className="font-mono font-bold text-emerald-400 hover:underline cursor-pointer"
                        title="View rewards in this category"
                      >
                        {c.rewardCount} items
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); openForm(c); }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Rename category"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                          title="Delete category"
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

      </>
      )}

      {/* Add / rename */}
      {editing && createPortal(
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/40 text-slate-100" data-testid="category-form">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-red-900/30">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">{editing.id ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className={LABEL}>Code</label>
                <input
                  className={`${INPUT} font-mono`}
                  value={codeInput}
                  maxLength={30}
                  placeholder="Leave blank to auto-generate (e.g. CAT-005)"
                  onChange={(e) => setCodeInput(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
                />
                <p className="text-[11px] text-slate-500 mt-1">Letters, numbers, - and _ only (up to 30). Each category needs its own code.</p>
              </div>
              <div>
                <label className={LABEL}>Category Name <span className="text-red-400">*</span></label>
                <input
                  className={INPUT}
                  value={nameInput}
                  maxLength={100}
                  placeholder="e.g. Food & Drink"
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                />
                {editing.id && editing.rewardCount > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">The new name is applied to the {editing.rewardCount} reward(s) in this category.</p>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !nameInput.trim()}
                  className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-red-600/30 uppercase tracking-wide cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-sm w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-black text-white">Delete "{deleteTarget.name}"?</h3>
            <p className="text-xs text-slate-400 mt-2">
              {deleteTarget.rewardCount > 0
                ? `${deleteTarget.rewardCount} reward(s) still use this category, so it cannot be deleted until they are moved or removed.`
                : 'This category has no rewards and will be removed.'}
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTarget.rewardCount > 0}
                className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-red-600/30 uppercase tracking-wide cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
