"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { allPages } from "@/lib/api";
import { CustomersTable } from "@/components/dashboard/customer/customers-table";
import type { Customer } from "@/components/dashboard/customer/customers-table";

export default function Page(): React.JSX.Element {
	const [error, setError] = React.useState<string | null>(null);
	const [customers, setCustomers] = React.useState<Customer[]>([]);
	const [search, setSearch] = React.useState("");
	const [page, setPage] = React.useState(0);
	const [rowsPerPage, setRowsPerPage] = React.useState(10);

	React.useEffect(() => {
		allPages<{
			id: string;
			name: string;
			email: string;
			avatar: string;
			phone: string;
			city: string;
			state: string;
			country: string;
			createdAt: string;
			orderCount: number;
			totalSpent: string;
		}>("/admin/customers")
			.then((users) =>
				setCustomers(
					users.map((user) => ({
						...user,
						address: { city: user.city, state: user.state, country: user.country, street: "" },
						createdAt: new Date(user.createdAt),
						totalSpent: Number(user.totalSpent),
					}))
				)
			)
			.catch((error: Error) => setError(error.message));
	}, []);

	const filteredCustomers = customers.filter((customer) =>
		`${customer.name} ${customer.email}`.toLowerCase().includes(search.toLowerCase())
	);
	const visibleCustomers = filteredCustomers.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

	return (
		<Stack spacing={3}>
			<Typography variant="h4">Khách hàng</Typography>
			{error && <Alert severity="error">{error}</Alert>}
			<TextField
				label="Tìm theo tên hoặc email"
				value={search}
				onChange={(event) => {
					setSearch(event.target.value);
					setPage(0);
				}}
			/>
			<CustomersTable
				count={filteredCustomers.length}
				page={page}
				rows={visibleCustomers}
				rowsPerPage={rowsPerPage}
				onPageChange={setPage}
				onRowsPerPageChange={(count) => {
					setRowsPerPage(count);
					setPage(0);
				}}
			/>
		</Stack>
	);
}
