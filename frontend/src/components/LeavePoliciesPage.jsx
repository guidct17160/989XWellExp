import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

import { API_BASE } from '../config';

// Pop-ups are drawn on the page body so they are always centred on the window, not on a scrolled / animated parent
const Portal = ({ children }) => createPortal(children, document.body);
import FilterBar from './FilterBar';
import DatePicker from './DatePicker';

export default function LeavePoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaid, setFilterPaid] = useState('all'); // 'all' | 'paid' | 'unpaid'
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
  const [formDefaultQuota, setFormDefaultQuota] = useState(10);
  const [formIsPaid, setFormIsPaid] = useState(true);
  const [formApplicableGender, setFormApplicableGender] = useState('all');
  const [formRequireAttachment, setFormRequireAttachment] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('Active');

  const fetchPolicies = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/leave-policies`);
      const data = await res.json();
      if (res.ok && data && data.success && Array.isArray(data.policies)) {
        setPolicies(data.policies);
      } else {
        setPolicies([]);
        showToast((data && data.message) || 'Unable to load leave policies', 'error');
      }
    } catch (err) {
      console.error('Error fetching policies:', err);
      showToast('Unable to connect to the leave policy API', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const showToast = (msg, type = 'success') => {
    setSuccessToast({ msg, type });
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    const nextNum = policies.length + 1;
    setFormId(`LP-${String(nextNum).padStart(2, '0')}`);
    setFormTypeName('');
    setFormDefaultQuota(10);
    setFormIsPaid(true);
    setFormApplicableGender('all');
    setFormRequireAttachment(true);
    setFormDescription('');
    setFormStatus('Active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p) => {
    setModalMode('edit');
    setCurrentPolicy(p);
    setFormId(p.id);
    setFormTypeName(p.typeName);
    setFormDefaultQuota(p.defaultQuota || 0);
    setFormIsPaid(p.isPaid !== undefined ? p.isPaid : true);
    setFormApplicableGender(p.applicableGender || 'all');
    setFormRequireAttachment(!!p.requireAttachment);
    setFormDescription(p.description || '');
    setFormStatus(p.status || 'Active');
    setIsModalOpen(true);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    if (!formTypeName.trim()) {
      showToast('Please enter a leave type name', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: formId,
        typeName: formTypeName.trim(),
        defaultQuota: parseInt(formDefaultQuota, 10) || 0,
        isPaid: formIsPaid,
        applicableGender: formApplicableGender || 'all',
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
        showToast(modalMode === 'create' ? '✨ Leave policy added successfully' : '💾 Leave policy settings saved successfully', 'success');
        setIsModalOpen(false);
        fetchPolicies();
      } else {
        showToast(resData.message || 'An error occurred while saving', 'error');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('Unable to connect to the server to save', 'error');
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
        showToast(`🗑️ Leave policy ${policyName} deleted successfully`);
        setDeleteConfirmModal({ isOpen: false, policyId: '', policyName: '' });
        fetchPolicies();
      } else {
        showToast(data.message || 'Unable to delete', 'error');
      }
    } catch (err) {
      showToast('An error occurred while deleting', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered list
  const filteredPolicies = policies.filter((p) => {
    const matchSearch =
      (p.typeName && p.typeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.id && p.id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchPaid =
      filterPaid === 'all' ? true : filterPaid === 'paid' ? p.isPaid === true : p.isPaid === false;

    const matchGender =
      filterGender === 'all'
        ? true
        : (p.applicableGender || 'all') === filterGender;

    return matchSearch && matchPaid && matchGender;
  });

  const totalPolicies = policies.length;
  const activePolicies = policies.filter((p) => p.status === 'Active').length;
  const paidPolicies = policies.filter((p) => p.isPaid).length;
  const unpaidPolicies = totalPolicies - paidPolicies;

  return (
    <div className="space-y-6 text-slate-900 font-sans animate-in fade-in duration-200">
      {/* Toast Alert */}
      {successToast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold animate-bounce ${
            typeof successToast === 'object' && successToast?.type === 'error'
              ? 'bg-danger-50 border border-danger-200 text-danger-700'
              : 'bg-emerald-50 border border-emerald-500/60 text-emerald-800'
          }`}
        >
          {typeof successToast === 'object' && successToast?.type === 'error' ? (
            <AlertTriangle size={20} className="text-danger-600" />
          ) : (
            <CheckCircle2 size={20} className="text-emerald-600" />
          )}
          <span>{typeof successToast === 'object' ? successToast.msg : successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-violet-100 text-violet-700 border border-violet-200">
            <UserCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                Leave Quotas
              </h1>
            </div>
            
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchPolicies}
            disabled={isLoading}
            className="flex items-center gap-2 bg-slate-50 hover:bg-violet-50 text-slate-700 hover:text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold transition-all"
            title="Refresh data from the database"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-violet-600' : ''} />
            <span>Refresh</span>
          </button>

        </div>
      </div>

      {/* Policy Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Policies</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalPolicies} <span className="text-xs font-normal text-slate-500">types</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600">
            <Layers size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{activePolicies} <span className="text-xs font-normal text-slate-500">types</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Paid</span>
            <div className="text-2xl font-black text-blue-600 mt-1">{paidPolicies} <span className="text-xs font-normal text-slate-500">types</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Unpaid</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{unpaidPolicies} <span className="text-xs font-normal text-slate-500">types</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <FilterBar
        right={
          <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto cursor-pointer"
          >
          <Plus size={16} />
          <span>Add Leave Policy</span>
          </button>
        }
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Search by leave type or policy ID..."
        filters={[
          {
            label: 'Gender',
            value: filterGender,
            onChange: setFilterGender,
            options: [
              { value: 'all', label: 'All' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ],
          },
          {
            label: 'Payment',
            value: filterPaid,
            onChange: setFilterPaid,
            options: [
              { value: 'all', label: 'All' },
              { value: 'paid', label: 'Paid' },
              { value: 'unpaid', label: 'Unpaid' },
            ],
          },
        ]}
      />

      {/* Policies Table */}
      {filteredPolicies.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <th className="py-4 px-5">Code</th>
                  <th className="py-4 px-5 w-full">Leave Type</th>
                  <th className="py-4 px-5 text-center">Quota</th>
                  <th className="py-4 px-5">Pay Type</th>
                  <th className="py-4 px-5">Gender</th>
                  <th className="py-4 px-5">Document</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {filteredPolicies.map((p) => (
                  <tr key={p.id} className="hover:bg-violet-50 transition-colors align-middle">
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className="text-xs font-mono font-bold text-violet-600 bg-violet-100 px-2.5 py-1 rounded-lg border border-violet-200 whitespace-nowrap">{p.id}</span>
                    </td>
                    <td className="py-4 px-5 min-w-[16rem]">
                      <div className="text-sm font-bold text-slate-900">{p.typeName}</div>
                      
                    </td>
                    <td className="py-4 px-5 text-center whitespace-nowrap">
                      <span className="text-lg font-black text-amber-600 font-mono">{p.defaultQuota}</span>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${p.isPaid ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
                        {p.isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                        p.applicableGender === 'female'
                          ? 'text-pink-700 bg-pink-50 border-pink-200'
                          : p.applicableGender === 'male'
                          ? 'text-sky-700 bg-sky-50 border-sky-200'
                          : 'text-slate-700 bg-slate-100 border-slate-300'
                      }`}>
                        {p.applicableGender === 'female' ? 'Female only' : p.applicableGender === 'male' ? 'Male only' : 'All genders'}
                      </span>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                        p.requireAttachment
                          ? 'text-amber-700 bg-amber-50 border-amber-200'
                          : 'text-slate-500 bg-slate-100 border-slate-300'
                      }`}>
                        {p.requireAttachment ? 'Required' : 'Not required'}
                      </span>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-violet-100 text-violet-600 border-violet-200'}`}>
                        {p.status === 'Active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Configure / Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => requestDeletePolicy(p.id, p.typeName)}
                          className="p-1.5 text-slate-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                          title="Delete policy"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredPolicies.length === 0 && !isLoading && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-lg">

          <p className="text-xs text-slate-500 mb-4">No leave policies match your search</p>

        </div>
      )}

      {/* ======================================================== */}
      {/* Policy Configuration Modal (Popup Dialog) */}
      {/* ======================================================== */}
      {isModalOpen && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-violet-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-100 text-violet-600 border border-violet-200">
                  <Edit size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase">
                    {modalMode === 'create' ? 'Add New Leave Policy' : `Policy Settings: ${formTypeName || formId}`}
                  </h2>
                  
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 p-2 rounded-xl hover:bg-violet-50 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePolicy} className="space-y-5">
              {/* Row 1: ID, Type Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Policy ID</label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    disabled={modalMode === 'edit'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-violet-500 disabled:opacity-60"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Leave Type Name *</label>
                  <input
                    type="text"
                    value={formTypeName}
                    onChange={(e) => setFormTypeName(e.target.value)}
                    placeholder="e.g. Annual Leave"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Quota, Pay Type, Applicable Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Quota (days/yr)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={formDefaultQuota}
                    onChange={(e) => setFormDefaultQuota(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Pay Type</label>
                  <select
                    value={formIsPaid ? 'true' : 'false'}
                    onChange={(e) => setFormIsPaid(e.target.value === 'true')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                  >
                    <option value="true">Paid</option>
                    <option value="false">Unpaid</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Gender *</label>
                  <select
                    value={formApplicableGender}
                    onChange={(e) => setFormApplicableGender(e.target.value)}
                    title="Leave requests and this quota are shown in the Mobile App only to employees whose gender matches"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                  >
                    <option value="all">All genders</option>
                    <option value="male">Male only</option>
                    <option value="female">Female only</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Attachment toggle */}
              <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Require Attachment</span>
                    <span className="text-[10px] text-slate-500 block">e.g. medical certificate or supporting document</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRequireAttachment}
                      onChange={(e) => setFormRequireAttachment(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                  </label>
                </div>
              </div>

              {/* Description & Status */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Notes / Policy Details</label>
                <textarea
                  rows="2"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. A medical certificate is required for more than 3 consecutive days, or eligibility rules for probation employees"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                >
                  <option value="Active">Active </option>
                  <option value="Inactive">Inactive </option>
                </select>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-50 hover:bg-violet-50 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold shadow-lg shadow-violet-600/40 transition-all uppercase tracking-wide disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Settings</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
      {/* ======================================================== */}
      {/* Delete Confirmation Popup Modal */}
      {/* ======================================================== */}
      {deleteConfirmModal.isOpen && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-slate-300 space-y-5 animate-scale-up">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 border border-violet-300 flex items-center justify-center text-violet-700 shadow-inner flex-shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Leave Policy Deletion</h3>
                <p className="text-xs text-slate-500">Please review before confirming</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2">
              <p>
                Are you sure you want to delete the leave policy <span className="font-bold text-slate-900">"{deleteConfirmModal.policyName}"</span> (ID <span className="font-mono text-danger-600 font-bold">{deleteConfirmModal.policyId}</span>)?
              </p>
              <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-semibold pt-1">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>This will disable the employees' entitlement and cannot be undone</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, policyId: '', policyName: '' })}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePolicy}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold shadow-lg shadow-violet-600/40 transition-all uppercase tracking-wide disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
