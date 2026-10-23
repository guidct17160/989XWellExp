import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  Briefcase,
  Layers,
  Building2,
  Clock,
  UserCheck,
  FileSpreadsheet,
  MapPin,
  Ban,
  Bell,
  ChevronDown,
  UserPlus,
  UserMinus,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Menu,
  X,
  Target,
  Gift
} from 'lucide-react';
import EmployeeManagement from './EmployeeManagement';
import OrgManagement from './OrgManagement';
import AdminManagement from './AdminManagement';
import AttendanceManagement from './AttendanceManagement';
import QuestManagement from './QuestManagement';
import WorkLocationsPage from './WorkLocationsPage';
import RewardManagement from './RewardManagement';
import RewardCategoriesPage from './RewardCategoriesPage';

// Standalone Sub-Menu Page Components
import PointsHistoryPage from './PointsHistoryPage';
import LeavePoliciesPage from './LeavePoliciesPage';
import AuditTrailLogsPage from './AuditTrailLogsPage';

import { API_BASE } from '../config';
import { MENU_PATHS, HOME_PATH, matchMenu, legacyTabPath } from '../routes';

export default function DashboardPage({ user, onLogout }) {
  const currentUser = user || (() => {
    try {
      const saved = localStorage.getItem('wellx989_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  })();
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  const [selectedYear, setSelectedYear] = useState('2026');

  // The open menu comes from the address bar (/employees, /rewards/categories, ...), see routes.js
  const location = useLocation();
  const navigate = useNavigate();
  const matched = matchMenu(location.pathname);
  const activeMenu = matched ? matched.menu : 'dashboard';

  const setActiveMenu = (menu) => {
    if (!menu) return;
    const base = MENU_PATHS[menu] || HOME_PATH;
    if (matched && matched.menu === menu) {
      // Re-selecting the current menu closes any open detail page (/departments/IT -> /departments)
      if (matched.detail) navigate(base, { replace: true });
      return;
    }
    navigate(base);
  };

  // Unknown address (/, an old /?tab=... bookmark, a typo) -> the matching page, or the Dashboard
  useEffect(() => {
    if (!matched) navigate(legacyTabPath(location.search) || HOME_PATH, { replace: true });
  }, [matched, location.search, navigate]);

  useEffect(() => {
    if (!isSuperAdmin && (activeMenu === 'admin' || activeMenu === 'audit-logs')) {
      navigate(HOME_PATH, { replace: true });
    }
  }, [isSuperAdmin, activeMenu, navigate]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({
    role: false,
    org: false,
    employee: false,
    attendance: false,
    approval: false,
    mission: false,
    reward: false,
  });

  const toggleMenu = (key) => {
    setExpandedMenus((prev) => ({
      role: false,
      org: false,
      employee: false,
      attendance: false,
      approval: false,
      mission: false,
      reward: false,
      ...(key ? { [key]: !prev[key] } : {}),
    }));
  };

  // Mouse Drag / Touch Swipe gesture handlers to pull out or swipe away sidebar menu
  const touchStartX = React.useRef(0);
  const touchStartY = React.useRef(0);
  const isPointerDown = React.useRef(false);

  const handlePointerDown = (clientX, clientY) => {
    touchStartX.current = clientX;
    touchStartY.current = clientY;
    isPointerDown.current = true;
  };

  const handlePointerUp = (clientX, clientY) => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    const diffX = clientX - touchStartX.current;
    const diffY = clientY - touchStartY.current;

    // Trigger swipe if horizontal drag is greater than vertical scroll
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 40) {
        // Dragged/Swiped Right -> Open Sidebar Drawer
        setIsMobileMenuOpen(true);
      } else if (diffX < -40 && isMobileMenuOpen) {
        // Dragged/Swiped Left -> Close Sidebar Drawer
        setIsMobileMenuOpen(false);
      }
    }
  };

  const [stats, setStats] = useState({
    totalEmployees: 0,
    newHires: 0,
    resigned: 0,
    passedProbation: 0,
  });
  const [employeesList, setEmployeesList] = useState([]);

  useEffect(() => {
    // Fetch live employee total from backend API (100% Real DB Data)
    fetch(`${API_BASE}/employees`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.employees)) {
          setEmployeesList(data.employees);
          const emps = data.employees;
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          let newHires = 0;
          let resigned = 0;
          let passedProbation = 0;

          emps.forEach((emp) => {
            const isResigned = emp.status === 'Resign' || emp.status === 'Resigned' || emp.status === 'Inactive';
            if (isResigned) {
              const exitDateStr = emp.resignDate || emp.resignationDate;
              if (exitDateStr) {
                const d = new Date(exitDateStr);
                if (!isNaN(d.getTime())) {
                  if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                    resigned++;
                  }
                } else {
                  resigned++;
                }
              } else {
                resigned++;
              }
            }
            if (emp.startDate && emp.status !== 'Resign' && emp.status !== 'Resigned') {
              const d = new Date(emp.startDate);
              if (!isNaN(d.getTime())) {
                const diffDays = (now - d) / (1000 * 60 * 60 * 24);
                // New hire: joined in the current calendar month (matches the card's date-range label)
                if (diffDays >= 0 && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                  newHires++;
                }
                // Passed probation: active and tenure >= 120 days
                if (diffDays >= 120 && emp.status === 'Active') {
                  passedProbation++;
                }
              }
            }
          });

          setStats({
            totalEmployees: emps.filter((e) => e.status !== 'Resign' && e.status !== 'Resigned' && e.status !== 'Inactive').length,
            newHires,
            resigned,
            passedProbation,
          });
        }
      })
      .catch((err) => console.log('Backend sync offline', err));
  }, [activeMenu]);

  // Bar Chart Data (Jan - Dec) dynamically computed from real employee startDate and resignDate
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const barData = React.useMemo(() => {
    const monthlyHires = new Array(12).fill(0);
    const monthlyExits = new Array(12).fill(0);

    employeesList.forEach((emp) => {
      if (emp.startDate && emp.status !== 'Resign' && emp.status !== 'Resigned') {
        const d = new Date(emp.startDate);
        if (!isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear) {
          const m = d.getMonth();
          if (m >= 0 && m < 12) {
            monthlyHires[m]++;
          }
        }
      }
      if (emp.status === 'Resign' || emp.status === 'Resigned' || emp.status === 'Inactive') {
        const exitDateStr = emp.resignDate || emp.resignationDate;
        if (exitDateStr) {
          const d = new Date(exitDateStr);
          if (!isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear) {
            const m = d.getMonth();
            if (m >= 0 && m < 12) {
              monthlyExits[m]++;
            }
          }
        } else if (selectedYear === String(new Date().getFullYear())) {
          monthlyExits[new Date().getMonth()]++;
        }
      }
    });

    return months.map((month, idx) => ({
      month,
      newHires: monthlyHires[idx],
      exits: monthlyExits[idx],
    }));
  }, [employeesList, selectedYear]);

  const renderNavLinks = () => (
    <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
      <button
        className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all text-left ${
          activeMenu === 'dashboard'
            ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
            : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
        }`}
        onClick={() => { setActiveMenu('dashboard'); toggleMenu(null); setIsMobileMenuOpen(false); }}
      >
        <LayoutDashboard size={18} />
        <span>Dashboard Overview</span>
      </button>

      {/* 1. Role & Permission (Only visible to Super Admin - Completely hidden for HR Admin) */}
      {isSuperAdmin && (
        <div>
          <button
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
              ['admin', 'audit-logs'].includes(activeMenu)
                ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
                : expandedMenus.role
                ? 'bg-red-900/60 text-white border border-red-700/60'
                : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
            }`}
            onClick={() => {
              toggleMenu('role');
            }}
          >
            <div className="flex items-center gap-3.5">
              <ShieldCheck size={18} />
              <span>Role & Permission</span>
            </div>
            <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${expandedMenus.role ? 'rotate-180 text-red-400' : 'text-slate-500'}`} />
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expandedMenus.role ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="ml-5 pl-3 border-l-2 border-red-600/50 space-y-1 text-xs font-semibold py-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveMenu('admin'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    activeMenu === 'admin' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span>Administrators & Roles</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveMenu('audit-logs'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    activeMenu === 'audit-logs' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span>Security & Audit Logs (PDPA)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Organization */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['department'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : expandedMenus.org
                ? 'bg-red-900/60 text-white border border-red-700/60'
                : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('org');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Building2 size={18} />
            <span>Organization</span>
          </div>
          <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${expandedMenus.org ? 'rotate-180 text-red-400' : 'text-slate-500'}`} />
        </button>
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            expandedMenus.org ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="ml-5 pl-3 border-l-2 border-red-600/50 space-y-1 text-xs font-semibold py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('department'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'department' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Main Departments</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Employee & Point */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['all-employee', 'points'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : expandedMenus.employee
                ? 'bg-red-900/60 text-white border border-red-700/60'
                : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('employee');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Users size={18} />
            <span>Employee & Point</span>
          </div>
          <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${expandedMenus.employee ? 'rotate-180 text-red-400' : 'text-slate-500'}`} />
        </button>
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            expandedMenus.employee ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="ml-5 pl-3 border-l-2 border-red-600/50 space-y-1 text-xs font-semibold py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('all-employee'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'all-employee' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>All Employees Directory</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('points'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'points' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Points Balance & History</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Attendance */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['attendance', 'work-locations'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : expandedMenus.attendance
                ? 'bg-red-900/60 text-white border border-red-700/60'
                : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('attendance');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Clock size={18} />
            <span>Attendance</span>
          </div>
          <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${expandedMenus.attendance ? 'rotate-180 text-red-400' : 'text-slate-500'}`} />
        </button>
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            expandedMenus.attendance ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="ml-5 pl-3 border-l-2 border-red-600/50 space-y-1 text-xs font-semibold py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('attendance'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'attendance' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Daily Attendance & GPS Logs</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('work-locations'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'work-locations' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Work Locations</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Leave & Policies */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            activeMenu === 'leave-policy'
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : expandedMenus.approval
                ? 'bg-red-900/60 text-white border border-red-700/60'
                : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('approval');
          }}
        >
          <div className="flex items-center gap-3.5">
            <UserCheck size={18} />
            <span>Leave & Policies</span>
          </div>
          <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${expandedMenus.approval ? 'rotate-180 text-red-400' : 'text-slate-500'}`} />
        </button>
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            expandedMenus.approval ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="ml-5 pl-3 border-l-2 border-red-600/50 space-y-1 text-xs font-semibold py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('leave-policy'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'leave-policy' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Leave Quotas & Policies</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Mission */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            activeMenu === 'mission'
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : expandedMenus.mission
                ? 'bg-red-900/60 text-white border border-red-700/60'
                : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('mission');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Target size={18} />
            <span>Mission</span>
          </div>
          <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${expandedMenus.mission ? 'rotate-180 text-red-400' : 'text-slate-500'}`} />
        </button>
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            expandedMenus.mission ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="ml-5 pl-3 border-l-2 border-red-600/50 space-y-1 text-xs font-semibold py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('mission'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'mission' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Quest Management</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Reward */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['reward', 'reward-categories'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : expandedMenus.reward
                ? 'bg-red-900/60 text-white border border-red-700/60'
                : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('reward');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Gift size={18} />
            <span>Reward</span>
          </div>
          <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${expandedMenus.reward ? 'rotate-180 text-red-400' : 'text-slate-500'}`} />
        </button>
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            expandedMenus.reward ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="ml-5 pl-3 border-l-2 border-red-600/50 space-y-1 text-xs font-semibold py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('reward'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'reward' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Rewards Catalog & Inventory</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('reward-categories'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'reward-categories' ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Reward Categories</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div 
      className="flex min-h-screen bg-[#0B0D13] text-slate-100 font-sans antialiased"
      onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
      onMouseUp={(e) => handlePointerUp(e.clientX, e.clientY)}
      onTouchStart={(e) => handlePointerDown(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={(e) => handlePointerUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
    >
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Overlay */}
      <aside className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-gradient-to-b from-[#991B1B] via-[#7F1D1D] to-[#0B0D13] text-white flex flex-col p-4 border-r border-red-900/30 transition-transform duration-300 lg:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center">
            <img src="/logo.png" alt="WellX989" className="h-9 w-auto object-contain drop-shadow" />
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-red-950/60 border border-red-800/40"
          >
            <X size={20} />
          </button>
        </div>

        {renderNavLinks()}

        <div className="mt-auto pt-4 flex flex-col gap-2">
          

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs text-red-400 hover:bg-red-950/60 hover:text-red-300 border border-red-900/30 bg-[#0B0D13]/50 transition-all text-left"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-gradient-to-b from-[#991B1B] via-[#7F1D1D] to-[#0B0D13] text-white flex-col p-4 flex-shrink-0 border-r border-red-900/30">
        {/* Brand Header */}
        <div className="mb-6 px-1 flex items-center justify-center">
          <img src="/logo.png" alt="WellX989" className="h-14 w-auto object-contain drop-shadow-md" />
        </div>

        {renderNavLinks()}

        {/* Sidebar Footer Package Badge & Logout */}
        <div className="mt-auto pt-4 flex flex-col gap-2">
          

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs text-red-400 hover:bg-red-950/60 hover:text-red-300 border border-red-900/30 bg-[#0B0D13]/50 transition-all text-left"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-[#141722] border-b border-red-900/30 flex items-center justify-between px-4 sm:px-8 shadow-md z-10">
          <div className="flex items-center gap-2.5 text-slate-400 font-medium text-xs sm:text-sm">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-300 hover:text-white rounded-lg bg-red-950/40 border border-red-900/40 mr-1"
              title="Open Menu"
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {/* Notification Bell */}
            <button className="relative p-2 rounded-full text-slate-400 hover:text-white hover:bg-red-950/40 transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#DC2626] rounded-full ring-2 ring-[#141722]" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 bg-[#0B0D13] hover:bg-red-950/30 border border-red-900/40 rounded-full pl-1.5 pr-2.5 py-1 transition-all"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-950 text-red-400 border border-red-700/50 flex items-center justify-center text-xs font-black shrink-0">
                  {String(currentUser?.name || currentUser?.username || 'A').trim().charAt(0).toUpperCase()}
                </div>
                <span className="text-xs sm:text-sm font-semibold text-slate-200 hidden sm:inline">{currentUser?.name || currentUser?.username || 'Admin'}</span>
                <ChevronDown size={16} className="text-slate-400" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#141722] rounded-xl shadow-2xl border border-red-900/40 p-1.5 z-50">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:bg-red-950/50 text-sm font-bold transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main key={activeMenu} className="p-4 sm:p-8 flex-1 animate-fade-in-up">
          {activeMenu === 'admin' ? (
            <AdminManagement isSuperAdmin={isSuperAdmin} currentUser={currentUser} />
          ) : activeMenu === 'audit-logs' ? (
            <AuditTrailLogsPage />
          ) : activeMenu === 'department' ? (
            <OrgManagement type="department" />
          ) : activeMenu === 'all-employee' ? (
            <EmployeeManagement />
          ) : activeMenu === 'points' ? (
            <PointsHistoryPage />
          ) : activeMenu === 'attendance' ? (
            <AttendanceManagement />
          ) : activeMenu === 'work-locations' ? (
            <WorkLocationsPage />
          ) : activeMenu === 'leave-policy' ? (
            <LeavePoliciesPage />
          ) : activeMenu === 'mission' ? (
            <QuestManagement />
          ) : activeMenu === 'reward' ? (
            <RewardManagement />
          ) : activeMenu === 'reward-categories' ? (
            <RewardCategoriesPage />
          ) : (
            <>
              {/* Dashboard Overview */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide">Dashboard Overview</h1>
              </div>

              {/* Row 1: 4 Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-7">
                {/* Card 1: Active Employees */}
                <div className="bg-[#141722] rounded-2xl p-5 shadow-lg border border-red-900/30 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Active Employees</span>
                      <div className="text-3xl font-black text-[#EF4444] mt-7">
                        {stats.totalEmployees} <span className="text-xs font-normal text-slate-400">people</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center text-[#EF4444]">
                      <Users size={22} />
                    </div>
                  </div>
                  
                </div>

                {/* Card 2: New Hires */}
                <div className="bg-[#141722] rounded-2xl p-5 shadow-lg border border-red-900/30 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">New Employee</span>
                      
                      <div className="text-3xl font-black text-white mt-6">
                        {stats.newHires} <span className="text-xs font-normal text-slate-400">people</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center text-red-400">
                      <UserPlus size={22} />
                    </div>
                  </div>
                </div>

                {/* Card 3: Resigned */}
                <div className="bg-[#141722] rounded-2xl p-5 shadow-lg border border-red-900/30 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Employee leaves</span>
                      
                      <div className="text-3xl font-black text-[#F59E0B] mt-6">
                        {stats.resigned} <span className="text-xs font-normal text-slate-400">people</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-500">
                      <UserMinus size={22} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Charts Section */}
              <div className="bg-[#141722] rounded-2xl p-6 shadow-lg border border-red-900/30 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">Employee Hires and Exits Report</h3>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-[#0B0D13] border border-red-900/40 rounded-full px-4 py-1 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>

                {/* Bar Chart Plot */}
                <div className="flex gap-4 h-60 mb-4">
                  <div className="flex flex-col justify-between text-xs text-slate-500 pb-6 font-mono">
                    <span>50</span>
                    <span>40</span>
                    <span>30</span>
                    <span>20</span>
                    <span>10</span>
                    <span>0</span>
                  </div>

                  <div className="flex-1 relative flex flex-col justify-end">
                    <div className="absolute inset-0 pb-6 flex flex-col justify-between pointer-events-none">
                      <div className="border-b border-dashed border-red-950/60 w-full" />
                      <div className="border-b border-dashed border-red-950/60 w-full" />
                      <div className="border-b border-dashed border-red-950/60 w-full" />
                      <div className="border-b border-dashed border-red-950/60 w-full" />
                      <div className="border-b border-dashed border-red-950/60 w-full" />
                      <div className="border-b border-dashed border-red-950/60 w-full" />
                    </div>

                    <div className="relative z-10 flex justify-between items-end h-full pb-6">
                      {barData.map((item, index) => {
                        const newHiresHeight = Math.min((item.newHires / 50) * 100, 100);
                        const exitsHeight = Math.min((item.exits / 50) * 100, 100);
                        return (
                          <div key={index} className="flex flex-col items-center h-full justify-end flex-1">
                            <div className="flex gap-1 items-end h-[calc(100%-20px)]">
                              {item.newHires > 0 && (
                                <div
                                  className="w-3.5 bg-[#DC2626] rounded-t-md transition-all duration-500 shadow-md shadow-red-600/50"
                                  style={{ height: `${newHiresHeight}%` }}
                                  title={`New hires: ${item.newHires}`}
                                />
                              )}
                              {item.exits > 0 && (
                                <div
                                  className="w-3.5 bg-amber-500 rounded-t-md transition-all duration-500"
                                  style={{ height: `${exitsHeight}%` }}
                                  title={`Exits: ${item.exits}`}
                                />
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 mt-2 font-mono">{item.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Bar Chart Legend */}
                <div className="flex justify-center gap-6 mt-auto">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#DC2626]" />
                    <span>New Employees</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                    <span>Employee Leavers</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
