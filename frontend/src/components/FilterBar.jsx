import React from 'react';
import { Search, Filter } from 'lucide-react';

/**
 * Shared Search + Filter bar used by every list page.
 *
 * filters: [{ label, value, onChange(value), options: [{ value, label }] }]
 * children: extra controls rendered with the filters (e.g. a date picker)
 * right: node pinned to the far right (e.g. a primary action button)
 */
export default function FilterBar({ search, onSearch, placeholder = 'Search...', filters = [], children, right }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-lg flex flex-col md:flex-row gap-3 items-center justify-between">
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {onSearch && (
          <div className="relative w-full md:w-80">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
            />
          </div>
        )}

        {filters.map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            <Filter size={14} className="text-violet-600" />
            <span>{f.label}:</span>
            <select
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              title={(f.options.find((o) => o.value === f.value) || {}).label}
              className="bg-transparent font-bold text-violet-700 outline-none cursor-pointer max-w-[9rem] truncate"
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value} className="bg-slate-50 text-white">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {children}
      </div>

      {right}
    </div>
  );
}
