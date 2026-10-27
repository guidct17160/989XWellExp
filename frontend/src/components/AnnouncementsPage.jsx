import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Megaphone,
  Plus,
  Trash2,
  RefreshCw,
  Edit,
  CheckCircle,
  AlertTriangle,
  X,
  UploadCloud,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Radio,
  CalendarClock,
  CalendarX,
} from 'lucide-react';

import { API_BASE } from '../config';
import FilterBar from './FilterBar';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all disabled:opacity-50';
const LABEL = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const STATUS_STYLE = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  Scheduled: 'bg-sky-50 text-sky-700 border-sky-300',
  Expired: 'bg-slate-100 text-slate-500 border-slate-300',
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const localNowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const emptyForm = () => ({
  title: '',
  description: '',
  startDate: localToday(),
  startTime: localNowTime(),
  endDate: '',
  endTime: '23:59',
  noEndDate: false,
});

const fromApi = (a) => ({
  title: a.title,
  description: a.description || a.content || '',
  startDate: a.startDate,
  startTime: a.startTime,
  endDate: a.endDate || '',
  endTime: a.endTime || '23:59',
  noEndDate: !a.endDate,
});

const imageSrc = (a) => (a && a.hasImage ? `${API_BASE}/announcements/${encodeURIComponent(a.id)}/image?v=${a.imageVersion || ''}` : null);

