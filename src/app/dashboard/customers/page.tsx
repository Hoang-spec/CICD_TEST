'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { CustomersTable } from '@/components/dashboard/customer/customers-table';
import type { Customer } from '@/components/dashboard/customer/customers-table';
import { adminRequest } from '@/lib/admin-api';

interface ApiCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt?: string;
  orderCount: number;
  totalSpent: number;
}

export default function Page(): React.JSX.Element {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    adminRequest<{ data: ApiCustomer[] }>(`/api/admin/customers?search=${encodeURIComponent(search)}`)
      .then(({ data }) => {
        if (active) setCustomers(data.map((customer, index) => ({
          id: customer.id,
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          email: customer.email,
          avatar: `/assets/avatar-${(index % 11) + 1}.png`,
          phone: '—',
          orderCount: customer.orderCount,
          totalSpent: customer.totalSpent,
          address: { city: '—', state: '—', country: '—', street: '—' },
          createdAt: customer.createdAt ? new Date(customer.createdAt) : new Date(),
        })));
        if (active) setError(null);
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search]);

  const visibleCustomers = customers.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Khách hàng</Typography>
      <TextField label="Tìm theo tên hoặc email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? <CircularProgress /> : <CustomersTable count={customers.length} page={page} rows={visibleCustomers} rowsPerPage={rowsPerPage} onPageChange={setPage} onRowsPerPageChange={(count) => { setRowsPerPage(count); setPage(0); }} />}
    </Stack>
  );
}
