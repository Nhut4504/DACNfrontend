// src/pages/admin/AdminIotStation.tsx
import React, { useEffect, useRef, useState } from 'react';
import axios from '../../utils/axios';
import { BACKEND_URL, IOT_API_URL } from '../../config';

type StationMode = 'REGISTER' | 'IMPORT' | 'PACK';

interface ScanLogEntry {
  id: string;
  uid: string;
  mode: StationMode;
  success: boolean;
  productName: string;
  message: string;
  time: string;
}

interface StationState {
  mode: StationMode;
  activeOrderId: string | null;
  packedCounts: Record<string, number>;
  lastScannedUid: string | null;
  lastScannedAt: string | null;
  logs: ScanLogEntry[];
}

interface ProductOption {
  _id?: string;
  id?: string;
  name: string;
  price?: number;
  images?: string | string[];
}

interface RfidTagItem {
  id: string;
  uid: string;
  productId: string;
  size: string;
  color: string;
  status: string;
  product?: ProductOption;
}

interface OrderItemOption {
  _id?: string;
  id?: string;
  productId?: string;
  name?: string;
  size?: string;
  color?: string;
  quantity: number;
  product?: {
    _id?: string;
    id?: string;
    name?: string;
  };
}

interface OrderOption {
  _id?: string;
  id?: string;
  orderStatus?: string;
  user?: {
    name?: string;
    email?: string;
  };
  shippingAddress?: {
    recipientName?: string;
  };
  items?: OrderItemOption[];
}

interface NoticeState {
  type: 'success' | 'error' | 'info';
  text: string;
}

function getFirstImage(images?: string | string[]): string {
  if (!images) return 'https://via.placeholder.com/48?text=SP';
  const first = Array.isArray(images) ? images[0] : String(images).split(',')[0].trim();
  if (!first) return 'https://via.placeholder.com/48?text=SP';
  if (first.startsWith('http://') || first.startsWith('https://')) return first;
  return `${BACKEND_URL}${first.startsWith('/') ? '' : '/'}${first}`;
}

