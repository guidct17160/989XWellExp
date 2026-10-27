import React, { useState, useEffect } from 'react';
import useDetailRoute from './useDetailRoute';
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
  AlertCircle,
  X,
  ArrowLeft,
  Search,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck,
  Calendar,
  List
} from 'lucide-react';

import { API_BASE } from '../config';
import FilterBar from './FilterBar';

export default function OrgManagement({ type = 'department', initialTab }) {
  const currentTab = initialTab || type;
  const [activeTabState, setActiveTabState] = useState(currentTab);

  useEffect(() => {
    if (initialTab) setActiveTabState(initialTab);
    else if (type) setActiveTabState(type);
  }, [initialTab, type]);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');
  const itemMemberCount = (item) =>
    typeof item.employeeCount === 'number' ? item.employeeCount : (typeof item.memberCount === 'number' ? item.memberCount : 0);
  const term = searchTerm.trim().toLowerCase();
  const filteredData = data.filter((item) => {
    if (memberFilter === 'has' && itemMemberCount(item) === 0) return false;
    if (memberFilter === 'empty' && itemMemberCount(item) > 0) return false;
    if (!term) return true;
    return [item.code, item.id, item.name, item.title]
      .some((v) => v && String(v).toLowerCase().includes(term));
  });
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const detailRoute = useDetailRoute('department');
  // The open department comes from the URL (/departments/<code>), so it survives refresh / back
  const activeDetailDept = detailRoute.detailId
    ? data.find((d) => String(d.code) === detailRoute.detailId || String(d.id) === detailRoute.detailId) || null
    : null;
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
      return { title: 'Position Management', icon: <Briefcase size={24} />, placeholder: 'e.g. Senior Software Engineer', extraLabel: 'Parent Department' };
    }
    return { title: 'Department', icon: <Building2 size={24} />, placeholder: 'e.g. Information Technology (IT)', extraLabel: 'Department Code' };
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
      } else {
        triggerNotification(resData.message || 'Unable to load organization structure data', 'error');
      }
      if (resEmp.success) {
        setAllEmployees(resEmp.employees || []);
      }
    } catch (err) {
      console.error('Failed to fetch org data', err);
      triggerNotification('Unable to connect to the server to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [type]);

  const openMembersModal = (item) => {
    setSelectedDeptItem(item);
    setShowMembersModal(true);
  };

  const triggerNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!nameInput) {
      triggerNotification('Please enter a name', 'error');
      return;
    }

    let endpoint = `${API_BASE}/departments`;
    let payload = { name: nameInput.trim(), code: extraInput.trim() || undefined };

    if (type === 'position') {
      endpoint = `${API_BASE}/positions`;
      payload = { title: nameInput, department: extraInput || '' };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        triggerNotification(`${nameInput} added successfully`, 'success');
        setNameInput('');
        setExtraInput('');
        setShowAddModal(false);
        fetchData();
      } else {
        triggerNotification(json.message || 'Failed to save data', 'error');
      }
    } catch (err) {
      console.error('Network fetch error', err);
      triggerNotification('Unable to connect to the server to add data. Please try again.', 'error');
    }
  };

  const openEditModal = (item) => {
    setEditTargetItem(item);
    setEditNameInput(item.name || item.title || '');
    setEditExtraInput(type === 'position' ? (item.department || item.description || '') : (item.code || ''));
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!editTargetItem || !editNameInput) return;

    let endpoint = `${API_BASE}/departments/${editTargetItem.id}`;
    let payload = { id: editTargetItem.id, name: editNameInput.trim(), code: editExtraInput.trim() || editTargetItem.code };

    if (type === 'position') {
      endpoint = `${API_BASE}/positions/${editTargetItem.id}`;
      payload = { id: editTargetItem.id, title: editNameInput, department: editExtraInput || editTargetItem.department || '' };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        triggerNotification(`${editNameInput} updated successfully`, 'success');
        setShowEditModal(false);
        fetchData();
      } else {
        triggerNotification(json.message || 'Failed to update data', 'error');
      }
    } catch (err) {
      console.error('Network fetch error on edit', err);
      triggerNotification('Unable to connect to the server to update data. Please try again.', 'error');
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
        triggerNotification(`Deleted successfully`);
        setShowDeleteModal(false);
        setDeleteTargetItem(null);
        fetchData();
      } else {
        triggerNotification(json.message || 'Failed to delete data', 'error');
      }
    } catch (err) {
      console.error('Delete failed', err);
      triggerNotification('Unable to connect to the server to delete data. Please try again.', 'error');
    }
  };

  const openDetailView = (item) => {
    detailRoute.open(item.code || item.id);
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
          badge: 'bg-amber-50 text-amber-700 border-amber-200 shadow-md shadow-slate-300'
        };
      }
      return {
        level: 1,
        name: 'Employee',
        label: '👤 Employee',
        badge: 'bg-slate-100 text-slate-700 border-slate-300'
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
      if (levelB !== levelA) return levelB - levelA; // SuperBoss (3) => Boss (2) => Employee (1)
      return (a.name || '').localeCompare(b.name || '');
    });

    return (
      <div className="space-y-6 text-slate-900 font-sans animate-in fade-in duration-200">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold animate-bounce ${
              typeof notification === 'object' && notification?.type === 'error'
                ? 'bg-danger-50 border border-danger-200 text-danger-700'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}
          >
            {typeof notification === 'object' && notification?.type === 'error' ? (
              <AlertCircle size={20} className="text-danger-600" />
            ) : (
              <CheckCircle size={20} className="text-emerald-600" />
            )}
            <span>{typeof notification === 'object' ? notification.msg : notification}</span>
          </div>
        )}

        {/* Top Navigation & Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200">
                  {activeDetailDept.code || activeDetailDept.id}
                </span>
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                  {activeDetailDept.name || activeDetailDept.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Line details and all employees in this department</p>
            </div>
          </div>
        </div>

        {/* Member count + search in one bar, apart from the data table */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-3 rounded-xl bg-violet-100 text-violet-700 border border-violet-200">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Employees in department</p>
              <h3 className="text-2xl font-black text-slate-900 font-mono">{members.length} members</h3>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search name, employee ID, or email..."
              value={searchMemberTerm}
              onChange={(e) => setSearchMemberTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-violet-500 transition-all"
            />
          </div>
        </div>

        {/* Member List Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden space-y-0">
          {filteredMembers.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <Users size={44} className="text-slate-400 mb-1" />
              <p className="text-base font-bold text-slate-700">No employees found in this department</p>
              <p className="text-xs text-slate-500">
                {searchMemberTerm ? 'Try searching with a different keyword' : 'No employees are registered in this department yet. You can add new employees on the Employee Management page.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3.5 px-4">ID</th>
                    <th className="py-3.5 px-4">First Name</th>
                    <th className="py-3.5 px-4">Last Name</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Start Date</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-800">
                  {filteredMembers.map((emp) => {
                    const roleInfo = getRoleLevelInfo(emp.role);
                    const isResign = emp.status === 'Resign' || emp.status === 'Resigned';
                    const nameParts = String(emp.name || '').trim().split(/\s+/).filter(Boolean);
                    const firstName = emp.firstName || nameParts[0] || '-';
                    const lastName = emp.lastName || nameParts.slice(1).join(' ') || '-';
                    return (
                      <tr key={emp.id} className="hover:bg-violet-50 transition-colors whitespace-nowrap">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200">
                            {emp.code || emp.id}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">{firstName}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">{lastName}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">{emp.email || '-'}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 font-mono whitespace-nowrap">
                          {emp.phone && emp.phone !== '-' ? emp.phone : '-'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${roleInfo.badge}`}>
                            {roleInfo.label} (Level {roleInfo.level})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs font-mono font-semibold whitespace-nowrap">
                          {isResign ? (
                            <span className="text-danger-600 font-semibold">Resigned: {emp.resignDate || emp.startDate || '-'}</span>
                          ) : (
                            emp.startDate || '-'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                              isResign
                                ? 'bg-violet-100 text-violet-700 border border-violet-300'
                                : emp.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}
                          >
                            ● {emp.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold animate-bounce ${
            typeof notification === 'object' && notification?.type === 'error'
              ? 'bg-danger-50 border border-danger-200 text-danger-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          }`}
        >
          {typeof notification === 'object' && notification?.type === 'error' ? (
            <AlertCircle size={20} className="text-danger-600" />
          ) : (
            <CheckCircle size={20} className="text-emerald-600" />
          )}
          <span>{typeof notification === 'object' ? notification.msg : notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700 border border-violet-200">{info.icon}</div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">{info.title}</h1>
            
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-700 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <FilterBar
        right={
          <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto cursor-pointer"
          >
          <Plus size={16} />
          <span>Add New Department</span>
          </button>
        }
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Search code or name..."
        filters={[
          {
            label: 'Members',
            value: memberFilter,
            onChange: setMemberFilter,
            options: [
              { value: 'all', label: 'All' },
              { value: 'has', label: 'Has members' },
              { value: 'empty', label: 'No members' },
            ],
          },
        ]}
      />

      {/* List / Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">Code</th>
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6 text-center">Member</th>
                <th className="py-4 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500 font-mono">Loading data...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500 font-mono">No items yet</td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => openDetailView(item)}
                    className="hover:bg-violet-50 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-violet-100 text-violet-700 border border-violet-200">
                        {item.code || item.id}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 group-hover:text-violet-700 transition-colors">{item.name || item.title}</td>
                    <td className="py-4 px-6 text-center font-bold text-violet-700 font-mono">
                      {typeof item.employeeCount === 'number' ? item.employeeCount : (typeof item.memberCount === 'number' ? item.memberCount : 0)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(item);
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(item);
                          }}
                          className="p-1.5 text-slate-500 hover:text-violet-600 hover:bg-violet-100 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
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

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">Add New Department</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-full hover:bg-violet-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Code</label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate a code"
                  value={extraInput}
                  onChange={(e) => setExtraInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Name *</label>
                <input
                  type="text"
                  placeholder={info.placeholder}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleAddSubmit}
                  className="px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition-all uppercase tracking-wide cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ITEM MODAL */}
      {showEditModal && editTargetItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-200 text-slate-900 animate-pop-in">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">Edit Department ({editTargetItem.code || editTargetItem.id})</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-full hover:bg-violet-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Code</label>
                <input
                  type="text"
                  value={editExtraInput}
                  onChange={(e) => setEditExtraInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Name *</label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleEditSubmit}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-all uppercase tracking-wide cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDeleteModal && deleteTargetItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Red Trash Icon */}
            <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 border border-violet-300 flex items-center justify-center mb-5 shadow-lg shadow-slate-300">
              <Trash2 size={28} />
            </div>

            {/* Header/Title */}
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wide mb-2">
              Confirm deletion of {info.title.split(' ')[0]} ({deleteTargetItem.name || deleteTargetItem.title})?
            </h3>

            {/* Body/Description */}
            <p className="text-sm text-slate-700 leading-relaxed mb-7 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              You are about to delete <span className="font-bold text-slate-900">{deleteTargetItem.name || deleteTargetItem.title}</span> ({deleteTargetItem.code || deleteTargetItem.id}) from the system. This data cannot be recovered.
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
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all"
              >
                Cancel
              </button>
              {/* Danger Red Confirm Delete Button */}
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#991B1B] hover:from-[#EF4444] hover:to-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-danger-600/40 transition-all uppercase tracking-wide flex items-center gap-2"
              >
                <Trash2 size={16} />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
