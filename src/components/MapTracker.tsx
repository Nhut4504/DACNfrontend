import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { io, Socket } from 'socket.io-client';

interface MapTrackerProps {
  orderId: string;
  destination: { lat: number; lng: number } | null;
  height?: number;
}

// Normalize SOCKET_URL: handle cases where env var might be ':5000' or missing protocol
const rawSocketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
let SOCKET_URL = 'http://localhost:5000';
try {
  // If rawSocketUrl is an absolute URL, use its origin (strip any path like /api)
  if (/^https?:\/\//i.test(rawSocketUrl)) {
    try {
      const u = new URL(rawSocketUrl);
      SOCKET_URL = u.origin; // strip pathname
    } catch (e) {
      SOCKET_URL = rawSocketUrl;
    }
  } else if (rawSocketUrl.startsWith(':')) {
    SOCKET_URL = `${window.location.protocol}//${window.location.hostname}${rawSocketUrl}`;
  } else if (/^[0-9]+$/.test(rawSocketUrl)) {
    SOCKET_URL = `${window.location.protocol}//${window.location.hostname}:${rawSocketUrl}`;
  } else if (/^[^/]+:\d+$/.test(rawSocketUrl) || /^[^/]+:\d+\/?$/.test(rawSocketUrl)) {
    // host:port form
    SOCKET_URL = `${window.location.protocol}//${rawSocketUrl.replace(/\/$/, '')}`;
  } else {
    SOCKET_URL = `${window.location.protocol}//${rawSocketUrl}`;
  }
} catch (e) {
  SOCKET_URL = 'http://localhost:5000';
}

const MapTracker: React.FC<MapTrackerProps> = ({ orderId, destination, height = 240 }) => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const shipperMarkerRef = useRef<L.Layer | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const pathRef = useRef<L.Polyline | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!mapEl.current) return;

    mapRef.current = L.map(mapEl.current, {
      center: destination || { lat: 10.762622, lng: 106.660172 },
      zoom: 13
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // destination marker
    if (destination) {
      destMarkerRef.current = L.marker([destination.lat, destination.lng], { opacity: 0.9 }).addTo(mapRef.current);
    }

    // connect socket and join order room after connect to avoid lost emits
    // prefer websocket transport but allow polling fallback; explicitly set path
    // eslint-disable-next-line no-console
    console.log('[MapTracker] connecting to socket URL:', SOCKET_URL);
    const socket = io(SOCKET_URL, { autoConnect: true, path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[MapTracker] socket connected', socket.id);
      socket.emit('joinOrder', orderId);
    });

    socket.on('connect_error', (err: any) => {
      // eslint-disable-next-line no-console
      console.error('[MapTracker] socket connect_error', err);
    });

    socket.on('shipperLocation', (payload: any) => {
      // debug: log incoming shipperLocation payload
      // eslint-disable-next-line no-console
      console.log('[MapTracker] received shipperLocation', payload, 'for order', orderId);
      if (!payload || payload.orderId !== orderId) return;
      const { lat, lng } = payload;
      if (!mapRef.current) return;

        if (!shipperMarkerRef.current) {
          // Use a large orange truck icon for shipper for better visibility
          const truckSvg = `
            <svg viewBox="0 0 24 24" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
              <g fill="none" fill-rule="evenodd">
                <path d="M3 6h11v7h-11z" fill="#ff8a3d"/>
                <path d="M16 9h2l2 2v2h-4z" fill="#ff8a3d"/>
                <circle cx="7" cy="15" r="1.6" fill="#333"/>
                <circle cx="17" cy="15" r="1.6" fill="#333"/>
                <path d="M3 13h14" stroke="#c75a00" stroke-width="0.5"/>
              </g>
            </svg>
          `;

          const truckIcon = L.divIcon({
            html: `<div style="transform: translate(-50%, -50%); width:36px; height:36px;">${truckSvg}</div>`,
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          const marker = L.marker([lat, lng], { icon: truckIcon as any }).addTo(mapRef.current);
          shipperMarkerRef.current = marker;
        } else {
          // circle or marker both support setLatLng via L.Layer
          try {
            // @ts-ignore
            shipperMarkerRef.current.setLatLng([lat, lng]);
          } catch (e) {
            // fallback: remove & recreate
            try { shipperMarkerRef.current.remove(); } catch(_) {}
            const circle = L.circleMarker([lat, lng], { radius: 8, color: '#ff7a18', fillColor: '#ff7a18', fillOpacity: 0.95 }).addTo(mapRef.current);
            shipperMarkerRef.current = circle;
          }
        }

        // Pan map slightly to follow marker without abrupt zoom changes
        try {
          if (mapRef.current) mapRef.current.panTo([lat, lng], { animate: true });
        } catch (e) {
          // ignore
        }

        // Update or create path polyline from shipper to destination
        try {
            if (destMarkerRef.current) {
            const shipLatLng = (shipperMarkerRef.current as any).getLatLng();
            const destLatLng = destMarkerRef.current.getLatLng();

            if (!pathRef.current) {
              // Thicker, darker blue polyline for better visibility
              pathRef.current = L.polyline([shipLatLng, destLatLng], { color: '#1e40af', weight: 5, opacity: 0.95 }).addTo(mapRef.current);
            } else {
              pathRef.current.setLatLngs([shipLatLng, destLatLng]);
              // update style in case options changed
              try { pathRef.current.setStyle({ color: '#1e40af', weight: 5, opacity: 0.95 }); } catch (e) {}
            }

            // Fit bounds on first appearance
            if (!mapRef.current.getBounds().contains(destLatLng)) {
              const bounds = L.latLngBounds([shipLatLng, destLatLng]);
              mapRef.current.fitBounds(bounds, { padding: [60, 60] });
            }
          }
        } catch (e) {
          // ignore
        }
    });

    // Clean up
    return () => {
      try {
        socket.disconnect();
      } catch (e) {}
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [orderId]);

  // update destination marker when prop changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (!destination) return;

    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
    } else {
      destMarkerRef.current = L.marker([destination.lat, destination.lng]).addTo(mapRef.current);
    }
  }, [destination]);

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border">
      <div ref={mapEl} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

export default MapTracker;
