"use client";

import * as React from "react";
import { Alert, Button, Card, CardActions, CardContent, CardHeader, Stack, TextField } from "@mui/material";

import { api } from "@/lib/api";
import { useUser } from "@/hooks/use-user";

export function AccountDetailsForm(): React.JSX.Element {
	const { user, checkSession } = useUser();
	const [message, setMessage] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [saving, setSaving] = React.useState(false);
	const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		setSaving(true);
		setError(null);
		setMessage(null);
		try {
			await api("/users/me", { method: "PATCH", body: JSON.stringify(Object.fromEntries(data)) });
			await checkSession?.();
			setMessage("Đã lưu thông tin");
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setSaving(false);
		}
	};
	const fields = [
		["firstName", "Tên"],
		["lastName", "Họ"],
		["phone", "Số điện thoại"],
		["city", "Thành phố"],
		["state", "Tỉnh / bang"],
		["country", "Quốc gia"],
	];
	return (
		<form key={user?.id} onSubmit={submit}>
			<Card>
				<CardHeader title="Hồ sơ" />
				<CardContent>
					<Stack spacing={2}>
						{error && <Alert severity="error">{error}</Alert>}
						{message && <Alert severity="success">{message}</Alert>}
						{fields.map(([key, label]) => (
							<TextField
								key={key}
								name={key}
								label={label}
								defaultValue={String(user?.[key] ?? "")}
								required={key === "firstName" || key === "lastName"}
							/>
						))}
						<TextField label="Email" value={user?.email ?? ""} disabled />
					</Stack>
				</CardContent>
				<CardActions>
					<Button type="submit" variant="contained" disabled={saving}>
						Lưu thông tin
					</Button>
				</CardActions>
			</Card>
		</form>
	);
}
