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
    // Optional cancellation policy: free cancellation up to N days before the rental
    // starts, then a flat fee % applies. Both null means no policy set.
    cancellationFreeDays: number | null;
    cancellationFeePercent: number | null;
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
    // Both must be set together (or both left out/null to clear the policy) — enforced
    // server-side too.
    cancellationFreeDays?: number | null;
    cancellationFeePercent?: number | null;
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

export async function listMyItems(params: { search?: string } = {}): Promise<Item[]> {
    const { data } = await apiClient.get("/api/items/mine", { params });
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
    // Deliberately plain fetch, not apiClient/axios, for this one call. apiClient sets
    // a default 'Content-Type: application/json' header on every request; some
    // axios/browser combinations keep that header as-is for a FormData body instead of
    // letting the browser fill in the multipart boundary, which silently produces a
    // body multer can't parse (req.file ends up undefined server-side). A plain fetch
    // with no Content-Type header set lets the browser generate the correct
    // 'multipart/form-data; boundary=...' header itself — the same thing that already
    // proved reliable end-to-end in this feature's integration tests.
    const res = await fetch(`${apiBaseUrl}/api/items/${itemId}/images`, {
        method: "POST",
        credentials: "include", // send the httpOnly auth cookie, matching apiClient's withCredentials
        body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
    }
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
