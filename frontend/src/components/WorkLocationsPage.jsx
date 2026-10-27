import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Plus, Trash2, RefreshCw, Edit, AlertTriangle, CheckCircle, LocateFixed, ArrowLeft, X, Search } from 'lucide-react';

import { API_BASE } from '../config';
import FilterBar from './FilterBar';
import useDetailRoute from './useDetailRoute';
import { parseCoordinates, placeNameFromUrl, isShortMapLink, searchPlaces } from './locationSearch';

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all disabled:opacity-50';
const LABEL = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1';

const TYPES = ['Office', 'WFH', 'Site', 'Other'];
const DEFAULT_CENTER = [13.7563, 100.5018]; // Bangkok, used until a pin is placed

const TYPE_STYLE = {
  Office: 'bg-sky-50 text-sky-700 border-sky-200',
  WFH: 'bg-violet-100 text-violet-700 border-violet-300',
  Site: 'bg-amber-50 text-amber-700 border-amber-200',
  Other: 'bg-slate-100 text-slate-700 border-slate-300',
};
const STATUS_STYLE = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  Inactive: 'bg-slate-100 text-slate-500 border-slate-300',
};

const EMPTY_FORM = {
  name: '',
  type: 'Office',
  address: '',
  latitude: '',
  longitude: '',
  radiusM: 100,
  status: 'Active',
  scope: 'all',
  departmentIds: [],
  members: [],
};

const accessLabel = (l) => {
  if (l.scope === 'departments') return `${l.departmentIds.length} department(s)`;
  if (l.scope === 'members') return `${l.members.length} employee(s)`;
  return 'All employees';
};

// Click-to-pin map: a circle shows the radius inside which employees can clock in / out
function LocationMap({ latitude, longitude, radiusM, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasPin = latitude !== '' && longitude !== '' && Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    const map = L.map(elRef.current, { center: hasPin ? [lat, lng] : DEFAULT_CENTER, zoom: hasPin ? 17 : 11 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    map.on('click', (e) => onPickRef.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasPin) {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }
      return;
    }
    const radius = Number(radiusM) > 0 ? Number(radiusM) : 100;
    if (!markerRef.current) {
      markerRef.current = L.circleMarker([lat, lng], { radius: 8, color: '#FFFFFF', weight: 2, fillColor: '#7C3AED', fillOpacity: 1 }).addTo(map);
      circleRef.current = L.circle([lat, lng], { radius, color: '#7C3AED', weight: 2, fillColor: '#7C3AED', fillOpacity: 0.15 }).addTo(map);
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    } else {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(radius);
      if (!map.getBounds().contains([lat, lng])) map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }
  }, [hasPin, lat, lng, radiusM]);

  return <div ref={elRef} className="h-72 w-full rounded-xl border border-slate-200 overflow-hidden z-0" data-testid="location-map" />;
}

