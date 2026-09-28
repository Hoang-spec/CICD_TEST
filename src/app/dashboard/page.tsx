'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { adminRequest } from '@/lib/admin-api';

interface DashboardData {
  totalCustomers: number;
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  lowStockProducts: { id: string; name: string; stock: number }[];
  bestSellingProducts: { product: { id: string; name: string } | undefined; quantity: number }[];
  latestOrders: { id: string; customer: { name: string }; total: number; status: string; createdAt: string }[];
}

const statusLabels: Record<string, string> = { pending: 'Chờ xử lý', processing: 'Đang chuẩn bị', shipped: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };

export default function Page(): React.JSX.Element {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    adminRequest<{ data: DashboardData }>('/api/admin/dashboard')
      .then((result) => setData(result.data))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="info">Chưa có dữ liệu dashboard.</Alert>;

  const stats = [
    ['Doanh thu', `$${Number(data.revenue).toFixed(2)}`],
    ['Đơn hàng', data.totalOrders],
    ['Chờ xử lý', data.pendingOrders],
    ['Khách hàng', data.totalCustomers],
    ['Sản phẩm đang bán', data.totalProducts],
  ];

  return <Stack spacing={3}>
    <Stack spacing={0.5}><Typography variant="h4">Tổng quan</Typography><Typography color="text.secondary">Tình hình cửa hàng từ dữ liệu đơn hàng và sản phẩm hiện tại.</Typography></Stack>
    <Grid container spacing={3}>{stats.map(([label, value]) => <Grid key={label} size={{ lg: 2.4, md: 4, sm: 6, xs: 12 }}><Card sx={{ height: '100%' }}><CardContent><Typography color="text.secondary" variant="body2">{label}</Typography><Typography variant="h4" sx={{ mt: 1 }}>{value}</Typography></CardContent></Card></Grid>)}</Grid>
    <Grid container spacing={3}>
      <Grid size={{ lg: 8, xs: 12 }}><Card><CardContent><Typography variant="h6" sx={{ mb: 2 }}>Đơn hàng mới nhất</Typography>
        {data.latestOrders.length ? <Table size="small"><TableHead><TableRow><TableCell>Mã đơn</TableCell><TableCell>Khách hàng</TableCell><TableCell>Tổng</TableCell><TableCell>Trạng thái</TableCell><TableCell>Ngày đặt</TableCell></TableRow></TableHead><TableBody>{data.latestOrders.map((order) => <TableRow key={order.id}><TableCell>{order.id.slice(-8)}</TableCell><TableCell>{order.customer.name}</TableCell><TableCell>${Number(order.total).toFixed(2)}</TableCell><TableCell><Chip size="small" label={statusLabels[order.status] ?? order.status} /></TableCell><TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table> : <Typography color="text.secondary">Chưa có đơn hàng.</Typography>}
      </CardContent></Card></Grid>
      <Grid size={{ lg: 4, xs: 12 }}><Stack spacing={3}>
        <Card><CardContent><Typography variant="h6" sx={{ mb: 2 }}>Sắp hết hàng</Typography>{data.lowStockProducts.length ? <Stack spacing={1.5}>{data.lowStockProducts.map((product) => <Stack key={product.id} direction="row" justifyContent="space-between"><Typography>{product.name}</Typography><Chip size="small" color="warning" label={`${product.stock} còn lại`} /></Stack>)}</Stack> : <Typography color="text.secondary">Không có sản phẩm tồn kho thấp.</Typography>}</CardContent></Card>
        <Card><CardContent><Typography variant="h6" sx={{ mb: 2 }}>Bán chạy</Typography>{data.bestSellingProducts.length ? <Stack spacing={1.5}>{data.bestSellingProducts.map((item) => <Stack key={item.product?.id} direction="row" justifyContent="space-between"><Typography>{item.product?.name ?? 'Sản phẩm đã xóa'}</Typography><Typography color="text.secondary">{item.quantity} đã bán</Typography></Stack>)}</Stack> : <Typography color="text.secondary">Chưa có dữ liệu bán hàng.</Typography>}</CardContent></Card>
      </Stack></Grid>
    </Grid>
  </Stack>;
}
