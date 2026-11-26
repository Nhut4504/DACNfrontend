import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  preferGeolocationOnMount?: boolean;
}

const MapPicker: React.FC<MapPickerProps> = ({
  initial,
  onSelect,
  mode = 'default',
  destination = null
}) => {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.CircleMarker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const pathRef = useRef<L.Polyline | null>(null);

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initial || null
  );
  const [address, setAddress] = useState<string>('');
  const [locating, setLocating] = useState<boolean>(false);
  const hasUserInteractedRef = useRef<boolean>(false);

  const reverseGeocodePoint = useCallback(async (lat: number, lng: number) => {
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
  }, [onSelect]);

  // Hàm đặt hoặc di chuyển marker trên bản đồ
  const placeOrMoveMarker = useCallback((lat: number, lng: number, zoomLevel?: number) => {
    if (!mapRef.current) return;

    if (zoomLevel) {
      mapRef.current.setView([lat, lng], zoomLevel);
    } else {
      mapRef.current.panTo([lat, lng]);
    }

    if (mode === 'shipper') {
      if (!circleRef.current) {
        circleRef.current = L.circleMarker([lat, lng], {
          radius: 8,
          color: '#ff7a18',
          fillColor: '#ff7a18',
          fillOpacity: 0.95
        }).addTo(mapRef.current);
      } else {
        circleRef.current.setLatLng([lat, lng]);
      }

      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { draggable: true, opacity: 0 }).addTo(mapRef.current);
        markerRef.current.on('dragend', (e: L.DragEndEvent) => {
          const latlng = (e.target as L.Marker).getLatLng();
          hasUserInteractedRef.current = true;
          setPosition({ lat: latlng.lat, lng: latlng.lng });
          try { circleRef.current?.setLatLng(latlng); } catch (_) {}
          reverseGeocodePoint(latlng.lat, latlng.lng);
        });
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
    } else {
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
        markerRef.current.on('dragend', (e: L.DragEndEvent) => {
          const latlng = (e.target as L.Marker).getLatLng();
          hasUserInteractedRef.current = true;
          setPosition({ lat: latlng.lat, lng: latlng.lng });
          reverseGeocodePoint(latlng.lat, latlng.lng);
        });
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
    }
  }, [mode, reverseGeocodePoint]);

  // Lấy định vị hiện tại của máy tính
  const locateComputerPosition = useCallback((forceOverride = false) => {
    if (!navigator.geolocation) {
      if (forceOverride) alert('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // Nếu người dùng đã chủ động bấm chọn điểm khác trước khi GPS trả về thì không ghi đè (trừ khi bấm nút định vị lại)
        if (hasUserInteractedRef.current && !forceOverride) return;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition({ lat, lng });
        placeOrMoveMarker(lat, lng, 16);
        reverseGeocodePoint(lat, lng);
      },
      (err) => {
        setLocating(false);
        console.warn('Không lấy được định vị máy tính:', err);
        if (forceOverride) {
          alert('Không thể lấy định vị máy tính. Vui lòng bật quyền Vị trí (Location) trên trình duyệt.');
        }
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [placeOrMoveMarker, reverseGeocodePoint]);

  // Khởi tạo bản đồ 1 lần
  useEffect(() => {
    if (!mapElRef.current) return;

    const defaultCenter = initial || { lat: 10.762622, lng: 106.660172 };
    mapRef.current = L.map(mapElRef.current, {
      center: defaultCenter,
      zoom: 15,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    if (initial) {
      placeOrMoveMarker(initial.lat, initial.lng, 15);
      reverseGeocodePoint(initial.lat, initial.lng);
    }

    // Cho phép click tự do lên bản đồ để chọn điểm
    const onMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      hasUserInteractedRef.current = true;
      setPosition({ lat, lng });
      placeOrMoveMarker(lat, lng);
      reverseGeocodePoint(lat, lng);
    };

    mapRef.current.on('click', onMapClick);

    // Luôn ưu tiên lấy định vị máy tính lúc mở bản đồ để đưa tâm về vị trí hiện tại
    locateComputerPosition(false);

    return () => {
      mapRef.current?.off();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Vẽ đường nối nếu truyền destination
  useEffect(() => {
    if (!mapRef.current) return;
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

  return (
    <div className="map-picker">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-sm text-gray-600">
          Nhấp vào bản đồ hoặc kéo ghim để chọn vị trí nhận hàng
        </span>
        <button
          type="button"
          onClick={() => locateComputerPosition(true)}
          disabled={locating}
          className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
        >
          {locating ? '⏳ Đang định vị...' : '📍 Vị trí của tôi'}
        </button>
      </div>

      <div style={{ height: 300 }} className="rounded-lg overflow-hidden border relative z-0">
        <div ref={mapElRef} style={{ height: '100%', width: '100%' }} />
      </div>

      {position && (
        <div className="mt-2 text-xs text-gray-700">
          <div>
            <strong>Tọa độ đã chọn:</strong> {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
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