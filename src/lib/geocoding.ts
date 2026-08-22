export interface GeocodeResult {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  address: string;
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

function pickCity(a: Record<string, string>): string {
  return (
    a["city"] ||
    a["town"] ||
    a["village"] ||
    a["municipality"] ||
    a["county"] ||
    a["state_district"] ||
    a["suburb"] ||
    ""
  );
}

export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(
    query,
  )}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Geocoding service is unavailable. Enter latitude/longitude manually.");
  const json = (await res.json()) as NominatimItem[];
  if (!json.length) throw new Error("Address not found. Try a simpler address or enter coordinates manually.");
  const item = json[0];
  const a = item.address ?? {};
  return {
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    city: pickCity(a),
    state: a["state"] || "",
    country: a["country"] || "",
    countryCode: (a["country_code"] || "").toUpperCase(),
    address: query,
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Reverse geocoding failed.");
  const item = (await res.json()) as NominatimItem;
  const a = item.address ?? {};
  return {
    latitude: lat,
    longitude: lon,
    city: pickCity(a),
    state: a["state"] || "",
    country: a["country"] || "",
    countryCode: (a["country_code"] || "").toUpperCase(),
    address: item.display_name || "",
  };
}

/** Turns "IN" into the flag emoji. */
export function flagEmoji(cc: string): string {
  if (!cc || cc.length !== 2) return "";
  return String.fromCodePoint(
    ...cc
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
