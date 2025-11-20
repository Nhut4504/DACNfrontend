// src/pages/OrderHistory.tsx - Updated với thông tin thanh toán chi tiết
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import ReviewForm from '../components/ReviewForm';
import MapTracker from '../components/MapTracker';
import { useAuth } from '../context/AuthContext';
import { 
  ShoppingBagIcon, 
  XMarkIcon,
  QrCodeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  BanknotesIcon,
  TicketIcon,
  SparklesIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<{productId: string, orderId: string} | null>(null);
  const [cancelingOrder, setCancelingOrder] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<{orderId: string, orderNumber: string} | null>(null);
  const [showQRModal, setShowQRModal] = useState<any>(null);
  const [showRouteModal, setShowRouteModal] = useState<{ orderId: string; dest: { lat: number; lng: number } } | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
    // Setup socket for real-time order updates (normalize URL and strip any /api path)
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
    console.log('[OrderHistory] connecting socket to', normalized);
    const socket = io(normalized, { autoConnect: true, path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('orderStatusUpdated', (payload: any) => {
      if (!payload || !payload.orderId) return;
      // Update local orders
      setOrders((prev) => prev.map(o => o._id === payload.orderId ? { ...o, orderStatus: payload.status || payload.orderStatus || o.orderStatus } : o));

      // If the order was moved to 'shipped', ensure this socket joins the order room
      try {
        if (payload.status === 'shipped' || payload.orderStatus === 'shipped') {
          // eslint-disable-next-line no-console
          console.log('[OrderHistory] joining order room for', payload.orderId);
          socketRef.current?.emit('joinOrder', payload.orderId);
        }
      } catch (e) {
        // ignore
      }
    });

    return () => {
      try { socket.disconnect(); } catch (e) {}
      socketRef.current = null;
    };
  }, [user]);

  // Auto-refresh orders every 5 minutes to check payment status
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        fetchOrders();
      }, 5 * 60 * 1000); // 5 minutes
      
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get('/orders/my-orders');
      console.log('Orders fetched:', data);
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewQR = async (orderId: string) => {
    setLoadingQR(true);
    try {
      const { data } = await axios.get(`/orders/${orderId}/qr-code`);
      setShowQRModal(data);
    } catch (error: any) {
      console.error('Error fetching QR code:', error);
      if (error.response?.data?.expired) {
        alert('Đơn hàng đã hết hạn thanh toán');
      } else {
        alert(error.response?.data?.message || 'Không thể tải mã QR');
      }
    } finally {
      setLoadingQR(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancelingOrder(orderId);
    try {
      const { data } = await axios.put(`/orders/${orderId}/cancel`);
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId 
            ? { ...order, orderStatus: 'cancelled' }
            : order
        )
      );
      
      setShowCancelModal(null);
      alert('Đơn hàng đã được hủy thành công!');
    } catch (error: any) {
      console.error('Error canceling order:', error);
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi hủy đơn hàng');
    } finally {
      setCancelingOrder(null);
    }
  };

  const canCancelOrder = (orderStatus: string) => {
    return orderStatus === 'pending' || orderStatus === 'processing';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'shipped': return 'text-purple-600 bg-purple-50';
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      case 'expired': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'processing': return 'Đang xử lý';
      case 'shipped': return 'Đang giao hàng';
      case 'delivered': return 'Đã giao hàng';
      case 'cancelled': return 'Đã hủy';
      case 'expired': return 'Hết hạn thanh toán';
      default: return status;
    }
  };

  const formatTimeRemaining = (deadline: any) => {
    if (!deadline) return null;
    
    if (deadline.isExpired) {
      return <span className="text-red-600">Đã hết hạn thanh toán</span>;
    }
    
    const { hoursRemaining, minutesRemaining } = deadline;
    
    if (hoursRemaining <= 6) {
      return (
        <span className="text-orange-600 font-medium flex items-center">
          <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
          Còn {hoursRemaining}h {minutesRemaining}m để thanh toán
        </span>
      );
    }
    
    return (
      <span className="text-blue-600 flex items-center">
        <ClockIcon className="w-4 h-4 mr-1" />
        Còn {hoursRemaining}h {minutesRemaining}m để thanh toán
      </span>
    );
  };

  const togglePaymentDetails = (orderId: string) => {
    setExpandedPayment(expandedPayment === orderId ? null : orderId);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Vui lòng đăng nhập để xem lịch sử đơn hàng</p>
        <Link to="/login" className="text-blue-600 hover:underline">
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBagIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Chưa có đơn hàng nào</h2>
        <p className="text-gray-500 mb-6">Hãy mua sắm và đặt hàng ngay!</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Mua sắm ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Lịch sử đơn hàng ({orders.length})</h1>

      <div className="space-y-4">
        {orders.map((order: any) => (
          <div key={order._id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Order Header */}
            <div className="bg-gray-50 px-6 py-4 border-b">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Mã đơn hàng: <span className="font-semibold text-gray-800">#{order._id.slice(-8)}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Ngày đặt: {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {/* Payment deadline for bank transfer */}
                  {order.paymentMethod === 'BankTransfer' && 
                   order.paymentStatus === 'pending' && 
                   order.paymentDeadlineStatus && 
                   !order.paymentDeadlineStatus.isExpired && (
                    <div className="mt-2">
                      {formatTimeRemaining(order.paymentDeadlineStatus)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.orderStatus)}`}>
                    {getStatusText(order.orderStatus)}
                  </span>
                  
                  {/* Show QR button for pending bank transfer */}
                  {order.paymentMethod === 'BankTransfer' && 
                   order.paymentStatus === 'pending' && 
                   order.orderStatus !== 'cancelled' &&
                   order.orderStatus !== 'expired' && (
                    <button
                      onClick={() => handleViewQR(order._id)}
                      disabled={loadingQR}
                      className="px-3 py-1 text-sm rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors flex items-center"
                    >
                      <QrCodeIcon className="w-4 h-4 mr-1" />
                      Xem QR
                    </button>
                  )}
                  {/* View route button (shows live map) */}
                  <button
                    onClick={() => {
                      const lat = order.shippingAddress?.lat;
                      const lng = order.shippingAddress?.lng;
                      if (typeof lat === 'number' && typeof lng === 'number') {
                        // Join the order room before opening the modal so we receive shipperLocation events
                        try {
                          // eslint-disable-next-line no-console
                          console.log('[OrderHistory] user opened route modal — joining order room', order._id);
                          socketRef.current?.emit('joinOrder', order._id);
                        } catch (e) {}

                        setShowRouteModal({ orderId: order._id, dest: { lat: Number(lat), lng: Number(lng) } });
                      } else {
                        alert('Chưa có tọa độ giao hàng. Vui lòng để khách hàng chọn vị trí trên bản đồ.');
                      }
                    }}
                    className="px-3 py-1 text-sm rounded-md bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors flex items-center ml-2"
                  >
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 10h11M3 6h11M3 14h7m3 0v7l4-4-4-4v7"/></svg>
                    Xem lộ trình
                  </button>
                  
                  {/* Cancel button */}
                  {canCancelOrder(order.orderStatus) && (
                    <button
                      onClick={() => setShowCancelModal({
                        orderId: order._id,
                        orderNumber: order._id.slice(-8)
                      })}
                      disabled={cancelingOrder === order._id}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        cancelingOrder === order._id
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {cancelingOrder === order._id ? 'Đang hủy...' : 'Hủy đơn'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="p-6">
              <div className="space-y-4">
                {order.items.map((item: any) => (
                  <div key={item._id} className="flex items-center space-x-4">
                    <img
                      src={item.product?.images?.[0] || '/placeholder.jpg'}
                      alt={item.product?.name || 'Product'}
                      className="w-20 h-20 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{item.product?.name || 'Sản phẩm đã xóa'}</h3>
                      <p className="text-sm text-gray-600">
                        Size: {item.size} | Màu: {item.color} | SL: {item.quantity}
                      </p>
                      <div className="mt-1">
                        {item.isFlashSaleItem ? (
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-red-600">
                              {(item.price * item.quantity).toLocaleString('vi-VN')}₫
                            </p>
                            <p className="text-xs text-gray-400 line-through">
                              {(item.originalPrice * item.quantity).toLocaleString('vi-VN')}₫
                            </p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <SparklesIcon className="w-3 h-3 mr-1" />
                              Flash Sale
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-gray-800">
                            {(item.price * item.quantity).toLocaleString('vi-VN')}₫
                          </p>
                        )}
                      </div>
                    </div>
                    {order.orderStatus === 'delivered' && item.product && (
                      <button
                        onClick={() => setSelectedReview({productId: item.product._id, orderId: order._id})}
                        className="text-blue-600 text-sm hover:underline whitespace-nowrap"
                      >
                        Đánh giá
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Payment Details Section */}
              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => togglePaymentDetails(order._id)}
                  className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700 flex items-center">
                    <ReceiptPercentIcon className="w-5 h-5 mr-2" />
                    Chi tiết thanh toán
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${
                      expandedPayment === order._id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedPayment === order._id && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-3">
                    {/* Subtotal */}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tạm tính:</span>
                      <span className="font-medium">{order.subtotal.toLocaleString('vi-VN')}₫</span>
                    </div>

                    {/* Flash Sale Discount */}
                    {order.flashSaleDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 flex items-center">
                          <SparklesIcon className="w-4 h-4 mr-1 text-red-500" />
                          Giảm giá Flash Sale:
                        </span>
                        <span className="font-medium text-red-600">
                          -{order.flashSaleDiscount.toLocaleString('vi-VN')}₫
                        </span>
                      </div>
                    )}

                    {/* Voucher Discount */}
                    {order.voucherDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 flex items-center">
                          <TicketIcon className="w-4 h-4 mr-1 text-blue-500" />
                          Giảm giá Voucher{order.voucherCode && ` (${order.voucherCode})`}:
                        </span>
                        <span className="font-medium text-blue-600">
                          -{order.voucherDiscount.toLocaleString('vi-VN')}₫
                        </span>
                      </div>
                    )}

                    {/* Total Discount */}
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                        <span className="text-gray-600 font-medium">Tổng giảm giá:</span>
                        <span className="font-semibold text-green-600">
                          -{order.discountAmount.toLocaleString('vi-VN')}₫
                        </span>
                      </div>
                    )}

                    {/* Shipping Fee */}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Phí vận chuyển:</span>
                      <span className="font-medium">
                        {order.shippingFee > 0 
                          ? `${order.shippingFee.toLocaleString('vi-VN')}₫`
                          : 'Miễn phí'
                        }
                      </span>
                    </div>

                    {/* Payment Method */}
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Phương thức thanh toán:</span>
                      <span className="font-medium flex items-center">
                        {order.paymentMethod === 'COD' ? (
                          <>
                            <BanknotesIcon className="w-4 h-4 mr-1" />
                            Thanh toán khi nhận hàng
                          </>
                        ) : (
                          <>
                            <QrCodeIcon className="w-4 h-4 mr-1" />
                            Chuyển khoản
                            {order.paymentStatus === 'paid' && (
                              <CheckCircleIcon className="w-4 h-4 ml-2 text-green-600" />
                            )}
                          </>
                        )}
                      </span>
                    </div>

                    {/* Total Amount */}
                    <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                      <span className="font-semibold text-gray-700">Thành tiền:</span>
                      <span className="text-xl font-bold text-red-600">
                        {order.totalAmount.toLocaleString('vi-VN')}₫
                      </span>
                    </div>

                    {/* Savings Badge */}
                    {order.discountAmount > 0 && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800 font-medium text-center">
                          🎉 Bạn đã tiết kiệm được {order.discountAmount.toLocaleString('vi-VN')}₫
                          {order.flashSaleDiscount > 0 && order.voucherDiscount > 0 && (
                            <span className="text-xs block mt-1 text-green-600">
                              (Flash Sale: {order.flashSaleDiscount.toLocaleString('vi-VN')}₫ + 
                              Voucher: {order.voucherDiscount.toLocaleString('vi-VN')}₫)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-1">Địa chỉ giao hàng:</p>
                  <p className="text-sm">
                    {order.shippingAddress.recipientName} - {order.shippingAddress.recipientPhone}
                  </p>
                  <p className="text-sm">
                    {order.shippingAddress.street}, {order.shippingAddress.state}, {order.shippingAddress.city}
                  </p>
                </div>
              )}

              {/* Live tracking map when order is in delivery */}
              {order.orderStatus === 'shipped' && order.shippingAddress?.lat && order.shippingAddress?.lng && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Theo dõi hành trình shipper:</p>
                  <MapTracker
                    orderId={order._id}
                    destination={{ lat: Number(order.shippingAddress.lat), lng: Number(order.shippingAddress.lng) }}
                    height={260}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Thông tin thanh toán</h3>
              <button
                onClick={() => setShowQRModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: QR Code */}
              <div className="space-y-4">
                {/* Payment deadline warning */}
                {showQRModal.hoursRemaining !== undefined && showQRModal.hoursRemaining <= 6 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-orange-800">
                          Sắp hết hạn thanh toán!
                        </p>
                        <p className="text-sm text-orange-600">
                          Còn {showQRModal.hoursRemaining}h {showQRModal.minutesRemaining}m để thanh toán
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg shadow-md">
                    <img 
                      src={showQRModal.qrUrl}
                      alt="QR Code"
                      className="w-60 h-60"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Bank Info */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Ngân hàng</p>
                  <p className="font-semibold text-lg">MB Bank</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Số tài khoản</p>
                  <p className="font-semibold font-mono text-lg">{showQRModal.accountNo}</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Chủ tài khoản</p>
                  <p className="font-semibold text-lg">{showQRModal.accountName}</p>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Số tiền</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {showQRModal.amount.toLocaleString('vi-VN')}₫
                  </p>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Nội dung chuyển khoản</p>
                  <p className="font-bold font-mono text-lg break-all">{showQRModal.content}</p>
                </div>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="mt-6 bg-blue-50 rounded-lg p-4">
              <div className="flex items-start">
                <InformationCircleIcon className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-2">Hướng dẫn thanh toán</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Quét mã QR bằng app ngân hàng hoặc chuyển khoản thủ công</li>
                    <li>• Nhập đúng nội dung chuyển khoản để hệ thống tự động xác nhận</li>
                    <li>• Đơn hàng sẽ được xử lý sau 5-10 phút kể từ khi thanh toán thành công</li>
                    <li>• Liên hệ hỗ trợ nếu sau 15 phút đơn hàng chưa được cập nhật</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowQRModal(null)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Lộ trình giao hàng</h3>
              <button onClick={() => setShowRouteModal(null)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div>
              <MapTracker
                orderId={showRouteModal.orderId}
                destination={showRouteModal.dest}
                height={420}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowRouteModal(null)} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Xác nhận hủy đơn hàng</h3>
              <button
                onClick={() => setShowCancelModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                Bạn có chắc chắn muốn hủy đơn hàng <span className="font-semibold">#{showCancelModal.orderNumber}</span> không?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Sau khi hủy, đơn hàng sẽ không thể khôi phục. Số lượng sản phẩm sẽ được hoàn trả về kho.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelModal(null)}
                className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Không, giữ lại
              </button>
              <button
                onClick={() => handleCancelOrder(showCancelModal.orderId)}
                disabled={cancelingOrder === showCancelModal.orderId}
                className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                  cancelingOrder === showCancelModal.orderId
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {cancelingOrder === showCancelModal.orderId ? 'Đang hủy...' : 'Có, hủy đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <ReviewForm
              productId={selectedReview.productId}
              orderId={selectedReview.orderId}
              onSuccess={() => {
                setSelectedReview(null);
                fetchOrders();
              }}
            />
            <button
              onClick={() => setSelectedReview(null)}
              className="mt-4 w-full text-gray-600 hover:text-gray-800"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
