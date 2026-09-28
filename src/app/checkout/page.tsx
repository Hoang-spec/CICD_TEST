'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ArrowLeft, Check, Minus, Plus, ShoppingBag } from '@phosphor-icons/react';

import { paths } from '@/paths';
import { products } from '@/lib/shop-products';

export default function CheckoutPage(): React.JSX.Element {
  const router = useRouter();
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [isComplete, setIsComplete] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState('card');

  React.useEffect(() => {
    const savedCart = globalThis.localStorage.getItem('atelier-cart');
    if (savedCart) setCart(JSON.parse(savedCart) as Record<string, number>);
  }, []);

  const updateQuantity = (productId: string, amount: number): void => {
    setCart((currentCart) => {
      const nextQuantity = (currentCart[productId] ?? 0) + amount;
      const nextCart = { ...currentCart };
      if (nextQuantity > 0) nextCart[productId] = nextQuantity;
      else delete nextCart[productId];
      globalThis.localStorage.setItem('atelier-cart', JSON.stringify(nextCart));
      return nextCart;
    });
  };

  const cartProducts = products.filter((product) => cart[product.id]);
  const cartTotal = cartProducts.reduce((total, product) => total + product.price * cart[product.id], 0);
  const shipping = cartTotal > 0 && cartTotal < 50 ? 5 : 0;
  const total = cartTotal + shipping;

  const submitOrder = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    globalThis.localStorage.removeItem('atelier-cart');
    setCart({});
    setIsComplete(true);
  };

  if (isComplete) {
    return (
      <Box className="shop-page checkout-page">
        <Container maxWidth="sm" className="order-success-page">
          <Check size={52} />
          <Typography component="h1">Đặt hàng thành công</Typography>
          <Typography>Đơn hàng của bạn đã được ghi nhận. Chúng tôi sẽ liên hệ để xác nhận thời gian giao hàng.</Typography>
          <Button className="primary-button" onClick={() => router.push(paths.shop)}>Tiếp tục mua sắm</Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box className="shop-page checkout-page">
      <Box component="header" className="shop-header">
        <Container maxWidth="lg" className="shop-header-inner">
          <Button className="back-shop-button" startIcon={<ArrowLeft size={18} />} onClick={() => router.push(paths.shop)}>Quay lại cửa hàng</Button>
          <Stack direction="row" alignItems="center" spacing={1.5}><Box className="shop-mark">a</Box><Typography className="shop-logo">atelier.</Typography></Stack>
          <Box className="checkout-step">Thanh toán</Box>
        </Container>
      </Box>

      <Container maxWidth="lg" className="checkout-content">
        <Typography className="eyebrow">Almost yours</Typography>
        <Typography component="h1">Hoàn tất đơn hàng</Typography>
        {cartProducts.length === 0 ? (
          <Stack alignItems="center" className="checkout-empty" spacing={2}><ShoppingBag size={42} /><Typography>Giỏ hàng của bạn đang trống.</Typography><Button className="primary-button" onClick={() => router.push(paths.shop)}>Quay lại cửa hàng</Button></Stack>
        ) : (
          <Box component="form" onSubmit={submitOrder} className="checkout-layout">
            <Stack spacing={4}>
              <Box className="checkout-section"><Typography component="h2">Thông tin giao hàng</Typography><Stack spacing={2} className="checkout-fields"><TextField label="Họ và tên" required fullWidth /><TextField label="Email" type="email" required fullWidth /><TextField label="Số điện thoại" required fullWidth /><TextField label="Địa chỉ giao hàng" required fullWidth /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField label="Tỉnh / thành phố" required fullWidth /><TextField label="Mã bưu chính" required fullWidth /></Stack></Stack></Box>
              <Box className="checkout-section"><Typography component="h2">Phương thức thanh toán</Typography><FormControl><RadioGroup value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><FormControlLabel value="card" control={<Radio />} label="Thẻ tín dụng / ghi nợ" /><FormControlLabel value="cod" control={<Radio />} label="Thanh toán khi nhận hàng" /></RadioGroup></FormControl>{paymentMethod === 'card' && <Stack spacing={2} className="checkout-fields"><TextField label="Số thẻ (demo)" required fullWidth inputProps={{ inputMode: 'numeric' }} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField label="Ngày hết hạn" placeholder="MM/YY" required fullWidth /><TextField label="CVV" required fullWidth /></Stack></Stack>}</Box>
            </Stack>
            <Box className="checkout-summary"><Typography component="h2">Đơn hàng của bạn</Typography><Stack spacing={2} className="checkout-products">{cartProducts.map((product) => <Stack key={product.id} direction="row" spacing={1.5} alignItems="center"><Box className="checkout-product-image"><img src={product.image} alt="" /></Box><Box sx={{ flex: 1 }}><Typography className="cart-item-name">{product.name}</Typography><Typography className="cart-item-price">${product.price}</Typography><Stack direction="row" alignItems="center" className="quantity-control"><Button aria-label={`Giảm ${product.name}`} onClick={() => updateQuantity(product.id, -1)}><Minus size={14} /></Button><Typography>{cart[product.id]}</Typography><Button aria-label={`Tăng ${product.name}`} onClick={() => updateQuantity(product.id, 1)}><Plus size={14} /></Button></Stack></Box><Typography fontWeight={700}>${product.price * cart[product.id]}</Typography></Stack>)}</Stack><Divider /><Stack spacing={1.5} className="summary-totals"><Stack direction="row" justifyContent="space-between"><Typography>Tạm tính</Typography><Typography>${cartTotal}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography>Phí vận chuyển</Typography><Typography>{shipping === 0 ? 'Miễn phí' : `$${shipping}`}</Typography></Stack><Stack direction="row" justifyContent="space-between" className="summary-grand-total"><Typography>Tổng cộng</Typography><Typography>${total}</Typography></Stack></Stack><Button type="submit" className="primary-button" fullWidth>Đặt hàng</Button></Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}
