import { apiClient, apiBaseUrl } from "../../../services/api/client";

// Everything in this file hits PUBLIC endpoints (no auth) — this is what powers the
// unauthenticated marketplace homepage. See nodejs/src/routes/site.routes.js.

export interface PublicCategory {
    id: number;
    name: string;
    hasIcon: boolean;
    sortOrder: number;
    active: boolean;
}

export interface CarouselSlide {
    id: number;
    headline: string | null;
    subtext: string | null;
    linkUrl: string | null;
    sortOrder: number;
    active: boolean;
}

export interface TrendingItem {
    id: number;
    title: string;
    category: string | null;
    pricePerDay: number;
    currency: string;
    primaryImageId: number | null;
    featuredUntil: string | null;
}

export function siteLogoUrl(): string {
    return `${apiBaseUrl}/api/site/logo`;
}

export function categoryIconUrl(categoryId: number): string {
    return `${apiBaseUrl}/api/site/categories/${categoryId}/icon`;
}

export function carouselImageUrl(slideId: number): string {
    return `${apiBaseUrl}/api/site/carousel/${slideId}/image`;
}

export async function getPublicCategories(): Promise<PublicCategory[]> {
    const { data } = await apiClient.get("/api/site/categories");
    return data.categories;
}

export async function getPublicCarousel(): Promise<CarouselSlide[]> {
    const { data } = await apiClient.get("/api/site/carousel");
    return data.slides;
}

export async function getTrendingItems(limit = 6): Promise<TrendingItem[]> {
    const { data } = await apiClient.get("/api/site/trending", { params: { limit } });
    return data.items;
}
