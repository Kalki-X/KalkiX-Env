import { apiClient } from "../../../services/api/client";

export interface PlatformStats {
    totalUsers: number;
    byRole: {
        superAdmins: number;
        admins: number;
        support: number;
        finance: number;
        platformUsers: number;
    };
    renters: number;
    lenders: number;
    suspended: number;
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
    const { data } = await apiClient.get("/api/admin/stats");
    return data.stats as PlatformStats;
}

export type StaffRole = "admin" | "support" | "finance";

export interface CreateStaffPayload {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    role: StaffRole;
    isRenter?: boolean;
    isLender?: boolean;
}

export async function createStaffAccount(payload: CreateStaffPayload) {
    const { data } = await apiClient.post("/api/admin/users", payload);
    return data.user;
}
