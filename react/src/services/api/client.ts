import axios from "axios";

// Backend URL is injected by docker-compose as VITE_API_URL; falls back to local dev default.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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

/** Pulls a readable message out of an axios error from our API. */
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data as Partial<ApiError> | undefined;
        if (data?.error) return data.error;
        if (err.message) return err.message;
    }
    return fallback;
}
