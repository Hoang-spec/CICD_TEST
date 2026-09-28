'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';

import { paths } from '@/paths';
import { useUser } from '@/hooks/use-user';

export function AdminGuard({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const router = useRouter();
  const { user, isLoading } = useUser();

  React.useEffect(() => {
    if (!isLoading && user && user.role !== 'admin') router.replace(paths.shop);
  }, [isLoading, router, user]);

  if (isLoading) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>;
  if (!user) return null;
  if (user.role !== 'admin') return <Alert severity="error">Bạn không có quyền truy cập trang quản trị.</Alert>;
  return <>{children}</>;
}
