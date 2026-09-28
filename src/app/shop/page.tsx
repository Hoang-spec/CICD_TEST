'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CaretRight, Heart, MagnifyingGlass, Minus, Plus, ShoppingBag, Sparkle, X } from '@phosphor-icons/react';

import { paths } from '@/paths';
import { authClient } from '@/lib/auth/client';
import { useUser } from '@/hooks/use-user';
import { products as fallbackProducts, type Product } from '@/lib/shop-products';

export default function ShopPage(): React.JSX.Element {
  const router = useRouter();
  const { user, isLoading, checkSession } = useUser();
  const [hasShopSession, setHasShopSession] = React.useState(false);
  const [category, setCategory] = React.useState('All products');
  const [search, setSearch] = React.useState('');
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [isCartLoaded, setIsCartLoaded] = React.useState(false);
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [products, setProducts] = React.useState<Product[]>(fallbackProducts);
  const categories = React.useMemo(() => ['All products', ...new Set(products.map((product) => product.category))], [products]);

  React.useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiUrl}/api/products`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load catalog');
        const result = (await response.json()) as { data: Product[] };
        setProducts(result.data);
      })
      .catch(() => { /* Keep the bundled catalog available when the API is offline. */ });
  }, []);

  React.useEffect(() => {
    authClient.getUser().then(({ data }) => setHasShopSession(Boolean(data))).catch(() => setHasShopSession(false));
  }, []);

  React.useEffect(() => {
    const savedCart = globalThis.localStorage.getItem('atelier-cart');
    if (savedCart) setCart(JSON.parse(savedCart) as Record<string, number>);
    setIsCartLoaded(true);
  }, []);

  React.useEffect(() => {
    if (isCartLoaded) globalThis.localStorage.setItem('atelier-cart', JSON.stringify(cart));
  }, [cart, isCartLoaded]);

  const filteredProducts = products.filter((product) => {
    const matchesCategory = category === 'All products' || product.category === category;
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product): void => {
    setCart((currentCart) => ({ ...currentCart, [product.id]: (currentCart[product.id] ?? 0) + 1 }));
  };

  const updateQuantity = (productId: string, amount: number): void => {
    setCart((currentCart) => {
      const nextQuantity = (currentCart[productId] ?? 0) + amount;
      const nextCart = { ...currentCart };
      if (nextQuantity > 0) nextCart[productId] = nextQuantity;
      else delete nextCart[productId];
      return nextCart;
    });
  };

  const cartProducts = products.filter((product) => cart[product.id]);
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = cartProducts.reduce((total, product) => total + product.price * cart[product.id], 0);

  const handleSignOut = async (): Promise<void> => {
    await authClient.signOut();
    setHasShopSession(false);
    await checkSession?.();
    router.refresh();
  };

  const handleAuthNavigation = async (destination: string): Promise<void> => {
    await authClient.signOut();
    await checkSession?.();
    globalThis.location.assign(destination);
  };

  return (
    <Box className="shop-page">
      <Box component="header" className="shop-header">
        <Container maxWidth="lg" className="shop-header-inner">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box className="shop-mark">a</Box>
            <Typography className="shop-logo">atelier.</Typography>
          </Stack>
          <Stack component="nav" direction="row" spacing={3} className="shop-nav">
            <a href="#new-in">New in</a>
            <a href="#shop">Shop</a>
            <a href="#story">Our story</a>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton aria-label="Search" className="shop-icon-button">
              <MagnifyingGlass size={20} />
            </IconButton>
            <Box className="account-links">
              {isLoading ? null : user || hasShopSession ? <Button onClick={handleSignOut} className="account-signup">Đăng xuất</Button> : <>
                <Button component={RouterLink} href={paths.auth.signIn} className="account-login" onClick={(event) => { event.preventDefault(); void handleAuthNavigation(paths.auth.signIn); }}>Đăng nhập</Button>
                <Button component={RouterLink} href={paths.auth.signUp} className="account-signup" onClick={(event) => { event.preventDefault(); void handleAuthNavigation(paths.auth.signUp); }}>Đăng ký</Button>
              </>}
            </Box>
            <Button className="cart-button" onClick={() => setIsCartOpen(true)} startIcon={<ShoppingBag size={19} />}>
              Bag <span className="cart-count">{cartCount}</span>
            </Button>
          </Stack>
        </Container>
      </Box>

      <main>
        <Box id="new-in" className="shop-hero">
          <Container maxWidth="lg" className="hero-inner">
            <Box className="hero-copy">
              <Chip icon={<Sparkle size={15} />} label="The everyday edit" className="hero-chip" />
              <Typography component="h1">Small rituals.<br /><em>Big feeling.</em></Typography>
              <Typography className="hero-description">Những món đồ được chọn để làm dịu nhịp sống, nâng niu làn da và khiến mỗi ngày trở nên đặc biệt hơn.</Typography>
              <Button href="#shop" className="primary-button" endIcon={<CaretRight size={18} />}>Khám phá bộ sưu tập</Button>
            </Box>
            <Box className="hero-art" aria-label="Bộ sản phẩm chăm sóc cá nhân" role="img">
              <Box className="hero-orbit orbit-one" />
              <Box className="hero-orbit orbit-two" />
              <Box className="hero-product hero-product-main"><img src="/assets/product-3.png" alt="Ritual of Sakura" /></Box>
              <Box className="hero-product hero-product-side"><img src="/assets/product-1.png" alt="Erbology Aloe Vera" /></Box>
              <Box className="hero-note">made<br />with care</Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg" id="shop" className="shop-content">
          <Stack className="section-heading" direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
            <Box>
              <Typography className="eyebrow">Curated for you</Typography>
              <Typography component="h2">The good stuff</Typography>
            </Box>
            <Box className="search-box">
              <MagnifyingGlass size={18} />
              <InputBase value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm" inputProps={{ 'aria-label': 'Tìm sản phẩm' }} />
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} className="category-list" sx={{ overflowX: 'auto' }}>
            {categories.map((item) => <Button key={item} className={category === item ? 'category-button active' : 'category-button'} onClick={() => setCategory(item)}>{item}</Button>)}
          </Stack>

          <Box className="product-grid">
            {filteredProducts.map((product) => (
              <Box className="product-card" key={product.id}>
                <Box className="product-image" sx={{ backgroundColor: product.accent }} onClick={() => setSelectedProduct(product)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedProduct(product); }}>
                  {product.badge && <Chip label={product.badge} className="product-badge" />}
                  <IconButton aria-label={`Yêu thích ${product.name}`} className="wishlist-button"><Heart size={19} /></IconButton>
                  <img src={product.image} alt={product.name} />
                </Box>
                <Stack spacing={0.75} className="product-info">
                  <Typography className="product-category">{product.category}</Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Typography className="product-name product-name-clickable" onClick={() => setSelectedProduct(product)}>{product.name}</Typography>
                    <Typography className="product-price">${product.price}</Typography>
                  </Stack>
                  <Typography className="product-description">{product.description}</Typography>
                  <Button className="add-button" onClick={() => addToCart(product)} startIcon={<Plus size={16} />}>Thêm vào túi</Button>
                </Stack>
              </Box>
            ))}
          </Box>
          {filteredProducts.length === 0 && <Typography className="empty-state">Không tìm thấy sản phẩm phù hợp.</Typography>}
        </Container>

        <Box id="story" className="story-band">
          <Container maxWidth="lg" className="story-inner">
            <Typography className="eyebrow">Our point of view</Typography>
            <Typography component="h2">Đẹp hơn khi vừa đủ.</Typography>
            <Typography>atelier. tin vào những lựa chọn có chủ đích: công thức tốt, thiết kế đẹp và cảm giác dễ chịu từ lần dùng đầu tiên.</Typography>
            <Button className="text-button" endIcon={<CaretRight size={18} />}>Tìm hiểu về atelier.</Button>
          </Container>
        </Box>
      </main>

      <Drawer anchor="right" open={isCartOpen} onClose={() => setIsCartOpen(false)}>
        <Box className="cart-drawer">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography component="h2">Your bag <span>{cartCount} items</span></Typography>
            <IconButton aria-label="Đóng giỏ hàng" onClick={() => setIsCartOpen(false)}><X size={20} /></IconButton>
          </Stack>
          <Divider />
          {cartCount === 0 ? <Box className="empty-cart"><ShoppingBag size={36} /><Typography>Chiếc túi của bạn đang trống.</Typography></Box> : (
            <Stack spacing={2} className="cart-items">
              {cartProducts.map((product) => <Stack key={product.id} direction="row" spacing={1.5} alignItems="center"><Box className="cart-item-image"><img src={product.image} alt="" /></Box><Box sx={{ flex: 1 }}><Typography className="cart-item-name">{product.name}</Typography><Typography className="cart-item-price">${product.price} / sản phẩm</Typography><Stack direction="row" alignItems="center" className="quantity-control"><IconButton aria-label={`Giảm ${product.name}`} onClick={() => updateQuantity(product.id, -1)}><Minus size={14} /></IconButton><Typography>{cart[product.id]}</Typography><IconButton aria-label={`Tăng ${product.name}`} onClick={() => updateQuantity(product.id, 1)}><Plus size={14} /></IconButton></Stack></Box></Stack>)}
            </Stack>
          )}
          <Box className="cart-footer"><Stack direction="row" justifyContent="space-between"><Typography>Tạm tính</Typography><Typography className="cart-total">${cartTotal}</Typography></Stack><Button className="primary-button cart-checkout-button" fullWidth disabled={cartCount === 0} onClick={() => router.push(paths.checkout)}>Tiến hành thanh toán</Button></Box>
        </Box>
      </Drawer>

      <Dialog open={Boolean(selectedProduct)} onClose={() => setSelectedProduct(null)} maxWidth="sm" fullWidth>
        {selectedProduct && <>
          <DialogContent className="product-detail">
            <Box className="detail-image" sx={{ backgroundColor: selectedProduct.accent }}><img src={selectedProduct.image} alt={selectedProduct.name} /></Box>
            <Box className="detail-copy"><Typography className="product-category">{selectedProduct.category}</Typography><Typography component="h2">{selectedProduct.name}</Typography><Typography className="detail-price">${selectedProduct.price}</Typography><Typography className="detail-description">{selectedProduct.description} Công thức được chọn lọc để mang lại trải nghiệm chăm sóc nhẹ nhàng và dễ chịu trong mỗi ngày.</Typography><Button className="primary-button" fullWidth startIcon={<ShoppingBag size={17} />} onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); setIsCartOpen(true); }}>Thêm vào túi</Button></Box>
          </DialogContent>
        </>}
      </Dialog>

    </Box>
  );
}
