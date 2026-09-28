import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDirectory, 'db.json');
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? 'development-only-secret';

const seedData = {
  users: [
    { id: 'USR-ADMIN', firstName: 'Admin', lastName: 'User', email: 'admin@example.com', passwordHash: bcrypt.hashSync('Admin123', 10), role: 'admin', createdAt: new Date().toISOString() },
    { id: 'USR-CLIENT', firstName: 'Client', lastName: 'User', email: 'client@example.com', passwordHash: bcrypt.hashSync('Client123', 10), role: 'client', createdAt: new Date().toISOString() },
  ],
  products: [
    { id: 'PRD-001', name: 'Erbology Aloe Vera', category: 'Body care', description: 'Gel làm dịu và cấp ẩm sâu cho làn da mỗi ngày.', price: 24, oldPrice: null, image: '/assets/product-1.png', accent: '#e4f0e8', badge: 'Bán chạy', stock: 20, active: true },
    { id: 'PRD-002', name: 'Lancôme Rouge', category: 'Makeup', description: 'Sắc son satin mềm mịn, lưu màu tự nhiên cả ngày.', price: 32, oldPrice: 38, image: '/assets/product-2.png', accent: '#f7e6df', badge: '-15%', stock: 15, active: true },
    { id: 'PRD-003', name: 'Ritual of Sakura', category: 'Body care', description: 'Nghi thức chăm sóc cơ thể lấy cảm hứng từ hoa anh đào.', price: 29, oldPrice: null, image: '/assets/product-3.png', accent: '#f3e9e6', badge: null, stock: 18, active: true },
    { id: 'PRD-004', name: 'Nécessaire Body Lotion', category: 'Body care', description: 'Dưỡng thể tối giản với kết cấu nhẹ, thấm nhanh.', price: 26, oldPrice: null, image: '/assets/product-4.png', accent: '#e8edf0', badge: null, stock: 12, active: true },
    { id: 'PRD-005', name: 'Soja & Co. Eucalyptus', category: 'Home scent', description: 'Nến thơm đậu nành mang không gian xanh vào căn phòng.', price: 30, oldPrice: null, image: '/assets/product-5.png', accent: '#e8eee8', badge: null, stock: 10, active: true },
  ],
  orders: [],
};

async function readDatabase() {
  try {
    const database = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    // Add fields introduced after an existing db.json was first created.
    database.users ??= [];
    database.orders ??= [];
    database.products ??= [];
    database.products = database.products.map((product) => ({ active: true, description: '', oldPrice: null, image: '', accent: '#e4f0e8', badge: null, stock: 0, ...product }));
    return database;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.mkdir(dataDirectory, { recursive: true });
    await writeDatabase(seedData);
    return seedData;
  }
}

async function writeDatabase(database) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(database, null, 2));
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

function requireAuth(request, response, next) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return response.status(401).json({ error: 'Authentication required' });
  try {
    request.auth = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return response.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(request, response, next) {
  if (request.auth?.role !== 'admin') return response.status(403).json({ error: 'Admin access required' });
  return next();
}

function validateProduct(body, partial = false) {
  const required = ['name', 'category', 'price', 'stock'];
  if (!partial && required.some((field) => body?.[field] === undefined)) return 'Vui lòng nhập tên, danh mục, giá và tồn kho';
  if (body?.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) return 'Tên sản phẩm không hợp lệ';
  if (body?.category !== undefined && (typeof body.category !== 'string' || !body.category.trim())) return 'Danh mục không hợp lệ';
  if (body?.price !== undefined && (!Number.isFinite(Number(body.price)) || Number(body.price) < 0)) return 'Giá sản phẩm không hợp lệ';
  if (body?.oldPrice !== undefined && body.oldPrice !== null && (!Number.isFinite(Number(body.oldPrice)) || Number(body.oldPrice) < 0)) return 'Giá cũ không hợp lệ';
  if (body?.stock !== undefined && (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0)) return 'Tồn kho phải là số nguyên không âm';
  if (body?.active !== undefined && typeof body.active !== 'boolean') return 'Trạng thái active phải là true hoặc false';
  for (const field of ['description', 'image', 'accent', 'badge']) {
    if (body?.[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') return `${field} không hợp lệ`;
  }
  return null;
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'atelier-backend' }));

app.post('/api/auth/register', async (request, response) => {
  const { firstName, lastName, email, password } = request.body ?? {};
  if (![firstName, lastName, email].every((value) => typeof value === 'string' && value.trim()) || typeof password !== 'string' || password.length < 8) {
    return response.status(400).json({ error: 'Vui lòng nhập đủ thông tin và mật khẩu tối thiểu 8 ký tự' });
  }
  const database = await readDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  if (database.users.some((user) => user.email === normalizedEmail)) return response.status(409).json({ error: 'Email đã được sử dụng' });
  const user = { id: `USR-${randomUUID()}`, firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 10), role: 'client', createdAt: new Date().toISOString() };
  database.users.push(user);
  await writeDatabase(database);
  return response.status(201).json({ data: publicUser(user), token: createToken(user) });
});

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') return response.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
  const database = await readDatabase();
  const user = database.users.find((candidate) => candidate.email === email.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return response.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
  return response.json({ data: publicUser(user), token: createToken(user) });
});

