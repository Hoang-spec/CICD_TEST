"use client";

import * as React from "react";
import { Alert, Button, Card, CardActions, CardContent, CardHeader, Stack, TextField } from "@mui/material";

import { api } from "@/lib/api";
import { useUser } from "@/hooks/use-user";

export function UpdatePasswordForm(): React.JSX.Element {
	const { checkSession } = useUser();
	const [error, setError] = React.useState<string | null>(null);
	const [saving, setSaving] = React.useState(false);
	const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		if (data.get("password") !== data.get("confirmation")) {
			setError("Mật khẩu xác nhận không khớp");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await api("/users/me/change-password", {
				method: "POST",
				body: JSON.stringify({ currentPassword: data.get("currentPassword"), password: data.get("password") }),
			});
			await checkSession?.();
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setSaving(false);
		}
	};
	return (
		<form onSubmit={submit}>
			<Card>
				<CardHeader title="Đổi mật khẩu" subheader="Bạn sẽ cần đăng nhập lại sau khi đổi mật khẩu." />
				<CardContent>
					<Stack spacing={2}>
						{error && <Alert severity="error">{error}</Alert>}
						<TextField
							name="currentPassword"
							label="Mật khẩu hiện tại"
							type="password"
							autoComplete="current-password"
							required
						/>
						<TextField
							name="password"
							label="Mật khẩu mới"
							type="password"
							autoComplete="new-password"
							inputProps={{ minLength: 8, maxLength: 72 }}
							required
						/>
						<TextField
							name="confirmation"
							label="Xác nhận mật khẩu mới"
							type="password"
							autoComplete="new-password"
							required
						/>
					</Stack>
				</CardContent>
				<CardActions>
					<Button type="submit" variant="contained" disabled={saving}>
						Đổi mật khẩu
					</Button>
				</CardActions>
			</Card>
		</form>
	);
}
