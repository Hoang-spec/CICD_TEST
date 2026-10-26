"use client";

import * as React from "react";
import { Avatar, Card, CardContent, Stack, Typography } from "@mui/material";

import { useUser } from "@/hooks/use-user";

export function AccountInfo(): React.JSX.Element {
	const { user } = useUser();
	return (
		<Card>
			<CardContent>
				<Stack spacing={2} alignItems="center">
					<Avatar src={user?.avatar} sx={{ height: 80, width: 80 }} />
					<Typography variant="h5">{user?.name}</Typography>
					<Typography>{user?.email}</Typography>
					<Typography>{[user?.city, user?.country].filter(Boolean).join(", ")}</Typography>
				</Stack>
			</CardContent>
		</Card>
	);
}
