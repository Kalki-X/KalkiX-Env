import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Leaflet's default marker icon resolves image paths relative to the CSS file location,
// which breaks under Vite's bundling — this is the standard workaround: import the icon
// assets explicitly and point the default icon at the bundled URLs.
const defaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const DEFAULT_CENTER: [number, number] = [20, 0]; // world view fallback when no pin is set yet
const DEFAULT_ZOOM = 2;
const PINNED_ZOOM = 13;

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

interface LocationPickerProps {
    lat: number | null;
    lng: number | null;
    onChange?: (lat: number, lng: number) => void;
    readOnly?: boolean;
    height?: number;
}

// Click-to-drop-a-pin map, backed by free OpenStreetMap tiles (no API key needed).
// In readOnly mode (renter viewing a pickup location) it just renders the marker with
// no click handler.
export default function LocationPicker({ lat, lng, onChange, readOnly = false, height = 280 }: LocationPickerProps) {
    const hasPin = lat !== null && lng !== null;
    const center = useMemo<[number, number]>(() => (hasPin ? [lat as number, lng as number] : DEFAULT_CENTER), [hasPin, lat, lng]);

    return (
        <div style={{ height, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <MapContainer
                center={center}
                zoom={hasPin ? PINNED_ZOOM : DEFAULT_ZOOM}
                style={{ height: "100%", width: "100%" }}
                // Re-mount when the pin appears/disappears so the map recenters correctly
                // instead of relying on imperative recentering.
                key={hasPin ? `${lat}-${lng}` : "no-pin"}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {!readOnly && onChange && <ClickHandler onPick={onChange} />}
                {hasPin && <Marker position={[lat as number, lng as number]} icon={defaultIcon} />}
            </MapContainer>
        </div>
    );
}
