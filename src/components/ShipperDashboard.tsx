import React, { useEffect, useState, useRef } from 'react';
import axios, { AxiosError } from 'axios';
import { io, Socket } from 'socket.io-client';

interface IShippingInfo {
    address: string;
    city: string;
    phoneNo: string;
    lat?: number;
    lng?: number;
}

interface IShipperInfo {
    name: string;
    phone: string;
}

interface IOrder {
    _id: string;
    orderStatus: string;
    shippingInfo?: IShippingInfo;
    shipperInfo?: IShipperInfo;
    totalPrice: number;
}

interface IApiResponse {
    success: boolean;
    orders: IOrder[];
}

// Tính góc phương hướng (0 - 360 độ) từ điểm A sang điểm B
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

// Lấy tọa độ đường đi thực tế từ OSRM (fallback về đường thẳng nếu lỗi mạng)
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
            // OSRM trả về [lng, lat] -> đảo thành [lat, lng] cho Leaflet
            return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        }
    } catch (e) {
        console.warn('OSRM route fallback to straight line:', e);
    }
    return [
        [startLat, startLng],
        [endLat, endLng]
    ];
}

// Chia đều tuyến đường thành N điểm mượt để xe chạy đều tốc độ
function resampleRoute(coords: [number, number][], totalSteps: number): [number, number][] {
    if (coords.length < 2) return coords;
    const segLengths: number[] = [];
    let totalDist = 0;

    for (let i = 0; i < coords.length - 1; i++) {
        const dLat = coords[i + 1][0] - coords[i][0];
        const dLng = coords[i + 1][1] - coords[i][1];
        const dist = Math.hypot(dLat, dLng);
        segLengths.push(dist);
        totalDist += dist;
    }

    if (totalDist === 0) return [coords[0]];

    const result: [number, number][] = [coords[0]];
    for (let step = 1; step < totalSteps; step++) {
        const targetDist = (step / totalSteps) * totalDist;
        let accum = 0;
        for (let i = 0; i < segLengths.length; i++) {
            if (accum + segLengths[i] >= targetDist) {
                const ratio = segLengths[i] === 0 ? 0 : (targetDist - accum) / segLengths[i];
                const lat = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * ratio;
                const lng = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * ratio;
                result.push([lat, lng]);
                break;
            }
            accum += segLengths[i];
        }
    }
    result.push(coords[coords.length - 1]);
    return result;
}

