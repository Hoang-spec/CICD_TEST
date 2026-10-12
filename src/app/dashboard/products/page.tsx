'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/ssr/PencilSimple';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';
import { TrashIcon } from '@phosphor-icons/react/dist/ssr/Trash';

import { getDemoProducts, saveDemoProducts } from '@/lib/demo-store';
import type { DemoProduct } from '@/lib/demo-store';

type ProductInput = Omit<DemoProduct, 'id'>;
const blankProduct: ProductInput = { name: '', category: '', description: '', price: 0, oldPrice: null, image: '', accent: '#e4f0e8', badge: null, stock: 0, active: true };

export default function Page(): React.JSX.Element {
  const [products, setProducts] = React.useState<DemoProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DemoProduct | null>(null);
  const [form, setForm] = React.useState<ProductInput>(blankProduct);
  const [saving, setSaving] = React.useState(false);

  const loadProducts = React.useCallback(() => {
    setLoading(true);
    setProducts(getDemoProducts());
    setError(null);
    setLoading(false);
  }, []);

  React.useEffect(() => { void loadProducts(); }, [loadProducts]);

  const openCreate = (): void => { setEditing(null); setForm(blankProduct); setDialogOpen(true); };
  const openEdit = (product: DemoProduct): void => {
    setEditing(product);
    const { id: _id, ...values } = product;
    setForm(values);
    setDialogOpen(true);
  };

  const saveProduct = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const nextProducts = getDemoProducts();
      if (editing) {
        const index = nextProducts.findIndex((product) => product.id === editing.id);
        if (index >= 0) nextProducts[index] = { ...nextProducts[index], ...form };
      } else {
        nextProducts.unshift({ id: `PRD-${globalThis.crypto.randomUUID()}`, ...form });
      }
      saveDemoProducts(nextProducts);
      setDialogOpen(false);
      loadProducts();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  };

  const deleteProduct = async (product: DemoProduct): Promise<void> => {
    if (!globalThis.confirm(`Xóa sản phẩm “${product.name}”?`)) return;
    try {
      saveDemoProducts(getDemoProducts().map((item) => item.id === product.id ? { ...item, active: false } : item));
      loadProducts();
    }
    catch (reason) { setError((reason as Error).message); }
  };

  const field = (key: keyof ProductInput, label: string, type = 'text'): React.JSX.Element => (
    <TextField
      key={key}
      fullWidth
      label={label}
      type={type}
      value={String(form[key] ?? '')}
      onChange={(event) => setForm((current) => ({ ...current, [key]: type === 'number' ? Number(event.target.value) : event.target.value }) as ProductInput)}
      inputProps={type === 'number' ? { min: 0, step: key === 'price' || key === 'oldPrice' ? '0.01' : '1' } : undefined}
    />
  );

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Sản phẩm</Typography>
        <Button variant="contained" startIcon={<PlusIcon />} onClick={openCreate}>Thêm sản phẩm</Button>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <CircularProgress /> : <Paper sx={{ overflowX: 'auto' }}><Table>
        <TableHead><TableRow><TableCell>Sản phẩm</TableCell><TableCell>Danh mục</TableCell><TableCell>Giá</TableCell><TableCell>Tồn kho</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
        <TableBody>{products.map((product) => <TableRow key={product.id} hover>
          <TableCell><Stack direction="row" spacing={1.5} alignItems="center">{product.image && <img src={product.image} alt="" width="42" height="42" style={{ objectFit: 'cover', borderRadius: 8 }} />}<Stack><Typography variant="subtitle2">{product.name}</Typography><Typography variant="caption" color="text.secondary">{product.id}</Typography></Stack></Stack></TableCell>
          <TableCell>{product.category}</TableCell><TableCell>${product.price.toFixed(2)}</TableCell><TableCell>{product.stock}</TableCell><TableCell>{product.active ? 'Đang bán' : 'Đã ẩn'}</TableCell>
          <TableCell align="right"><IconButton aria-label="Sửa" onClick={() => openEdit(product)}><PencilSimpleIcon /></IconButton><IconButton aria-label="Xóa" color="error" onClick={() => void deleteProduct(product)}><TrashIcon /></IconButton></TableCell>
        </TableRow>)}</TableBody>
      </Table></Paper>}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void saveProduct(event)}>
          <DialogTitle>{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
            {field('name', 'Tên sản phẩm')}{field('category', 'Danh mục')}{field('description', 'Mô tả')}{field('price', 'Giá', 'number')}{field('oldPrice', 'Giá cũ', 'number')}{field('stock', 'Tồn kho', 'number')}{field('image', 'Đường dẫn ảnh')}{field('accent', 'Màu nền')}{field('badge', 'Nhãn')}
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setDialogOpen(false)}>Hủy</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</Button></DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
