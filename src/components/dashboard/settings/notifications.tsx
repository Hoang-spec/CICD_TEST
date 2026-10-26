"use client";

import * as React from "react";
import {
	Alert,
	Button,
	Card,
	CardActions,
	CardContent,
	CardHeader,
	Checkbox,
	FormControlLabel,
	Stack,
} from "@mui/material";

import { api } from "@/lib/api";

const defaults = { productUpdates: false, securityUpdates: false, phoneEmail: false, phoneSecurity: false };
export function Notifications(): React.JSX.Element {
	const [values, setValues] = React.useState(defaults);
	const [error, setError] = React.useState<string | null>(null);
	const [saved, setSaved] = React.useState(false);
	const [ready, setReady] = React.useState(false);
	const [saving, setSaving] = React.useState(false);
	React.useEffect(() => {
		api<{ data: Partial<typeof defaults> }>("/users/me/notification-preferences")
			.then(({ data }) => {
				setValues({ ...defaults, ...data });
				setReady(true);
			})
			.catch((error: Error) => setError(error.message));
	}, []);
	const submit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();
		setError(null);
		setSaved(false);
		setSaving(true);
		try {
			await api("/users/me/notification-preferences", { method: "PATCH", body: JSON.stringify(values) });
			setSaved(true);
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setSaving(false);
		}
	};
	const labels = {
		productUpdates: "Email cập nhật sản phẩm",
		securityUpdates: "Email bảo mật",
		phoneEmail: "Thông báo qua điện thoại",
		phoneSecurity: "Thông báo bảo mật qua điện thoại",
	};
	return (
		<form onSubmit={submit}>
			<Card>
				<CardHeader
					title="Tùy chọn thông báo"
					subheader="Lưu lựa chọn của bạn. Kênh gửi email/điện thoại chưa được kích hoạt."
				/>
				<CardContent>
					<Stack>
						{error && <Alert severity="error">{error}</Alert>}
						{saved && <Alert severity="success">Đã lưu lựa chọn</Alert>}
						{(Object.keys(values) as (keyof typeof defaults)[]).map((key) => (
							<FormControlLabel
								key={key}
								label={labels[key]}
								control={
									<Checkbox
										disabled={!ready}
										checked={values[key]}
										onChange={(_, checked) => {
											setValues((v) => ({ ...v, [key]: checked }));
											setSaved(false);
										}}
									/>
								}
							/>
						))}
					</Stack>
				</CardContent>
				<CardActions>
					<Button type="submit" variant="contained" disabled={!ready || saving}>
						Lưu thay đổi
					</Button>
				</CardActions>
			</Card>
		</form>
	);
}
