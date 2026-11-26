// src/pages/admin/AdminRecommendations.tsx - Fixed Version with Accurate Data
import axios from '../../utils/axios';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  SparklesIcon,
  ChartPieIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  ShoppingCartIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MagnifyingGlassIcon,
  TagIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend, Area, AreaChart,
  Scatter, ScatterChart
} from 'recharts';

// ==================== INTERFACES ====================
interface DashboardMetrics {
  timestamp?: Date;
  userMetrics: {
    total: number;
    new: number;
    active: number;
    churned: number;
    activeRate: string;
    churnRate: string;
    segments: Record<string, number>;
    growth: {
      daily: number | string;
      weekly: number | string;
      monthly: number | string;
    };
  };
  productMetrics: {
    topViewed: Array<{
      _id: string;
      name: string;
      category: string;
      viewCount: number;
      totalOrders: number;
      conversionRate?: number;
    }>;
    topConverting: Array<{
      _id: string;
      name: string;
      category: string;
      conversionRate: number;
      viewCount: number;
      totalOrders: number;
    }>;
    categoryPerformance: Array<{
      _id: string;
      products: number;
      totalViews: number;
      totalOrders: number;
      avgRating: number;
    }>;
  };
  behaviorMetrics: {
    viewPatterns: Array<{
      _id: { hour: number; dayOfWeek: number };
      count: number;
    }>;
    searchPatterns: Array<{
      _id: string;
      count: number;
    }>;
    cartPatterns?: Array<{
      _id: null;
      avgAdditions: number;
      avgRemovals: number;
      totalUsers: number;
    }>;
    dailyActivity?: Array<{
      date: string;
      views: number;
      searches: number;
      cartAdds: number;
      purchases: number;
    }>;
  };
  revenueMetrics?: {
    daily: Array<{ _id?: null; revenue: number; orders: number; avgOrderValue: number }>;
    weekly: Array<{ _id?: null; revenue: number; orders: number; avgOrderValue: number }>;
    monthly: Array<{ _id?: null; revenue: number; orders: number; avgOrderValue: number }>;
    bySource: Array<{ _id: string; revenue: number; orders: number }>;
  };
  recommendations: {
    totalGenerated: number;
    conversionRate: number | string;
    topPerformers?: Array<{
      _id: string;
      name: string;
      category: string;
      recommendationViews: number;
      totalOrders: number;
      conversionRate: number;
    }>;
  };
  wishlistMetrics?: {
    totalWishlistItems: number;
    monthlyWishlistAdds: number;
    topWishlistedProducts: Array<{
      _id: string;
      name: string;
      category: string;
      wishlistCount: number;
    }>;
  };
}

interface UserSegment {
  _id: string;
  count: number;
  avgSpent: number;
  avgOrders: number;
  users: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
}

interface ChurnPrediction {
  userId: string;
  name: string;
  email: string;
  riskScore: number;
  riskLevel: string;
  factors: Array<{
    factor: string;
    score: number;
    weight: number;
    weightedScore: number;
  }>;
  recommendations?: Array<{
    action: string;
    priority: string;
    tactics: string[];
  }>;
  lastActivity: string;
}

interface UserJourney {
  user: {
    _id: string;
    name: string;
    email: string;
    registrationDate: string;
  };
  timeline: Array<{
    type: string;
    date: string;
    details: any;
  }>;
  metrics: {
    totalEvents: number;
    timeToFirstPurchase: number | null;
    averageTimeBetweenPurchases: number | null;
    mostViewedCategory: string | null;
    purchaseFunnel: {
      views: number;
      searches: number;
      cartAdds: number;
      purchases: number;
      viewToCart: string;
      cartToPurchase: string;
      overallConversion: string;
    };
    customerLifetimeValue: number;
  };
  segment: string;
}

// ==================== MAIN COMPONENT ====================
const AdminRecommendations: React.FC = () => {
  // State Management
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [churnPredictions, setChurnPredictions] = useState<ChurnPrediction[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserJourney | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productView, setProductView] = useState<'list' | 'chart'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showingAllProducts, setShowingAllProducts] = useState(false);
  
  // Collapsible states for product sections
  const [topViewedCollapsed, setTopViewedCollapsed] = useState(false);
  const [topConvertingCollapsed, setTopConvertingCollapsed] = useState(false);

  // Configuration
  const API_BASE_URL = process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4'];

  // Get auth token
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
  }, []);

  // ==================== DATA FETCHING ====================
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getAuthToken();
      if (!token) {
        throw new Error('Vui lòng đăng nhập để tiếp tục');
      }

      const { data } = await axios.get(
        `${API_BASE_URL}/admin/recommendations/dashboard`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setDashboard(data);
    } catch (error: any) {
      console.error('Dashboard error:', error);
      setError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, getAuthToken]);

  const fetchAllProducts = useCallback(async () => {
    try {
      const token = getAuthToken();
      const { data } = await axios.get(
        `${API_BASE_URL}/products`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAllProducts(data.products || data);
    } catch (error) {
      console.error('Error fetching all products:', error);
    }
  }, [API_BASE_URL, getAuthToken]);

  const fetchSegments = useCallback(async () => {
    try {
      const token = getAuthToken();
      const { data } = await axios.get(
        `${API_BASE_URL}/admin/recommendations/segmentation`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSegments(data);
    } catch (error) {
      console.error('Segments error:', error);
    }
  }, [API_BASE_URL, getAuthToken]);

  const fetchChurnPredictions = useCallback(async () => {
    try {
      const token = getAuthToken();
      const { data } = await axios.post(
        `${API_BASE_URL}/admin/recommendations/predict-churn/advanced`,
        { includeRecommendations: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChurnPredictions(data);
    } catch (error) {
      console.error('Churn predictions error:', error);
    }
  }, [API_BASE_URL, getAuthToken]);

  const fetchUserJourney = useCallback(async (userId: string) => {
    try {
      const token = getAuthToken();
      const { data } = await axios.get(
        `${API_BASE_URL}/admin/recommendations/user-journey/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedUser(data);
    } catch (error) {
      console.error('User journey error:', error);
    }
  }, [API_BASE_URL, getAuthToken]);

  const exportData = useCallback(async (type: string) => {
    try {
      const token = getAuthToken();
      const response = await axios.get(
        `${API_BASE_URL}/admin/recommendations/export/${type}?format=csv`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${type}-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Lỗi khi xuất dữ liệu');
    }
  }, [API_BASE_URL, getAuthToken]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchDashboard();
    fetchAllProducts();
  }, [fetchDashboard, fetchAllProducts]);

  useEffect(() => {
    if (activeTab === 'segments') {
      fetchSegments();
    } else if (activeTab === 'churn') {
      fetchChurnPredictions();
    }
  }, [activeTab, fetchSegments, fetchChurnPredictions]);

  // ==================== HELPER FUNCTIONS ====================
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(amount || 0);
  }, []);

  const formatDate = useCallback((date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('vi-VN');
  }, []);

  const formatDateTime = useCallback((date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('vi-VN');
  }, []);

  const getRiskColor = useCallback((level: string) => {
    const normalized = level.toLowerCase();
    if (normalized === 'high' || normalized === 'cao') return 'text-red-600 bg-red-100';
    if (normalized === 'medium' || normalized === 'trung bình') return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  }, []);

  const getSegmentIcon = useCallback((segment: string) => {
    const icons: Record<string, string> = {
      'VIP': '👑',
      'Champion': '🏆',
      'Loyal Customer': '⭐',
      'Loyal': '⭐',
      'Regular': '👤',
      'Potential Loyalist': '🚀',
      'New Customer': '🆕',
      'Occasional': '🔄',
      'Browser': '👀',
      'At Risk': '⚠️',
      'Lost': '💔',
      'Prospect': '🎯',
      'New': '🆕'
    };
    return icons[segment] || '📊';
  }, []);

  // ==================== CHART DATA PREPARATION ====================
  
  // Prepare daily activity data from backend dailyActivity
  const prepareDailyActivityData = useMemo(() => {
    // Use actual daily activity data from backend if available
    if (dashboard?.behaviorMetrics?.dailyActivity) {
      return dashboard.behaviorMetrics.dailyActivity.map(item => ({
        date: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        views: item.views || 0,
        searches: item.searches || 0,
        cartAdds: item.cartAdds || 0,
        purchases: item.purchases || 0,
        label: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      }));
    }
    
    // Fallback: aggregate from viewPatterns if dailyActivity not available
    const data = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      
      // Calculate views for this day from behavior metrics
      let dayViews = 0;
      if (dashboard?.behaviorMetrics?.viewPatterns) {
        // Sum up views for this day of week
        const dayOfWeek = date.getDay() + 1; // getDay() returns 0-6, MongoDB uses 1-7
        const relevantPatterns = dashboard.behaviorMetrics.viewPatterns.filter(
          pattern => pattern._id.dayOfWeek === dayOfWeek
        );
        dayViews = relevantPatterns.reduce((sum, pattern) => sum + pattern.count, 0);
      }
      
      data.push({
        date: dateStr,
        views: dayViews,
        label: dateStr
      });
    }
    
    return data;
  }, [dashboard]);

  // Prepare category performance data
  const prepareCategoryPerformanceData = useMemo(() => {
    if (!dashboard?.productMetrics?.categoryPerformance) return [];
    
    return dashboard.productMetrics.categoryPerformance.map(cat => ({
      category: cat._id,
      products: cat.products,
      views: cat.totalViews,
      orders: cat.totalOrders,
      rating: parseFloat(cat.avgRating.toFixed(2)),
      conversionRate: cat.totalViews > 0 ? 
        parseFloat(((cat.totalOrders / cat.totalViews) * 100).toFixed(2)) : 0
    }));
  }, [dashboard]);

  // Prepare wishlist metrics - Calculate correctly from backend data
  const prepareWishlistData = useMemo(() => {
    return {
      total: dashboard?.wishlistMetrics?.totalWishlistItems || 0,
      monthly: dashboard?.wishlistMetrics?.monthlyWishlistAdds || 0,
      topProducts: dashboard?.wishlistMetrics?.topWishlistedProducts || []
    };
  }, [dashboard]);

  // Prepare search terms data
  const prepareSearchTermsData = useMemo(() => {
    if (!dashboard?.behaviorMetrics?.searchPatterns) return [];
    
    return dashboard.behaviorMetrics.searchPatterns
      .slice(0, 20)
      .map(term => ({
        text: term._id,
        value: term.count,
        size: Math.min(Math.max(12 + Math.log(term.count) * 4, 12), 32)
      }));
  }, [dashboard]);

  // Prepare segment data
  const prepareSegmentData = useMemo(() => {
    return segments.map(segment => ({
      name: segment._id,
      value: segment.count,
      avgSpent: segment.avgSpent,
      icon: getSegmentIcon(segment._id)
    }));
  }, [segments, getSegmentIcon]);

  // Prepare product scatter data
  const prepareProductScatterData = useMemo(() => {
    const productsToUse = showingAllProducts ? allProducts : 
      dashboard?.productMetrics ? [
        ...dashboard.productMetrics.topViewed,
        ...dashboard.productMetrics.topConverting
      ] : [];
    
    const uniqueProducts = Array.from(
      new Map(productsToUse.map((p: any) => [p._id, p])).values()
    );
    
    return uniqueProducts.map((product: any) => ({
      name: product.name,
      x: product.viewCount || 0,
      y: product.conversionRate || (product.viewCount > 0 ? (product.totalOrders / product.viewCount * 100) : 0),
      z: product.totalOrders || 0,
      category: product.category
    }));
  }, [dashboard, allProducts, showingAllProducts]);

  // Prepare recommendation performance data
  const prepareRecommendationPerformance = useMemo(() => {
    if (!dashboard?.recommendations?.topPerformers) return [];
    
    return dashboard.recommendations.topPerformers.slice(0, 10).map(item => ({
      name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
      views: item.recommendationViews,
      orders: item.totalOrders,
      conversion: item.conversionRate
    }));
  }, [dashboard]);

  const riskCounts = useMemo(() => ({
    high: churnPredictions.filter(p => p.riskLevel === 'High' || p.riskLevel === 'Cao').length,
    medium: churnPredictions.filter(p => p.riskLevel === 'Medium' || p.riskLevel === 'Trung bình').length,
    low: churnPredictions.filter(p => p.riskLevel === 'Low' || p.riskLevel === 'Thấp').length
  }), [churnPredictions]);

  // Get all products for display when "show all" is clicked
  const getDisplayProducts = useCallback((type: 'viewed' | 'converting') => {
    if (!showingAllProducts) {
      return type === 'viewed' 
        ? dashboard?.productMetrics?.topViewed || []
        : dashboard?.productMetrics?.topConverting || [];
    }
    
    // When showing all, calculate metrics for all products
    return allProducts
      .map(product => ({
        ...product,
        conversionRate: product.viewCount > 0 
          ? (product.totalOrders / product.viewCount * 100) 
          : 0
      }))
      .sort((a, b) => {
        if (type === 'viewed') {
          return (b.viewCount || 0) - (a.viewCount || 0);
        } else {
          return b.conversionRate - a.conversionRate;
        }
      });
  }, [dashboard, allProducts, showingAllProducts]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    const viewedProducts = getDisplayProducts('viewed');
    const convertingProducts = getDisplayProducts('converting');
    
    if (!searchTerm) {
      return { viewed: viewedProducts, converting: convertingProducts };
    }
    
    const searchLower = searchTerm.toLowerCase();
    return {
      viewed: viewedProducts.filter((product: any) =>
        product.name?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower)
      ),
      converting: convertingProducts.filter((product: any) =>
        product.name?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower)
      )
    };
  }, [getDisplayProducts, searchTerm]);

  // ==================== RENDER FUNCTIONS ====================
  const renderDashboard = () => {
    if (!dashboard) return null;

    const wishlistData = prepareWishlistData;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Tổng người dùng"
            value={dashboard.userMetrics.total}
            subtitle={`${dashboard.userMetrics.new} mới trong tháng`}
            icon={<UserGroupIcon className="h-8 w-8" />}
            color="blue"
            growth={Number(dashboard.userMetrics.growth.monthly)}
          />
          <MetricCard
            title="Người dùng hoạt động"
            value={dashboard.userMetrics.active}
            subtitle={`${dashboard.userMetrics.activeRate}% tỷ lệ hoạt động`}
            icon={<ArrowTrendingUpIcon className="h-8 w-8" />}
            color="green"
            growth={Number(dashboard.userMetrics.growth.weekly)}
          />
          <MetricCard
            title="Tỷ lệ chuyển đổi"
            value={`${dashboard.recommendations.conversionRate}%`}
            subtitle={`${dashboard.recommendations.totalGenerated} đề xuất`}
            icon={<SparklesIcon className="h-8 w-8" />}
            color="purple"
          />
          <MetricCard
            title="Lượt thích tháng"
            value={wishlistData.monthly}
            subtitle={`Tổng ${wishlistData.total} sản phẩm`}
            icon={<HeartIcon className="h-8 w-8" />}
            color="red"
            growth={dashboard.userMetrics.new > 0 ? 
              Number(((wishlistData.monthly / dashboard.userMetrics.new) * 100).toFixed(1)) : 0}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Hoạt động 30 ngày gần nhất</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={prepareDailyActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="label"
                  interval={4}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    const labelMap: Record<string, string> = {
                      views: 'Lượt xem',
                      searches: 'Tìm kiếm',
                      cartAdds: 'Thêm giỏ',
                      purchases: 'Mua hàng'
                    };
                    return [`${value} lượt`, labelMap[name] || name];
                  }}
                  labelFormatter={(label) => `Ngày: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="views" 
                  stroke="#8884d8" 
                  fill="#8884d8"
                  fillOpacity={0.6}
                  strokeWidth={2}
                  name="views"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Hiệu suất danh mục</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={prepareCategoryPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="views" fill="#8884d8" name="Lượt xem" />
                <Bar yAxisId="left" dataKey="orders" fill="#82ca9d" name="Đơn hàng" />
                <Line yAxisId="right" type="monotone" dataKey="conversionRate" stroke="#ff7300" name="Tỷ lệ CV (%)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Performance Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Phân tích sản phẩm</h3>
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm sản phẩm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-2.5 text-gray-400" />
              </div>
              
              {/* View Toggle */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setProductView('list')}
                  className={`px-3 py-1 rounded ${productView === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Danh sách
                </button>
                <button
                  onClick={() => setProductView('chart')}
                  className={`px-3 py-1 rounded ${productView === 'chart' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Biểu đồ
                </button>
              </div>

              {/* Show All Toggle */}
              <button
                onClick={() => setShowingAllProducts(!showingAllProducts)}
                className={`px-3 py-1 rounded ${showingAllProducts ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
              >
                {showingAllProducts ? 'Hiện top 10' : 'Hiện tất cả'}
              </button>
            </div>
          </div>

          {productView === 'chart' ? (
            <div className="space-y-6">
              {/* Scatter Plot */}
              <div>
                <h4 className="text-md font-medium mb-3">
                  Tương quan Lượt xem - Tỷ lệ chuyển đổi 
                  {showingAllProducts && ` (${allProducts.length} sản phẩm)`}
                </h4>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="x" 
                      name="Lượt xem" 
                      label={{ value: 'Lượt xem', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      dataKey="y" 
                      name="Tỷ lệ chuyển đổi (%)" 
                      label={{ value: 'Tỷ lệ chuyển đổi (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border rounded shadow-lg">
                              <p className="font-semibold">{data.name}</p>
                              <p className="text-sm">Danh mục: {data.category}</p>
                              <p className="text-sm">Lượt xem: {data.x.toLocaleString()}</p>
                              <p className="text-sm">Tỷ lệ CV: {data.y.toFixed(2)}%</p>
                              <p className="text-sm">Đơn hàng: {data.z}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter 
                      name="Sản phẩm" 
                      data={prepareProductScatterData} 
                      fill="#8884d8"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Recommendation Performance */}
              {prepareRecommendationPerformance.length > 0 && (
                <div>
                  <h4 className="text-md font-medium mb-3">Hiệu suất đề xuất</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={prepareRecommendationPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="views" fill="#8884d8" name="Lượt xem từ đề xuất" />
                      <Bar dataKey="orders" fill="#82ca9d" name="Đơn hàng" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Viewed Products with Collapse */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold">
                    Sản phẩm xem nhiều nhất 
                    {showingAllProducts && ` (${filteredProducts.viewed.length} sản phẩm)`}
                  </h4>
                  <button
                    onClick={() => setTopViewedCollapsed(!topViewedCollapsed)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title={topViewedCollapsed ? "Mở rộng" : "Thu gọn"}
                  >
                    {topViewedCollapsed ? (
                      <ChevronDownIcon className="h-5 w-5 text-gray-600" />
                    ) : (
                      <ChevronUpIcon className="h-5 w-5 text-gray-600" />
                    )}
                  </button>
                </div>
                
                {!topViewedCollapsed && (
                  <>
                    <div className={`space-y-2 ${showingAllProducts ? 'max-h-[600px] overflow-y-auto pr-2' : ''}`}>
                      {filteredProducts.viewed
                        .slice(0, showingAllProducts ? undefined : 10)
                        .map((product: any, idx: number) => (
                          <ProductCard
                            key={product._id}
                            product={product}
                            index={idx + 1}
                            type="views"
                          />
                        ))}
                    </div>

                    {showingAllProducts && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Tổng lượt xem:</span>
                            <p className="font-semibold text-lg">
                              {filteredProducts.viewed.reduce((sum: number, p: any) => sum + (p.viewCount || 0), 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Tổng đơn hàng:</span>
                            <p className="font-semibold text-lg">
                              {filteredProducts.viewed.reduce((sum: number, p: any) => sum + (p.totalOrders || 0), 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Top Converting Products with Collapse */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold">
                    Sản phẩm chuyển đổi tốt nhất
                    {showingAllProducts && ` (${filteredProducts.converting.length} sản phẩm)`}
                  </h4>
                  <button
                    onClick={() => setTopConvertingCollapsed(!topConvertingCollapsed)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title={topConvertingCollapsed ? "Mở rộng" : "Thu gọn"}
                  >
                    {topConvertingCollapsed ? (
                      <ChevronDownIcon className="h-5 w-5 text-gray-600" />
                    ) : (
                      <ChevronUpIcon className="h-5 w-5 text-gray-600" />
                    )}
                  </button>
                </div>
                
                {!topConvertingCollapsed && (
                  <>
                    <div className={`space-y-2 ${showingAllProducts ? 'max-h-[600px] overflow-y-auto pr-2' : ''}`}>
                      {filteredProducts.converting
                        .slice(0, showingAllProducts ? undefined : 10)
                        .map((product: any, idx: number) => (
                          <ProductCard
                            key={product._id}
                            product={product}
                            index={idx + 1}
                            type="conversion"
                          />
                        ))}
                    </div>

                    {showingAllProducts && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">CV trung bình:</span>
                            <p className="font-semibold text-lg">
                              {filteredProducts.converting.length > 0 
                                ? (filteredProducts.converting.reduce((sum: number, p: any) => sum + (p.conversionRate || 0), 0) / 
                                  filteredProducts.converting.length).toFixed(2) 
                                : 0}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Hiệu quả:</span>
                            <p className="font-semibold text-lg">
                              {filteredProducts.converting.filter((p: any) => p.conversionRate > 5).length}/{filteredProducts.converting.length} tốt
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search Terms Word Cloud */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TagIcon className="h-5 w-5 mr-2" />
            Từ khóa tìm kiếm phổ biến
          </h3>
          <div className="flex flex-wrap gap-2">
            {prepareSearchTermsData.map((term, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all hover:scale-105 cursor-pointer"
                style={{
                  fontSize: `${term.size}px`,
                  backgroundColor: COLORS[idx % COLORS.length] + '20',
                  color: COLORS[idx % COLORS.length]
                }}
                title={`${term.value} lượt tìm`}
              >
                {term.text}
                <span className="ml-2 text-xs opacity-75">({term.value})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Top Wishlisted Products */}
        {wishlistData.topProducts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <HeartIcon className="h-5 w-5 mr-2" />
              Sản phẩm được yêu thích nhất
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishlistData.topProducts.slice(0, 6).map((product: any, idx: number) => (
                <div key={product._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{product.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-red-500">
                        <HeartIcon className="h-4 w-4 mr-1" />
                        <span className="font-semibold">{product.wishlistCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSegments = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-6">Phân khúc người dùng</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={prepareSegmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {prepareSegmentData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => value.toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>

          {/* Segment Cards */}
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '400px' }}>
            {segments.map(segment => (
              <SegmentCard
                key={segment._id}
                segment={segment}
                icon={getSegmentIcon(segment._id)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Segment Analysis */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Phân tích chi tiết phân khúc</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={segments}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="_id" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={(value: any) => typeof value === 'number' ? value.toLocaleString() : value} />
            <Legend />
            <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Số lượng người dùng" />
            <Bar yAxisId="right" dataKey="avgOrders" fill="#82ca9d" name="Đơn hàng TB" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Segment Value Matrix */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Ma trận giá trị phân khúc</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phân khúc</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Số lượng</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Chi tiêu TB</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Đơn hàng TB</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tổng giá trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {segments.map(segment => (
                <tr key={segment._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-xl mr-2">{getSegmentIcon(segment._id)}</span>
                      <span className="font-medium">{segment._id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">{segment.count}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(segment.avgSpent)}</td>
                  <td className="px-6 py-4 text-center">{segment.avgOrders.toFixed(1)}</td>
                  <td className="px-6 py-4 text-right font-semibold">
                    {formatCurrency(segment.count * segment.avgSpent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderChurnPredictions = () => {
    return (
      <div className="space-y-6">
        {/* Risk Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RiskCard level="high" count={riskCounts.high} label="Rủi ro cao" />
          <RiskCard level="medium" count={riskCounts.medium} label="Rủi ro trung bình" />
          <RiskCard level="low" count={riskCounts.low} label="Rủi ro thấp" />
        </div>

        {/* Risk Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Phân bố rủi ro</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Rủi ro cao', value: riskCounts.high },
                    { name: 'Rủi ro TB', value: riskCounts.medium },
                    { name: 'Rủi ro thấp', value: riskCounts.low }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#EF4444" />
                  <Cell fill="#F59E0B" />
                  <Cell fill="#10B981" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Yếu tố rủi ro phổ biến</h3>
            <div className="space-y-3">
              {['lastActivity', 'purchasePattern', 'engagement', 'cartBehavior', 'searchBehavior'].map((factor, idx) => {
                const avgScore = churnPredictions.reduce((sum, p) => {
                  const f = p.factors.find(f => f.factor === factor);
                  return sum + (f?.score || 0);
                }, 0) / (churnPredictions.length || 1);
                
                return (
                  <div key={factor} className="flex items-center">
                    <span className="text-sm font-medium w-32">{factor}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div 
                        className={`h-4 rounded-full ${
                          avgScore > 60 ? 'bg-red-500' :
                          avgScore > 40 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${avgScore}%` }}
                      />
                    </div>
                    <span className="ml-2 text-sm text-gray-600">{avgScore.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Predictions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Chi tiết dự đoán rủi ro</h3>
          </div>
          <ChurnTable
            predictions={churnPredictions}
            getRiskColor={getRiskColor}
            formatDate={formatDate}
            onViewJourney={fetchUserJourney}
          />
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return <LoadingScreen />;
  }

  // Error state
  if (error) {
    return <ErrorScreen error={error} onRetry={fetchDashboard} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <Header 
          onRefresh={fetchDashboard}
          onExport={() => exportData(activeTab === 'segments' ? 'users' : activeTab === 'churn' ? 'churn' : 'products')}
        />

        {/* Tabs */}
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'segments' && renderSegments()}
          {activeTab === 'churn' && renderChurnPredictions()}
        </div>
      </div>

      {/* User Journey Modal */}
      {selectedUser && (
        <UserJourneyModal
          journey={selectedUser}
          onClose={() => setSelectedUser(null)}
          formatCurrency={formatCurrency}
          formatDateTime={formatDateTime}
        />
      )}
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================
const Header: React.FC<{
  onRefresh: () => void;
  onExport: () => void;
}> = ({ onRefresh, onExport }) => (
  <div className="mb-8">
    <div className="flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <ChartBarIcon className="h-10 w-10 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Phân tích & Đề xuất</h1>
          <p className="text-gray-600">Thống kê và tối ưu hóa hệ thống gợi ý</p>
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={onRefresh}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" />
          <span>Làm mới</span>
        </button>
        <button
          onClick={onExport}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          <span>Xuất dữ liệu</span>
        </button>
      </div>
    </div>
  </div>
);

const Tabs: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ activeTab, onTabChange }) => (
  <div className="border-b border-gray-200 mb-6">
    <nav className="-mb-px flex space-x-8">
      {[
        { id: 'dashboard', label: 'Tổng quan', icon: ChartPieIcon },
        { id: 'segments', label: 'Phân khúc', icon: UserGroupIcon },
        { id: 'churn', label: 'Dự đoán rời bỏ', icon: ExclamationTriangleIcon }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <tab.icon className="h-5 w-5 mr-2" />
          {tab.label}
        </button>
      ))}
    </nav>
  </div>
);

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'red';
  growth?: number;
}> = ({ title, value, subtitle, icon, color, growth }) => {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    red: 'text-red-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          {growth !== undefined && !isNaN(growth) && (
            <div className="flex items-center mt-2">
              {growth > 0 ? (
                <ArrowUpIcon className="h-4 w-4 mr-1 text-green-500" />
              ) : (
                <ArrowDownIcon className="h-4 w-4 mr-1 text-red-500" />
              )}
              <span className={`text-sm font-medium ${
                growth > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {growth > 0 ? '+' : ''}{growth}%
              </span>
            </div>
          )}
        </div>
        <div className={colorClasses[color]}>{icon}</div>
      </div>
    </div>
  );
};

const ProductCard: React.FC<{
  product: any;
  index: number;
  type: 'views' | 'conversion';
}> = ({ product, index, type }) => {
  const conversionRate = product.conversionRate || 
    (product.viewCount > 0 ? (product.totalOrders / product.viewCount * 100) : 0);

  return (
    <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
      <div className="flex items-center flex-1">
        <span className={`text-lg font-bold mr-3 w-8 text-center ${
          index <= 3 ? 'text-yellow-500' : 'text-gray-500'
        }`}>
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{product.name}</p>
          <div className="flex items-center text-xs text-gray-500 space-x-2">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
              {product.category}
            </span>
            {type === 'conversion' && (
              <>
                <span>•</span>
                <span className="flex items-center">
                  <EyeIcon className="h-3 w-3 mr-1" />
                  {product.viewCount?.toLocaleString() || 0}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="text-right ml-4">
        {type === 'views' ? (
          <>
            <p className="font-semibold flex items-center justify-end">
              <EyeIcon className="h-4 w-4 mr-1 text-gray-400" />
              {product.viewCount?.toLocaleString() || 0}
            </p>
            <div className="flex items-center justify-end text-xs text-gray-500">
              <ShoppingCartIcon className="h-3 w-3 mr-1" />
              {product.totalOrders || 0} đơn
              <span className="ml-2 text-blue-600 font-medium">
                ({conversionRate.toFixed(1)}% CV)
              </span>
            </div>
          </>
        ) : (
          <>
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
              conversionRate > 10 ? 'bg-green-100 text-green-800' :
              conversionRate > 5 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {conversionRate.toFixed(1)}%
            </span>
            <p className="text-xs text-gray-500 mt-1">
              {product.totalOrders || 0}/{product.viewCount || 0}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const SegmentCard: React.FC<{
  segment: UserSegment;
  icon: string;
  formatCurrency: (amount: number) => string;
}> = ({ segment, icon, formatCurrency }) => (
  <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center">
        <span className="text-2xl mr-2">{icon}</span>
        <div>
          <h4 className="font-semibold">{segment._id}</h4>
          <p className="text-sm text-gray-500">{segment.count} người dùng</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatCurrency(segment.avgSpent)}</p>
        <p className="text-xs text-gray-500">chi tiêu TB</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-1">
      {segment.users.slice(0, 3).map(user => (
        <span key={user._id} className="text-xs bg-gray-100 px-2 py-1 rounded">
          {user.name}
        </span>
      ))}
      {segment.users.length > 3 && (
        <span className="text-xs text-gray-500">+{segment.users.length - 3} khác</span>
      )}
    </div>
  </div>
);

const RiskCard: React.FC<{
  level: 'high' | 'medium' | 'low';
  count: number;
  label: string;
}> = ({ level, count, label }) => {
  const colors = {
    high: 'bg-red-50 border-red-200 text-red-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    low: 'bg-green-50 border-green-200 text-green-800'
  };

  const icons = {
    high: <ExclamationTriangleIcon className="h-8 w-8" />,
    medium: <ClockIcon className="h-8 w-8" />,
    low: <ChartBarIcon className="h-8 w-8" />
  };

  return (
    <div className={`border-2 rounded-lg p-6 ${colors[level]}`}>
      <div className="flex items-center justify-between mb-2">
        {icons[level]}
        <span className="text-3xl font-bold">{count}</span>
      </div>
      <h3 className="font-semibold">{label}</h3>
      <p className="text-sm opacity-75">người dùng</p>
    </div>
  );
};

const ChurnTable: React.FC<{
  predictions: ChurnPrediction[];
  getRiskColor: (level: string) => string;
  formatDate: (date: string | null) => string;
  onViewJourney: (userId: string) => void;
}> = ({ predictions, getRiskColor, formatDate, onViewJourney }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người dùng</th>
          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Điểm rủi ro</th>
          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mức độ</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yếu tố chính</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đề xuất</th>
          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hành động</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 bg-white">
        {predictions.slice(0, 10).map(prediction => (
          <tr key={prediction.userId} className="hover:bg-gray-50">
            <td className="px-6 py-4">
              <div>
                <p className="text-sm font-medium">{prediction.name}</p>
                <p className="text-xs text-gray-500">{prediction.email}</p>
                <p className="text-xs text-gray-400">
                  Hoạt động cuối: {formatDate(prediction.lastActivity)}
                </p>
              </div>
            </td>
            <td className="px-6 py-4 text-center">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold">{prediction.riskScore}</span>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      prediction.riskScore > 70 ? 'bg-red-500' :
                      prediction.riskScore > 40 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${prediction.riskScore}%` }}
                  />
                </div>
              </div>
            </td>
            <td className="px-6 py-4 text-center">
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${getRiskColor(prediction.riskLevel)}`}>
                {prediction.riskLevel}
              </span>
            </td>
            <td className="px-6 py-4">
              <div className="space-y-1">
                {prediction.factors
                  .sort((a, b) => b.weightedScore - a.weightedScore)
                  .slice(0, 3)
                  .map((factor, idx) => (
                    <div key={idx} className="flex items-center text-xs">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5 mr-2">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${factor.score}%` }}
                        />
                      </div>
                      <span className="text-gray-600">{factor.factor}</span>
                    </div>
                  ))}
              </div>
            </td>
            <td className="px-6 py-4">
              {prediction.recommendations && prediction.recommendations.length > 0 && (
                <div className="space-y-1">
                  {prediction.recommendations.slice(0, 2).map((rec, idx) => (
                    <div key={idx} className="text-xs">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
                        rec.priority === 'high' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {rec.action}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </td>
            <td className="px-6 py-4 text-center">
              <button
                onClick={() => onViewJourney(prediction.userId)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Xem chi tiết
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const LoadingScreen: React.FC = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
    </div>
  </div>
);

const ErrorScreen: React.FC<{
  error: string;
  onRetry: () => void;
}> = ({ error, onRetry }) => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <p className="text-red-600 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Thử lại
      </button>
    </div>
  </div>
);

const UserJourneyModal: React.FC<{
  journey: UserJourney;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
  formatDateTime: (date: string | null) => string;
}> = ({ journey, onClose, formatCurrency, formatDateTime }) => {
  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      'registration': '🎉',
      'view': '👀',
      'search': '🔍',
      'cart_add': '🛒',
      'cart_remove': '❌',
      'purchase': '💳',
      'wishlist': '❤️'
    };
    return icons[type] || '📍';
  };

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      'registration': 'bg-purple-100 text-purple-800',
      'view': 'bg-blue-100 text-blue-800',
      'search': 'bg-gray-100 text-gray-800',
      'cart_add': 'bg-yellow-100 text-yellow-800',
      'cart_remove': 'bg-red-100 text-red-800',
      'purchase': 'bg-green-100 text-green-800',
      'wishlist': 'bg-pink-100 text-pink-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getSegmentIcon = (segment: string) => {
    const icons: Record<string, string> = {
      'VIP': '👑',
      'Champion': '🏆',
      'Loyal Customer': '⭐',
      'Loyal': '⭐',
      'Regular': '👤',
      'Potential Loyalist': '🚀',
      'New Customer': '🆕',
      'Occasional': '🔄',
      'Browser': '👀',
      'At Risk': '⚠️',
      'Lost': '💔',
      'Prospect': '🎯',
      'New': '🆕'
    };
    return icons[segment] || '📊';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">Phân tích hành vi người dùng</h2>
              <div className="mt-2">
                <p className="text-gray-600">{journey.user.name}</p>
                <p className="text-sm text-gray-500">{journey.user.email}</p>
                <p className="text-sm text-gray-500">
                  Thành viên từ: {formatDateTime(journey.user.registrationDate)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* Metrics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Phân khúc</p>
              <p className="text-lg font-semibold flex items-center">
                <span className="mr-2">{getSegmentIcon(journey.segment)}</span>
                {journey.segment}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">CLV</p>
              <p className="text-lg font-semibold">{formatCurrency(journey.metrics.customerLifetimeValue)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Thời gian mua hàng đầu tiên</p>
              <p className="text-lg font-semibold">
                {journey.metrics.timeToFirstPurchase !== null 
                  ? `${journey.metrics.timeToFirstPurchase} ngày` 
                  : 'Chưa mua'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Chu kỳ mua hàng TB</p>
              <p className="text-lg font-semibold">
                {journey.metrics.averageTimeBetweenPurchases !== null
                  ? `${journey.metrics.averageTimeBetweenPurchases} ngày`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Purchase Funnel Stats */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">Thống kê chuyển đổi</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{journey.metrics.purchaseFunnel.views}</p>
                <p className="text-sm text-gray-600">Lượt xem</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{journey.metrics.purchaseFunnel.searches}</p>
                <p className="text-sm text-gray-600">Tìm kiếm</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{journey.metrics.purchaseFunnel.cartAdds}</p>
                <p className="text-sm text-gray-600">Thêm giỏ</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{journey.metrics.purchaseFunnel.purchases}</p>
                <p className="text-sm text-gray-600">Mua hàng</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="flex justify-between text-sm">
                <span>Tỷ lệ xem → giỏ: <strong>{journey.metrics.purchaseFunnel.viewToCart}%</strong></span>
                <span>Tỷ lệ giỏ → mua: <strong>{journey.metrics.purchaseFunnel.cartToPurchase}%</strong></span>
                <span>Tỷ lệ chuyển đổi tổng: <strong>{journey.metrics.purchaseFunnel.overallConversion}%</strong></span>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          {journey.metrics.mostViewedCategory && (
            <div className="bg-yellow-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">Danh mục quan tâm nhất</p>
              <p className="text-lg font-semibold">{journey.metrics.mostViewedCategory}</p>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="font-semibold mb-3">Lịch sử hoạt động ({journey.metrics.totalEvents} sự kiện)</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {journey.timeline.map((event, idx) => (
                <div key={idx} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    <span className="text-xl">{getEventIcon(event.type)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getEventColor(event.type)}`}>
                        {event.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(event.date)}
                      </span>
                    </div>
                    {event.details && (
                      <div className="mt-1 text-sm text-gray-600">
                        {event.type === 'search' && event.details.query && (
                          <span>Tìm kiếm: "{event.details.query}"</span>
                        )}
                        {event.type === 'view' && event.details.duration && (
                          <span>Thời gian xem: {event.details.duration}s</span>
                        )}
                        {event.type === 'purchase' && event.details.totalAmount && (
                          <span>Giá trị: {formatCurrency(event.details.totalAmount)}</span>
                        )}
                        {event.type === 'cart_add' && event.details.quantity && (
                          <span>Số lượng: {event.details.quantity}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRecommendations;
