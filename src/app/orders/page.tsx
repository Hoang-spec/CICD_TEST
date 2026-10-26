"use client";

import * as React from "react";
import Link from "next/link";
import { Alert, Button, Card, CardContent, Container, Stack, Typography } from "@mui/material";

import { paths } from "@/paths";
import { getOrders, type StoreOrder } from "@/lib/store-api";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function OrdersPage(): React.JSX.Element {
	const [orders, setOrders] = React.useState<StoreOrder[]>([]);
	const [error, setError] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(true);
	React.useEffect(() => {
		getOrders()
			.then(setOrders)
			.catch((error: Error) => setError(error.message))
			.finally(() => setLoading(false));
	}, []);
	const labels = {
		pending: "Chờ xử lý",
		processing: "Đang chuẩn bị",
		shipped: "Đang giao",
		delivered: "Đã giao",
		cancelled: "Đã hủy",
	};
	return (
		<AuthGuard>
			<Container maxWidth="md" sx={{ py: 5 }}>
				<Stack spacing={3}>
					<Button component={Link} href={paths.shop}>
						Quay lại cửa hàng
					</Button>
					<Typography variant="h4">Đơn hàng của tôi</Typography>
					{error && <Alert severity="error">{error}</Alert>}
					{loading && <Typography>Đang tải đơn hàng…</Typography>}
					{!loading && !error && orders.length === 0 && <Typography>Bạn chưa có đơn hàng.</Typography>}
					{orders.map((order) => (
						<Card key={order.id}>
							<CardContent>
								<Stack spacing={1}>
									<Typography variant="h6">{order.id}</Typography>
									<Typography>
										{labels[order.status]} · {new Date(order.createdAt).toLocaleString()}
									</Typography>
									{order.items.map((item) => (
										<Typography key={item.productId}>
											{item.name} × {item.quantity} — ${(item.price * item.quantity).toFixed(2)}
										</Typography>
									))}
									<Typography>Phí vận chuyển: ${order.shipping.toFixed(2)}</Typography>
									<Typography fontWeight={700}>Tổng cộng: ${order.total.toFixed(2)}</Typography>
								</Stack>
							</CardContent>
						</Card>
					))}
				</Stack>
			</Container>
		</AuthGuard>
	);
}
