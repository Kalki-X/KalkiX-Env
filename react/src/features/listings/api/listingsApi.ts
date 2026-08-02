import { apiClient, apiBaseUrl } from "../../../services/api/client";

export type ItemStatus = "draft" | "active" | "paused" | "archived";

export interface Item {
    id: number;
    ownerId: number;
    title: string;
    description: string | null;
    category: string | null;
    pricePerDay: number;
    currency: string;
    status: ItemStatus;
    pickupAddress: string | null;
    pickupLat: number | null;
    pickupLng: number | null;
    primaryImageId: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface ItemImage {
    id: number;
    itemId: number;
    mimeType: string;
    position: number;
    createdAt: string;
}

export interface AvailabilityBlock {
    id: number;
    itemId: number;
    startDate: string;
    endDate: string;
    reason: string | null;
    createdAt: string;
}

export interface UnavailableRange {
    // Present (a block id) when this entry came from a lender-defined availability
    // block, which the lender can remove; null when it came from an actual booking,
    // which can only be changed by cancelling the booking itself.
    id: number | null;
    startDate: string;
    endDate: string;
    reason: string;
}

export interface ItemFormPayload {
    title: string;
    description?: string;
    category?: string;
    pricePerDay: number;
    currency?: string;
    pickupAddress?: string;
    pickupLat?: number;
    pickupLng?: number;
}

// ---------- Browse (public) ----------

export async function listActiveItems(params: { category?: string; search?: string } = {}): Promise<Item[]> {
    const { data } = await apiClient.get("/api/items", { params });
    return data.items;
}

export async function getItem(id: number): Promise<Item> {
    const { data } = await apiClient.get(`/api/items/${id}`);
    return data.item;
}

// ---------- Lender: listing management ----------

export async function listMyItems(): Promise<Item[]> {
    const { data } = await apiClient.get("/api/items/mine");
    return data.items;
}

export async function createItem(payload: ItemFormPayload): Promise<Item> {
    const { data } = await apiClient.post("/api/items", payload);
    return data.item;
}

export async function updateItem(id: number, payload: Partial<ItemFormPayload>): Promise<Item> {
    const { data } = await apiClient.patch(`/api/items/${id}`, payload);
    return data.item;
}

export async function updateItemStatus(id: number, status: ItemStatus): Promise<Item> {
    const { data } = await apiClient.patch(`/api/items/${id}/status`, { status });
    return data.item;
}

export async function deleteItem(id: number): Promise<void> {
    await apiClient.delete(`/api/items/${id}`);
}

// ---------- Images ----------

export function itemImageUrl(itemId: number, imageId: number): string {
    return `${apiBaseUrl}/api/items/${itemId}/images/${imageId}`;
}

export async function listItemImages(itemId: number): Promise<ItemImage[]> {
    const { data } = await apiClient.get(`/api/items/${itemId}/images`);
    return data.images;
}

export async function uploadItemImage(itemId: number, file: File): Promise<ItemImage> {
    const form = new FormData();
    form.append("image", file);
    // Deliberately no explicit Content-Type header — axios detects the FormData body
    // and lets the browser set the multipart boundary itself. Setting it manually here
    // would omit the boundary parameter and the upload would fail server-side.
    const { data } = await apiClient.post(`/api/items/${itemId}/images`, form);
    return data.image;
}

export async function deleteItemImage(itemId: number, imageId: number): Promise<void> {
    await apiClient.delete(`/api/items/${itemId}/images/${imageId}`);
}

// ---------- Availability ----------

export async function getAvailability(itemId: number, params: { from?: string; to?: string } = {}): Promise<UnavailableRange[]> {
    const { data } = await apiClient.get(`/api/items/${itemId}/availability`, { params });
    return data.unavailable;
}

export async function addAvailabilityBlock(
    itemId: number,
    payload: { startDate: string; endDate: string; reason?: string }
): Promise<AvailabilityBlock> {
    const { data } = await apiClient.post(`/api/items/${itemId}/availability`, payload);
    return data.block;
}

export async function removeAvailabilityBlock(itemId: number, blockId: number): Promise<void> {
    await apiClient.delete(`/api/items/${itemId}/availability/${blockId}`);
}
