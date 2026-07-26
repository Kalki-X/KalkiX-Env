import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "../features/auth/context/AuthContext";
import type { AuthUser } from "../features/auth/api/authApi";
import { resolveHomeRoute } from "../features/auth/utils/resolveHomeRoute";

interface ProtectedRouteProps {
    /** If omitted, any authenticated user may access the route. */
    roles?: AuthUser["role"][];
    /** Extra check beyond `role`, e.g. requiring the isLender/isRenter capability flag. */
    capability?: "isRenter" | "isLender";
}

/**
 * Gate for every /admin, /staff, /finance, /lender, /renter route.
 * - Not logged in           -> bounce to /login (and remember where they were headed)
 * - Logged in, wrong role   -> bounce to *their* dashboard, not an error page
 *   (keeps this friendly rather than dead-ending on a 403)
 */
export default function ProtectedRoute({ roles, capability }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const roleAllowed = !roles || roles.includes(user.role);
    const capabilityAllowed = !capability || user[capability];

    if (!roleAllowed || !capabilityAllowed) {
        return <Navigate to={resolveHomeRoute(user)} replace />;
    }

    return <Outlet />;
}
