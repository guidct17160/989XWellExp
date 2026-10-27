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
  Gift,
  Megaphone
} from 'lucide-react';
import EmployeeManagement from './EmployeeManagement';
import OrgManagement from './OrgManagement';
import AdminManagement from './AdminManagement';
import AttendanceManagement from './AttendanceManagement';
import QuestManagement from './QuestManagement';
import WorkLocationsPage from './WorkLocationsPage';
import WorkTimeSettingsPage from './WorkTimeSettingsPage';
import AnnouncementsPage from './AnnouncementsPage';
import RewardManagement from './RewardManagement';
import RewardCategoriesPage from './RewardCategoriesPage';

// Standalone Sub-Menu Page Components
import PointsHistoryPage from './PointsHistoryPage';
import LeavePoliciesPage from './LeavePoliciesPage';
import AuditTrailLogsPage from './AuditTrailLogsPage';

import { API_BASE } from '../config';
import { MENU_PATHS, HOME_PATH, matchMenu, movedPath, legacyTabPath } from '../routes';

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
  const moved = movedPath(location.pathname); // an old address of a page that now lives under Settings
  const matched = moved ? null : matchMenu(location.pathname);
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
    if (moved) navigate(moved, { replace: true });
    else if (!matched) navigate(legacyTabPath(location.search) || HOME_PATH, { replace: true });
  }, [moved, matched, location.search, navigate]);

  useEffect(() => {
    if (!isSuperAdmin && (activeMenu === 'admin' || activeMenu === 'audit-logs')) {
      navigate(HOME_PATH, { replace: true });
    }
  }, [isSuperAdmin, activeMenu, navigate]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const MENU_GROUPS = ['role', 'org', 'employee', 'mission', 'reward', 'settings'];
  const [expandedMenus, setExpandedMenus] = useState(() => Object.fromEntries(MENU_GROUPS.map((k) => [k, false])));

  // Only one group is open at a time; toggleMenu(null) closes them all
  const toggleMenu = (key) => {
    setExpandedMenus((prev) => ({
      ...Object.fromEntries(MENU_GROUPS.map((k) => [k, false])),
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

  const ACTIVE_ITEM = 'bg-white text-[#2563EB] shadow-lg shadow-blue-900/20 border border-white';

  // A menu without sub-items
  const navSingle = (menu, Icon, label) => (
    <button
      key={menu}
      className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all text-left ${
        activeMenu === menu ? ACTIVE_ITEM : 'text-white/90 hover:bg-white/15 hover:text-white'
      }`}
      onClick={() => { setActiveMenu(menu); toggleMenu(null); setIsMobileMenuOpen(false); }}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  // A menu that opens a list of sub-items: items = [{ menu, label }]
  const navGroup = (key, Icon, label, items) => (
    <div key={key}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 text-left ${
          items.some((i) => i.menu === activeMenu)
            ? ACTIVE_ITEM
            : expandedMenus[key]
              ? 'bg-white/15 text-white border border-white/20'
              : 'text-white/90 hover:bg-white/15 hover:text-white'
        }`}
        onClick={() => toggleMenu(key)}
      >
        <div className="flex items-center gap-3.5">
          <Icon size={18} />
          <span>{label}</span>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-300 ease-out ${expandedMenus[key] ? 'rotate-180 text-white' : 'text-white/70'}`} />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          expandedMenus[key] ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="ml-5 pl-3 border-l-2 border-white/40 space-y-1 text-xs font-semibold py-1">
            {items.map((item) => (
              <button
                key={item.menu}
                onClick={(e) => { e.stopPropagation(); setActiveMenu(item.menu); setIsMobileMenuOpen(false); }}
                className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeMenu === item.menu ? 'text-white bg-white/15 border border-white/30 shadow-sm font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Order: daily work first, rarely changed things (Organization, Settings, Role & Permission) at the bottom
  const renderNavLinks = () => (
    <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
      {navSingle('dashboard', LayoutDashboard, 'Dashboard Overview')}
      {navGroup('employee', Users, 'Employee & Point', [
        { menu: 'all-employee', label: 'All Employees Directory' },
        { menu: 'points', label: 'Points Balance & History' },
      ])}
      {navSingle('attendance', Clock, 'Attendance')}
      {navGroup('mission', Target, 'Mission', [{ menu: 'mission', label: 'Quest Management' }])}
      {navGroup('reward', Gift, 'Reward', [
        { menu: 'reward', label: 'Rewards Catalog & Inventory' },
        { menu: 'reward-categories', label: 'Reward Categories' },
      ])}
      {/* Announcements (company news shown in the employee app) */}
      {navSingle('announcements', Megaphone, 'Announcements')}
      {navGroup('org', Building2, 'Organization', [{ menu: 'department', label: 'Main Departments' }])}
      {navGroup('settings', Settings, 'Settings', [
        { menu: 'attendance-settings', label: 'Work Time Settings' },
        { menu: 'work-locations', label: 'Work Locations' },
        { menu: 'leave-policy', label: 'Leave Quotas & Policies' },
      ])}
      {/* Only visible to Super Admin - completely hidden for HR Admin */}
      {isSuperAdmin &&
        navGroup('role', ShieldCheck, 'Role & Permission', [
          { menu: 'admin', label: 'Administrators & Roles' },
          { menu: 'audit-logs', label: 'Security & Audit Logs (PDPA)' },
        ])}
    </nav>
  );

  return (
    <div 
      className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased"
      onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
      onMouseUp={(e) => handlePointerUp(e.clientX, e.clientY)}
      onTouchStart={(e) => handlePointerDown(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={(e) => handlePointerUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
    >
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Overlay */}
      <aside className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#3B82F6] text-white flex flex-col p-4 border-r border-blue-400/40 transition-transform duration-300 lg:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center">
            <img src="/logo.png" alt="WellX989" className="h-9 w-auto object-contain brightness-0 invert" />
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-white bg-white/15 border border-white/30"
          >
            <X size={20} />
          </button>
        </div>

        {renderNavLinks()}

        <div className="mt-auto pt-4 flex flex-col gap-2">
          

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs text-white hover:bg-white/20 border border-white/40 bg-white/10 transition-all text-left"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#3B82F6] text-white flex-col p-4 flex-shrink-0 border-r border-blue-400/40">
        {/* Brand Header */}
        <div className="mb-6 px-1 flex items-center justify-center">
          <img src="/logo.png" alt="WellX989" className="h-14 w-auto object-contain brightness-0 invert" />
        </div>

        {renderNavLinks()}

        {/* Sidebar Footer Package Badge & Logout */}
        <div className="mt-auto pt-4 flex flex-col gap-2">
          

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs text-white hover:bg-white/20 border border-white/40 bg-white/10 transition-all text-left"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shadow-md z-10">
          <div className="flex items-center gap-2.5 text-slate-500 font-medium text-xs sm:text-sm">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-700 hover:text-slate-900 rounded-lg bg-violet-50 border border-slate-200 mr-1"
              title="Open Menu"
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {/* Notification Bell */}
            <button className="relative p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-violet-50 transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#7C3AED] rounded-full ring-2 ring-white" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 bg-slate-50 hover:bg-violet-50 border border-slate-200 rounded-full pl-1.5 pr-2.5 py-1 transition-all"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-violet-100 text-violet-600 border border-violet-300 flex items-center justify-center text-xs font-black shrink-0">
                  {String(currentUser?.name || currentUser?.username || 'A').trim().charAt(0).toUpperCase()}
                </div>
                <span className="text-xs sm:text-sm font-semibold text-slate-800 hidden sm:inline">{currentUser?.name || currentUser?.username || 'Admin'}</span>
                <ChevronDown size={16} className="text-slate-500" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-50">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-danger-600 hover:bg-danger-50 text-sm font-bold transition-colors"
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
          ) : activeMenu === 'attendance-settings' ? (
            <WorkTimeSettingsPage />
          ) : activeMenu === 'work-locations' ? (
            <WorkLocationsPage />
          ) : activeMenu === 'leave-policy' ? (
            <LeavePoliciesPage />
          ) : activeMenu === 'mission' ? (
            <QuestManagement />
          ) : activeMenu === 'announcements' ? (
            <AnnouncementsPage />
          ) : activeMenu === 'reward' ? (
            <RewardManagement />
          ) : activeMenu === 'reward-categories' ? (
            <RewardCategoriesPage />
          ) : (
            <>
              {/* Dashboard Overview */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-wide">Dashboard Overview</h1>
              </div>

              {/* Row 1: 4 Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-7">
                {/* Card 1: Active Employees */}
                <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-200 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Active Employees</span>
                      <div className="text-3xl font-black text-violet-700 mt-7">
                        {stats.totalEmployees} <span className="text-xs font-normal text-slate-500">people</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700">
                      <Users size={22} />
                    </div>
                  </div>
                  
                </div>

                {/* Card 2: New Hires */}
                <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-200 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">New Employee</span>
                      
                      <div className="text-3xl font-black text-slate-900 mt-6">
                        {stats.newHires} <span className="text-xs font-normal text-slate-500">people</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600">
                      <UserPlus size={22} />
                    </div>
                  </div>
                </div>

                {/* Card 3: Resigned */}
                <div className="bg-white rounded-2xl p-5 shadow-lg border border-danger-200 card-ultra-smooth flex flex-col justify-between min-h-[125px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Employee leaves</span>
                      
                      <div className="text-3xl font-black text-[#F59E0B] mt-6">
                        {stats.resigned} <span className="text-xs font-normal text-slate-500">people</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                      <UserMinus size={22} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Charts Section */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">Employee Hires and Exits Report</h3>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-full px-4 py-1 text-xs font-bold text-slate-900 outline-none cursor-pointer"
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
                      <div className="border-b border-dashed border-slate-200 w-full" />
                      <div className="border-b border-dashed border-slate-200 w-full" />
                      <div className="border-b border-dashed border-slate-200 w-full" />
                      <div className="border-b border-dashed border-slate-200 w-full" />
                      <div className="border-b border-dashed border-slate-200 w-full" />
                      <div className="border-b border-dashed border-slate-200 w-full" />
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
                                  className="w-3.5 bg-[#7C3AED] rounded-t-md transition-all duration-500 shadow-md shadow-violet-600/50"
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
                            <span className="text-[11px] text-slate-500 mt-2 font-mono">{item.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Bar Chart Legend */}
                <div className="flex justify-center gap-6 mt-auto">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#7C3AED]" />
                    <span>New Employees</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
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
