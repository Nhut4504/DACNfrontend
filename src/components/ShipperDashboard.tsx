import React, { useEffect, useState, useRef } from 'react';
import axios, { AxiosError } from 'axios'; // Import thêm AxiosError để xử lý lỗi
import { io, Socket } from 'socket.io-client';
import * as L from 'leaflet';
import MapTracker from './MapTracker';

// 1. Định nghĩa Type/Interface cho đối tượng Order
// Dựa theo cách bạn sử dụng trong JSX, Order sẽ trông như thế này
interface IShippingInfo {
    address: string;
    city: string;
    phoneNo: string;
    lat?: number; // Optional latitude
    lng?: number; // Optional longitude
}

interface IOrder {
    _id: string;
    orderStatus: string;
    shippingInfo?: IShippingInfo; // Dùng ? vì bạn có dùng order.shippingInfo?.address
    totalPrice: number;
}

// Định nghĩa kiểu cho data trả về từ API
interface IApiResponse {
    success: boolean;
    orders: IOrder[];
}

const ShipperDashboard: React.FC = () => {
    // 2. Thêm kiểu dữ liệu cho useState
    const [orders, setOrders] = useState<IOrder[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // 1. Hàm lấy danh sách đơn hàng từ Backend
    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('token'); 
            
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            };
            
            // 3. Thêm kiểu cho data trả về
            const { data } = await axios.get<IApiResponse>('http://localhost:5000/api/v1/orders/shipper/orders', config);
            
            if(data.success) {
                setOrders(data.orders);
            }
        } catch (err) {
            // 4. Thêm kiểu cho lỗi (dùng any hoặc AxiosError)
            const error = err as AxiosError | Error;
            console.error("Lỗi lấy đơn hàng:", error.message);
            alert("Không thể tải danh sách đơn hàng (Kiểm tra quyền Shipper)");
        } finally {
            setLoading(false);
        }
    };

    // 2. Hàm cập nhật trạng thái đơn (Giao thành công/thất bại)
    // 5. Thêm kiểu cho tham số
    const updateStatus = async (orderId: string, newStatus: string) => {
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { 'Authorization': `Bearer ${token}` } };

            await axios.put(`http://localhost:5000/api/v1/orders/shipper/orders/${orderId}`, {
                status: newStatus
            }, config);

            alert("Cập nhật thành công!");
            fetchOrders(); // Load lại danh sách sau khi update
        } catch (err) {
            const error = err as AxiosError | Error;
            // Cố gắng lấy message lỗi từ response của axios
            let errorMessage = error.message;
            if (axios.isAxiosError(error) && error.response?.data) {
                errorMessage = (error.response.data as { message: string }).message;
            }
            alert("Lỗi cập nhật: " + errorMessage);
        }
    };

        // Start delivery simulation for an order: mark shipped and emit periodic locations
        const startDeliverySimulation = async (orderId: string, passedStartLat?: number | null, passedStartLng?: number | null) => {
            try {
                // find the order to get destination coords
                const order = orders.find(o => o._id === orderId) as IOrder | undefined;
                if (!order) {
                    console.warn('Order not found for simulation', orderId);
                    return;
                }

                const destLat = order.shippingInfo?.lat ?? 10.762622;
                const destLng = order.shippingInfo?.lng ?? 106.660172;

                const sLat = (typeof passedStartLat === 'number' && passedStartLat !== null) ? passedStartLat : destLat;
                const sLng = (typeof passedStartLng === 'number' && passedStartLng !== null) ? passedStartLng : destLng;

                if ([sLat, sLng, destLat, destLng].some(v => typeof v !== 'number' || Number.isNaN(v))) {
                    console.warn('Missing coordinates for simulation', { sLat, sLng, destLat, destLng });
                    return;
                }

                // Update status to 'shipped' via API
                await updateStatus(orderId, 'shipped');

                                const socket = socketRef.current;
                                if (!socket) return;

                                // Ensure socket is connected before joining and emitting locations
                                if (!socket.connected) {
                                    // attempt to connect and wait for connect event (timeout fallback)
                                    await new Promise<void>((resolve) => {
                                        let resolved = false;
                                        socket.connect();
                                        const onConnect = () => {
                                            if (resolved) return;
                                            resolved = true;
                                            // eslint-disable-next-line no-console
                                            console.log('[Shipper] socket connected', socket.id);
                                            resolve();
                                        };
                                        socket.once('connect', onConnect);
                                        // fallback: resolve after 3s even if not connected to avoid blocking forever
                                        setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 3000);
                                    });
                                }

                                try { socket.emit('joinOrder', orderId); } catch (e) {}

                                // compute distance and duration
                                let durationMs: number;
                                try {
                                    const distanceMeters = L.latLng(sLat, sLng).distanceTo(L.latLng(destLat, destLng));
                                    if (etaMinutes && etaMinutes > 0) {
                                        durationMs = Math.max(1000, etaMinutes * 60 * 1000);
                                    } else {
                                        // estimate duration using default speed (30 km/h)
                                        const speedKmh = 30;
                                        const hours = (distanceMeters / 1000) / speedKmh;
                                        durationMs = Math.max(5000, Math.round(hours * 3600 * 1000));
                                    }
                                } catch (e) {
                                    durationMs = Math.max(1000, etaMinutes * 60 * 1000);
                                }

                                const steps = Math.max(10, Math.floor(durationMs / 1000)); // ~1 update per second
                                const intervalMs = Math.max(250, Math.floor(durationMs / steps));

                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const lat = sLat + (destLat - sLat) * t;
                    const lng = sLng + (destLng - sLng) * t;

                    // debug: log before emitting
                    // eslint-disable-next-line no-console
                    console.log('[Shipper] emitting shipperLocation', { orderId, lat, lng });
                    socket.emit('shipperLocation', { orderId, lat, lng });
                    // wait
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((res) => setTimeout(res, intervalMs));
                }

                // finalize: mark delivered
                await updateStatus(orderId, 'delivered');
            } catch (e) {
                console.error('Start delivery error', e);
            }
        };

        // Chạy hàm fetchOrders khi trang vừa load
        useEffect(() => {
                fetchOrders();
        }, []);

        // Socket for shipper simulation
        const socketRef = useRef<Socket | null>(null);

        useEffect(() => {
                // Normalize socket URL similar to MapTracker
                                const rawSocketUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
                                let normalized = 'http://localhost:5000';
                                try {
                                    if (/^https?:\/\//i.test(rawSocketUrl)) {
                                        try { normalized = new URL(rawSocketUrl).origin; } catch (e) { normalized = rawSocketUrl; }
                                    } else if (rawSocketUrl.startsWith(':')) {
                                        normalized = `${window.location.protocol}//${window.location.hostname}${rawSocketUrl}`;
                                    } else if (/^[0-9]+$/.test(rawSocketUrl)) {
                                        normalized = `${window.location.protocol}//${window.location.hostname}:${rawSocketUrl}`;
                                    } else {
                                        normalized = `${window.location.protocol}//${rawSocketUrl}`;
                                    }
                                } catch (e) {
                                    normalized = 'http://localhost:5000';
                                }

                                // eslint-disable-next-line no-console
                                console.log('[Shipper] creating socket with URL', normalized);
                                const socket = io(normalized, { autoConnect: false, path: '/socket.io', transports: ['websocket', 'polling'] });
            socketRef.current = socket;
            return () => {
                try { socket.disconnect(); } catch (e) {}
                socketRef.current = null;
            };
        }, []);

        // UI state for starting delivery (kept minimal)
        // default 0 = auto-estimate duration from distance
        const [etaMinutes, setEtaMinutes] = useState<number>(0);

    if (loading) return <div className="p-10 text-center">Đang tải đơn hàng...</div>;

    return (
        <div className="container mx-auto mt-10 px-4">
            <h1 className="text-3xl font-bold text-blue-600 mb-6">📦 Kênh Shipper - Đơn cần giao</h1>
            
            {orders.length === 0 ? (
                <p className="text-gray-500">Hiện chưa có đơn hàng nào cần giao.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 6. Thêm kiểu cho 'order' trong .map() */}
                    {orders.map((order: IOrder) => (
                        <div key={order._id} className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm font-bold text-gray-500">#{order._id.substring(0, 8)}...</span>
                                <span className={`px-2 py-1 rounded text-xs text-white ${
                                    order.orderStatus === 'delivered' ? 'bg-green-500' : 'bg-yellow-500'
                                }`}>
                                    {order.orderStatus}
                                </span>
                            </div>

                            <div className="mb-4">
                                <p className="font-semibold">📍 Địa chỉ:</p>
                                <p className="text-gray-700 text-sm">{order.shippingInfo?.address}, {order.shippingInfo?.city}</p>
                            </div>

                            <div className="mb-4">
                                <p className="font-semibold">📞 Khách hàng:</p>
                                <p className="text-gray-700 text-sm">{order.shippingInfo?.phoneNo}</p>
                                <p className="text-red-500 font-bold mt-1">
                                    Tổng tiền: {new Intl.NumberFormat('vi-VN').format(order.totalPrice)} đ
                                </p>
                            </div>

                            {/* Các nút hành động rút gọn: Bắt đầu giao / Giao thất bại */}
                            <div className="mt-4">
                                {order.orderStatus !== 'delivered' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                if (!navigator.geolocation) {
                                                    alert('Trình duyệt không hỗ trợ geolocation');
                                                    return;
                                                }
                                                navigator.geolocation.getCurrentPosition((pos) => {
                                                    const lat = pos.coords.latitude;
                                                    const lng = pos.coords.longitude;
                                                    startDeliverySimulation(order._id, lat, lng);
                                                }, (err) => {
                                                    alert('Không thể lấy vị trí hiện tại: ' + (err.message || ''));
                                                }, { enableHighAccuracy: true, timeout: 5000 });
                                            }}
                                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded transition"
                                        >
                                            Bắt đầu giao
                                        </button>
                                        <button
                                            onClick={() => updateStatus(order._id, 'Returned')}
                                            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded transition"
                                        >
                                            Giao thất bại
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ShipperDashboard;