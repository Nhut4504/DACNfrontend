import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from '../utils/axios';
import { useNavigate } from 'react-router-dom'; // 👈 1. Import useNavigate

interface ImageSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  image: string;
  price: number;
  score: number;
}

const ImageSearch: React.FC<ImageSearchProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate(); // 👈 2. Khởi tạo hook điều hướng

  useEffect(() => {
    if (!isOpen) {
      handleClear();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreview(objectUrl);
      setResults([]);
      setError(null);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setResults([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 👇 3. Hàm xử lý khi click vào sản phẩm
  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`); // Chuyển hướng đến trang chi tiết
    onClose(); // Đóng Modal tìm kiếm
  };

  const submit = async () => {
    if (!file) return;
    
    const form = new FormData();
    form.append('image', file); 

    setLoading(true);
    setError(null);

    try {
      const { data } = await axios.post('/image-search', form, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });

      setResults(data.data || []);
      
      if (!data.data || data.data.length === 0) {
        setError("Không tìm thấy sản phẩm nào tương tự.");
      }

    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Lỗi khi xử lý hình ảnh.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            📸 Tìm kiếm bằng hình ảnh AI
          </h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
          <div className="flex flex-col md:flex-row gap-6 items-start h-full">
            
            {/* Upload Section */}
            <div className="w-full md:w-1/3 space-y-4 flex-shrink-0 sticky top-0">
              <div 
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors h-64 relative bg-gray-50
                  ${preview ? 'border-blue-300 bg-blue-50/50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'}`}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="Preview" className="h-full object-contain rounded-md shadow-sm" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleClear(); }}
                      className="absolute top-2 right-2 bg-white p-1.5 rounded-full text-red-500 hover:bg-red-50 shadow-md border border-gray-100"
                      title="Xóa ảnh"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </>
                ) : (
                  <div className="text-gray-400">
                    <div className="text-5xl mb-3">☁️</div>
                    <span className="text-sm font-medium">Tải ảnh lên để tìm kiếm</span>
                  </div>
                )}
                
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={onFileChange} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={!!preview}
                />
              </div>

              <button 
                onClick={submit} 
                disabled={loading || !file}
                className={`w-full py-3 px-4 rounded-lg text-white font-bold shadow-md transition-all
                  ${loading || !file 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'}`}
              >
                {loading ? '⏳ Đang phân tích...' : '🔍 Tìm ngay'}
              </button>
            </div>

            {/* Results Section */}
            <div className="w-full md:w-2/3 min-h-[300px]">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 mb-4 animate-fade-in">
                  ⚠️ {error}
                </div>
              )}

              {results.length > 0 ? (
                <div className="animate-fade-in">
                  <h4 className="font-semibold text-gray-700 mb-4 flex items-center justify-between">
                    <span>Kết quả tìm kiếm</span>
                    <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{results.length} sản phẩm</span>
                  </h4>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.map((r) => (
                      <div 
                        key={r.id} 
                        // 👇 4. Thêm sự kiện onClick tại đây
                        onClick={() => handleProductClick(r.id)}
                        className="group border rounded-lg overflow-hidden hover:shadow-md transition-all bg-white relative cursor-pointer hover:border-blue-300"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                          <img 
                            src={r.image || '/placeholder.jpg'} 
                            alt={r.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                          <div className="absolute top-2 right-2 z-10">
                            <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full border border-white/20 shadow-sm">
                              {Math.round(r.score * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="p-3">
                          <h5 className="font-medium text-xs text-gray-800 line-clamp-2 mb-1 h-8 group-hover:text-blue-600 transition-colors" title={r.name}>
                            {r.name}
                          </h5>
                          <div className="text-red-600 font-bold text-sm">
                            {r.price?.toLocaleString('vi-VN')}₫
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !loading && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/30 min-h-[300px]">
                    <div className="text-4xl mb-3 opacity-50">🔍</div>
                    <p className="text-sm">Kết quả tìm kiếm sẽ hiển thị tại đây</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImageSearch;