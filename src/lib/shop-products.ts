export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  oldPrice?: number | null;
  image: string;
  accent: string;
  badge?: string | null;
}

export const products: Product[] = [
  {
    id: 'PRD-001',
    name: 'Erbology Aloe Vera',
    category: 'Body care',
    description: 'Gel làm dịu và cấp ẩm sâu cho làn da mỗi ngày.',
    price: 24,
    image: '/assets/product-1.png',
    accent: '#e4f0e8',
    badge: 'Bán chạy',
  },
  {
    id: 'PRD-002',
    name: 'Lancôme Rouge',
    category: 'Makeup',
    description: 'Sắc son satin mềm mịn, lưu màu tự nhiên cả ngày.',
    price: 32,
    oldPrice: 38,
    image: '/assets/product-2.png',
    accent: '#f7e6df',
    badge: '-15%',
  },
  {
    id: 'PRD-003',
    name: 'Ritual of Sakura',
    category: 'Body care',
    description: 'Nghi thức chăm sóc cơ thể lấy cảm hứng từ hoa anh đào.',
    price: 29,
    image: '/assets/product-3.png',
    accent: '#f3e9e6',
  },
  {
    id: 'PRD-004',
    name: 'Nécessaire Body Lotion',
    category: 'Body care',
    description: 'Dưỡng thể tối giản với kết cấu nhẹ, thấm nhanh.',
    price: 26,
    image: '/assets/product-4.png',
    accent: '#e8edf0',
  },
  {
    id: 'PRD-005',
    name: 'Soja & Co. Eucalyptus',
    category: 'Home scent',
    description: 'Nến thơm đậu nành mang không gian xanh vào căn phòng.',
    price: 30,
    image: '/assets/product-5.png',
    accent: '#e8eee8',
  },
];
