'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { adminRequest } from '@/lib/admin-api';

interface Order {
  id: string;
  customer: { name: string; email: string; city?: string };
  items: { name: string; quantity: number; price: number }[];
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
}

const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const statusLabels: Record<string, string> = { pending: 'Chờ xử lý', processing: 'Đang chuẩn bị', shipped: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };

export default function Page(): React.JSX.Element {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadOrders = React.useCallback(async () => {
    setLoading(true);
    try { const result = await adminRequest<{ data: Order[] }>('/api/orders'); setOrders(result.data); setError(null); }
    catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void loadOrders(); }, [loadOrders]);

  const updateStatus = async (order: Order, status: string): Promise<void> => {
    try {
      const result = await adminRequest<{ data: Order }>(`/api/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setOrders((current) => current.map((item) => item.id === order.id ? result.data : item));
      setError(null);
    } catch (reason) { setError((reason as Error).message); }
  };

  return <Stack spacing={3}>
    <Typography variant="h4">Đơn hàng</Typography>
    <Typography color="text.secondary">Theo dõi đơn hàng và cập nhật tiến trình giao.</Typography>
    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
    {loading ? <CircularProgress /> : orders.length === 0 ? <Alert severity="info">Chưa có đơn hàng.</Alert> : <Paper sx={{ overflowX: 'auto' }}><Table>
      <TableHead><TableRow><TableCell>Mã đơn</TableCell><TableCell>Khách hàng</TableCell><TableCell>Sản phẩm</TableCell><TableCell>Tổng tiền</TableCell><TableCell>Ngày đặt</TableCell><TableCell>Trạng thái</TableCell></TableRow></TableHead>
      <TableBody>{[...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((order) => <TableRow key={order.id} hover>
        <TableCell><Typography variant="subtitle2">{order.id.slice(-8)}</Typography><Typography variant="caption" color="text.secondary">{order.paymentMethod === 'cod' ? 'Thanh toán khi nhận' : 'Thẻ (demo)'}</Typography></TableCell>
        <TableCell><Typography variant="body2">{order.customer.name}</Typography><Typography variant="caption" color="text.secondary">{order.customer.email}</Typography></TableCell>
        <TableCell>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</TableCell>
        <TableCell>${Number(order.total).toFixed(2)}</TableCell>
        <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
        <TableCell><Stack spacing={1} alignItems="flex-start"><Chip size="small" label={statusLabels[order.status] ?? order.status} color={order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'error' : 'default'} />
          {order.status !== 'delivered' && order.status !== 'cancelled' && <Select size="small" value={order.status} onChange={(event) => void updateStatus(order, event.target.value)} sx={{ minWidth: 150 }}>
            {statuses.filter((status) => status === order.status || (order.status === 'pending' && ['processing', 'cancelled'].includes(status)) || (order.status === 'processing' && ['shipped', 'cancelled'].includes(status)) || (order.status === 'shipped' && status === 'delivered')).map((status) => <MenuItem key={status} value={status}>{statusLabels[status]}</MenuItem>)}
          </Select>}</Stack></TableCell>
      </TableRow>)}</TableBody>
    </Table></Paper>}
  </Stack>;
}
