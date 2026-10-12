import { products as catalog, type Product } from '@/lib/shop-products';

export interface DemoProduct extends Product {
  stock: number;
  active: boolean;
}

export interface DemoOrder {
  id: string;
  userId: string;
  customer: { name: string; email: string; phone: string; address: string; city: string; postalCode: string };
  paymentMethod: string;
  items: { productId: string; name: string; price: number; quantity: number }[];
  subtotal: number;
  shipping: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

const PRODUCTS_KEY = 'atelier-demo-products';
const ORDERS_KEY = 'atelier-demo-orders';

function readList<T>(key: string): T[] {
  try {
    const stored = globalThis.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T[] : [];
  } catch {
    return [];
  }
}

export function getDemoProducts(): DemoProduct[] {
  const raw = globalThis.localStorage.getItem(PRODUCTS_KEY);
  if (raw !== null) return readList<DemoProduct>(PRODUCTS_KEY);
  return catalog.map((product, index) => ({ ...product, stock: [20, 15, 18, 12, 10][index] ?? 10, active: true }));
}

export function saveDemoProducts(products: DemoProduct[]): void {
  globalThis.localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

export function getDemoOrders(): DemoOrder[] {
  return readList<DemoOrder>(ORDERS_KEY);
}

export function saveDemoOrders(orders: DemoOrder[]): void {
  globalThis.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function updateDemoOrderStatus(orderId: string, status: DemoOrder['status']): DemoOrder {
  const orders = getDemoOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Không tìm thấy đơn hàng');
  const transitions: Record<DemoOrder['status'], DemoOrder['status'][]> = {
    pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [],
  };
  if (!transitions[order.status].includes(status)) throw new Error(`Không thể chuyển đơn từ ${order.status} sang ${status}`);
  if (status === 'cancelled') {
    const products = getDemoProducts();
    for (const item of order.items) {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (product) product.stock += item.quantity;
    }
    saveDemoProducts(products);
  }
  order.status = status;
  order.updatedAt = new Date().toISOString();
  saveDemoOrders(orders);
  return order;
}

export function createDemoOrder(input: {
  userId: string;
  customer: DemoOrder['customer'];
  paymentMethod: string;
  items: { productId: string; quantity: number }[];
}): DemoOrder {
  const products = getDemoProducts();
  const orderItems = input.items.map((entry) => {
    const product = products.find((candidate) => candidate.id === entry.productId && candidate.active);
    if (!product) throw new Error('Một sản phẩm trong giỏ hàng không còn bán');
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1 || product.stock < entry.quantity) {
      throw new Error(`Sản phẩm ${product.name} không đủ tồn kho`);
    }
    return { productId: product.id, name: product.name, price: product.price, quantity: entry.quantity };
  });
  for (const entry of orderItems) {
    const product = products.find((candidate) => candidate.id === entry.productId)!;
    product.stock -= entry.quantity;
  }
  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 0 && subtotal < 50 ? 5 : 0;
  const now = new Date().toISOString();
  const order: DemoOrder = {
    id: `ORD-${globalThis.crypto.randomUUID()}`, userId: input.userId, customer: input.customer,
    paymentMethod: input.paymentMethod, items: orderItems, subtotal, shipping, total: subtotal + shipping,
    status: 'pending', createdAt: now, updatedAt: now,
  };
  saveDemoProducts(products);
  saveDemoOrders([order, ...getDemoOrders()]);
  return order;
}
