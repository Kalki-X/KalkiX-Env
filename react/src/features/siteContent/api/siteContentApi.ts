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

export interface HomepageSection {
    id: number;
    title: string;
    body: string | null;
    hasImage: boolean;
    videoUrl: string | null;
    sortOrder: number;
    active: boolean;
}

export interface SiteNotice {
    id: number;
    message: string;
    severity: "info" | "warning" | "critical";
    active: boolean;
    createdAt: string;
    updatedAt: string;
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

export function sectionImageUrl(sectionId: number): string {
    return `${apiBaseUrl}/api/site/sections/${sectionId}/image`;
}

export async function getPublicSections(): Promise<HomepageSection[]> {
    const { data } = await apiClient.get("/api/site/sections");
    return data.sections;
}

export async function getPublicNotices(): Promise<SiteNotice[]> {
    const { data } = await apiClient.get("/api/site/notices");
    return data.notices;
}
