import { apiClient, apiBaseUrl } from "../../../services/api/client";

// Admin-only site/marketplace-homepage management: branding, platform fee, featured
// listing pricing, categories, and the hero carousel. Mirrors
// nodejs/src/routes/adminSite.routes.js (Super Admin + Admin, same RBAC as email
// templates).

export interface ImageSpec {
    label: string;
    width: number;
    height: number;
    maxBytes: number;
    formats: string[];
    recommendation: string;
}

export interface SiteSettings {
    hasLogo: boolean;
    platformFeePercent: number;
    featuredListingPricePerDay: number;
    featuredListingCurrency: string;
    updatedAt: string | null;
    updatedBy: number | null;
}

export interface AdminCategory {
    id: number;
    name: string;
    hasIcon: boolean;
    sortOrder: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminCarouselSlide {
    id: number;
    headline: string | null;
    subtext: string | null;
    linkUrl: string | null;
    sortOrder: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminFeaturedListing {
    id: number;
    itemId: number;
    itemTitle: string;
    ownerId: number;
    purchasedBy: number;
    startsAt: string;
    endsAt: string;
    feeAmount: number;
    currency: string;
    status: "active" | "cancelled";
    createdAt: string;
}

// ---------- Settings ----------

export async function getSiteSettings(): Promise<{ settings: SiteSettings; imageSpecs: Record<string, ImageSpec> }> {
    const { data } = await apiClient.get("/api/admin/site/settings");
    return { settings: data.settings, imageSpecs: data.imageSpecs };
}

export async function updateSiteSettings(payload: {
    platformFeePercent?: number;
    featuredListingPricePerDay?: number;
    featuredListingCurrency?: string;
}): Promise<SiteSettings> {
    const { data } = await apiClient.put("/api/admin/site/settings", payload);
    return data.settings;
}

// FormData uploads use plain fetch (not apiClient/axios) so the browser sets the
// multipart boundary itself — same reasoning as uploadItemImage in listingsApi.ts.
async function uploadFile(path: string, fieldName: string, file: File, extraFields: Record<string, string> = {}): Promise<any> {
    const form = new FormData();
    for (const [key, value] of Object.entries(extraFields)) form.append(key, value);
    form.append(fieldName, file);
    const res = await fetch(`${apiBaseUrl}${path}`, { method: "POST", credentials: "include", body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
    return data;
}

export async function uploadSiteLogo(file: File): Promise<SiteSettings> {
    const data = await uploadFile("/api/admin/site/settings/logo", "logo", file);
    return data.settings;
}

export async function removeSiteLogo(): Promise<SiteSettings> {
    const { data } = await apiClient.delete("/api/admin/site/settings/logo");
    return data.settings;
}

// ---------- Categories ----------

export async function listAdminCategories(): Promise<AdminCategory[]> {
    const { data } = await apiClient.get("/api/admin/site/categories");
    return data.categories;
}

export async function createCategory(payload: { name: string; sortOrder?: number }): Promise<AdminCategory> {
    const { data } = await apiClient.post("/api/admin/site/categories", payload);
    return data.category;
}

export async function updateCategory(id: number, payload: { name?: string; sortOrder?: number; active?: boolean }): Promise<AdminCategory> {
    const { data } = await apiClient.patch(`/api/admin/site/categories/${id}`, payload);
    return data.category;
}

export async function uploadCategoryIcon(id: number, file: File): Promise<AdminCategory> {
    const data = await uploadFile(`/api/admin/site/categories/${id}/icon`, "icon", file);
    return data.category;
}

export async function deleteCategory(id: number): Promise<void> {
    await apiClient.delete(`/api/admin/site/categories/${id}`);
}

// ---------- Carousel ----------

export async function listAdminCarousel(): Promise<AdminCarouselSlide[]> {
    const { data } = await apiClient.get("/api/admin/site/carousel");
    return data.slides;
}

export async function createCarouselSlide(
    file: File,
    fields: { headline?: string; subtext?: string; linkUrl?: string; sortOrder?: number }
): Promise<AdminCarouselSlide> {
    const extra: Record<string, string> = {};
    if (fields.headline !== undefined) extra.headline = fields.headline;
    if (fields.subtext !== undefined) extra.subtext = fields.subtext;
    if (fields.linkUrl !== undefined) extra.linkUrl = fields.linkUrl;
    if (fields.sortOrder !== undefined) extra.sortOrder = String(fields.sortOrder);
    const data = await uploadFile("/api/admin/site/carousel", "image", file, extra);
    return data.slide;
}

export async function updateCarouselSlide(
    id: number,
    payload: { headline?: string; subtext?: string; linkUrl?: string; sortOrder?: number; active?: boolean }
): Promise<AdminCarouselSlide> {
    const { data } = await apiClient.patch(`/api/admin/site/carousel/${id}`, payload);
    return data.slide;
}

export async function replaceCarouselSlideImage(id: number, file: File): Promise<AdminCarouselSlide> {
    const data = await uploadFile(`/api/admin/site/carousel/${id}/image`, "image", file);
    return data.slide;
}

export async function deleteCarouselSlide(id: number): Promise<void> {
    await apiClient.delete(`/api/admin/site/carousel/${id}`);
}

// ---------- Featured listings (oversight) ----------

export async function listFeaturedListings(activeOnly = false): Promise<AdminFeaturedListing[]> {
    const { data } = await apiClient.get("/api/admin/site/featured", { params: { activeOnly } });
    return data.featured;
}

export async function cancelFeaturedListing(id: number): Promise<AdminFeaturedListing> {
    const { data } = await apiClient.delete(`/api/admin/site/featured/${id}`);
    return data.featured;
}
