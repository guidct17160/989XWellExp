import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DatePicker({
  value,
  onChange,
  name,
  placeholder = 'YYYY-MM-DD',
  required = false,
  className = '',
  disabled = false,
  placement = 'top', // Default to 'top' as requested ("show the date picker above, not below")
  disablePast = true, // Disallow selecting dates before today as requested ("do not allow selecting dates before today")
  minDate,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Helper: Get today at 00:00:00
  const getTodayMidnight = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  };

  const isPastDate = (year, month, day) => {
    if (!disablePast && !minDate) return false;
    const cellDate = new Date(year, month, day);
    cellDate.setHours(0, 0, 0, 0);
    let minLimit = getTodayMidnight();
    if (minDate && minDate !== 'today') {
      const parsedMin = new Date(minDate);
      if (!isNaN(parsedMin.getTime())) {
        parsedMin.setHours(0, 0, 0, 0);
        minLimit = parsedMin;
      }
    }
    return cellDate < minLimit;
  };

  const isPrevMonthDisabled = () => {
    if (!disablePast && !minDate) return false;
    let minLimit = getTodayMidnight();
    if (minDate && minDate !== 'today') {
      const parsedMin = new Date(minDate);
      if (!isNaN(parsedMin.getTime())) {
        parsedMin.setHours(0, 0, 0, 0);
        minLimit = parsedMin;
      }
    }
    return (
      viewYear < minLimit.getFullYear() ||
      (viewYear === minLimit.getFullYear() && viewMonth <= minLimit.getMonth())
    );
  };

  // Parse initial date from value or fallback to today
  const getInitialYearMonth = () => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-').map(Number);
      return { year: parts[0], month: parts[1] - 1 };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  };

  const initial = getInitialYearMonth();
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  const handleToggleOpen = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  // Sync view when value changes from outside
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-').map(Number);
      setViewYear(parts[0]);
      setViewMonth(parts[1] - 1);
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (isPrevMonthDisabled()) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (year, month, day) => {
    if (disabled || isPastDate(year, month, day)) return;
    const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (onChange) {
      // Support synthetic event or direct value
      onChange({
        target: { name, value: formatted },
      });
    }
    setIsOpen(false);
  };

  const handleSetToday = (e) => {
    e.stopPropagation();
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    setViewYear(y);
    setViewMonth(m);
    handleSelectDay(y, m, d);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange({ target: { name, value: '' } });
    }
  };

  // Build the 42-cells calendar grid (6 rows x 7 days)
  const buildCalendarGrid = () => {
    // Days in current month
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // First day of current month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

    // Days in previous month
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({
        day: dayNum,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
      });
    }

    // 2. Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      cells.push({
        day: dayNum,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
      });
    }

    // 3. Next month leading days (to fill remaining slots up to 42 or 35)
    const totalSlots = cells.length > 35 ? 42 : 35;
    const remainingSlots = totalSlots - cells.length;
    for (let dayNum = 1; dayNum <= remainingSlots; dayNum++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({
        day: dayNum,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
      });
    }

    return cells;
  };

  const calendarGrid = buildCalendarGrid();

  // Compare if date is the selected one
  const isSelectedDate = (year, month, day) => {
    if (!value) return false;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return value === dateStr;
  };

  // Compare if date is today
  const isTodayDate = (year, month, day) => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Input Box Trigger */}
      <div
        id={id}
        onClick={handleToggleOpen}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none flex items-center justify-between cursor-pointer transition-all select-none group ${
          isOpen ? 'border-violet-500 ring-4 ring-violet-200' : 'hover:border-violet-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={value ? 'text-slate-900 font-mono tracking-wide' : 'text-slate-500 font-mono'}>
          {value || placeholder}
        </span>

        <div className="flex items-center gap-1.5">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-500 hover:text-violet-600 rounded-md transition-colors"
              title="Clear date"
            >
              <X size={14} />
            </button>
          )}
          <CalendarIcon
            size={18}
            className={`transition-colors ${
              isOpen ? 'text-violet-700' : 'text-slate-500 group-hover:text-slate-800'
            }`}
          />
        </div>
      </div>

      {/* Hidden real input for native form compatibility */}
      <input
        type="hidden"
        name={name}
        value={value || ''}
        required={required}
      />

      {/* CALENDAR POPOVER (Styled exactly as requested in screenshot) */}
      {isOpen && (
        <div
          className={`absolute left-0 z-[9999] w-[310px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150 select-none ${
            placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
          }`}
        >
          {/* Header: < October 2026 > */}
          <div className="flex items-center justify-between mb-4 px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={isPrevMonthDisabled()}
              className={`p-1.5 rounded-lg transition-colors ${
                isPrevMonthDisabled()
                  ? 'text-slate-700 opacity-30 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Previous month"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="font-bold text-slate-800 text-sm tracking-wide">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday Labels: Su Mo Tu We Th Fr Sa */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {WEEKDAY_LABELS.map((d, index) => (
              <div
                key={d}
                className={`text-xs font-bold py-1 ${
                  index === 0
                    ? 'text-violet-600'
                    : index === 6
                    ? 'text-blue-600'
                    : 'text-slate-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarGrid.map((cell, idx) => {
              const selected = isSelectedDate(cell.year, cell.month, cell.day);
              const today = isTodayDate(cell.year, cell.month, cell.day);
              const isPast = isPastDate(cell.year, cell.month, cell.day);

              if (isPast) {
                return (
                  <button
                    key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                    type="button"
                    disabled={true}
                    className="h-9 w-9 mx-auto flex items-center justify-center text-sm font-medium rounded-xl text-slate-700 opacity-30 cursor-not-allowed select-none bg-slate-50/50"
                    title="Dates before today cannot be selected"
                  >
                    {cell.day}
                  </button>
                );
              }

              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                  type="button"
                  onClick={() => handleSelectDay(cell.year, cell.month, cell.day)}
                  className={`h-9 w-9 mx-auto flex items-center justify-center text-sm font-semibold rounded-xl transition-all ${
                    selected
                      ? 'border-2 border-blue-500 text-blue-600 font-bold bg-blue-50/60 shadow-sm'
                      : cell.isCurrentMonth
                      ? 'text-slate-800 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-500 cursor-pointer'
                  } ${today && !selected ? 'ring-1 ring-blue-300 font-bold text-blue-600' : ''}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Quick Action Footer: Today & Clear */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 px-1 text-xs font-semibold">
            <button
              type="button"
              onClick={handleSetToday}
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
            >
              Today ({new Date().getDate()} {MONTH_NAMES[new Date().getMonth()]})
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-500 hover:text-violet-600 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
