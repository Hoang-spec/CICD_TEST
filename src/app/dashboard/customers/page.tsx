'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { CustomersTable } from '@/components/dashboard/customer/customers-table';
import type { Customer } from '@/components/dashboard/customer/customers-table';
import { getDemoUsers } from '@/lib/auth/client';
import { getDemoOrders } from '@/lib/demo-store';

export default function Page(): React.JSX.Element {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    const orders = getDemoOrders();
    setCustomers(getDemoUsers().filter((user) => user.role !== 'admin').map((user, index) => {
      const userOrders = orders.filter((order) => order.userId === user.id && order.status !== 'cancelled');
      return {
        id: user.id,
        name: user.name ?? user.email ?? 'Khách hàng',
        email: user.email ?? '',
        avatar: `/assets/avatar-${(index % 11) + 1}.png`,
        phone: '—',
        address: { city: '—', state: '—', country: '—', street: '—' },
        createdAt: new Date(String(user.createdAt ?? Date.now())),
        orderCount: userOrders.length,
        totalSpent: userOrders.reduce((total, order) => total + order.total, 0),
      };
    }));
  }, []);

  const filteredCustomers = customers.filter((customer) => `${customer.name} ${customer.email}`.toLowerCase().includes(search.toLowerCase()));
  const visibleCustomers = filteredCustomers.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Khách hàng</Typography>
      <TextField label="Tìm theo tên hoặc email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
      <CustomersTable count={filteredCustomers.length} page={page} rows={visibleCustomers} rowsPerPage={rowsPerPage} onPageChange={setPage} onRowsPerPageChange={(count) => { setRowsPerPage(count); setPage(0); }} />
    </Stack>
  );
}
