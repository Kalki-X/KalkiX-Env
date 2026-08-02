import { apiClient } from "../../../services/api/client";
import { PlatformUser, UserStatus, Paginated } from "../../admin/api/adminApi";

// Admin & Support's user-management view. Scoped server-side to platform users only
// (renters/lenders) — staff can never see or edit other staff accounts, and can never
// change a user's role. See nodejs/src/routes/staffUsers.routes.js.

export interface ListStaffUsersParams {
    search?: string;
    status?: UserStatus;
    page?: number;
    pageSize?: number;
    export?: boolean;
}

export async function listStaffUsers(
    params: ListStaffUsersParams
): Promise<Paginated<PlatformUser> & { users: PlatformUser[] }> {
    const { data } = await apiClient.get("/api/staff/users", { params });
    return data;
}

export interface UpdateStaffUserPayload {
    isRenter?: boolean;
    isLender?: boolean;
    status?: UserStatus;
}

export async function updateStaffUser(id: number, payload: UpdateStaffUserPayload): Promise<PlatformUser> {
    const { data } = await apiClient.patch(`/api/staff/users/${id}`, payload);
    return data.user as PlatformUser;
}