app.get('/api/auth/me', requireAuth, async (request, response) => {
  const database = await readDatabase();
  const user = database.users.find((candidate) => candidate.id === request.auth.sub);
  return user ? response.json({ data: publicUser(user) }) : response.status(404).json({ error: 'User not found' });
});

// Public catalog: supports search, category, and stock visibility filters.
app.get('/api/products', async (request, response) => {
  const database = await readDatabase();
  const search = String(request.query.search ?? '').trim().toLowerCase();
  const category = String(request.query.category ?? '').trim().toLowerCase();
  const products = database.products.filter((product) => product.active !== false
    && (!search || `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(search))
    && (!category || product.category.toLowerCase() === category));
  return response.json({ data: products });
});

app.get('/api/products/:id', async (request, response) => {
  const product = (await readDatabase()).products.find((item) => item.id === request.params.id && item.active !== false);
  return product ? response.json({ data: product }) : response.status(404).json({ error: 'Không tìm thấy sản phẩm' });
});

app.post('/api/products', requireAuth, requireAdmin, async (request, response) => {
  const error = validateProduct(request.body);
  if (error) return response.status(400).json({ error });
  const database = await readDatabase();
  const product = {
    id: `PRD-${randomUUID()}`,
    name: request.body.name.trim(), category: request.body.category.trim(),
    description: request.body.description ?? '', price: Number(request.body.price),
    oldPrice: request.body.oldPrice === undefined || request.body.oldPrice === null ? null : Number(request.body.oldPrice),
    image: request.body.image ?? '', accent: request.body.accent ?? '#e4f0e8', badge: request.body.badge ?? null,
    stock: Number(request.body.stock), active: request.body.active !== false,
  };
  database.products.push(product);
  await writeDatabase(database);
  return response.status(201).json({ data: product });
});

app.patch('/api/products/:id', requireAuth, requireAdmin, async (request, response) => {
  const error = validateProduct(request.body, true);
  if (error) return response.status(400).json({ error });
  const database = await readDatabase();
  const product = database.products.find((item) => item.id === request.params.id);
  if (!product) return response.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  for (const field of ['name', 'category', 'description', 'image', 'accent', 'badge', 'active']) {
    if (request.body[field] !== undefined) product[field] = typeof request.body[field] === 'string' && ['name', 'category'].includes(field) ? request.body[field].trim() : request.body[field];
  }
  if (request.body.price !== undefined) product.price = Number(request.body.price);
  if (request.body.oldPrice !== undefined) product.oldPrice = request.body.oldPrice === null ? null : Number(request.body.oldPrice);
  if (request.body.stock !== undefined) product.stock = Number(request.body.stock);
  product.updatedAt = new Date().toISOString();
  await writeDatabase(database);
  return response.json({ data: product });
});

app.delete('/api/products/:id', requireAuth, requireAdmin, async (request, response) => {
  const database = await readDatabase();
  const product = database.products.find((item) => item.id === request.params.id);
  if (!product) return response.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  if (database.orders.some((order) => order.items.some((item) => item.productId === product.id))) {
    product.active = false;
    product.deletedAt = new Date().toISOString();
    await writeDatabase(database);
    return response.json({ data: product, message: 'Sản phẩm đã được ẩn vì đã có trong đơn hàng' });
  }
  database.products = database.products.filter((item) => item.id !== product.id);
  await writeDatabase(database);
  return response.status(204).end();
});

app.get('/api/orders', requireAuth, async (request, response) => {
  const database = await readDatabase();
  const orders = request.auth.role === 'admin' ? database.orders : database.orders.filter((order) => order.userId === request.auth.sub);
  return response.json({ data: orders });
});

app.get('/api/orders/:id', requireAuth, async (request, response) => {
  const database = await readDatabase();
  const order = database.orders.find((item) => item.id === request.params.id);
  if (!order || (request.auth.role !== 'admin' && order.userId !== request.auth.sub)) return response.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  return response.json({ data: order });
});

app.post('/api/orders', requireAuth, async (request, response) => {
  const { items, customer, paymentMethod } = request.body ?? {};
  if (!Array.isArray(items) || items.length === 0 || !customer?.name || !customer?.email || !customer?.phone || !customer?.address || !customer?.city || !customer?.postalCode || !['card', 'cod'].includes(paymentMethod)) {
    return response.status(400).json({ error: 'Thông tin đơn hàng không hợp lệ' });
  }
  const database = await readDatabase();
  const quantities = new Map();
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!item.productId || !Number.isInteger(quantity) || quantity < 1) return response.status(400).json({ error: 'Sản phẩm hoặc số lượng không hợp lệ' });
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + quantity);
  }
  const orderItems = [];
  for (const [productId, quantity] of quantities) {
    const product = database.products.find((candidate) => candidate.id === productId && candidate.active !== false);
    if (!product) return response.status(400).json({ error: `Không tìm thấy sản phẩm ${productId}` });
    if (product.stock < quantity) return response.status(409).json({ error: `Sản phẩm ${product.name} chỉ còn ${product.stock} trong kho` });
    orderItems.push({ productId: product.id, name: product.name, price: product.price, quantity });
  }
  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 0 && subtotal < 50 ? 5 : 0;
  const order = {
    id: `ORD-${randomUUID()}`, userId: request.auth.sub,
    customer: Object.fromEntries(['name', 'email', 'phone', 'address', 'city', 'postalCode'].map((key) => [key, String(customer[key] ?? '').trim()])),
    paymentMethod, items: orderItems, subtotal, shipping, total: subtotal + shipping,
    status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  for (const item of orderItems) database.products.find((product) => product.id === item.productId).stock -= item.quantity;
  database.orders.push(order);
  await writeDatabase(database);
  return response.status(201).json({ data: order });
});

const orderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
app.patch('/api/orders/:id/status', requireAuth, requireAdmin, async (request, response) => {
  const { status } = request.body ?? {};
  if (!orderStatuses.includes(status)) return response.status(400).json({ error: `Trạng thái phải là một trong: ${orderStatuses.join(', ')}` });
  const database = await readDatabase();
  const order = database.orders.find((item) => item.id === request.params.id);
  if (!order) return response.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  const transitions = { pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
  if (!transitions[order.status]?.includes(status)) return response.status(409).json({ error: `Không thể chuyển đơn từ ${order.status} sang ${status}` });
  if (status === 'cancelled') {
    for (const item of order.items) {
      const product = database.products.find((candidate) => candidate.id === item.productId);
      if (product) product.stock += item.quantity;
    }
  }
  order.status = status;
  order.updatedAt = new Date().toISOString();
  await writeDatabase(database);
  return response.json({ data: order });
});

app.get('/api/admin/customers', requireAuth, requireAdmin, async (request, response) => {
  const database = await readDatabase();
  const search = String(request.query.search ?? '').trim().toLowerCase();
  const customers = database.users.filter((user) => user.role !== 'admin').map((user) => {
    const orders = database.orders.filter((order) => order.userId === user.id);
    return { ...publicUser(user), orderCount: orders.length, totalSpent: orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.total, 0) };
  }).filter((user) => !search || `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(search));
  return response.json({ data: customers });
});

app.get('/api/admin/dashboard', requireAuth, requireAdmin, async (_request, response) => {
  const database = await readDatabase();
  const activeOrders = database.orders.filter((order) => order.status !== 'cancelled');
  const sold = new Map();
  for (const order of activeOrders) for (const item of order.items) sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.quantity);
  return response.json({ data: {
    totalCustomers: database.users.filter((user) => user.role !== 'admin').length,
    totalProducts: database.products.filter((product) => product.active !== false).length,
    totalOrders: database.orders.length,
    pendingOrders: database.orders.filter((order) => order.status === 'pending').length,
    revenue: activeOrders.reduce((sum, order) => sum + order.total, 0),
    lowStockProducts: database.products.filter((product) => product.active !== false && product.stock <= 5),
    bestSellingProducts: [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([productId, quantity]) => ({ product: database.products.find((item) => item.id === productId), quantity })),
    latestOrders: [...database.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  } });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  return response.status(500).json({ error: 'Internal server error' });
});

if (!jwtSecret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
app.listen(port, () => console.log(`Atelier backend listening on http://localhost:${port}`));
