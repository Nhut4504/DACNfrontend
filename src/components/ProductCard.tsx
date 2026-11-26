// src/components/ProductCard.tsx - Enhanced with Flash Sale Support & Mobile Responsive
import React, { useState, memo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  StarIcon, 
  HeartIcon, 
  ShoppingCartIcon,
  ClockIcon,
  FireIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import OptimizedImage from './OptimizedImage';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import axios from '../utils/axios';

interface FlashSaleInfo {
  saleId: string;
  saleName: string;
  originalPrice: number;
  discountPrice: number;
  discountPercentage: number;
  endDate: string;
  available?: number;
  soldQuantity?: number;
  maxQuantity?: number;
  timeRemaining?: number;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  rating: number;
  totalReviews: number;
  category?: string;
  brand?: string;
  sizes?: string[];
  colors?: string[];
  stock?: Array<{
    size: string;
    color: string;
    quantity: number;
  }>;
  flashSale?: FlashSaleInfo;
  isFlashSale?: boolean;
  effectivePrice?: number;
  discountPrice?: number;
  originalPrice?: number;
  discountPercentage?: number;
  trendingScore?: number;
  trendingUsers?: number;
  trendingOrders?: number;
  recommendationType?: string;
  reason?: string;
  confidence?: number;
  recommendationScore?: number;
  recommendedByUsers?: number;
  contentScore?: number;
  complementScore?: number;
  boughtTogether?: number;
}

interface ProductCardProps {
  product: Product;
  showRecommendationReason?: boolean;
  recommendationData?: {
    type?: string;
    reason?: string;
    confidence?: number;
    complementaryScore?: number;
  };
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string, isWishlisted: boolean) => void;
  onAddToCart?: (productId: string) => void;
  onProductView?: (productId: string, duration: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = memo(({
  product,
  showRecommendationReason = false,
  recommendationData,
  isWishlisted: propIsWishlisted = false,
  onToggleWishlist,
  onAddToCart,
  onProductView
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(propIsWishlisted);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const viewStartTime = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuth();
  const { addToCart } = useCart();

  const hasFlashSale = product.isFlashSale || !!product.flashSale;
  
  const getEffectivePrice = () => {
    if (product.effectivePrice !== undefined) {
      return product.effectivePrice;
    }
    if (hasFlashSale) {
      return product.flashSale?.discountPrice || product.discountPrice || product.price;
    }
    return product.price;
  };

  const getOriginalPrice = () => {
    if (hasFlashSale) {
      return product.flashSale?.originalPrice || product.originalPrice || product.price;
    }
    return product.price;
  };

  const getDiscountPercentage = () => {
    if (hasFlashSale) {
      return product.flashSale?.discountPercentage || product.discountPercentage || 0;
    }
    return 0;
  };

  const effectivePrice = getEffectivePrice();
  const originalPrice = getOriginalPrice();
  const discountPercentage = getDiscountPercentage();
  const hasDiscount = hasFlashSale && effectivePrice < originalPrice;

  const getRecommendationReason = () => {
    if (product.reason) return product.reason;
    if (recommendationData?.reason) return recommendationData.reason;
    if (product.recommendationType) {
      const reasons: Record<string, string> = {
        collaborative: 'Người khác cũng mua',
        content: 'Phù hợp với bạn',
        trending: 'Đang thịnh hành',
        new: 'Sản phẩm mới',
        mixed: 'Được đề xuất',
        complementary: 'Mua kèm'
      };
      return reasons[product.recommendationType] || 'Đề xuất';
    }
    return null;
  };

  const recommendationReason = getRecommendationReason();

  useEffect(() => {
    setIsWishlisted(propIsWishlisted);
  }, [propIsWishlisted]);

  useEffect(() => {
    viewStartTime.current = Date.now();
    
    return () => {
      if (onProductView) {
        const duration = Math.floor((Date.now() - viewStartTime.current) / 1000);
        if (duration > 1) {
          onProductView(product._id, duration);
        }
      }
    };
  }, [product._id, onProductView]);

  useEffect(() => {
    if (!hasFlashSale) return;

    const endDate = product.flashSale?.endDate || product.flashSale?.timeRemaining;
    if (!endDate) return;

    const updateTimer = () => {
      let diff: number;
      
      if (typeof endDate === 'string') {
        const end = new Date(endDate);
        const now = new Date();
        diff = end.getTime() - now.getTime();
      } else if (typeof endDate === 'number') {
        diff = endDate * 1000;
      } else {
        return;
      }

      if (diff <= 0) {
        setTimeRemaining('Đã kết thúc');
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days} ngày`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [hasFlashSale, product.flashSale]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (product.images.length > 1) {
      let imageIndex = 0;
      intervalRef.current = setInterval(() => {
        imageIndex = (imageIndex + 1) % product.images.length;
        setCurrentImageIndex(imageIndex);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentImageIndex(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('Vui lòng đăng nhập để sử dụng tính năng này');
      return;
    }

    if (wishlistLoading) return;

    setWishlistLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Vui lòng đăng nhập để sử dụng tính năng này');
        return;
      }

      await axios.post('/users/wishlist', {
        productId: product._id,
        action: isWishlisted ? 'remove' : 'add'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIsWishlisted(!isWishlisted);
      
      if (onToggleWishlist) {
        onToggleWishlist(product._id, !isWishlisted);
      }

      showToast(
        !isWishlisted 
          ? 'Đã thêm vào danh sách yêu thích!' 
          : 'Đã xóa khỏi danh sách yêu thích!',
        'success'
      );

    } catch (error: any) {
      console.error('Error updating wishlist:', error);
      showToast(
        error.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại!',
        'error'
      );
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('Vui lòng đăng nhập để sử dụng tính năng này');
      return;
    }

    if (cartLoading) return;

    const availableStock = product.stock?.filter(s => s.quantity > 0) || [];
    
    if (availableStock.length === 0) {
      showToast('Sản phẩm này hiện đã hết hàng', 'error');
      return;
    }

    if (hasFlashSale && product.flashSale?.available !== undefined && product.flashSale.available <= 0) {
      showToast('Sản phẩm Flash Sale đã hết', 'error');
      return;
    }

    const firstAvailable = availableStock[0];
    const size = firstAvailable.size || product.sizes?.[0] || 'M';
    const color = firstAvailable.color || product.colors?.[0] || 'Đen';

    setCartLoading(true);
    try {
      await addToCart(product._id, 1, size, color);
      
      if (onAddToCart) {
        onAddToCart(product._id);
      }

      const savings = hasDiscount ? (originalPrice - effectivePrice) : 0;
      const message = hasDiscount 
        ? `Đã thêm vào giỏ với giá Flash Sale! Tiết kiệm ${savings.toLocaleString('vi-VN')}₫`
        : 'Đã thêm vào giỏ hàng!';
      
      showToast(message, 'success');

    } catch (error: any) {
      console.error('Error adding to cart:', error);
      showToast(
        error.response?.data?.message || 'Có lỗi xảy ra khi thêm vào giỏ hàng',
        'error'
      );
    } finally {
      setCartLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    toast.style.transform = 'translateX(100%)';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  const currentImage = product.images[currentImageIndex] || product.images[0] || '/placeholder.jpg';

  const getProgressPercentage = () => {
    if (!product.flashSale) return 0;
    const sold = product.flashSale.soldQuantity || 0;
    const max = product.flashSale.maxQuantity || 100;
    return Math.min((sold / max) * 100, 100);
  };

  const progressPercentage = getProgressPercentage();
  const isAlmostSoldOut = progressPercentage > 80;

  return (
    <div 
      className="group bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Link to={`/product/${product._id}`}>
          <OptimizedImage
            src={currentImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            width={300}
            height={300}
            loading="lazy"
            placeholder="/placeholder.jpg"
          />
        </Link>

        {/* Badges Container - Top Left */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20 space-y-1 sm:space-y-2 max-w-[75%]">
          {hasFlashSale && (
            <div className="animate-pulse">
              <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-full inline-flex items-center space-x-1 shadow-lg">
                <BoltIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-[11px] sm:text-sm font-bold">-{Math.round(discountPercentage)}%</span>
              </div>
              {timeRemaining && (
                <div className="mt-1 bg-black/80 text-white text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex items-center space-x-1 w-fit">
                  <ClockIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>{timeRemaining}</span>
                </div>
              )}
            </div>
          )}

          {!hasFlashSale && showRecommendationReason && recommendationReason && (
            <div className="bg-blue-500 text-white text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded-full shadow truncate">
              {recommendationReason}
            </div>
          )}

          {hasFlashSale && isAlmostSoldOut && (
            <div className="bg-yellow-500 text-white text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full animate-bounce w-fit">
              🔥 Sắp hết
            </div>
          )}
        </div>

        {/* Badges Container - Top Right */}
        <div className="hidden sm:block absolute top-3 right-3 z-20 space-y-2">
          {product.trendingUsers && product.trendingUsers > 10 && (
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full shadow">
              👀 {product.trendingUsers} người xem
            </div>
          )}

          {product.recommendedByUsers && product.recommendedByUsers > 5 && (
            <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full shadow">
              👥 {product.recommendedByUsers} người mua
            </div>
          )}
        </div>

        {/* Mobile Quick Action Icons */}
        <div className="sm:hidden absolute top-2 right-2 z-20 flex flex-col gap-1.5">
          <button
            onClick={handleWishlistToggle}
            disabled={wishlistLoading}
            className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow"
            title="Yêu thích"
          >
            {isWishlisted ? (
              <HeartSolidIcon className="w-4 h-4 text-red-500" />
            ) : (
              <HeartIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
          <button
            onClick={handleAddToCart}
            disabled={cartLoading}
            className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow"
            title="Thêm vào giỏ"
          >
            <ShoppingCartIcon className="w-4 h-4 text-blue-600" />
          </button>
        </div>

        {/* Desktop Overlay Actions */}
        <div className="hidden sm:block absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex space-x-3">
            <button
              onClick={handleWishlistToggle}
              disabled={wishlistLoading}
              className={`w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition-all hover:scale-110 ${
                wishlistLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title={isWishlisted ? "Xóa khỏi yêu thích" : "Thêm vào yêu thích"}
            >
              {wishlistLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin"></div>
              ) : isWishlisted ? (
                <HeartSolidIcon className="w-6 h-6 text-red-500" />
              ) : (
                <HeartIcon className="w-6 h-6 text-gray-600" />
              )}
            </button>

            <button
              onClick={handleAddToCart}
              disabled={cartLoading}
              className={`w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition-all hover:scale-110 ${
                cartLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title="Thêm vào giỏ hàng"
            >
              {cartLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              ) : (
                <ShoppingCartIcon className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>

          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Link 
              to={`/product/${product._id}`}
              className="w-full bg-white text-gray-800 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors text-center block shadow-md"
            >
              Xem chi tiết
            </Link>
          </div>
        </div>

        {/* Image Indicators */}
        {product.images.length > 1 && (
          <div className="absolute bottom-1.5 sm:bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {product.images.map((_, index) => (
              <div
                key={index}
                className={`h-1 sm:h-1.5 rounded-full transition-all ${
                  index === currentImageIndex 
                    ? 'bg-white w-2.5 sm:w-3' 
                    : 'bg-white/50 w-1 sm:w-1.5'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          <Link to={`/product/${product._id}`}>
            <h3 className="font-medium text-xs sm:text-base text-gray-900 mb-1 sm:mb-2 line-clamp-2 hover:text-blue-600 transition-colors min-h-[32px] sm:min-h-[48px]">
              {product.name}
            </h3>
          </Link>

          {/* Rating */}
          <div className="flex items-center mb-1.5 sm:mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <StarIcon
                  key={i}
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${
                    i < Math.floor(product.rating) 
                      ? 'text-yellow-400 fill-current' 
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="ml-1 text-[11px] sm:text-sm text-gray-600">
              {product.rating.toFixed(1)} ({product.totalReviews})
            </span>
          </div>

          {/* Flash Sale Progress Bar */}
          {hasFlashSale && product.flashSale?.maxQuantity && (
            <div className="mb-2 sm:mb-3">
              <div className="flex justify-between text-[10px] sm:text-xs text-gray-600 mb-1">
                <span className="font-medium">
                  Đã bán: {product.flashSale.soldQuantity || 0}
                </span>
                <span className={isAlmostSoldOut ? 'text-red-600 font-bold' : ''}>
                  Còn: {product.flashSale.available || (product.flashSale.maxQuantity - (product.flashSale.soldQuantity || 0))}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isAlmostSoldOut 
                      ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse' 
                      : 'bg-gradient-to-r from-orange-400 to-red-500'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          {/* Price */}
          <div className="flex items-end justify-between mb-1.5 sm:mb-2 gap-1">
            <div className="min-w-0">
              {hasDiscount ? (
                <div>
                  <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                    <span className="text-sm sm:text-xl font-bold text-red-600">
                      {effectivePrice.toLocaleString('vi-VN')}₫
                    </span>
                    <span className="text-[11px] sm:text-sm text-gray-400 line-through">
                      {originalPrice.toLocaleString('vi-VN')}₫
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-green-600 font-medium mt-0.5 truncate">
                    Tiết kiệm {(originalPrice - effectivePrice).toLocaleString('vi-VN')}₫
                  </div>
                </div>
              ) : (
                <span className="text-sm sm:text-xl font-bold text-gray-900">
                  {effectivePrice.toLocaleString('vi-VN')}₫
                </span>
              )}
            </div>
            
            {(product.confidence || recommendationData?.confidence) && (
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] sm:text-xs text-gray-500">
                  Phù hợp
                </div>
                <div className="text-xs sm:text-sm font-semibold text-blue-600">
                  {Math.round((product.confidence || recommendationData?.confidence || 0) * 100)}%
                </div>
              </div>
            )}
          </div>

          {/* Category/Brand */}
          {(product.category || product.brand) && (
            <div className="text-[11px] sm:text-xs text-gray-500 flex items-center truncate">
              {product.brand && (
                <span className="truncate max-w-[80px] sm:max-w-[100px]" title={product.brand}>
                  {product.brand}
                </span>
              )}
              {product.brand && product.category && <span className="mx-1">•</span>}
              {product.category && (
                <span className="truncate max-w-[80px] sm:max-w-[100px]" title={product.category}>
                  {product.category}
                </span>
              )}
            </div>
          )}

          {product.boughtTogether && product.boughtTogether > 0 && (
            <div className="mt-1.5 text-[11px] sm:text-xs text-green-600 font-medium">
              🛒 {product.boughtTogether} người mua cùng
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;