import type { AuthUser } from "../api/authApi";

/**
 * Every role lands on a different home screen after login/registration.
 * Platform users (self-registered renters/lenders) can hold both capability
 * flags at once ("both" at signup) — renter view takes priority by default,
 * they can switch to the lender view from the dashboard sidebar.
 */
export function resolveHomeRoute(user: AuthUser): string {
    switch (user.role) {
        case "super_admin":
            return "/admin";
        case "admin":
        case "support":
            return "/staff";
        case "finance":
            return "/finance";
        default:
            if (user.isRenter) return "/renter";
            if (user.isLender) return "/lender";
            return "/"; // shouldn't normally happen, falls back to the public homepage
    }
}
