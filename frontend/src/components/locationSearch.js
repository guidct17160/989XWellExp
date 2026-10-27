// Find a place for the Work Location pin from what an admin pastes:
// coordinates, a Google Maps link, or an address / place name (OpenStreetMap Nominatim, no API key)

const validPoint = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';

// "13.7563, 100.5018" or a Google Maps URL that carries the position -> { lat, lng }, otherwise null
export function parseCoordinates(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const tries = [
    new RegExp(`^${NUM}\\s*[,\\s]\\s*${NUM}$`), // plain pair, as copied from Google Maps (right click)
    new RegExp(`!3d${NUM}!4d${NUM}`), // the place pin inside a Google Maps URL
    new RegExp(`[?&](?:q|ll|query|destination|center)=${NUM}(?:,|%2C)\\s*${NUM}`), // ?q=lat,lng
    new RegExp(`@${NUM},${NUM}`), // the map centre of a Google Maps URL
  ];
  for (const re of tries) {
    const m = t.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (validPoint(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export const isShortMapLink = (text) => /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(text || ''));

// A Google Maps link without coordinates still names the place: /maps/place/<name>/ or ?q=<name>
export function placeNameFromUrl(text) {
  const t = String(text || '').trim();
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const url = new URL(t);
    const q = url.searchParams.get('q') || url.searchParams.get('query');
    if (q) return q;
    const m = url.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/);
    if (m) return decodeURIComponent(m[1].replace(/\+/g, ' '));
  } catch (e) {}
  return null;
}

// Nominatim (OpenStreetMap) search -> [{ label, lat, lng }]
export async function searchPlaces(query, signal) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=th,en&q=' + encodeURIComponent(query);
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('The place search service is not available right now');
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
    .filter((r) => validPoint(r.lat, r.lng));
}
