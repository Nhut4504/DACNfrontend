import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';

// Fix lỗi icon Leaflet khi bundler không load được file ảnh
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

interface MapPickerProps {
  initial?: { lat: number; lng: number };
  onSelect?: (data: { lat: number; lng: number; address?: string }) => void;
  mode?: 'default' | 'shipper';
  destination?: { lat: number; lng: number } | null;
  // if true, try to use geolocation on mount even when `initial` is provided
  preferGeolocationOnMount?: boolean;
}

const MapPicker: React.FC<MapPickerProps> = ({ initial, onSelect, mode = 'default', destination = null, preferGeolocationOnMount = false }) => {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const pathRef = useRef<L.Polyline | null>(null);

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initial || null
  );
  const [address, setAddress] = useState<string>('');
  const hasAppliedInitialRef = useRef<boolean>(false);

  // Initialize map once
  useEffect(() => {
    if (!mapElRef.current) return;

    // Create map
    mapRef.current = L.map(mapElRef.current, {
      center: initial || { lat: 10.762622, lng: 106.660172 },
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapRef.current);


    // Try to obtain browser geolocation for initial marker if no initial prop
    const tryGeolocation = () => {
      // If there's an explicit initial and caller does not want geolocation preference, skip
      if (initial && !preferGeolocationOnMount) return;
      // if user already placed a marker or a marker exists, don't override it
      if (markerRef.current) return;
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPosition({ lat, lng });
          mapRef.current?.setView([lat, lng], 15);
          if (!markerRef.current) {
            if (mode === 'shipper') {
              // shipper: show orange circle and an invisible draggable marker to capture drag
              const circle = L.circleMarker([lat, lng], { radius: 8, color: '#ff7a18', fillColor: '#ff7a18', fillOpacity: 0.95 }).addTo(mapRef.current!);
              markerRef.current = L.marker([lat, lng], { draggable: true, opacity: 0 }).addTo(mapRef.current!);
              markerRef.current.on('dragend', (e: L.DragEndEvent) => {
                const latlng = (e.target as L.Marker).getLatLng();
                setPosition({ lat: latlng.lat, lng: latlng.lng });
                reverseGeocodePoint(latlng.lat, latlng.lng);
                try { circle.setLatLng(latlng); } catch (err) {}
              });
            } else {
              markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current!);
              markerRef.current.on('dragend', onMarkerDragEnd);
            }
          } else {
            markerRef.current.setLatLng([lat, lng]);
          }
          // reverse geocode initial pos
          reverseGeocodePoint(lat, lng);
        },
        (err) => {
          // ignore geolocation errors
          console.warn('Geolocation not available or denied', err);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };

    // Handle user marker drag
    const onMarkerDragEnd = (e: L.DragEndEvent) => {
      const latlng = (e.target as L.Marker).getLatLng();
      const lat = latlng.lat;
      const lng = latlng.lng;
      // mark that user has interacted so we don't override with geolocation/initial
      hasAppliedInitialRef.current = true;
      setPosition({ lat, lng });
      reverseGeocodePoint(lat, lng);
    };

    // Allow click to place marker as well
    const onMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      // mark that user has interacted so we don't override with geolocation/initial
      hasAppliedInitialRef.current = true;
      setPosition({ lat, lng });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current!);
        markerRef.current.on('dragend', onMarkerDragEnd);
      }
      reverseGeocodePoint(lat, lng);
    };

    mapRef.current.on('click', onMapClick);

    tryGeolocation();

    // If initial position exists, add marker (draggable)
    if (initial && !hasAppliedInitialRef.current) {
      if (mode === 'shipper') {
        const circle = L.circleMarker([initial.lat, initial.lng], { radius: 8, color: '#ff7a18', fillColor: '#ff7a18', fillOpacity: 0.95 }).addTo(mapRef.current);
        markerRef.current = L.marker([initial.lat, initial.lng], { draggable: true, opacity: 0 }).addTo(mapRef.current);
        markerRef.current.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          // mark user interaction
          hasAppliedInitialRef.current = true;
          setPosition({ lat: latlng.lat, lng: latlng.lng });
          reverseGeocodePoint(latlng.lat, latlng.lng);
          try { circle.setLatLng(latlng); } catch (err) {}
        });
      } else {
        markerRef.current = L.marker([initial.lat, initial.lng], { draggable: true }).addTo(mapRef.current);
        markerRef.current.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          hasAppliedInitialRef.current = true;
          setPosition({ lat: latlng.lat, lng: latlng.lng });
          reverseGeocodePoint(latlng.lat, latlng.lng);
        });
      }
    }

    // if destination is provided and we have a start, draw a route polyline
    if (destination && (initial || position)) {
      const start = initial || position!;
      const latlngs = [[start.lat, start.lng], [destination.lat, destination.lng]];
      pathRef.current = L.polyline(latlngs as any, { color: '#3b82f6', weight: 4, opacity: 0.9 }).addTo(mapRef.current);
      destMarkerRef.current = L.marker([destination.lat, destination.lng], { opacity: 0.95 }).addTo(mapRef.current);
      try {
        const bounds = L.latLngBounds(latlngs as any);
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      } catch (err) {}
    }

    return () => {
      mapRef.current?.off();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // React to changes in initial prop
  useEffect(() => {
    if (!mapRef.current || !initial) return;
    if (hasAppliedInitialRef.current) return;

    mapRef.current.setView([initial.lat, initial.lng], 13);

    if (markerRef.current) {
      markerRef.current.setLatLng([initial.lat, initial.lng]);
    } else {
      markerRef.current = L.marker([initial.lat, initial.lng]).addTo(mapRef.current);
    }

    setPosition(initial);
    // mark applied so future updates or geolocation won't override user's manual selection
    hasAppliedInitialRef.current = true;
  }, [initial]);

  // update destination/path when destination or position changes
  useEffect(() => {
    if (!mapRef.current) return;

    // remove existing path and dest marker
    try { pathRef.current?.remove(); } catch (e) {}
    try { destMarkerRef.current?.remove(); } catch (e) {}

    const start = position || initial;
    if (destination && start) {
      destMarkerRef.current = L.marker([destination.lat, destination.lng], { opacity: 0.95 }).addTo(mapRef.current);
      const latlngs = [[start.lat, start.lng], [destination.lat, destination.lng]];
      pathRef.current = L.polyline(latlngs as any, { color: '#3b82f6', weight: 4, opacity: 0.9 }).addTo(mapRef.current);
      try {
        const bounds = L.latLngBounds(latlngs as any);
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      } catch (err) {}
    }
  }, [destination, position, initial]);

  // Reverse geocode when position changes
  useEffect(() => {
    let cancelled = false;

    async function reverseGeocode() {
      if (!position) return;

      try {
        await reverseGeocodePoint(position.lat, position.lng);
      } catch (err) {
        console.error('Reverse geocode error:', err);
        if (!cancelled) onSelect?.({ lat: position.lat, lng: position.lng });
      }
    }

    reverseGeocode();
    return () => {
      cancelled = true;
    };
  }, [position, onSelect]);

  // helper to reverse geocode a specific point and call onSelect
  async function reverseGeocodePoint(lat: number, lng: number) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocode error ${res.status}`);
      const json = await res.json();
      const display = json.display_name || '';
      setAddress(display);
      onSelect?.({ lat, lng, address: display });

      if (markerRef.current && display) {
        markerRef.current.bindPopup(display).openPopup();
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
      onSelect?.({ lat, lng });
    }
  }

  return (
    <div className="map-picker">
      <div className="text-sm text-gray-600 mb-2">
        Chọn trên bản đồ hoặc nhấp vào vị trí giao hàng
      </div>

      <div style={{ height: 300 }} className="rounded-lg overflow-hidden border">
        <div ref={mapElRef} style={{ height: '100%', width: '100%' }} />
      </div>

      {position && (
        <div className="mt-2 text-xs text-gray-700">
          <div>
            <strong>Tọa độ:</strong> {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
          </div>
          {address && (
            <div className="truncate">
              <strong>Địa chỉ:</strong> {address}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapPicker;
