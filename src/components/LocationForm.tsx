import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { geocodeAddress } from "@/lib/geocoding";
import type { GeotagData } from "@/types/geotag";

interface Props {
  data: GeotagData;
  onChange: (patch: Partial<GeotagData>) => void;
}

export function LocationForm({ data, onChange }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGeocode = async () => {
    if (!data.address.trim()) {
      toast.error("Enter an address first.");
      return;
    }
    setLoading(true);
    try {
      const r = await geocodeAddress(data.address.trim());
      onChange({
        latitude: r.latitude,
        longitude: r.longitude,
        city: r.city,
        state: r.state,
        country: r.country,
        countryCode: r.countryCode,
      });
      toast.success("Location found.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Geocoding failed.");
    } finally {
      setLoading(false);
    }
  };

  const num = (v: string) => (v === "" ? null : Number.isNaN(Number(v)) ? null : Number(v));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="address"
              value={data.address}
              placeholder="SBI Complex, Beerwah, 193411, Jammu and Kashmir, India"
              onChange={(e) => onChange({ address: e.target.value })}
            />
            <Button onClick={handleGeocode} disabled={loading} className="sm:w-40">
              {loading ? "Locating…" : "Get Location"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              inputMode="decimal"
              value={data.latitude ?? ""}
              onChange={(e) => onChange({ latitude: num(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lon">Longitude</Label>
            <Input
              id="lon"
              inputMode="decimal"
              value={data.longitude ?? ""}
              onChange={(e) => onChange({ longitude: num(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={data.city} onChange={(e) => onChange({ city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" value={data.state} onChange={(e) => onChange({ state: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={data.country}
              onChange={(e) => onChange({ country: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc">Country code</Label>
            <Input
              id="cc"
              maxLength={2}
              value={data.countryCode}
              onChange={(e) => onChange({ countryCode: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={data.date}
              onChange={(e) => onChange({ date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={data.time}
              onChange={(e) => onChange({ time: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alt">Altitude</Label>
            <Input
              id="alt"
              placeholder="1650 m"
              value={data.altitude}
              onChange={(e) => onChange({ altitude: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc">Accuracy</Label>
            <Input
              id="acc"
              placeholder="±5 m"
              value={data.accuracy}
              onChange={(e) => onChange({ accuracy: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
