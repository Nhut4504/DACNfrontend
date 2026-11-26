import React, { useState, useRef, useEffect } from 'react';

const AIChatBubble: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  
  // State lưu trữ lịch sử đoạn chat
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: 'Xin chào! Mình là trợ lý AI của FashionShop. Mình có thể giúp gì cho bạn hôm nay?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Ref dùng để tự động cuộn xuống tin nhắn mới nhất
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn mỗi khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userText = message;
    setMessage('');
    
    // 1. In tin nhắn của User lên màn hình
    setChatHistory(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      // 2. Gọi API xuống Node.js Backend
      // Lưu ý: Đảm bảo port backend của bạn là 5000, nếu khác thì sửa lại nhé
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      
      const data = await response.json();
      
      // 3. In câu trả lời của AI lên màn hình
      if (data.reply) {
        setChatHistory(prev => [...prev, { role: 'ai', text: data.reply }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', text: 'Xin lỗi, AI không thể trả lời lúc này.' }]);
      }
    } catch (error) {
      console.error("Lỗi gọi Chatbot:", error);
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Cửa sổ Chat */}
      {isOpen && (
        <div className="mb-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-300 transform origin-bottom-right">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center text-white shadow-md z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold text-lg shadow-inner">
                AI
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">Trợ lý Thời Trang</h3>
                <p className="text-xs text-blue-100 mt-0.5">Luôn sẵn sàng hỗ trợ ✨</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Nội dung Chat */}
          <div className="h-96 p-4 bg-gray-50 overflow-y-auto flex flex-col gap-3">
            {chatHistory.map((chat, idx) => (
              <div 
                key={idx} 
                className={`py-2 px-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                  chat.role === 'user' 
                    ? 'bg-blue-600 text-white self-end rounded-tr-sm' 
                    : 'bg-white border border-gray-100 text-gray-800 self-start rounded-tl-sm'
                }`}
                style={{ whiteSpace: 'pre-wrap' }} // Giữ nguyên ngắt dòng của AI
              >
                {chat.text}
              </div>
            ))}
            
            {/* Hiệu ứng đang gõ */}
            {isLoading && (
              <div className="bg-white border border-gray-100 text-gray-500 self-start py-2 px-4 rounded-2xl rounded-tl-sm text-sm shadow-sm flex items-center gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
              </div>
            )}
            
            {/* Mỏ neo để tự động cuộn */}
            <div ref={messagesEndRef} />
          </div>

          {/* Khung nhập tin nhắn */}
          <form onSubmit={handleSend} className="p-3 border-t bg-white flex gap-2 items-center">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-gray-100 border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={isLoading || !message.trim()}
              className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Nút bấm mở Chat */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-300 relative group"
        >
          <span className="text-2xl animate-pulse">✨</span>
          {/* Tooltip nhỏ báo hiệu cho khách */}
          <span className="absolute -top-10 right-0 bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Chat với Trợ lý AI
          </span>
        </button>
      )}
    </div>
  );
};

export default AIChatBubble;