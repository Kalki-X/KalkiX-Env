import { apiClient } from "../../../services/api/client";

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
