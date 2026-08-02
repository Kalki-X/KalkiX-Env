import axios from "axios";

// Backend URL is injected by docker-compose as VITE_API_URL; falls back to local dev default.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/** Raw base URL, for the handful of places (Google sign-in) that need a full-page
 *  redirect rather than an axios call — OAuth can't be done via fetch/XHR. */
export const apiBaseUrl = baseURL;

export const apiClient = axios.create({
    baseURL,
    withCredentials: true, // send/receive the httpOnly auth cookie
    headers: {
        "Content-Type": "application/json",
    },
});

export interface ApiError {
    ok: false;
    error: string;
}

/** Pulls a readable message out of an axios error from our API. Also handles plain
 *  Error objects (e.g. from the raw-fetch image upload call, which isn't axios-based)
 *  so a specific server-provided message isn't silently swallowed into the fallback. */
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data as Partial<ApiError> | undefined;
        if (data?.error) return data.error;
        if (err.message) return err.message;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}
