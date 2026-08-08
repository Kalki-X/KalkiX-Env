import { apiClient, apiBaseUrl } from "../../../services/api/client";

export type AccountType = "renter" | "owner" | "both";

export interface AuthUser {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: "super_admin" | "admin" | "support" | "finance" | "platform_user";
    isRenter: boolean;
    isLender: boolean;
    status: "active" | "suspended" | "deactivated";
    createdAt: string;
    hasAvatar: boolean;
    // Optional postal address (Phase 11) — shown on the "From" block of a PDF document
    // whenever this user is the lender on a booking. All nullable.
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
}

export interface ProfileUpdatePayload {
    phone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
}

export interface RegisterPayload {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    accountType: AccountType;
}

export interface LoginPayload {
    email: string;
    password: string;
    remember?: boolean;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthUser> {
    const { data } = await apiClient.post("/api/auth/register", payload);
    return data.user as AuthUser;
}

export async function loginUser(payload: LoginPayload): Promise<AuthUser> {
    const { data } = await apiClient.post("/api/auth/login", payload);
    return data.user as AuthUser;
}

export async function logoutUser(): Promise<void> {
    await apiClient.post("/api/auth/logout");
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
    try {
        const { data } = await apiClient.get("/api/auth/me");
        return data.user as AuthUser;
    } catch {
        return null;
    }
}

export async function requestPasswordReset(email: string): Promise<string> {
    const { data } = await apiClient.post("/api/auth/forgot-password", { email });
    return data.message as string;
}

export async function resetPassword(token: string, password: string): Promise<string> {
    const { data } = await apiClient.post("/api/auth/reset-password", { token, password });
    return data.message as string;
}

// Self-service profile edit: phone + the optional postal address fields (Phase 11).
// Email is fixed (login identity) and isn't accepted by the backend even if included
// here — see auth.routes.js PATCH /me.
export async function updateProfile(payload: ProfileUpdatePayload): Promise<AuthUser> {
    const { data } = await apiClient.patch("/api/auth/me", payload);
    return data.user as AuthUser;
}

export function userAvatarUrl(userId: number): string {
    return `${apiBaseUrl}/api/users/${userId}/avatar`;
}

export async function uploadAvatar(file: File): Promise<AuthUser> {
    const form = new FormData();
    form.append("avatar", file);
    // Plain fetch, not apiClient — see the identical note on uploadItemImage in
    // listingsApi.ts for why (apiClient's default JSON Content-Type header can prevent
    // the browser from filling in the multipart boundary for a FormData body).
    const res = await fetch(`${apiBaseUrl}/api/auth/me/avatar`, {
        method: "POST",
        credentials: "include",
        body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
    }
    return data.user as AuthUser;
}
