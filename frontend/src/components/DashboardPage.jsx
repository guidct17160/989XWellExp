import React, { useState, useEffect } from 'react';
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
import MissionManagement from './MissionManagement';
import RewardManagement from './RewardManagement';

// Standalone Sub-Menu Page Components
import PositionsPage from './PositionsPage';
import PointsHistoryPage from './PointsHistoryPage';
import PayslipsPage from './PayslipsPage';
import LeavePoliciesPage from './LeavePoliciesPage';
import AuditTrailLogsPage from './AuditTrailLogsPage';
import ApprovalManagement from './ApprovalManagement';
import OvertimePage from './OvertimePage';
import TimeCorrectionsPage from './TimeCorrectionsPage';
import SectionsPage from './SectionsPage';
import EmployeeGroupsPage from './EmployeeGroupsPage';
import KpiEvaluationPage from './KpiEvaluationPage';

const API_BASE = 'http://localhost:5000/api';

export default function DashboardPage({ user, onLogout }) {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [activeMenu, setActiveMenuState] = useState('dashboard');

  const setActiveMenu = (menu) => {
    setActiveMenuState(menu);
    try {
      localStorage.setItem('wellx989_active_menu', menu);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', menu);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  };
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
            if (emp.status === 'Resigned' || emp.status === 'Inactive') {
              resigned++;
            }
            if (emp.startDate) {
              const d = new Date(emp.startDate);
              if (!isNaN(d.getTime())) {
                const diffDays = (now - d) / (1000 * 60 * 60 * 24);
                // New hire: joined within last 30 days or in current month
                if (diffDays >= 0 && (diffDays <= 30 || (d.getMonth() === currentMonth && d.getFullYear() === currentYear))) {
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
            totalEmployees: emps.length,
            newHires,
            resigned,
            passedProbation,
          });
        }
      })
      .catch((err) => console.log('Backend sync offline', err));
  }, [activeMenu]);

  // Bar Chart Data (Jan - Dec) dynamically computed from real employee startDate
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const barData = React.useMemo(() => {
    const monthlyHires = new Array(12).fill(0);
    const monthlyExits = new Array(12).fill(0);

    employeesList.forEach((emp) => {
      if (emp.startDate) {
        const d = new Date(emp.startDate);
        if (!isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear) {
          const m = d.getMonth();
          if (m >= 0 && m < 12) {
            monthlyHires[m]++;
          }
        }
      }
      if (emp.status === 'Resigned') {
        monthlyExits[new Date().getMonth()]++;
      }
    });

    return months.map((month, idx) => ({
      month,
      newHires: monthlyHires[idx],
      exits: monthlyExits[idx],
    }));
  }, [employeesList, selectedYear]);

  // Tenure Donut Data dynamically computed from real employee tenure in DB
  const tenureData = React.useMemo(() => {
    const now = new Date();
    let less120 = 0;
    let b120To1y = 0;
    let b1yTo3y = 0;
    let b3yTo6y = 0;
    let b6yTo10y = 0;
    let over10y = 0;

    employeesList.forEach((emp) => {
      const d = emp.startDate ? new Date(emp.startDate) : null;
      if (d && !isNaN(d.getTime())) {
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        if (diffDays < 120) less120++;
        else if (diffDays < 365) b120To1y++;
        else if (diffDays < 365 * 3) b1yTo3y++;
        else if (diffDays < 365 * 6) b3yTo6y++;
        else if (diffDays < 365 * 10) b6yTo10y++;
        else over10y++;
      } else {
        less120++;
      }
    });

    return [
      { label: 'อายุงานน้อยกว่า 120 วัน', count: less120, color: '#F0A925' },
      { label: 'อายุงาน 120 วัน - 1 ปี', count: b120To1y, color: '#3AAAEB' },
      { label: 'อายุงาน 1 ปี - 3 ปี', count: b1yTo3y, color: '#1F4E9C' },
      { label: 'อายุงาน 3 ปี - 6 ปี', count: b3yTo6y, color: '#0284C7' },
      { label: 'อายุงาน 6 ปี - 10 ปี', count: b6yTo10y, color: '#818CF8' },
      { label: 'อายุงาน 10 ปี ขึ้นไป', count: over10y, color: '#F97316' },
    ];
  }, [employeesList]);

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

      {/* 1. Role & Permission */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['admin', 'audit-logs'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('role');
          }}
        >
          <div className="flex items-center gap-3.5">
            <ShieldCheck size={18} />
            <span>1. Role & Permission</span>
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
                  activeMenu === 'admin' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Administrators & Roles</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('audit-logs'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'audit-logs' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Security & Audit Logs (PDPA)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Organization */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['department', 'position', 'section', 'group'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('org');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Building2 size={18} />
            <span>2. Organization</span>
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
                  activeMenu === 'department' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Main Departments</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('position'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'position' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Job Positions</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('section'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'section' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Sections (แผนกย่อย)</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('group'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'group' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Employee Groups (กลุ่มพนักงาน)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Employee & Point */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['all-employee', 'points', 'payslips', 'kpi'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('employee');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Users size={18} />
            <span>3. Employee & Point</span>
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
                  activeMenu === 'all-employee' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>All Employees Directory</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('points'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'points' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Points Balance & History</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('payslips'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'payslips' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Electronic Payslips</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('kpi'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'kpi' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>KPI & Evaluation</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Attendance */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['attendance', 'overtime', 'corrections'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('attendance');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Clock size={18} />
            <span>4. Attendance</span>
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
                  activeMenu === 'attendance' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Daily Attendance & GPS Logs</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('overtime'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'overtime' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Overtime (OT) Records</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('corrections'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'corrections' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Time Correction Requests</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Leave & Policies */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            ['leave-policy', 'approvals'].includes(activeMenu)
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('approval');
          }}
        >
          <div className="flex items-center gap-3.5">
            <UserCheck size={18} />
            <span>5. Leave & Policies</span>
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
                  activeMenu === 'leave-policy' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Leave Quotas & Policies</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu('approvals'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === 'approvals' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Approvals Workflow Center</span>
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
              : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('mission');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Target size={18} />
            <span>6. Mission</span>
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
                  activeMenu === 'mission' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Step Challenges & Health Missions</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Reward */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
            activeMenu === 'reward'
              ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/40 border border-red-500/50'
              : 'text-slate-300 hover:bg-red-950/40 hover:text-white'
          }`}
          onClick={() => {
            toggleMenu('reward');
          }}
        >
          <div className="flex items-center gap-3.5">
            <Gift size={18} />
            <span>7. Reward</span>
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
                  activeMenu === 'reward' ? 'text-white bg-red-900/40 border border-red-800/40 shadow-sm font-bold scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-red-950/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>Rewards Catalog & Inventory</span>
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
          <div className="bg-[#0B0D13]/80 backdrop-blur-md rounded-xl p-3 flex flex-col gap-1 border border-red-900/30">
            <span className="text-[10px] text-red-400 uppercase tracking-wider font-extrabold">Tactical Suite</span>
            <span className="text-xs font-semibold text-slate-200 leading-tight">
              WellX989 HR Solution + 989Velaa Plus(Full)
            </span>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs text-red-400 hover:bg-red-950/60 hover:text-red-300 border border-red-900/30 bg-[#0B0D13]/50 transition-all text-left"
          >
            <LogOut size={16} />
            <span>ออกจากระบบ (Logout)</span>
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
          <div className="bg-[#0B0D13]/80 backdrop-blur-md rounded-xl p-3.5 flex flex-col gap-1 border border-red-900/30">
            <span className="text-[11px] text-red-400 uppercase tracking-wider font-extrabold">Tactical Suite</span>
            <span className="text-xs font-semibold text-slate-200 leading-tight">
              WellX989 HR Solution + 989Velaa Plus(Full)
            </span>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs text-red-400 hover:bg-red-950/60 hover:text-red-300 border border-red-900/30 bg-[#0B0D13]/50 transition-all text-left"
          >
            <LogOut size={16} />
            <span>ออกจากระบบ (Logout)</span>
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
            <LayoutDashboard size={18} className="text-[#EF4444] shrink-0" />
            <span className="capitalize font-bold text-slate-200 truncate">
              War Command Suite / {activeMenu.replace('-', ' ')}
            </span>
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
                  สม
                </div>
                <span className="text-xs sm:text-sm font-semibold text-slate-200 hidden sm:inline">{user?.username || 'สมชาย ใจดี (Admin)'}</span>
                <ChevronDown size={16} className="text-slate-400" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#141722] rounded-xl shadow-2xl border border-red-900/40 p-1.5 z-50">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:bg-red-950/50 text-sm font-bold transition-colors"
                  >
                    <LogOut size={16} />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main key={activeMenu} className="p-4 sm:p-8 flex-1 animate-fade-in-up">
          {activeMenu === 'admin' ? (
            <AdminManagement />
          ) : activeMenu === 'audit-logs' ? (
            <AuditTrailLogsPage />
          ) : activeMenu === 'department' ? (
            <OrgManagement type="department" />
          ) : activeMenu === 'position' ? (
            <PositionsPage />
          ) : activeMenu === 'section' ? (
            <SectionsPage />
          ) : activeMenu === 'group' ? (
            <EmployeeGroupsPage />
          ) : activeMenu === 'all-employee' ? (
            <EmployeeManagement />
          ) : activeMenu === 'points' ? (
            <PointsHistoryPage />
          ) : activeMenu === 'payslips' ? (
            <PayslipsPage />
          ) : activeMenu === 'kpi' ? (
            <KpiEvaluationPage />
          ) : activeMenu === 'attendance' ? (
            <AttendanceManagement />
          ) : activeMenu === 'overtime' ? (
            <OvertimePage />
          ) : activeMenu === 'corrections' ? (
            <TimeCorrectionsPage />
          ) : activeMenu === 'leave-policy' ? (
            <LeavePoliciesPage />
          ) : activeMenu === 'approvals' ? (
            <ApprovalManagement />
          ) : activeMenu === 'mission' ? (
            <MissionManagement />
          ) : activeMenu === 'reward' ? (
            <RewardManagement />
          ) : (
            <>
              {/* Dashboard Overview */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide">รายงานข้อมูลพนักงานเดือนนี้ (Command Dashboard)</h1>
                <button
                  onClick={() => setActiveMenu('all-employee')}
                  className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide shrink-0"
                >
                  <UserPlus size={16} />
                  <span>สร้าง/สมัครพนักงานใหม่</span>
                </button>
              </div>

              {/* Row 1: 4 Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
                {/* Card 1: Active Employees */}
                <div className="bg-[#141722] rounded-2xl p-5 shadow-lg border border-red-900/30 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Active Employees</span>
                      <div className="text-3xl font-black text-[#EF4444] mt-2">
                        {stats.totalEmployees} <span className="text-xs font-normal text-slate-400">คน</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center text-[#EF4444]">
                      <Users size={22} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-block text-[11px] text-slate-400 bg-[#0B0D13] px-2.5 py-1 rounded-full border border-red-900/30 font-mono">
                      LIVE BACKEND API SYNC
                    </span>
                  </div>
                </div>

                {/* Card 2: New Hires */}
                <div className="bg-[#141722] rounded-2xl p-5 shadow-lg border border-red-900/30 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">พนักงานเข้าใหม่</span>
                      <span className="text-[11px] text-slate-500 block mb-1">1 - 31 August 2026</span>
                      <div className="text-3xl font-black text-white mt-1">
                        {stats.newHires} <span className="text-xs font-normal text-slate-400">คน</span>
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
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1">พนักงานออกภายในเดือน</span>
                      <div className="text-3xl font-black text-[#F59E0B] mt-2">
                        {stats.resigned} <span className="text-xs font-normal text-slate-400">คน</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-500">
                      <UserMinus size={22} />
                    </div>
                  </div>
                </div>

                {/* Card 4: Passed Probation */}
                <div className="bg-[#141722] rounded-2xl p-5 shadow-lg border border-red-900/30 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">ผ่านทดลองงานภายในเดือน</span>
                      <span className="text-[11px] text-slate-500 block mb-1">August 2026</span>
                      <div className="text-3xl font-black text-emerald-400 mt-1">
                        {stats.passedProbation} <span className="text-xs font-normal text-slate-400">คน</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                      <UserCheck size={22} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart 1: Bar Chart (Employee Turnover) */}
                <div className="lg:col-span-2 bg-[#141722] rounded-2xl p-6 shadow-lg border border-red-900/30 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-base font-bold text-white uppercase tracking-wider">รายงานพนักงานเข้าออก</h3>
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
                          const newHiresHeight = (item.newHires / 50) * 100;
                          const exitsHeight = (item.exits / 50) * 100;
                          return (
                            <div key={index} className="flex flex-col items-center h-full justify-end flex-1">
                              <div className="flex gap-1 items-end h-[calc(100%-20px)]">
                                {item.newHires > 0 && (
                                  <div
                                    className="w-3.5 bg-[#DC2626] rounded-t-md transition-all duration-500 shadow-md shadow-red-600/50"
                                    style={{ height: `${newHiresHeight}%` }}
                                    title={`เข้าใหม่: ${item.newHires} คน`}
                                  />
                                )}
                                {item.exits > 0 && (
                                  <div
                                    className="w-3.5 bg-amber-500 rounded-t-md transition-all duration-500"
                                    style={{ height: `${exitsHeight}%` }}
                                    title={`ออก: ${item.exits} คน`}
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
                      <span>จำนวนพนักงานเข้าใหม่</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                      <span>จำนวนพนักงานออก</span>
                    </div>
                  </div>
                </div>

                {/* Chart 2: Donut Chart (Employee Tenure) */}
                <div className="bg-[#141722] rounded-2xl p-6 shadow-lg border border-red-900/30 flex flex-col">
                  <h3 className="text-base font-bold text-white uppercase tracking-wider mb-4">รายงานกลุ่มพนักงานตามอายุงาน</h3>

                  {/* Donut Graphic */}
                  <div className="relative flex justify-center items-center my-4">
                    <svg width="190" height="190" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r="75" fill="none" stroke="#1A1E2C" strokeWidth="24" />
                      <circle
                        cx="100"
                        cy="100"
                        r="75"
                        fill="none"
                        stroke="#DC2626"
                        strokeWidth="24"
                        strokeDasharray="410 60"
                        strokeDashoffset="75"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="100"
                        cy="100"
                        r="75"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="24"
                        strokeDasharray="40 430"
                        strokeDashoffset="-340"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="100"
                        cy="100"
                        r="75"
                        fill="none"
                        stroke="#991B1B"
                        strokeWidth="24"
                        strokeDasharray="10 460"
                        strokeDashoffset="-385"
                      />
                    </svg>

                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-white leading-none">
                        {stats.totalEmployees}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">people</span>
                    </div>
                  </div>

                  {/* Tenure Breakdown List */}
                  <div className="flex flex-col gap-2.5 mt-2">
                    {tenureData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color === '#3AAAEB' || item.color === '#1F4E9C' ? '#DC2626' : item.color }} />
                          <span className="text-slate-300 font-medium">{item.label}</span>
                        </div>
                        <span className="text-slate-500 font-mono">{item.count} people</span>
                      </div>
                    ))}
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