function LocationForm({ locationId, locations, notify, onClose, onSaved }) {
  const existing = locationId === 'new' ? null : locations.find((l) => l.id === locationId);
  const [form, setForm] = useState(() =>
    existing
      ? {
          name: existing.name,
          type: existing.type,
          address: existing.address || '',
          latitude: String(existing.latitude),
          longitude: String(existing.longitude),
          radiusM: existing.radiusM,
          status: existing.status,
          scope: existing.scope,
          departmentIds: existing.departmentIds || [],
          members: existing.members || [],
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState(null); // null = not searched yet
  const [placeSearching, setPlaceSearching] = useState(false);
  const pickerRef = useRef(null);
  const memberInputRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // departments / employees are needed only for the "who can use it" pickers
  useEffect(() => {
    if (form.scope === 'departments' && departments.length === 0) {
      fetch(`${API_BASE}/departments`)
        .then((r) => r.json())
        .then((j) => setDepartments(Array.isArray(j.departments) ? j.departments : []))
        .catch(() => notify('Unable to load departments', 'error'));
    }
    if (form.scope === 'members' && employees.length === 0) {
      fetch(`${API_BASE}/employees`)
        .then((r) => r.json())
        .then((j) => setEmployees(Array.isArray(j.employees) ? j.employees : []))
        .catch(() => notify('Unable to load employees', 'error'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.scope]);

  useEffect(() => {
    const onDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pickPoint = (lat, lng) => set({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });

  // Paste coordinates / a Google Maps link, or type an address: the pin jumps to it
  const searchPlace = async () => {
    const q = placeQuery.trim();
    if (!q) return;
    setPlaceResults(null);
    const point = parseCoordinates(q);
    if (point) {
      pickPoint(point.lat, point.lng);
      return notify('Pin placed from the coordinates', 'success');
    }
    if (isShortMapLink(q)) {
      return notify('Short Google Maps links cannot be read. Open the link, then copy the full address from the browser or the coordinates (right-click the spot in Google Maps)', 'error');
    }
    setPlaceSearching(true);
    try {
      const results = await searchPlaces(placeNameFromUrl(q) || q);
      setPlaceResults(results);
    } catch (e) {
      notify(e.message || 'Unable to search for this place', 'error');
    } finally {
      setPlaceSearching(false);
    }
  };

  const choosePlace = (place) => {
    pickPoint(place.lat, place.lng);
    if (!form.address.trim()) set({ address: place.label, latitude: place.lat.toFixed(6), longitude: place.lng.toFixed(6) });
    setPlaceResults(null);
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) return notify('This browser cannot read your location', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => pickPoint(pos.coords.latitude, pos.coords.longitude),
      () => notify('Unable to read your location. Allow location access or click the map instead', 'error'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const selectedIds = new Set(form.members.map((m) => m.id));
  const term = memberSearch.trim().toLowerCase();
  const matches = useMemo(
    () =>
      employees
        .filter((e) => !selectedIds.has(e.id) && e.status !== 'Resign')
        .filter((e) => !term || [e.code, e.name, e.email, e.department].some((v) => v && String(v).toLowerCase().includes(term)))
        .slice(0, 30),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, term, form.members]
  );

  const validate = () => {
    if (!form.name.trim()) return 'Location name is required';
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (form.latitude === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) return 'Pin the location on the map (latitude is missing or invalid)';
    if (form.longitude === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) return 'Pin the location on the map (longitude is missing or invalid)';
    const r = Number(form.radiusM);
    if (!Number.isFinite(r) || r < 20 || r > 5000) return 'Radius must be between 20 and 5,000 metres';
    if (form.scope === 'departments' && form.departmentIds.length === 0) return 'Select at least one department';
    if (form.scope === 'members' && form.members.length === 0) return 'Select at least one employee';
    return '';
  };

  const save = async () => {
    const problem = validate();
    if (problem) return notify(problem, 'error');
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusM: Number(form.radiusM),
        status: form.status,
        scope: form.scope,
        departmentIds: form.departmentIds,
        memberIds: form.members.map((m) => m.id),
      };
      const res = await fetch(existing ? `${API_BASE}/work-locations/${encodeURIComponent(existing.id)}` : `${API_BASE}/work-locations`, {
        method: existing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        notify(existing ? 'Work location updated' : 'Work location created');
        onSaved();
      } else {
        notify(json.message || 'Unable to save the work location', 'error');
      }
    } catch (e) {
      notify('Unable to connect to the server to save the work location', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (locationId !== 'new' && !existing) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
        Work location not found.{' '}
        <button onClick={onClose} className="underline text-white cursor-pointer">Back to the list</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg flex items-center gap-3">
        <button onClick={onClose} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-700 cursor-pointer" title="Back">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">{existing ? 'Edit Work Location' : 'New Work Location'}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Employees can clock in / out only inside the radius of a location they are allowed to use</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className={LABEL}>Location name <span className="text-danger-600">*</span></label>
            <input className={INPUT} value={form.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Head Office" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Type</label>
              <select className={INPUT} value={form.type} onChange={(e) => set({ type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Status</label>
              <select className={INPUT} value={form.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>Address (optional)</label>
            <input className={INPUT} value={form.address} maxLength={500} onChange={(e) => set({ address: e.target.value })} placeholder="Building, street, district" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Latitude <span className="text-danger-600">*</span></label>
              <input className={INPUT} value={form.latitude} onChange={(e) => set({ latitude: e.target.value })} placeholder="13.756300" inputMode="decimal" />
            </div>
            <div>
              <label className={LABEL}>Longitude <span className="text-danger-600">*</span></label>
              <input className={INPUT} value={form.longitude} onChange={(e) => set({ longitude: e.target.value })} placeholder="100.501800" inputMode="decimal" />
            </div>
            <div>
              <label className={LABEL}>Radius (m) <span className="text-danger-600">*</span></label>
              <input className={INPUT} type="number" min={20} max={5000} value={form.radiusM} onChange={(e) => set({ radiusM: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Who can use this location</label>
            <div className="flex flex-wrap gap-5 py-1.5">
              {[
                ['all', 'All employees'],
                ['departments', 'Specific departments'],
                ['members', 'Specific employees'],
              ].map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                  <input type="radio" name="scope" checked={form.scope === value} onChange={() => set({ scope: value })} className="w-4 h-4 accent-violet-500" />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {form.scope === 'departments' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto space-y-1.5">
                {departments.length === 0 && <div className="text-xs text-slate-500">Loading departments...</div>}
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-violet-500"
                      checked={form.departmentIds.includes(d.id)}
                      onChange={(e) =>
                        set({ departmentIds: e.target.checked ? [...form.departmentIds, d.id] : form.departmentIds.filter((x) => x !== d.id) })
                      }
                    />
                    <span>{d.name}</span>
                  </label>
                ))}
              </div>
            )}

            {form.scope === 'members' && (
              <div ref={pickerRef}>
                <div className="relative">
                  {/* chips live inside the field, like a tag input */}
                  <div
                    data-testid="member-field"
                    className="flex flex-wrap items-center gap-2 w-full px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-200 transition-all cursor-text min-h-[46px]"
                    onClick={() => memberInputRef.current && memberInputRef.current.focus()}
                  >
                    {form.members.map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-violet-100 border border-violet-200 text-xs font-bold text-slate-900">
                        {m.name}
                        <button
                          type="button"
                          onClick={(ev) => { ev.stopPropagation(); set({ members: form.members.filter((x) => x.id !== m.id) }); }}
                          className="text-danger-700 hover:text-slate-900 cursor-pointer"
                          title="Remove"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                    <input
                      ref={memberInputRef}
                      className="flex-1 min-w-[10rem] bg-transparent outline-none text-sm font-medium text-slate-900 placeholder-slate-400 px-1.5 py-1"
                      placeholder={form.members.length === 0 ? 'Click and type a name, ID, email or department' : 'Add more employees...'}
                      value={memberSearch}
                      onFocus={() => setPickerOpen(true)}
                      onChange={(e) => { setMemberSearch(e.target.value); setPickerOpen(true); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && memberSearch === '' && form.members.length > 0) {
                          set({ members: form.members.slice(0, -1) });
                        }
                      }}
                    />
                  </div>
                  {pickerOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 shadow-2xl shadow-slate-300">
                      {matches.length === 0 && <div className="px-3.5 py-3 text-xs text-slate-500">No employees to add</div>}
                      {matches.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => { set({ members: [...form.members, { id: e.id, code: e.code, name: e.name }] }); setMemberSearch(''); }}
                          className="w-full text-left px-3.5 py-2 text-sm text-slate-800 hover:bg-violet-50 border-b border-slate-200 last:border-b-0 cursor-pointer flex items-center gap-3"
                        >
                          <span className="font-mono text-xs text-violet-600 shrink-0">{e.code}</span>
                          <span className="font-bold truncate">{e.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={LABEL + ' mb-0'}>Pin on map</label>
            <button type="button" onClick={useMyPosition} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-200 bg-slate-50 hover:bg-violet-50 px-3 py-1.5 rounded-lg cursor-pointer">
              <LocateFixed size={14} /> Use my current location
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className={INPUT + ' pl-9'}
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchPlace(); } }}
                  placeholder="Search an address, or paste a Google Maps link / coordinates"
                  aria-label="Search place"
                />
              </div>
              <button type="button" onClick={searchPlace} disabled={placeSearching || !placeQuery.trim()} className="px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs cursor-pointer disabled:opacity-50">
                {placeSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {placeResults && (
              <div data-testid="place-results" className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden divide-y divide-slate-100">
                {placeResults.length === 0 ? (
                  <p className="px-3.5 py-3 text-xs text-slate-500">No place found. Try a more specific address or paste the coordinates.</p>
                ) : (
                  placeResults.map((p, i) => (
                    <button key={i} type="button" onClick={() => choosePlace(p)} className="w-full flex items-start gap-2 px-3.5 py-2.5 text-left text-xs text-slate-800 hover:bg-violet-50 cursor-pointer">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-violet-600" />
                      <span>{p.label}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <LocationMap latitude={form.latitude} longitude={form.longitude} radiusM={form.radiusM} onPick={pickPoint} />
          <p className="text-[11px] text-slate-500">Search or click the map to place the pin. The red circle is the area where employees can clock in / out.</p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 font-bold text-xs cursor-pointer disabled:opacity-50">
          Cancel
        </button>
        <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs uppercase tracking-wide cursor-pointer disabled:opacity-60">
          {saving ? 'Saving...' : 'Save location'}
        </button>
      </div>
    </div>
  );
}

export default function WorkLocationsPage() {
  const detailRoute = useDetailRoute('work-locations');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notification, setNotification] = useState(null);

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/work-locations`);
      const json = await res.json();
      if (res.ok && json.success) {
        setLocations(json.locations || []);
      } else {
        setLocations([]);
        notify(json.message || 'Unable to load work locations', 'error');
      }
    } catch (e) {
      setLocations([]);
      notify('Unable to connect to the server to load work locations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const term = search.trim().toLowerCase();
  const filtered = locations.filter((l) => {
    if (typeFilter && l.type !== typeFilter) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    if (!term) return true;
    return [l.name, l.address].some((v) => v && String(v).toLowerCase().includes(term));
  });

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`${API_BASE}/work-locations/${encodeURIComponent(target.id)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        notify(`Work location "${target.name}" deleted`);
        fetchLocations();
      } else {
        notify(json.message || 'Unable to delete the work location', 'error');
      }
    } catch (e) {
      notify('Unable to connect to the server to delete the work location', 'error');
    }
  };

  const toast = notification && (
    <div
      className={`fixed top-5 right-5 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-bold border ${
        notification.type === 'error' ? 'bg-danger-50 text-danger-800 border-danger-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
      }`}
    >
      {notification.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
      {notification.message}
    </div>
  );

  // Create / edit lives on its own URL: /attendance/work-locations/new  or  /attendance/work-locations/<location id>
  if (detailRoute.detailId) {
    return (
      <div className="flex flex-col gap-6">
        {toast}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 font-mono">Loading...</div>
        ) : (
          <LocationForm
            key={detailRoute.detailId}
            locationId={detailRoute.detailId}
            locations={locations}
            notify={notify}
            onClose={detailRoute.close}
            onSaved={() => {
              detailRoute.close();
              fetchLocations();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {toast}

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700 border border-violet-200">
            <MapPin size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">Work Locations</h1>
            <p className="text-xs text-slate-500 mt-0.5">{locations.length} Total</p>
          </div>
        </div>
        <button
          onClick={fetchLocations}
          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-700 transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search name or address..."
        filters={[
          {
            label: 'Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [{ value: '', label: 'All' }, ...TYPES.map((t) => ({ value: t, label: t }))],
          },
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: '', label: 'All' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ],
          },
        ]}
        right={
          <button
            onClick={() => detailRoute.open('new')}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Location</span>
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-full">Location</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Who can use</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-800">
              {loading ? (
                <tr><td colSpan="5" className="py-12 text-center text-slate-500 font-mono">Loading work locations...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500 font-mono">
                    {locations.length === 0 ? 'No work locations yet. Click "Add Location" to create one.' : 'No work locations match the filters'}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-violet-50 transition-colors">
                    <td className="py-3.5 px-4 whitespace-normal min-w-[14rem]">
                      <button onClick={() => detailRoute.open(l.id)} className="font-bold text-slate-900 hover:text-violet-700 text-left cursor-pointer">{l.name}</button>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${TYPE_STYLE[l.type] || TYPE_STYLE.Other}`}>{l.type}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{accessLabel(l)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLE[l.status] || STATUS_STYLE.Inactive}`}>{l.status}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => detailRoute.open(l.id)} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer" title="Edit location">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(l)} className="p-2 text-slate-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors cursor-pointer" title="Delete location">
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wide mb-2">Delete work location?</h3>
            <p className="text-sm text-slate-700">
              "{deleteTarget.name}" will be removed. Past attendance records keep the location name. If it was the last active location,
              employees can clock in / out from anywhere again.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-danger-200 bg-slate-50 text-slate-700 hover:bg-danger-50 font-bold text-xs cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs uppercase tracking-wide cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
