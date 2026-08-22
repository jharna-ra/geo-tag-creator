export type OverlayPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center";

export type MapType = "satellite" | "street";

export interface GeotagData {
  country: string;
  countryCode: string;
  state: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  /** yyyy-mm-dd */
  date: string;
  /** HH:MM */
  time: string;
  altitude: string;
  accuracy: string;
}

export interface GeotagOptions {
  showAddress: boolean;
  showCoordinates: boolean;
  showDate: boolean;
  showTime: boolean;
  showAltitude: boolean;
  showAccuracy: boolean;
  mapType: MapType;
}

export const DEFAULT_OPTIONS: GeotagOptions = {
  showAddress: true,
  showCoordinates: true,
  showDate: true,
  showTime: true,
  showAltitude: true,
  showAccuracy: true,
  mapType: "satellite",
};

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const EMPTY_DATA: GeotagData = {
  country: "",
  countryCode: "",
  state: "",
  city: "",
  address: "",
  latitude: null,
  longitude: null,
  date: todayISO(),
  time: nowHM(),
  altitude: "",
  accuracy: "",
};