const AdminIotStation: React.FC = () => {
  const [stationState, setStationState] = useState<StationState>({
    mode: 'REGISTER',
    activeOrderId: null,
    packedCounts: {},
    lastScannedUid: null,
    lastScannedAt: null,
    logs: []
  });

  const [tags, setTags] = useState<RfidTagItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);

  const [uidInput, setUidInput] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [sizeInput, setSizeInput] = useState<string>('M');
  const [colorInput, setColorInput] = useState<string>('Đen');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loadingSave, setLoadingSave] = useState<boolean>(false);

  const lastScanTimeRef = useRef<string | null>(null);

  const fetchInitialData = async () => {
    try {
      const [tagsRes, prodRes, ordRes] = await Promise.all([
        axios.get(`${IOT_API_URL}/iot/tags`),
        axios.get('/products', { params: { limit: 100 } }),
        axios.get('/admin/orders', { params: { page: 1, limit: 50 } })
      ]);

      if (tagsRes.data?.success) {
        setTags(tagsRes.data.tags || []);
      }

      const prodList: ProductOption[] = Array.isArray(prodRes.data)
        ? prodRes.data
        : prodRes.data?.products || prodRes.data?.data || [];
      setProducts(prodList);
      if (prodList.length > 0) {
        const firstId = prodList[0].id || prodList[0]._id || '';
        setSelectedProductId((prev) => prev || firstId);
      }

      const ordList: OrderOption[] = ordRes.data?.orders || [];
      const pendingOrders = ordList.filter((o) =>
        ['pending', 'processing'].includes(String(o.orderStatus || '').toLowerCase())
      );
      setOrders(pendingOrders);
    } catch (err) {
      console.error('Lỗi tải dữ liệu IoT:', err);
    }
  };

  const syncStationState = async () => {
    try {
      const res = await axios.get(`${IOT_API_URL}/iot/state`);
      const data = res.data;
      if (!data?.success || !data?.state) return;

      const nextState: StationState = data.state;
      setStationState(nextState);

      if (nextState.activeOrderId) {
        setSelectedOrderId(nextState.activeOrderId);
      }

      if (nextState.lastScannedAt && nextState.lastScannedAt !== lastScanTimeRef.current) {
        const isFirstLoad = lastScanTimeRef.current === null;
        lastScanTimeRef.current = nextState.lastScannedAt;

        if (!isFirstLoad && nextState.lastScannedUid) {
          setUidInput(nextState.lastScannedUid);
          const latestLog = nextState.logs?.[0];
          if (latestLog) {
            setNotice({
              type: latestLog.success ? 'success' : 'error',
              text: latestLog.message
            });
          }
          fetchInitialData();
        }
      }
    } catch (err) {
      console.error('Lỗi đồng bộ trạm IoT:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
    syncStationState();
    const timer = setInterval(syncStationState, 1500);
    return () => clearInterval(timer);
  }, []);

  const handleChangeMode = async (newMode: StationMode, customOrderId: string | null = null) => {
    try {
      const orderIdToSend = newMode === 'PACK' ? customOrderId || selectedOrderId || null : null;
      const res = await axios.post(`${IOT_API_URL}/iot/mode`, {
        mode: newMode,
        orderId: orderIdToSend
      });
      if (res.data?.success) {
        setStationState(res.data.state);
        setNotice({
          type: 'info',
          text:
            newMode === 'REGISTER'
              ? 'Đã chuyển sang chế độ Gán thẻ RFID. Hãy quét thẻ trên mạch để lấy mã UID.'
              : newMode === 'IMPORT'
              ? 'Đã chuyển sang chế độ Nhập kho nhanh. Quét thẻ sản phẩm để cộng +1 tồn kho.'
              : 'Đã chuyển sang chế độ Đóng gói đơn hàng.'
        });
      }
    } catch {
      setNotice({ type: 'error', text: 'Không thể đổi chế độ trạm IoT.' });
    }
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uidInput.trim() || !selectedProductId) {
      setNotice({ type: 'error', text: 'Vui lòng quét thẻ để lấy mã UID và chọn sản phẩm.' });
      return;
    }

    setLoadingSave(true);
    try {
      const res = await axios.post(`${IOT_API_URL}/iot/tags`, {
        uid: uidInput.trim().toUpperCase(),
        productId: selectedProductId,
        size: sizeInput,
        color: colorInput
      });
      if (res.data?.success) {
        setNotice({ type: 'success', text: res.data.message });
        setUidInput('');
        fetchInitialData();
      } else {
        setNotice({ type: 'error', text: res.data?.message || 'Lỗi lưu thẻ RFID' });
      }
    } catch {
      setNotice({ type: 'error', text: 'Lỗi kết nối máy chủ khi lưu thẻ.' });
    } finally {
      setLoadingSave(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!window.confirm('Bạn có chắc muốn hủy gán thẻ RFID này?')) return;
    try {
      const res = await axios.delete(`${IOT_API_URL}/iot/tags/${tagId}`);
      if (res.data?.success) {
        setNotice({ type: 'success', text: 'Đã xóa liên kết thẻ RFID.' });
        fetchInitialData();
      }
    } catch {
      setNotice({ type: 'error', text: 'Không xóa được thẻ RFID.' });
    }
  };

  const activeOrder = orders.find((o) => (o._id || o.id) === selectedOrderId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Tiêu đề & Thanh chọn chế độ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
            <h1 className="text-xl font-bold text-gray-800">
              Trạm Quản Lý Kho & Đóng Gói RFID (IoT)
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Đồng bộ trực tiếp với mạch ESP8266 NodeMCU + đầu đọc RC522
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleChangeMode('REGISTER')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              stationState.mode === 'REGISTER'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            1. Gán thẻ RFID
          </button>
          <button
            type="button"
            onClick={() => handleChangeMode('IMPORT')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              stationState.mode === 'IMPORT'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            2. Nhập kho nhanh (+1)
          </button>
          <button
            type="button"
            onClick={() => handleChangeMode('PACK')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              stationState.mode === 'PACK'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            3. Đóng gói đơn hàng
          </button>
        </div>
      </div>

      {/* Thanh thông báo */}
      {notice && (
        <div
          className={`px-4 py-3 rounded-lg border text-sm font-medium flex items-center justify-between ${
            notice.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : notice.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs underline ml-4 opacity-75 hover:opacity-100"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Bố cục 2 cột chính */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* CHẾ ĐỘ 1: GÁN THẺ RFID */}
          {stationState.mode === 'REGISTER' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-base font-bold text-gray-800 mb-4">
                Gán thẻ từ RFID vào sản phẩm
              </h2>
              <form onSubmit={handleSaveTag} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Mã UID thẻ (Quét trên mạch để tự điền)
                  </label>
                  <input
                    type="text"
                    value={uidInput}
                    onChange={(e) => setUidInput(e.target.value.toUpperCase())}
                    placeholder="Ví dụ: A3B9120F"
                    className="w-full px-3.5 py-2 border border-blue-300 bg-blue-50/40 rounded-lg font-mono font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Sản phẩm liên kết
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {products.map((p) => {
                      const pId = p.id || p._id || '';
                      return (
                        <option key={pId} value={pId}>
                          {p.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Kích cỡ (Size)
                  </label>
                  <select
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {['S', 'M', 'L', 'XL', 'XXL', 'FreeSize'].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Màu sắc
                  </label>
                  <input
                    type="text"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    placeholder="Đen, Trắng, Xanh..."
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingSave}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition disabled:opacity-50"
                  >
                    {loadingSave ? 'Đang lưu...' : 'Lưu gán thẻ RFID'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* CHẾ ĐỘ 2: NHẬP KHO NHANH */}
          {stationState.mode === 'IMPORT' && (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center space-y-2">
              <div className="text-emerald-700 font-bold text-lg">
                Trạm đang ở chế độ NHẬP KHO TỰ ĐỘNG
              </div>
              <p className="text-sm text-emerald-800 max-w-xl mx-auto">
                Đưa từng sản phẩm có gắn thẻ RFID qua đầu đọc RC522. Hệ thống sẽ tự động nhận diện
                đúng mẫu mã, size, màu và cộng thêm <strong>+1</strong> vào tồn kho trong SQL Server.
              </p>
              {stationState.lastScannedUid && (
                <div className="pt-2 text-xs font-mono text-emerald-900">
                  Thẻ vừa quét gần nhất: <strong>{stationState.lastScannedUid}</strong>
                </div>
              )}
            </div>
          )}

          {/* CHẾ ĐỘ 3: ĐÓNG GÓI ĐƠN HÀNG */}
          {stationState.mode === 'PACK' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-gray-800">
                  Kiểm tra & Đóng gói đơn hàng bằng RFID
                </h2>
                <select
                  value={selectedOrderId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedOrderId(id);
                    handleChangeMode('PACK', id);
                  }}
                  className="px-3.5 py-2 border border-amber-300 bg-amber-50/40 rounded-lg text-sm font-medium"
                >
                  <option value="">-- Chọn đơn hàng cần đóng gói ({orders.length}) --</option>
                  {orders.map((o) => {
                    const orderId = o._id || o.id || '';
                    const customerName =
                      o.user?.name || o.shippingAddress?.recipientName || 'Khách hàng';
                    return (
                      <option key={orderId} value={orderId}>
                        Đơn #{orderId.slice(-8).toUpperCase()} - {customerName} (
                        {o.items?.length || 0} món)
                      </option>
                    );
                  })}
                </select>
              </div>

              {activeOrder ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Sản phẩm trong đơn</th>
                        <th className="px-4 py-2.5">Phân loại</th>
                        <th className="px-4 py-2.5 text-center">Tiến độ quét</th>
                        <th className="px-4 py-2.5 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(activeOrder.items || []).map((item, idx) => {
                        const prodId = item.product?._id || item.product?.id || item.productId || '';
                        const itemKey = item.id || item._id || prodId;
                        const scanned =
                          stationState.packedCounts?.[itemKey] ??
                          stationState.packedCounts?.[prodId] ??
                          0;
                        const done = scanned >= item.quantity;
                        return (
                          <tr key={itemKey || idx} className={done ? 'bg-green-50/60' : ''}>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {item.product?.name || item.name || 'Sản phẩm'}
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {item.size || '-'} / {item.color || '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold">
                              {scanned} / {item.quantity}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {done ? (
                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                  Đủ số lượng
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                                  Chờ quét thẻ
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                  Chọn một đơn hàng ở góc trên bên phải để bắt đầu quét kiểm tra sản phẩm.
                </div>
              )}
            </div>
          )}

          {/* Danh sách thẻ RFID đã gán */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">
                Danh sách thẻ RFID đã định danh ({tags.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Mã UID</th>
                    <th className="px-4 py-3">Sản phẩm</th>
                    <th className="px-4 py-3">Size / Màu</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tags.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                        Chưa có thẻ RFID nào được gán sản phẩm.
                      </td>
                    </tr>
                  ) : (
                    tags.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-700">{t.uid}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={getFirstImage(t.product?.images)}
                              alt=""
                              className="w-9 h-9 rounded object-cover border border-gray-200"
                            />
                            <span className="font-medium text-gray-800">{t.product?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {t.size} - {t.color}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(t.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-semibold"
                          >
                            Hủy gán
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cột phải: Nhật ký quét trực tiếp từ trạm ESP8266 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-fit">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">Nhật ký quét trực tiếp</h2>
            <span className="text-xs text-gray-400">Auto-sync 1.5s</span>
          </div>

          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            {stationState.logs?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Chưa có lượt quét nào từ trạm RFID.
              </p>
            ) : (
              stationState.logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border text-xs space-y-1 ${
                    log.success
                      ? 'bg-green-50/60 border-green-200 text-gray-800'
                      : 'bg-red-50/60 border-red-200 text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-gray-500">
                    <span className="font-bold text-gray-700">[{log.mode}] {log.uid}</span>
                    <span>{new Date(log.time).toLocaleTimeString('vi-VN')}</span>
                  </div>
                  <div className="font-semibold text-gray-900">{log.productName}</div>
                  <div className="text-gray-600">{log.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminIotStation;