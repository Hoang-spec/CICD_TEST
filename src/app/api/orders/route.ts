import { NextResponse } from 'next/server';

interface OrderItem {
  productId: string;
  quantity: number;
}

interface CreateOrderRequest {
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  paymentMethod: 'card' | 'cod';
  items: OrderItem[];
}

interface Order extends CreateOrderRequest {
  id: string;
  status: 'pending';
  createdAt: string;
}

const orders: Order[] = [];

function isValidRequest(value: unknown): value is CreateOrderRequest {
  if (!value || typeof value !== 'object') return false;

  const request = value as Partial<CreateOrderRequest>;
  const customer = request.customer;

  if (!customer || typeof customer !== 'object') return false;
  if (request.paymentMethod !== 'card' && request.paymentMethod !== 'cod') return false;
  if (!Array.isArray(request.items) || request.items.length === 0) return false;

  const customerFields = ['name', 'email', 'phone', 'address', 'city', 'postalCode'] as const;
  return customerFields.every((field) => typeof customer[field] === 'string' && customer[field].trim().length > 0)
    && request.items.every((item) => typeof item.productId === 'string' && item.productId.length > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json({ error: 'Thông tin đơn hàng không hợp lệ' }, { status: 400 });
  }

  const order: Order = {
    ...body,
    id: `ATL-${Date.now().toString(36).toUpperCase()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  orders.push(order);

  return NextResponse.json({ data: order }, { status: 201 });
}

export function GET(): NextResponse {
  return NextResponse.json({ data: orders });
}
