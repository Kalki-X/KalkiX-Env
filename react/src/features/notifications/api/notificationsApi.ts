import { apiClient } from "../../../services/api/client";

export interface AppNotification {
    id: number;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    entityType: string | null;
    entityId: string | null;
    readAt: string | null;
    createdAt: string;
}

export async function listNotifications(params: { page?: number; pageSize?: number } = {}): Promise<{
    notifications: AppNotification[];
    total: number;
    page: number;
    pageSize: number;
    unreadCount: number;
}> {
    const { data } = await apiClient.get("/api/notifications", { params });
    return { notifications: data.notifications, total: data.total, page: data.page, pageSize: data.pageSize, unreadCount: data.unreadCount };
}

export async function getUnreadCount(): Promise<number> {
    const { data } = await apiClient.get("/api/notifications/unread-count");
    return data.count;
}

export async function markNotificationRead(id: number): Promise<void> {
    await apiClient.post(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<number> {
    const { data } = await apiClient.post("/api/notifications/read-all");
    return data.count;
}
