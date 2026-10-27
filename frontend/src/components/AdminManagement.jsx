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
  Send,
  AlertCircle
} from 'lucide-react';

import { API_BASE } from '../config';

// Admin names are stored as one "name" column; show/edit them as first name + last name.
const splitName = (full) => {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

const isInactive = (st) => st === 'Inactive' || st === 'Resign' || st === 'Resigned';

export default function AdminManagement({ isSuperAdmin: propIsSuperAdmin, currentUser: propCurrentUser }) {
  const user = propCurrentUser || (() => {
    try {
      const saved = localStorage.getItem('wellx989_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  })();
  const isSuperAdmin = propIsSuperAdmin !== undefined ? propIsSuperAdmin : (user?.role === 'Super Admin');

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Form State (No department, email is username, no password input in form)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'HR Admin',
    status: 'Active',
  });

  const [sendingReset, setSendingReset] = useState(false);
  const [notification, setNotification] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  // Status Toggle Modal State
  const [statusToggleTarget, setStatusToggleTarget] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const triggerNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admins`);
      const data = await res.json();
      if (data.success && data.admins) {
        setAdmins(data.admins);
      } else {
        triggerNotification(data.message || 'Unable to load the administrator list', 'error');
      }
    } catch (err) {
      console.error('Failed to fetch admins', err);
      triggerNotification('Unable to connect to the server to load the administrator list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    if (!isSuperAdmin) {
      triggerNotification('Only a Super Admin can create an Admin', 'error');
      return;
    }
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'HR Admin',
      status: 'Pending Password',
    });
    setShowAddModal(true);
  };

  const openEditModal = (admin) => {
    setSelectedAdmin(admin);
    setFormData({
      ...splitName(admin.name),
      email: admin.email || admin.username || '',
      phone: admin.phone || '',
      role: admin.role === 'Super Admin' ? 'Super Admin' : 'HR Admin',
      status: isInactive(admin.status) ? 'Inactive' : (admin.status || 'Active'),
    });
    setShowEditModal(true);
  };

  const openResetPasswordModal = (admin) => {
    setSelectedAdmin(admin);
    setShowResetPasswordModal(true);
  };

  const openDeleteModal = (admin) => {
    setSelectedAdmin(admin);
    setShowDeleteModal(true);
  };

  // RESEND INVITE
  const handleResendInvite = async (admin) => {
    if (!admin || !admin.id) return;
    setResendingId(admin.id);
    try {
      const res = await fetch(`${API_BASE}/admins/${admin.id}/resend-invite`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        triggerNotification(`Password setup email sent to ${admin.email}`);
      } else {
        triggerNotification(json.message || 'An error occurred while sending the email', 'error');
      }
    } catch (err) {
      triggerNotification('A server connection error occurred', 'error');
    } finally {
      setResendingId(null);
    }
  };

  // Status Toggle Handlers
  const handleRequestStatusToggle = (adm) => {
    if (!isSuperAdmin || !adm) return;
    if (adm.status === 'Pending Password' || adm.status === 'Pending' || adm.status === 'รอตั้งรหัสผ่าน') return;
    const nextStatus = adm.status === 'Active' ? 'Inactive' : 'Active';
    setStatusToggleTarget({ adm, nextStatus });
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusToggleTarget) return;
    const { adm, nextStatus } = statusToggleTarget;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/admins/${adm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification(`Status of ${adm.name} changed to "${nextStatus}"`);
        setAdmins((prev) =>
          prev.map((a) => (a.id === adm.id ? { ...a, status: nextStatus } : a))
        );
      } else {
        triggerNotification(data.message || 'Unable to change the status', 'error');
      }
    } catch (err) {
      triggerNotification('A server connection error occurred', 'error');
    } finally {
      setIsUpdatingStatus(false);
      setStatusToggleTarget(null);
    }
  };

  const buildPayload = ({ firstName, lastName, ...rest }) => ({
    ...rest,
    name: `${firstName.trim()} ${lastName.trim()}`.trim(),
  });

  // CREATE ADMIN (Strictly Super Admin, Email as Username, No Department, Email link for password)
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email) {
      triggerNotification('Please enter first name, last name and email', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(formData)),
      });
      const json = await res.json();

      if (json.success) {
        triggerNotification(`Admin account "${formData.firstName} ${formData.lastName}" created and password setup email sent to ${formData.email}`);
        setShowAddModal(false);
        setSearchTerm('');
        setRoleFilter('');
        fetchAdmins();
      } else {
        triggerNotification(json.message || 'An error occurred while creating the Admin', 'error');
      }
    } catch (err) {
      console.error('Failed to create admin', err);
      triggerNotification('A server connection error occurred', 'error');
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
        body: JSON.stringify(buildPayload(formData)),
      });
      const json = await res.json();

      if (json.success) {
        triggerNotification(`Admin "${formData.firstName} ${formData.lastName}" updated`);
        setShowEditModal(false);
        fetchAdmins();
      } else {
        triggerNotification(json.message || 'An error occurred while updating the data', 'error');
      }
    } catch (err) {
      console.error('Failed to update admin', err);
      triggerNotification('A server connection error occurred', 'error');
    }
  };

  // RESET PASSWORD — emails a set-password link; the admin chooses the new password themselves
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAdmin || sendingReset) return;
    setSendingReset(true);
    try {
      const res = await fetch(`${API_BASE}/admins/${selectedAdmin.id}/resend-invite`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        triggerNotification(`Password reset link sent to ${selectedAdmin.email || selectedAdmin.username}`);
        setShowResetPasswordModal(false);
      } else {
        triggerNotification(json.message || 'Unable to send the password reset email', 'error');
      }
    } catch (err) {
      console.error('Failed to send reset password email', err);
      triggerNotification('A server connection error occurred', 'error');
    } finally {
      setSendingReset(false);
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
        triggerNotification(`Admin account "${selectedAdmin.name}" deleted`);
        setShowDeleteModal(false);
        fetchAdmins();
      } else {
        triggerNotification(json.message || 'An error occurred while deleting the Admin', 'error');
      }
    } catch (err) {
      console.error('Failed to delete admin', err);
      triggerNotification('An error occurred while deleting the Admin', 'error');
    }
  };

  // Filtered List
  const filteredAdmins = admins.filter((admin) => {
    const matchesSearch =
      (admin.name && admin.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.username && admin.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.email && admin.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.code && admin.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.id && admin.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.phone && admin.phone.includes(searchTerm));

    const matchesRole = roleFilter ? admin.role === roleFilter : true;
    const isPendingAdmin = admin.status === 'Pending Password' || admin.status === 'Pending' || admin.status === 'รอตั้งรหัสผ่าน';
    const matchesStatus = statusFilter
      ? (statusFilter === 'Inactive' ? isInactive(admin.status) : statusFilter === 'Pending' ? isPendingAdmin : admin.status === statusFilter)
      : true;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6 font-sans text-slate-900">
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

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-[#7C3AED] text-white shadow-lg shadow-violet-600/30">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">Admin Management</h1>
            
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdmins}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-700 transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          
          
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">All Admin</span>
            <div className="text-2xl font-black text-violet-700">{admins.length} <span className="text-xs font-normal text-slate-500">accounts</span></div>
          </div>
          <div className="p-3 rounded-xl bg-violet-100 text-violet-700 border border-violet-200">
            <ShieldCheck size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Super Admin</span>
            <div className="text-2xl font-black text-amber-600">
              {admins.filter((a) => a.role === 'Super Admin' || a.role === 'SuperBoss').length} <span className="text-xs font-normal text-slate-500">accounts</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <Lock size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">HR Admin</span>
            <div className="text-2xl font-black text-blue-600">
              {admins.filter((a) => a.role === 'HR Admin').length} <span className="text-xs font-normal text-slate-500">accounts</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
            <User size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-lg flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ID, name, email, phone..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
            <Filter size={14} className="text-violet-600" />
            <span>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent font-bold text-violet-700 outline-none cursor-pointer"
            >
              <option value="">All</option>
              <option value="Super Admin">Super Admin</option>
              <option value="HR Admin">HR Admin</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
            <Filter size={14} className="text-violet-600" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-violet-700 outline-none cursor-pointer"
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending Password</option>
            </select>
          </div>
        </div>

        {/* Create Admin button is strictly visible to Super Admin — far right */}
        {isSuperAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto"
          >
            <UserPlus size={16} />
            <span>Create New Admin Account</span>
          </button>
        )}
      </div>

      {/* Admin Table (No department column) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">ID</th>
                <th className="py-4 px-6">First Name</th>
                <th className="py-4 px-6">Last Name</th>
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">Phone</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500 font-mono">
                    Loading Admin data...
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500 font-mono">
                    No Admin records match the criteria
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((adm) => {
                  const isPending = adm.status === 'Pending Password' || adm.status === 'Pending' || adm.status === 'รอตั้งรหัสผ่าน';
                  return (
                    <tr key={adm.id} className="hover:bg-violet-50 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs font-bold text-violet-700">{adm.code || adm.id}</td>

                      <td className="py-4 px-6 font-bold text-slate-900">{splitName(adm.name).firstName || '-'}</td>

                      <td className="py-4 px-6 font-bold text-slate-900">{splitName(adm.name).lastName || '-'}</td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-violet-700" />
                          <span className="font-mono text-slate-800 text-xs">{adm.email || adm.username}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-500" />
                          <span>{adm.phone && adm.phone !== '-' ? adm.phone : '-'}</span>
                        </div>
                      </td>

                      {/* Role (Only 2 Roles: Super Admin & HR Admin) */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            adm.role === 'Super Admin' || adm.role === 'SuperBoss'
                              ? 'bg-amber-50 text-amber-700 border border-amber-300 shadow-sm'
                              : 'bg-blue-50 text-blue-700 border border-blue-300 shadow-sm'
                          }`}
                        >
                          {adm.role === 'Super Admin' || adm.role === 'SuperBoss' ? '👑 Super Admin' : '🛡️ HR Admin'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRequestStatusToggle(adm)}
                            disabled={!isSuperAdmin || isPending}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                              adm.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 cursor-pointer shadow-sm hover:scale-105 active:scale-95'
                                : isPending
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 cursor-default'
                                : 'bg-violet-100 text-violet-600 border-violet-300 hover:bg-violet-200 cursor-pointer shadow-sm hover:scale-105 active:scale-95'
                            }`}
                            title={isPending ? 'Waiting for the administrator to set a password' : isSuperAdmin ? 'Click to toggle Active / Inactive' : adm.status}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                adm.status === 'Active'
                                  ? 'bg-emerald-400 animate-pulse'
                                  : isPending
                                  ? 'bg-amber-400'
                                  : 'bg-violet-500'
                              }`}
                            />
                            <span>{adm.status === 'Active' ? 'Active ' : isPending ? 'Pending Password' : 'Inactive '}</span>
                          </button>

                          {/* Quick resend invite link button for Pending accounts */}
                          {isPending && isSuperAdmin && (
                            <button
                              onClick={() => handleResendInvite(adm)}
                              disabled={resendingId === adm.id}
                              className="text-[11px] font-bold bg-amber-100 hover:bg-amber-800 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-300 transition-colors flex items-center gap-1 shadow-sm"
                              title="Resend password setup email"
                            >
                              <Send size={11} className={resendingId === adm.id ? 'animate-spin' : ''} />
                              <span>{resendingId === adm.id ? 'Sending...' : 'Resend'}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isSuperAdmin ? (
                            <>
                              <button
                                onClick={() => openEditModal(adm)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-violet-50 rounded-lg transition-colors"
                                title="Edit Admin"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => openResetPasswordModal(adm)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Send password reset link by email"
                              >
                                <KeyRound size={16} />
                              </button>
                              <button
                                onClick={() => openDeleteModal(adm)}
                                className="p-1.5 text-slate-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                                title="Delete Admin account"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ADMIN MODAL (No department, email is username, no password input) */}
      {showAddModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-slate-200 text-slate-900 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700 border border-violet-200">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">Create New Admin Account</h3>
                  <p className="text-xs text-slate-500">A link to set the Web Admin password will be sent to the email</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-violet-50"
              >
                <X size={20} />
              </button>
            </div>

            

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="e.g. John"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="e.g. Smith"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="e.g. admin@wellx989.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Role *
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all cursor-pointer"
                  >
                    <option value="Super Admin">👑 Super Admin</option>
                    <option value="HR Admin">🛡️ HR Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="081-234-5678"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-sm shadow-lg shadow-violet-600/30 transition-all uppercase tracking-wide flex items-center gap-2"
                >
                  <Send size={15} />
                  <span>Save and send ADMIN invitation email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMIN MODAL (No department, only 2 roles) */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-slate-200 text-slate-900 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700 border border-violet-200">
                  <Edit size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">Edit Admin</h3>
                  <p className="text-xs text-slate-500">{formData.firstName} {formData.lastName} ({formData.email})</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-violet-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email (Username) *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Role *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all cursor-pointer"
                  >
                    <option value="Super Admin">👑 Super Admin</option>
                    <option value="HR Admin">🛡️ HR Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive </option>
                    {formData.status === 'Pending Password' && (
                      <option value="Pending Password">Pending Password</option>
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-sm shadow-lg shadow-violet-600/30 transition-all uppercase tracking-wide"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetPasswordModal && selectedAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">Reset Password (sent by email)</h3>
                  <p className="text-xs text-slate-500">{selectedAdmin.name} ({selectedAdmin.email || selectedAdmin.username})</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetPasswordModal(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-violet-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
                A password reset link will be sent to the email
                <span className="font-bold text-slate-900 font-mono"> {selectedAdmin.email || selectedAdmin.username} </span>
                The link is valid for 15 minutes, and the current password keeps working until the administrator sets a new one successfully
              </p>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResetPasswordModal(false)}
                  className="px-5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingReset}
                  className="px-6 py-2 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/30 uppercase tracking-wide flex items-center gap-2 disabled:opacity-60"
                >
                  <Send size={15} />
                  <span>{sendingReset ? 'Sending...' : 'Send password reset link by email'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ADMIN MODAL */}
      {showDeleteModal && selectedAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 border border-violet-300 flex items-center justify-center mb-5 shadow-lg shadow-slate-300">
              <Trash2 size={28} />
            </div>

            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wide mb-2">
              Confirm deleting the administrator account ({selectedAdmin?.name})?
            </h3>

            <p className="text-sm text-slate-700 leading-relaxed mb-7 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              You are about to delete the administrator account <span className="font-bold text-slate-900">{selectedAdmin?.name}</span> ({selectedAdmin?.email || selectedAdmin?.username}) from the system
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all"
              >
                Cancel
              </button>
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

      {/* STATUS TOGGLE CONFIRMATION MODAL FOR ADMIN */}
      {statusToggleTarget && (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-200">
              <div
                className={`p-3 rounded-2xl border flex-shrink-0 ${
                  statusToggleTarget.nextStatus === 'Inactive'
                    ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-lg shadow-slate-300'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-lg shadow-slate-300'
                }`}
              >
                <ShieldCheck size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                  {statusToggleTarget.nextStatus === 'Inactive'
                    ? 'Confirm suspending Admin access (Inactive)?'
                    : 'Confirm enabling Admin access (Active)?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Change Web Admin access status
                </p>
              </div>
            </div>

            {/* Admin Info Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 text-sm truncate">
                    {statusToggleTarget.adm.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {statusToggleTarget.adm.email || statusToggleTarget.adm.username} • {statusToggleTarget.adm.role}
                  </div>
                </div>
              </div>

              {/* Status Transition Display */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-bold">
                <span className="text-slate-500">Current status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full ${
                    statusToggleTarget.adm.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-violet-100 text-violet-600 border border-violet-300'
                  }`}
                >
                  ● {statusToggleTarget.adm.status}
                </span>
                <span className="text-slate-500">➜</span>
                <span className="text-slate-500">New status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full ${
                    statusToggleTarget.nextStatus === 'Active'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-500 shadow-sm'
                      : 'bg-violet-100 text-violet-600 border border-violet-500 shadow-sm'
                  }`}
                >
                  ● {statusToggleTarget.nextStatus}
                </span>
              </div>
            </div>

            {/* Warning / Notice Text */}
            <p className="text-xs text-slate-700 leading-relaxed mb-6">
              {statusToggleTarget.nextStatus === 'Inactive'
                ? '⚠️ Once set to Inactive, this administrator will temporarily be unable to log in to Web Admin'
                : '✅ Once set to Active, this administrator will be able to log in to Web Admin normally'}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setStatusToggleTarget(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleConfirmStatusToggle}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all uppercase tracking-wide flex items-center gap-2 text-white ${
                  statusToggleTarget.nextStatus === 'Inactive'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-600/30'
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-600/30'
                }`}
              >
                {isUpdatingStatus ? (
                  <span>Saving...</span>
                ) : (
                  <span>Confirm change to {statusToggleTarget.nextStatus}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