const ShipperDashboard: React.FC = () => {
    const [orders, setOrders] = useState<IOrder[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // State cho Modal nhập thông tin Shipper
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [shipperName, setShipperName] = useState<string>(() => localStorage.getItem('shipper_name') || '');
    const [shipperPhone, setShipperPhone] = useState<string>(() => localStorage.getItem('shipper_phone') || '');

    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('token');
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            };
            const { data } = await axios.get<IApiResponse>(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/v1/orders/shipper/orders`, config);
            if (data.success) {
                setOrders(data.orders);
            }
        } catch (err) {
            const error = err as AxiosError | Error;
            console.error('Lỗi lấy đơn hàng:', error.message);
            alert('Không thể tải danh sách đơn hàng (Kiểm tra quyền Shipper)');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (orderId: string, newStatus: string, info?: IShipperInfo) => {
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { 'Authorization': `Bearer ${token}` } };

            await axios.put(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/v1/orders/shipper/orders/${orderId}`, {
                status: newStatus,
                ...(info ? { shipperInfo: info } : {})
            }, config);

            fetchOrders();
        } catch (err) {
            const error = err as AxiosError | Error;
            let errorMessage = error.message;
            if (axios.isAxiosError(error) && error.response?.data) {
                errorMessage = (error.response.data as { message: string }).message;
            }
            alert('Lỗi cập nhật: ' + errorMessage);
            throw error;
        }
    };

    const startDeliverySimulation = async (
        orderId: string,
        shopLat: number,
        shopLng: number,
        info?: IShipperInfo
    ) => {
        try {
            const order = orders.find(o => o._id === orderId);
            if (!order) return;

            const destLat = order.shippingInfo?.lat ?? 10.762622;
            const destLng = order.shippingInfo?.lng ?? 106.660172;

            // Cập nhật trạng thái sang 'shipped' kèm thông tin shipper
            await updateStatus(orderId, 'shipped', info);

            const socket = socketRef.current;
            if (!socket) return;

            if (!socket.connected) {
                await new Promise<void>((resolve) => {
                    let resolved = false;
                    socket.connect();
                    socket.once('connect', () => {
                        if (!resolved) { resolved = true; resolve(); }
                    });
                    setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 3000);
                });
            }

            try { socket.emit('joinOrder', orderId); } catch (e) {}

            // Lấy lộ trình đường thực tế từ Shop (máy tính) -> Khách hàng
            const rawRoute = await fetchRoadRoute(shopLat, shopLng, destLat, destLng);

            // Chạy nhanh toàn bộ hành trình trong ~9 giây (60 bước * 150ms)
            const totalSteps = 60;
            const intervalMs = 150;
            const smoothPoints = resampleRoute(rawRoute, totalSteps);

            let lastBearing = 0;
            for (let i = 0; i < smoothPoints.length; i++) {
                const [lat, lng] = smoothPoints[i];
                if (i < smoothPoints.length - 1) {
                    const [nextLat, nextLng] = smoothPoints[i + 1];
                    if (lat !== nextLat || lng !== nextLng) {
                        lastBearing = calculateBearing(lat, lng, nextLat, nextLng);
                    }
                }

                socket.emit('shipperLocation', {
                    orderId,
                    lat,
                    lng,
                    bearing: lastBearing,
                    shopLocation: { lat: shopLat, lng: shopLng },
                    routeCoords: rawRoute
                });

                await new Promise((res) => setTimeout(res, intervalMs));
            }

            // Hoàn tất giao hàng
            await updateStatus(orderId, 'delivered');
        } catch (e) {
            console.error('Start delivery error', e);
        }
    };

    const handleConfirmDelivery = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrderId) return;

        if (!shipperName.trim() || !shipperPhone.trim()) {
            alert('Vui lòng nhập đầy đủ họ tên và số điện thoại của bạn!');
            return;
        }

        localStorage.setItem('shipper_name', shipperName.trim());
        localStorage.setItem('shipper_phone', shipperPhone.trim());

        const info: IShipperInfo = {
            name: shipperName.trim(),
            phone: shipperPhone.trim()
        };
        const targetOrderId = selectedOrderId;
        setSelectedOrderId(null);

        if (!navigator.geolocation) {
            alert('Trình duyệt không hỗ trợ định vị GPS');
            return;
        }

        // Lấy định vị máy tính làm vị trí Shop xuất phát
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                startDeliverySimulation(targetOrderId, pos.coords.latitude, pos.coords.longitude, info);
            },
            (err) => {
                alert('Không thể lấy định vị máy tính (vị trí Shop): ' + (err.message || ''));
            },
            { enableHighAccuracy: true, timeout: 6000 }
        );
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const rawSocketUrl = process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}`;
        let normalized = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}`;
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
            normalized = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}`;
        }

        const socket = io(normalized, { autoConnect: false, path: '/socket.io', transports: ['websocket', 'polling'] });
        socketRef.current = socket;
        return () => {
            try { socket.disconnect(); } catch (e) {}
            socketRef.current = null;
        };
    }, []);

    if (loading) return <div className="p-10 text-center">Đang tải đơn hàng...</div>;

    return (
        <div className="container mx-auto mt-10 px-4">
            <h1 className="text-3xl font-bold text-blue-600 mb-6">📦 Kênh Shipper - Đơn cần giao</h1>

            {orders.length === 0 ? (
                <p className="text-gray-500">Hiện chưa có đơn hàng nào cần giao.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

                            {order.shipperInfo?.name && (
                                <div className="mb-4 p-2.5 bg-blue-50 border border-blue-200 rounded text-sm">
                                    <p className="font-semibold text-blue-800">🛵 Shipper phụ trách:</p>
                                    <p className="text-blue-700">{order.shipperInfo.name} - {order.shipperInfo.phone}</p>
                                </div>
                            )}

                            <div className="mt-4">
                                {order.orderStatus !== 'delivered' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedOrderId(order._id)}
                                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded transition font-medium"
                                        >
                                            Bắt đầu giao
                                        </button>
                                        <button
                                            onClick={() => updateStatus(order._id, 'cancelled')}
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

            {/* Modal nhập thông tin Shipper */}
            {selectedOrderId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">🛵 Thông tin Shipper giao hàng</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Nhập tên và số điện thoại của bạn để khách hàng liên hệ khi giao đơn <span className="font-semibold">#{selectedOrderId.slice(-8)}</span>.
                        </p>

                        <form onSubmit={handleConfirmDelivery} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Họ và tên Shipper <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={shipperName}
                                    onChange={(e) => setShipperName(e.target.value)}
                                    placeholder="Ví dụ: Nguyễn Văn A"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Số điện thoại liên hệ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={shipperPhone}
                                    onChange={(e) => setShipperPhone(e.target.value)}
                                    placeholder="Ví dụ: 0901234567"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedOrderId(null)}
                                    className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition"
                                >
                                    Xác nhận & Giao
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShipperDashboard;