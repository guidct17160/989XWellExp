import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Calendar,
  ShieldCheck,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  Ban,
  KeyRound
} from 'lucide-react';

import { API_BASE } from '../config';
import FilterBar from './FilterBar';
import DatePicker from './DatePicker';

export default function EmployeeManagement({ initialTab = 'all-employee' }) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveSubTab(initialTab);
  }, [initialTab]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedGender, setSelectedGender] = useState('');

  // Status Toggle Modal State
  const [statusToggleTarget, setStatusToggleTarget] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmAddModal, setShowConfirmAddModal] = useState(false);
  const [showDuplicateEmailAlertModal, setShowDuplicateEmailAlertModal] = useState(false);
  const [showDuplicateCodeAlertModal, setShowDuplicateCodeAlertModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // Reset password: employee waiting for the admin's confirmation, and whether the request is running
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [sentEmailModal, setSentEmailModal] = useState(null);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    code: '',
    username: '',
    password: '1234',
    name: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'Male',
    department: '',
    role: 'Employee',
    status: 'Active',
    startDate: new Date().toISOString().split('T')[0],
  });

  const [notification, setNotification] = useState(null);

  const fetchOrgStructure = async () => {
    try {
      const deptRes = await fetch(`${API_BASE}/departments`).then((r) => r.json()).catch(() => null);

      if (deptRes?.success && deptRes.departments) setDepartments(deptRes.departments);
    } catch (err) {
      console.error('Failed to fetch org structure', err);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/employees`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEmployees(Array.isArray(data.employees) ? data.employees : []);
      } else {
        triggerNotification(data.message || 'Unable to load the employee list (please sign in again)', 'error');
      }
    } catch (err) {
      console.error('Failed to fetch employees from API', err);
      triggerNotification('Unable to connect to the server to load the employee list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchOrgStructure();
  }, []);

  const triggerNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'status' && (value === 'Resign' || value === 'Resigned')) {
        if (!next.resignDate) {
          next.resignDate = new Date().toISOString().split('T')[0];
        }
      }
      return next;
    });
  };

  // Open Create Modal
  const handleOpenAdd = () => {
    const num = employees.length + 1;
    const empCode = `EMP-${String(num).padStart(3, '0')}`;
    setFormData({
      code: empCode,
      firstName: '',
      lastName: '',
      name: '',
      email: '',
      phone: '',
      gender: 'Male',
      department: '',
      role: 'Employee',
      status: 'Pending',
      startDate: new Date().toISOString().split('T')[0],
    });
    setShowAddModal(true);
  };

  // Create Employee Submit - Step 1: Open Confirmation Popup
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if ((!formData.firstName && !formData.name) || !formData.email) {
      triggerNotification('Please enter the employee first name, last name and email', 'error');
      return;
    }

    const cleanEmail = formData.email.trim().toLowerCase();
    const existingByEmail = employees.find(
      (emp) => emp.email && emp.email.trim().toLowerCase() === cleanEmail
    );
    if (existingByEmail) {
      setShowDuplicateEmailAlertModal(true);
      return;
    }

    if (formData.code && formData.code.trim()) {
      const cleanCode = formData.code.trim().toUpperCase();
      const existingByCode = employees.find(
        (emp) => emp.code && emp.code.trim().toUpperCase() === cleanCode
      );
      if (existingByCode) {
        setShowDuplicateCodeAlertModal(true);
        return;
      }
    }

    setShowConfirmAddModal(true);
  };

  // Step 2: Confirmed Create & Single Click Send Email
  const handleConfirmCreateEmployee = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = {
      ...formData,
      name: `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || formData.name,
    };

    try {
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerNotification(`Employee ${payload.name} created successfully! A password setup link has been sent to ${formData.email}`);
        setShowConfirmAddModal(false);
        setShowAddModal(false);
        fetchEmployees();
      } else {
        triggerNotification(data.message || 'Failed to create the employee', 'error');
      }
    } catch (err) {
      triggerNotification('Unable to connect to the server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (emp) => {
    if (emp.status === 'Resign' || emp.status === 'Resigned') {
      triggerNotification('Employees with Resign status cannot be edited because they have left the company', 'error');
      return;
    }
    setSelectedEmployee(emp);
    const firstName = emp.firstName || (emp.name ? emp.name.split(' ')[0] : '');
    const lastName = emp.lastName || (emp.name ? emp.name.split(' ').slice(1).join(' ') : '');
    setFormData({
      code: emp.code,
      firstName: firstName,
      lastName: lastName,
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      gender: emp.gender || 'Male',
      department: emp.department,
      role: emp.role || 'Employee',
      status: emp.status || 'Active',
      startDate: emp.startDate || new Date().toISOString().split('T')[0],
      resignDate: emp.resignDate || new Date().toISOString().split('T')[0],
    });
    setShowEditModal(true);
  };

  // Status Toggle Handlers
  const handleRequestStatusToggle = (emp) => {
    if (!emp) return;
    if (emp.status === 'Resign' || emp.status === 'Resigned') {
      triggerNotification('Employees with Resign status cannot have their status changed', 'error');
      return;
    }
    const nextStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    setStatusToggleTarget({ emp, nextStatus });
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusToggleTarget) return;
    const { emp, nextStatus } = statusToggleTarget;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/employees/${emp.id || emp.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerNotification(`Status of ${emp.name} changed to "${nextStatus}"`, 'success');
        setEmployees((prev) =>
          prev.map((e) => ((e.id === emp.id || e.code === emp.code) ? { ...e, status: nextStatus } : e))
        );
      } else {
        triggerNotification(data.message || 'Unable to change status', 'error');
      }
    } catch (err) {
      console.error('Failed to toggle employee status', err);
      triggerNotification('Server connection error', 'error');
    } finally {
      setIsUpdatingStatus(false);
      setStatusToggleTarget(null);
    }
  };

  // Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const isResigning = formData.status === 'Resign' || formData.status === 'Resigned';
      const effectiveResignDate = isResigning ? (formData.resignDate || formData.startDate || new Date().toISOString().split('T')[0]) : null;
      const payload = {
        ...formData,
        resignDate: effectiveResignDate,
      };

      const res = await fetch(`${API_BASE}/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (isResigning) {
          triggerNotification(`${formData.name} has been marked as Resign with resignation date ${effectiveResignDate}`, 'success');
        } else {
          triggerNotification(`Employee ${formData.name} updated successfully`, 'success');
        }
        setShowEditModal(false);
        fetchEmployees();
      } else {
        triggerNotification(data.message || 'Failed to update the employee', 'error');
      }
    } catch (err) {
      triggerNotification('Failed to update the employee', 'error');
    }
  };

  // Reset password: employees cannot reset their own password, so an Admin sends the set-password link from here
  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/employees/${encodeURIComponent(resetTarget.id || resetTarget.code)}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        triggerNotification(
          `Password reset link sent to ${data.maskedEmail || 'the employee'} (${resetTarget.name}). They can set a new password in the app.`
        );
        setResetTarget(null);
      } else {
        triggerNotification(data.message || 'Failed to send the password reset link', 'error');
      }
    } catch (err) {
      console.error('Reset employee password error:', err);
      triggerNotification('Unable to connect to the server to reset the password', 'error');
    } finally {
      setResetting(false);
    }
  };

  // Delete Submit
  const handleDeleteSubmit = async () => {
    if (!selectedEmployee) return;
    try {
      const empId = selectedEmployee.id || selectedEmployee.code;
      const res = await fetch(`${API_BASE}/employees/${empId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification(`Employee ${selectedEmployee.name} has been deleted`);
        setShowDeleteModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        triggerNotification(data.message || 'Failed to delete the employee', 'error');
      }
    } catch (err) {
      console.error('Delete employee error:', err);
      triggerNotification('Failed to delete the employee', 'error');
    }
  };

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      String(emp.name || '').toLowerCase().includes(q) ||
      String(emp.email || '').toLowerCase().includes(q) ||
      String(emp.code || '').toLowerCase().includes(q) ||
      String(emp.department || '').toLowerCase().includes(q);
    const matchesDept = selectedDept ? emp.department === selectedDept : true;
    const matchesStatus = selectedStatus
      ? (selectedStatus === 'Resign' ? (emp.status === 'Resign' || emp.status === 'Resigned') : emp.status === selectedStatus)
      : true;
    const matchesGender = selectedGender ? (emp.gender || 'Male') === selectedGender : true;
    return matchesSearch && matchesDept && matchesStatus && matchesGender;
  });

  const handleExportCSV = () => {
    if (filteredEmployees.length === 0) return;
    const headers = ['ID', 'First Name', 'Last Name', 'Department', 'Gender', 'Role', 'Start Date', 'Status'];
    const q = (v) => `"${String(v ?? '-').replace(/"/g, '""')}"`;
    const rows = filteredEmployees.map((item) => [
      q(item.code || '-'),
      q(item.firstName || '-'),
      q(item.lastName || '-'),
      q(item.department || '-'),
      q(item.gender || '-'),
      q(item.role || '-'),
      q(item.startDate ? String(item.startDate).slice(0, 10) : '-'),
      q(item.status || '-'),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-bold animate-bounce transition-all ${
            notification.type === 'error'
              ? 'bg-red-950 border-red-700/60 text-red-300'
              : 'bg-emerald-950 border border-emerald-700/60 text-emerald-300'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle size={20} className="text-[#EF4444]" />
          ) : (
            <CheckCircle size={20} className="text-emerald-400" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">All Employees</h1>
              
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredEmployees.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600/50 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export the filtered employees"
          >
            <FileSpreadsheet size={16} />
            <span>Export</span>
          </button>

          <button
            onClick={fetchEmployees}
            className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

        </div>
      </div>

      {/* Filter and Search Bar */}
      <FilterBar
        right={
          <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto cursor-pointer"
          >
          <UserPlus size={16} />
          <span>Create / Register New Employee</span>
          </button>
        }
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Search ID, name, email, department..."
        filters={[
          {
            label: 'Status',
            value: selectedStatus,
            onChange: setSelectedStatus,
            options: [
              { value: '', label: 'All' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
              { value: 'Resign', label: 'Resign' },
            ],
          },
          {
            label: 'Gender',
            value: selectedGender,
            onChange: setSelectedGender,
            options: [
              { value: '', label: 'All' },
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ],
          },
          {
            label: 'Department',
            value: selectedDept,
            onChange: setSelectedDept,
            options: [{ value: '', label: 'All' }, ...departments.map((d) => ({ value: d.name, label: d.name }))],
          },
        ]}
      />

      {/* Employee Data Table */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-[#0B0D13] border-b border-red-900/30 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">First Name</th>
                <th className="py-3.5 px-4">Last Name</th>
                <th className="py-3.5 px-4 w-full">Department</th>
                <th className="py-3.5 px-4">Gender</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Start Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20 text-sm font-medium text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500 font-mono">
                    Loading employees...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500 font-mono">
                    No employees match the filters
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-red-950/20 transition-colors">
                    {/* ID / First Name / Last Name / Department */}
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#EF4444]">{emp.code}</td>
                    <td className="py-3.5 px-4 font-bold text-white max-w-[10rem] truncate" title={emp.firstName}>{emp.firstName || '-'}</td>
                    <td className="py-3.5 px-4 font-bold text-white max-w-[12rem] truncate" title={emp.lastName}>{emp.lastName || '-'}</td>
                    <td className="py-3.5 px-4 text-slate-300 whitespace-normal min-w-[12rem]">{emp.department || '-'}</td>

                    {/* Gender Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          (emp.gender || 'Male') === 'Female' || emp.gender === 'หญิง'
                            ? 'bg-pink-950/80 text-pink-300 border border-pink-700/50'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-700/50'
                        }`}
                      >
                        {(emp.gender || 'Male') === 'Female' || emp.gender === 'หญิง' ? '👩 Female' : '👨 Male'}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          emp.role === 'Admin' || emp.role === 'HR Admin'
                            ? 'bg-red-950 text-red-400 border border-red-700/60'
                            : 'bg-[#0B0D13] text-slate-300 border border-red-900/40'
                        }`}
                      >
                        <ShieldCheck size={13} className="text-[#EF4444]" />
                        {emp.role || 'Employee'}
                      </span>
                    </td>

                    {/* Start Date */}
                    <td className="py-3.5 px-4 text-slate-400 text-xs font-mono font-semibold">
                      {emp.startDate}
                    </td>

                    {/* Status Button (Click to toggle Active/Inactive with Confirmation Popup) */}
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleRequestStatusToggle(emp)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm border ${
                          emp.status === 'Resign' || emp.status === 'Resigned'
                            ? 'bg-rose-950/90 text-rose-300 border-rose-700/60 cursor-not-allowed opacity-90'
                            : emp.status === 'Active'
                            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600/70 hover:bg-emerald-900 hover:border-emerald-500 cursor-pointer hover:scale-105 active:scale-95'
                            : emp.status === 'Inactive'
                            ? 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-slate-200 hover:border-slate-500 cursor-pointer hover:scale-105 active:scale-95'
                            : 'bg-amber-950/80 text-amber-300 border-amber-700/60 hover:bg-amber-900 cursor-pointer hover:scale-105 active:scale-95'
                        }`}
                        title={emp.status === 'Resign' || emp.status === 'Resigned' ? 'Status: Resign (left the company)' : `Current status: ${emp.status} (click to change)`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            emp.status === 'Resign' || emp.status === 'Resigned'
                              ? 'bg-rose-500'
                              : emp.status === 'Active'
                              ? 'bg-emerald-400 animate-pulse'
                              : emp.status === 'Inactive'
                              ? 'bg-slate-500'
                              : 'bg-amber-400'
                          }`}
                        />
                        <span>
                          {emp.status === 'Pending' || emp.status === 'Pending Password'
                            ? 'Pending (awaiting password setup)'
                            : emp.status === 'Resign' || emp.status === 'Resigned'
                            ? 'Resign'
                            : emp.status}
                        </span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {emp.status !== 'Resign' && emp.status !== 'Resigned' && (
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Edit employee"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {emp.status !== 'Resign' && emp.status !== 'Resigned' && (
                          <button
                            onClick={() => setResetTarget(emp)}
                            className="p-2 text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Reset password"
                            aria-label={`Reset password for ${emp.name}`}
                          >
                            <KeyRound size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/60 rounded-lg transition-colors cursor-pointer"
                          title="Delete employee"
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

      {/* CREATE / REGISTER EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141722] rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">Create / Register New Employee</h3>
                  <p className="text-xs text-slate-400">Enter employee details to add them to the HR Admin system</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-red-950/40"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              {/* In-Modal Alert Banner for Duplicate Email or Code */}
              {(() => {
                const cleanTypedEmail = formData.email ? formData.email.trim().toLowerCase() : '';
                const isEmailDup = cleanTypedEmail !== '' && employees.some((e) => e.email && e.email.trim().toLowerCase() === cleanTypedEmail);
                const cleanTypedCode = formData.code ? formData.code.trim().toUpperCase() : '';
                const isCodeDup = cleanTypedCode !== '' && employees.some((e) => e.code && e.code.trim().toUpperCase() === cleanTypedCode);

                if (isEmailDup) {
                  return (
                    <div className="bg-red-950/90 border-2 border-red-500 rounded-2xl p-4 mb-1 flex items-start gap-3 shadow-xl text-red-100 animate-in fade-in zoom-in-95 duration-150">
                      <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-red-200">❌ This email cannot be used (duplicate email)</h4>
                        <p className="text-xs text-red-300 mt-1">
                          Email <strong className="font-mono text-white underline decoration-red-400">{formData.email}</strong> already exists in the database and cannot be reused. Please use a different email.
                        </p>
                      </div>
                    </div>
                  );
                }

                if (isCodeDup) {
                  return (
                    <div className="bg-red-950/90 border-2 border-red-500 rounded-2xl p-4 mb-1 flex items-start gap-3 shadow-xl text-red-100 animate-in fade-in zoom-in-95 duration-150">
                      <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-red-200">❌ This employee ID cannot be used (duplicate ID)</h4>
                        <p className="text-xs text-red-300 mt-1">
                          Employee ID <strong className="font-mono text-white underline decoration-red-400">{formData.code}</strong> already exists in the database and cannot be reused. Please use a different ID.
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Employee ID *</label>
                  {(() => {
                    const cleanTypedCode = formData.code ? formData.code.trim().toUpperCase() : '';
                    const isCodeDup = cleanTypedCode !== '' && employees.some((e) => e.code && e.code.trim().toUpperCase() === cleanTypedCode);
                    return (
                      <>
                        <input
                          type="text"
                          name="code"
                          value={formData.code}
                          onChange={handleInputChange}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                            isCodeDup
                              ? 'bg-red-950/60 border-red-500 text-red-100 ring-4 ring-red-500/30'
                              : 'bg-[#0B0D13] border-red-900/40 text-white focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20'
                          }`}
                          required
                        />
                        {isCodeDup && (
                          <p className="text-xs font-bold text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={13} />
                            <span>This employee ID is already in use</span>
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="e.g. Somchai"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="e.g. Jaidee"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Employee Email (required - used as app username) *</label>
                  {(() => {
                    const cleanTypedEmail = formData.email ? formData.email.trim().toLowerCase() : '';
                    const isDup = cleanTypedEmail !== '' && employees.some((e) => e.email && e.email.trim().toLowerCase() === cleanTypedEmail);
                    return (
                      <>
                        <input
                          type="email"
                          name="email"
                          placeholder="somchai@wellx989.com"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                            isDup
                              ? 'bg-red-950/60 border-red-500 text-red-100 ring-4 ring-red-500/30'
                              : 'bg-[#0B0D13] border-red-900/40 text-white focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20'
                          }`}
                          required
                        />
                        {isDup && (
                          <p className="text-xs font-bold text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={13} />
                            <span>This email is already in use</span>
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="081-234-5678"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Gender *</label>
                  <select
                    name="gender"
                    value={formData.gender || 'Male'}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  >
                    <option value="Male">👨 Male</option>
                    <option value="Female">👩 Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Department *</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  >
                    <option value="">-- Please select a department --</option>
                    {departments.map((d) => (
                      <option key={d.id || d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="text-xs text-amber-400 mt-1">
                      ⚠️ No departments yet. Please add one first under "Organization Structure ➔ Departments".
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                  >
                    <option value="Employee">👤 Employee (general staff - clock in, request leave)</option>
                    <option value="Boss">👔 Boss (line manager - approves staff in the same line)</option>
                    <option value="SuperBoss">👑 SuperBoss (top executive/CEO - approves managers of all lines)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Start Date</label>
                  <DatePicker
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                  />
                </div>

              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save and Create Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION POPUP MODAL (Anti-Double-Submit & Single-Click Protection) */}
      {showConfirmAddModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-800/60 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-red-900/30">
              <div className="p-3 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/50 flex-shrink-0">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Confirm Employee Creation</h3>
                <p className="text-xs text-slate-400">Review the details before sending the password setup email</p>
              </div>
            </div>

            {/* Summary Details */}
            <div className="bg-[#0B0D13] rounded-2xl p-4 border border-red-900/30 space-y-2.5 text-xs text-slate-300 mb-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Employee ID:</span>
                <span className="font-mono font-bold text-[#EF4444]">{formData.code}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Full Name:</span>
                <span className="font-bold text-white">{`${formData.firstName || ''} ${formData.lastName || ''}`.trim() || formData.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Email (Username):</span>
                <span className="font-semibold text-blue-400">{formData.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Department:</span>
                <span className="font-medium text-slate-200">{formData.department}</span>
              </div>
            </div>

            {/* Warning Callout */}
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 mb-6 text-xs text-red-200 flex items-start gap-2.5">
              <CheckCircle size={16} className="text-[#EF4444] flex-shrink-0 mt-0.5" />
              <span>
                On confirmation, the employee will be added to the database and a password setup email will be sent to <strong>{formData.email}</strong> immediately.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmAddModal(false)}
                className="px-4 py-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmCreateEmployee}
                className="px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-white" />
                    <span>Sending email...</span>
                  </>
                ) : (
                  <>
                    <Mail size={14} />
                    <span>Confirm and Send Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE EMAIL ALERT MODAL POPUP */}
      {showDuplicateEmailAlertModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-600/80 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-red-900/40">
              <div className="p-3 rounded-2xl bg-red-950/90 text-red-400 border border-red-700/60 flex-shrink-0">
                <AlertCircle size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Duplicate Email!</h3>
                <p className="text-xs text-red-300">This email cannot be registered</p>
              </div>
            </div>

            <div className="bg-red-950/50 rounded-2xl p-4 border border-red-800/60 text-xs text-red-200 leading-relaxed mb-5">
              Email <strong className="font-mono text-white underline decoration-red-400">{formData.email}</strong> already exists in the system, so a new employee cannot be created with the same email. Please use a different email.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDuplicateEmailAlertModal(false)}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
              >
                OK, Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE CODE ALERT MODAL POPUP */}
      {showDuplicateCodeAlertModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-600/80 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-red-900/40">
              <div className="p-3 rounded-2xl bg-red-950/90 text-red-400 border border-red-700/60 flex-shrink-0">
                <AlertCircle size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Duplicate Employee ID!</h3>
                <p className="text-xs text-red-300">This employee ID cannot be registered</p>
              </div>
            </div>

            <div className="bg-red-950/50 rounded-2xl p-4 border border-red-800/60 text-xs text-red-200 leading-relaxed mb-5">
              Employee ID <strong className="font-mono text-white underline decoration-red-400">{formData.code}</strong> already exists in the system, so a new employee cannot be created with the same ID. Please use a different ID.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDuplicateCodeAlertModal(false)}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
              >
                OK, Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141722] rounded-3xl max-w-xl w-full p-7 shadow-2xl border border-red-900/40 text-slate-100 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
                  <Edit size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">Edit Employee</h3>
                  <p className="text-xs text-slate-400">{formData.name} ({formData.code})</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-red-950/40"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Gender *</label>
                  <select
                    name="gender"
                    value={formData.gender || 'Male'}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  >
                    <option value="Male">👨 Male</option>
                    <option value="Female">👩 Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Department *</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                    required
                  >
                    <option value="">-- Please select a department --</option>
                    {departments.map((d) => (
                      <option key={d.id || d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="text-xs text-amber-400 mt-1">
                      ⚠️ No departments yet. Please add one first under "Organization Structure ➔ Departments".
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all cursor-pointer"
                  >
                    <option value="Employee">👤 Employee (general staff)</option>
                    <option value="Boss">👔 Boss (line manager)</option>
                    <option value="SuperBoss">👑 SuperBoss (top executive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all cursor-pointer"
                  >
                    <option value="Active">Active (currently employed)</option>
                    <option value="Inactive">Inactive (no longer active)</option>
                    <option value="Resign">Resign (resigned)</option>
                  </select>
                </div>

                <div>
                  {formData.status === 'Resign' || formData.status === 'Resigned' ? (
                    <>
                      <label className="block text-xs font-bold text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block"></span>
                        Resignation Date *
                      </label>
                      <DatePicker
                        name="resignDate"
                        value={formData.resignDate || formData.startDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          setFormData((prev) => ({
                            ...prev,
                            resignDate: e.target.value,
                          }));
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Start Date</label>
                      <DatePicker
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleInputChange}
                      />
                    </>
                  )}
                </div>

              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-red-900/30">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {/* RESET PASSWORD CONFIRMATION MODAL */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-amber-800/40 text-slate-100">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-950/80 text-amber-300 border border-amber-700/50 flex items-center justify-center shrink-0">
                <KeyRound size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wide">Reset Password</h3>
                <p className="text-xs text-slate-400 mt-0.5">Send a set-password link to this employee</p>
              </div>
            </div>

            <div className="bg-[#0B0D13] p-4 rounded-2xl border border-red-900/40 mb-6 flex flex-col gap-2.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Employee Name:</span>
                <span className="font-bold text-white text-sm">{resetTarget.name}</span>
              </div>
              <div className="flex items-center justify-between border-t border-red-900/20 pt-2">
                <span>Employee ID:</span>
                <span className="font-mono font-bold text-[#EF4444]">{resetTarget.code || resetTarget.id}</span>
              </div>
              <div className="flex items-center justify-between border-t border-red-900/20 pt-2">
                <span>Email:</span>
                <span className="font-semibold text-slate-200">{resetTarget.email || '-'}</span>
              </div>
              <p className="border-t border-red-900/20 pt-2.5 text-slate-300">
                The employee receives an email with a link (valid for 15 minutes) to set a new password in the app.
                Employees cannot reset their own password.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-red-900/20">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                disabled={resetting}
                className="px-5 py-2.5 rounded-xl border border-slate-700/60 bg-[#1E293B] hover:bg-slate-800 text-slate-300 font-bold text-sm transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#991B1B] hover:from-[#EF4444] hover:to-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/30 flex items-center gap-2 disabled:opacity-60"
              >
                <KeyRound size={16} />
                <span>{resetting ? 'Sending...' : 'Send reset link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-7 shadow-2xl border border-red-900/50 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Red Trash Icon */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-red-950/90 text-[#EF4444] border border-red-700/60 flex items-center justify-center shadow-lg shadow-red-950/60 shrink-0">
                <Trash2 size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wide">
                  Confirm Employee Deletion
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Confirmation Required</p>
              </div>
            </div>

            {/* Body/Description Box */}
            <div className="bg-[#0B0D13] p-4.5 rounded-2xl border border-red-900/40 mb-6 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Employee Name:</span>
                <span className="font-bold text-white text-sm">{selectedEmployee?.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-red-900/20 pt-2">
                <span>Employee ID / Code:</span>
                <span className="font-mono font-bold text-[#EF4444] text-xs bg-red-950/80 px-2 py-0.5 rounded border border-red-800/40">
                  {selectedEmployee?.code || selectedEmployee?.id}
                </span>
              </div>
              <div className="mt-1 pt-2.5 border-t border-red-900/30 text-xs text-red-300 font-semibold flex items-center gap-1.5">
                <AlertCircle size={15} className="text-[#EF4444] shrink-0" />
                <span>Warning: once confirmed, this employee's data cannot be recovered</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-red-900/20">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedEmployee(null);
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-700/60 bg-[#1E293B] hover:bg-slate-800 text-slate-300 font-bold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#991B1B] hover:from-[#EF4444] hover:to-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/40 transition-all uppercase tracking-wide flex items-center gap-2"
              >
                <Trash2 size={16} />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS TOGGLE CONFIRMATION MODAL */}
      {statusToggleTarget && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141722] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-900/40 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-red-900/30">
              <div
                className={`p-3 rounded-2xl border flex-shrink-0 ${
                  statusToggleTarget.nextStatus === 'Inactive'
                    ? 'bg-amber-950/90 text-amber-400 border-amber-700/60 shadow-lg shadow-amber-950/40'
                    : 'bg-emerald-950/90 text-emerald-400 border-emerald-700/60 shadow-lg shadow-emerald-950/40'
                }`}
              >
                {statusToggleTarget.nextStatus === 'Inactive' ? (
                  <Ban size={28} />
                ) : (
                  <CheckCircle size={28} />
                )}
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  {statusToggleTarget.nextStatus === 'Inactive'
                    ? 'Confirm deactivation (Inactive)?'
                    : 'Confirm account activation (Active)?'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Change the employee's system access status
                </p>
              </div>
            </div>

            {/* Employee Info Card */}
            <div className="bg-[#0B0D13] rounded-2xl p-4 border border-red-900/30 mb-5 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={
                    statusToggleTarget.emp.avatarUrl ||
                    (statusToggleTarget.emp.gender === 'Female'
                      ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120'
                      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120')
                  }
                  alt={statusToggleTarget.emp.name}
                  className="w-12 h-12 rounded-full object-cover border border-red-900/40"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-sm truncate">
                    {statusToggleTarget.emp.name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {statusToggleTarget.emp.code} • {statusToggleTarget.emp.email}
                  </div>
                </div>
              </div>

              {/* Status Transition Display */}
              <div className="flex items-center justify-between pt-2 border-t border-red-900/20 text-xs font-bold">
                <span className="text-slate-400">Current status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full ${
                    statusToggleTarget.emp.status === 'Active'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                      : 'bg-slate-900 text-slate-400 border border-slate-700'
                  }`}
                >
                  ● {statusToggleTarget.emp.status}
                </span>
                <span className="text-slate-500">➜</span>
                <span className="text-slate-400">New status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full ${
                    statusToggleTarget.nextStatus === 'Active'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500 shadow-sm'
                      : 'bg-amber-950 text-amber-400 border border-amber-600/70 shadow-sm'
                  }`}
                >
                  ● {statusToggleTarget.nextStatus}
                </span>
              </div>
            </div>

            {/* Warning / Notice Text */}
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              {statusToggleTarget.nextStatus === 'Inactive'
                ? '⚠️ Once set to Inactive, the employee cannot sign in to the WellX989 Mobile App until the account is reactivated.'
                : '✅ Once set to Active, the employee can sign in to the WellX989 Mobile App and clock in as normal.'}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-red-900/30">
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setStatusToggleTarget(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-700/60 bg-[#1E293B] hover:bg-slate-800 text-slate-300 font-bold text-sm transition-all"
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

