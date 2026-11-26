import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { io, Socket } from 'socket.io-client';

interface MapTrackerProps {
  orderId: string;
  destination: { lat: number; lng: number } | null;
  height?: number;
}

const rawSocketUrl = process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}`;
let SOCKET_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}`;
try {
  if (/^https?:\/\//i.test(rawSocketUrl)) {
    try {
      const u = new URL(rawSocketUrl);
      SOCKET_URL = u.origin;
    } catch (e) {
      SOCKET_URL = rawSocketUrl;
    }
  } else if (rawSocketUrl.startsWith(':')) {
    SOCKET_URL = `${window.location.protocol}//${window.location.hostname}${rawSocketUrl}`;
  } else if (/^[0-9]+$/.test(rawSocketUrl)) {
    SOCKET_URL = `${window.location.protocol}//${window.location.hostname}:${rawSocketUrl}`;
  } else if (/^[^/]+:\d+\/?$/.test(rawSocketUrl)) {
    SOCKET_URL = `${window.location.protocol}//${rawSocketUrl.replace(/\/$/, '')}`;
  } else {
    SOCKET_URL = `${window.location.protocol}//${rawSocketUrl}`;
  }
} catch (e) {
  SOCKET_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}`;
}

// Tính góc phương hướng (0 - 360 độ) từ 2 tọa độ
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Lấy tuyến đường thực tế OSRM nếu payload socket chưa kèm routeCoords
async function fetchRoadRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length > 1) {
      return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    }
  } catch (e) {}
  return [
    [startLat, startLng],
    [endLat, endLng]
  ];
}

// Tạo HTML icon xe nhìn từ trên xuống (mũi xe hướng lên trên = 0 độ)
function createVehicleHtml(bearing: number): string {
  return `
    <div class="shipper-vehicle-rotator" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; transform: rotate(${bearing}deg); transition: transform 0.14s linear;">
      <svg viewBox="0 0 40 40" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
        <!-- Bóng đổ -->
        <ellipse cx="20" cy="21" rx="10" ry="16" fill="rgba(0,0,0,0.22)" />
        <!-- Thùng hàng phía sau -->
        <rect x="11" y="16" width="18" height="18" rx="3" fill="#f97316" stroke="#9a3412" stroke-width="1.5"/>
        <!-- Đầu xe phía trước -->
        <path d="M12 16 L13 7 Q20 4 27 7 L28 16 Z" fill="#ea580c" stroke="#9a3412" stroke-width="1.5"/>
        <!-- Kính chắn gió -->
        <path d="M14 11 Q20 8.5 26 11 L25 14.5 L15 14.5 Z" fill="#e0f2fe"/>
        <!-- Đèn pha chỉ hướng phía trước -->
        <circle cx="14.5" cy="6.5" r="1.5" fill="#fef08a"/>
        <circle cx="25.5" cy="6.5" r="1.5" fill="#fef08a"/>
      </svg>
    </div>
  `;
}

const MapTracker: React.FC<MapTrackerProps> = ({ orderId, destination, height = 260 }) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const shipperMarkerRef = useRef<L.Marker | null>(null);
  const shopMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const pathRef = useRef<L.Polyline | null>(null);
  const arrowMarkersRef = useRef<L.Marker[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const routeDrawnRef = useRef<boolean>(false);

  // Vẽ tuyến đường + các mũi tên chỉ hướng dọc theo đường đi
  const drawDirectionalRoute = (coords: [number, number][]) => {
    if (!mapRef.current || coords.length < 2) return;

    // Xóa đường và mũi tên cũ nếu có
    try { pathRef.current?.remove(); } catch (e) {}
    arrowMarkersRef.current.forEach((m) => {
      try { m.remove(); } catch (e) {}
    });
    arrowMarkersRef.current = [];

    // Vẽ đường chính
    pathRef.current = L.polyline(coords, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.9
    }).addTo(mapRef.current);

    // Rải khoảng 7 mũi tên chỉ hướng dọc đường đi
    const arrowCount = Math.min(7, Math.max(2, Math.floor(coords.length / 6)));
    for (let k = 1; k <= arrowCount; k++) {
      const idx = Math.floor((k / (arrowCount + 1)) * (coords.length - 1));
      const p1 = coords[idx];
      const p2 = coords[Math.min(idx + 1, coords.length - 1)];
      if (!p1 || !p2 || (p1[0] === p2[0] && p1[1] === p2[1])) continue;

      const angle = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
      const arrowIcon = L.divIcon({
        html: `<div style="transform: rotate(${angle}deg); color: #ffffff; background: #1d4ed8; border: 1.5px solid #ffffff; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.35);">▲</div>`,
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const arrowMarker = L.marker(p1, { icon: arrowIcon, interactive: false }).addTo(mapRef.current);
      arrowMarkersRef.current.push(arrowMarker);
    }

    // Đặt marker Shop tại điểm xuất phát
    const startPoint = coords[0];
    if (!shopMarkerRef.current) {
      const shopIcon = L.divIcon({
        html: `<div style="background:#16a34a; color:white; font-weight:bold; font-size:11px; padding:2px 6px; border-radius:999px; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3); white-space:nowrap;">🏪 Shop</div>`,
        className: '',
        iconSize: [54, 24],
        iconAnchor: [27, 12]
      });
      shopMarkerRef.current = L.marker(startPoint, { icon: shopIcon }).addTo(mapRef.current);
    }

    // Căn khung hình bao trọn cả Shop và Khách
    try {
      const bounds = L.latLngBounds(coords);
      mapRef.current.fitBounds(bounds, { padding: [45, 45] });
    } catch (e) {}
  };

  useEffect(() => {
    if (!mapEl.current) return;

    mapRef.current = L.map(mapEl.current, {
      center: destination || { lat: 10.762622, lng: 106.660172 },
      zoom: 14
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    if (destination) {
      destMarkerRef.current = L.marker([destination.lat, destination.lng], { opacity: 0.95 })
        .bindPopup('📍 Điểm giao hàng')
        .addTo(mapRef.current);
    }

    const socket = io(SOCKET_URL, {
      autoConnect: true,
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinOrder', orderId);
    });

    socket.on('shipperLocation', async (payload: any) => {
      if (!payload || payload.orderId !== orderId) return;
      const { lat, lng } = payload;
      if (!mapRef.current) return;

      // Xác định góc xoay của xe (ưu tiên từ payload, nếu không có thì tự tính từ tọa độ trước đó)
      let bearing = typeof payload.bearing === 'number' ? payload.bearing : 0;
      if (typeof payload.bearing !== 'number' && lastPosRef.current) {
        if (lastPosRef.current.lat !== lat || lastPosRef.current.lng !== lng) {
          bearing = calculateBearing(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
        }
      }
      lastPosRef.current = { lat, lng };

      // Vẽ tuyến đường có mũi tên chỉ hướng ngay lần nhận tọa độ đầu tiên
      if (!routeDrawnRef.current) {
        routeDrawnRef.current = true;
        if (Array.isArray(payload.routeCoords) && payload.routeCoords.length > 1) {
          drawDirectionalRoute(payload.routeCoords);
        } else if (destination) {
          const startLat = payload.shopLocation?.lat ?? lat;
          const startLng = payload.shopLocation?.lng ?? lng;
          const roadCoords = await fetchRoadRoute(startLat, startLng, destination.lat, destination.lng);
          drawDirectionalRoute(roadCoords);
        }
      }

      // Tạo hoặc cập nhật vị trí + góc xoay của xe
      if (!shipperMarkerRef.current) {
        const truckIcon = L.divIcon({
          html: createVehicleHtml(bearing),
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        shipperMarkerRef.current = L.marker([lat, lng], {
          icon: truckIcon,
          zIndexOffset: 1000
        }).addTo(mapRef.current);
      } else {
        shipperMarkerRef.current.setLatLng([lat, lng]);
        const el = shipperMarkerRef.current.getElement();
        if (el) {
          const rotator = el.querySelector('.shipper-vehicle-rotator') as HTMLElement | null;
          if (rotator) {
            rotator.style.transform = `rotate(${bearing}deg)`;
          }
        }
      }
    });

    return () => {
      try { socket.disconnect(); } catch (e) {}
      arrowMarkersRef.current.forEach((m) => { try { m.remove(); } catch (_) {} });
      arrowMarkersRef.current = [];
      routeDrawnRef.current = false;
      lastPosRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [orderId]);

  useEffect(() => {
    if (!mapRef.current || !destination) return;
    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
    } else {
      destMarkerRef.current = L.marker([destination.lat, destination.lng]).addTo(mapRef.current);
    }
  }, [destination]);

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border relative z-0">
      <div ref={mapEl} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

export default MapTracker;