// Reads a PNG / GIF file of any size (up to 5 MB) and makes sure it really is a picture
const readImage = (file) =>
  new Promise((resolve, reject) => {
    if (!/^image\/(png|gif)$/.test(file.type)) return reject(new Error('The image must be a PNG or GIF file'));
    if (file.size > MAX_IMAGE_BYTES) return reject(new Error('The image must be 5 MB or smaller'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('The file is not a valid image'));
      img.onload = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

function AnnouncementForm({ existing, onClose, onSaved, notify }) {
  const [form, setForm] = useState(() => (existing ? fromApi(existing) : emptyForm()));
  // image: undefined = keep what is stored, null = removed, string = a new picture (data URL)
  const [image, setImage] = useState(undefined);
  const [imageError, setImageError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const preview = image === undefined ? imageSrc(existing) : image;

  const pick = async (file) => {
    if (!file) return;
    setImageError('');
    try {
      setImage(await readImage(file));
    } catch (e) {
      setImageError(e.message);
    }
  };

  const validate = () => {
    if (!form.title.trim()) return 'Title is required';
    if (!form.description.trim()) return 'Description is required';
    if (!form.startDate) return 'Start date is required';
    if (!form.noEndDate) {
      if (!form.endDate) return 'End date is required (or tick "No end date")';
      if (`${form.endDate} ${form.endTime}` <= `${form.startDate} ${form.startTime}`) return 'End date / time must be after the start date / time';
      if (`${form.endDate} ${form.endTime}` < `${localToday()} ${localNowTime()}`) return 'End date / time cannot be earlier than the current time';
    }
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) return notify(problem, 'error');
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        startDate: form.startDate,
        startTime: form.startTime,
        noEndDate: form.noEndDate,
        endDate: form.noEndDate ? null : form.endDate,
        endTime: form.noEndDate ? null : form.endTime,
      };
      if (image !== undefined) body.image = image; // a new picture or null to remove
      const res = await fetch(existing ? `${API_BASE}/announcements/${encodeURIComponent(existing.id)}` : `${API_BASE}/announcements`, {
        method: existing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notify(existing ? 'Announcement updated' : 'Announcement created');
        onSaved();
      } else {
        notify(json.message || 'Failed to save the announcement', 'error');
      }
    } catch (err) {
      console.error('Failed to save announcement', err);
      notify('Unable to connect to the server to save the announcement', 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-900"
        data-testid="announcement-form"
      >
        <div className="flex justify-between items-center px-7 pt-6 pb-4 border-b border-slate-200 shrink-0">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">
            {existing ? 'Edit Announcement' : 'Add New Announcement'} <span className="text-xs font-bold text-violet-600 normal-case">(*Required)</span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-7 py-5 space-y-5">
          <div>
            <label className={LABEL}>Title <span className="text-danger-600">*</span></label>
            <input className={INPUT} value={form.title} maxLength={255} placeholder="Enter title" onChange={(e) => set({ title: e.target.value })} />
          </div>

          <div>
            <label className={LABEL}>Description <span className="text-danger-600">*</span></label>
            <textarea
              className={`${INPUT} h-32`}
              value={form.description}
              maxLength={5000}
              placeholder="Enter description"
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          <div>
            <label className={LABEL}>Default Image</label>
            {preview ? (
              <div className="flex items-start gap-4">
                <img src={preview} alt="Announcement" className="w-40 h-40 rounded-xl object-cover border border-slate-200" />
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current && fileRef.current.click()}
                    className="block text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-800 cursor-pointer"
                  >
                    Change image
                  </button>
                  <button
                    type="button"
                    onClick={() => { setImage(null); setImageError(''); }}
                    className="block text-xs font-bold px-3 py-2 rounded-lg border border-danger-200 bg-slate-50 hover:bg-danger-50 text-danger-700 cursor-pointer"
                  >
                    Remove image
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current && fileRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files && e.dataTransfer.files[0]); }}
                className={`h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer text-sm transition-colors ${
                  dragOver ? 'border-violet-500 bg-violet-50 text-white' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-violet-500/60'
                }`}
              >
                <UploadCloud size={28} />
                <span>Drop files here or click to upload.</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/gif"
              className="hidden"
              data-testid="announcement-image-input"
              onChange={(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ''; }}
            />
            <p className="text-[11px] text-slate-500 mt-1.5">Upload image: supports PNG / GIF of any size (up to 5 MB).</p>
            {imageError && <p className="text-xs font-bold text-danger-600 mt-1">{imageError}</p>}
          </div>

          <div>
            <label className={LABEL}>Start Date / Time <span className="text-danger-600">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DatePicker name="startDate" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} placeholder="Select date" placement="bottom" disablePast={!existing} />
              <TimePicker name="startTime" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} placement="bottom" />
            </div>
          </div>

          <div>
            <label className={LABEL}>End Date / Time {!form.noEndDate && <span className="text-danger-600">*</span>}</label>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${form.noEndDate ? 'opacity-40 pointer-events-none' : ''}`}>
              <DatePicker
                name="endDate"
                value={form.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
                placeholder="Select date"
                minDate={form.startDate > localToday() ? form.startDate : 'today'}
                disabled={form.noEndDate}
              />
              <TimePicker name="endTime" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} disabled={form.noEndDate} />
            </div>
            <label className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-violet-500"
                checked={form.noEndDate}
                onChange={(e) => set({ noEndDate: e.target.checked })}
              />
              <span>No end date</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-7 py-4 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 font-bold text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-violet-600/30 uppercase tracking-wide cursor-pointer"
          >
            {saving ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');
  const [sort, setSort] = useState({ key: 'created', dir: 'desc' });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, announcement = edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/announcements/all`);
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.announcements || []);
      } else {
        setItems([]);
        notify(json.message || 'Unable to load announcements', 'error');
      }
    } catch (err) {
      console.error('Failed to load announcements', err);
      setItems([]);
      notify('Unable to connect to the server to load announcements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`${API_BASE}/announcements/${encodeURIComponent(target.id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        notify(`"${target.title}" deleted`);
        load();
      } else {
        notify(json.message || 'Failed to delete the announcement', 'error');
      }
    } catch (err) {
      console.error('Failed to delete announcement', err);
      notify('Unable to connect to the server to delete the announcement', 'error');
    }
  };

  const toggleSort = (key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sortValue = (a) => {
    if (sort.key === 'title') return String(a.title || '').toLowerCase();
    if (sort.key === 'start') return `${a.startDate} ${a.startTime}`;
    if (sort.key === 'end') return a.endDate ? `${a.endDate} ${a.endTime}` : '9999-12-31 23:59'; // no end date sorts last
    return `${a.createdDate} ${a.createdTime}`;
  };

  const term = search.trim().toLowerCase();
  const filtered = items
    .filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (startFilter && a.startDate < startFilter) return false;
      if (endFilter && (!a.endDate || a.endDate > endFilter)) return false;
      return !term || String(a.title || '').toLowerCase().includes(term);
    })
    .sort((a, b) => {
      const x = sortValue(a);
      const y = sortValue(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1);
    });

  const count = (s) => items.filter((a) => a.status === s).length;

  const Th = ({ label, k, className = '' }) => (
    <th className={`py-3.5 px-4 whitespace-nowrap ${className}`}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase font-extrabold tracking-wider hover:text-slate-900 cursor-pointer">
        {label}
        {sort.key === k ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-60" />}
      </button>
    </th>
  );

  return (
    <div className="space-y-6 text-slate-900 font-sans animate-in fade-in duration-200">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-[60] px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2.5 border ${
            notification.type === 'error' ? 'bg-danger-50 border-danger-200 text-danger-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} className="text-emerald-600" />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-violet-100 text-violet-700 border border-violet-200">
            <Megaphone size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">Announcements</h1>
            
          </div>
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-700 transition-colors self-start md:self-auto cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: 'Active now', value: count('Active'), Icon: Radio, box: 'bg-emerald-50 text-emerald-600 border-emerald-200', text: 'text-emerald-600' },
          { label: 'Scheduled', value: count('Scheduled'), Icon: CalendarClock, box: 'bg-sky-50 text-sky-600 border-sky-200', text: 'text-sky-600' },
          { label: 'Expired', value: count('Expired'), Icon: CalendarX, box: 'bg-slate-100 text-slate-500 border-slate-300', text: 'text-slate-700' },
        ].map(({ label, value, Icon, box, text }) => (
          <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${box}`}><Icon size={24} /></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <h3 className={`text-2xl font-black font-mono ${text}`}>{value}</h3>
            </div>
          </div>
        ))}
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search title..."
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'ALL', label: 'All Status' },
              { value: 'Active', label: 'Active' },
              { value: 'Scheduled', label: 'Scheduled' },
              { value: 'Expired', label: 'Expired' },
            ],
          },
        ]}
        right={
          <button
            onClick={() => setEditing({})}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto cursor-pointer"
          >
            <Plus size={16} />
            <span>Add New Announcement</span>
          </button>
        }
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Start Date</span>
          <div className="w-40"><DatePicker value={startFilter} onChange={(e) => setStartFilter(e.target.value)} disablePast={false} placement="bottom" /></div>
          {startFilter && <button onClick={() => setStartFilter('')} className="text-slate-500 hover:text-slate-900 cursor-pointer" title="Clear"><X size={14} /></button>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">End Date</span>
          <div className="w-40"><DatePicker value={endFilter} onChange={(e) => setEndFilter(e.target.value)} disablePast={false} placement="bottom" /></div>
          {endFilter && <button onClick={() => setEndFilter('')} className="text-slate-500 hover:text-slate-900 cursor-pointer" title="Clear"><X size={14} /></button>}
        </div>
      </FilterBar>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                <Th label="Title" k="title" className="w-full" />
                <Th label="Start Date" k="start" />
                <Th label="End Date" k="end" />
                <th className="py-3.5 px-4 uppercase font-extrabold tracking-wider">Status</th>
                <Th label="Create Date" k="created" />
                <th className="py-3.5 px-4 text-center uppercase font-extrabold tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-800">
              {loading ? (
                <tr><td colSpan="6" className="py-12 text-center text-slate-500 font-mono">Loading announcements...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-mono">
                    {items.length === 0 ? 'No announcements yet. Click "Add New Announcement" to create one.' : 'No announcements match the filters'}
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-violet-50 transition-colors align-middle">
                    <td className="py-3 px-4 min-w-[14rem]">
                      <button onClick={() => setEditing(a)} className="flex items-center gap-3 text-left cursor-pointer max-w-md">
                        {a.hasImage ? (
                          <img src={imageSrc(a)} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <span className="w-10 h-10 rounded-lg bg-violet-100 border border-slate-200 text-violet-600 flex items-center justify-center shrink-0"><Megaphone size={16} /></span>
                        )}
                        <span className="font-bold text-slate-900 hover:text-violet-700 truncate">{a.title}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-700">{a.startDate} {a.startTime}</td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-700">
                      {a.endDate ? `${a.endDate} ${a.endTime}` : <span className="italic text-slate-500">No end date</span>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLE[a.status] || STATUS_STYLE.Expired}`}>{a.status}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-700">{a.createdDate} {a.createdTime}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => setEditing(a)} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer" title="Edit announcement">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(a)} className="p-1.5 text-slate-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors cursor-pointer" title="Delete announcement">
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

      {editing && (
        <AnnouncementForm
          key={editing.id || 'new'}
          existing={editing.id ? editing : null}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-7 shadow-2xl border border-slate-200 text-slate-900 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Delete "{deleteTarget.title}"?</h3>
            <p className="text-xs text-slate-500 mt-2">This announcement will disappear from the employee app and cannot be restored.</p>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-danger-200 bg-slate-50 text-slate-700 hover:bg-danger-50 font-bold text-xs cursor-pointer">Cancel</button>
              <button onClick={handleDelete} className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-lg shadow-danger-600/30 uppercase tracking-wide cursor-pointer">Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
