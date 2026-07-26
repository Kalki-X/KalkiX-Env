import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Registration";
import ProtectedRoute from "./ProtectedRoute";
import DashboardLayout from "../layouts/DashboardLayout";
import SuperAdminDashboard from "../pages/admin/SuperAdminDashboard";
import StaffDashboard from "../pages/staff/StaffDashboard";
import FinanceDashboard from "../pages/finance/FinanceDashboard";
import LenderDashboard from "../pages/lender/LenderDashboard";
import RenterDashboard from "../pages/renter/RenterDashboard";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Home />
    },
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/register",
        element: <Register />
    },
    {
        path: "/test",
        element: <Home />
    },

    // Role-gated dashboards. Each ProtectedRoute checks auth + role/capability
    // before handing off to the shared DashboardLayout shell.
    {
        path: "/admin",
        element: <ProtectedRoute roles={["super_admin"]} />,
        children: [
            {
                element: <DashboardLayout title="Super Admin" />,
                children: [{ index: true, element: <SuperAdminDashboard /> }],
            },
        ],
    },
    {
        path: "/staff",
        element: <ProtectedRoute roles={["admin", "support"]} />,
        children: [
            {
                element: <DashboardLayout title="Admin & Support" />,
                children: [{ index: true, element: <StaffDashboard /> }],
            },
        ],
    },
    {
        path: "/finance",
        element: <ProtectedRoute roles={["finance"]} />,
        children: [
            {
                element: <DashboardLayout title="Finance" />,
                children: [{ index: true, element: <FinanceDashboard /> }],
            },
        ],
    },
    {
        path: "/lender",
        element: <ProtectedRoute capability="isLender" />,
        children: [
            {
                element: <DashboardLayout title="Lender" />,
                children: [{ index: true, element: <LenderDashboard /> }],
            },
        ],
    },
    {
        path: "/renter",
        element: <ProtectedRoute capability="isRenter" />,
        children: [
            {
                element: <DashboardLayout title="Renter" />,
                children: [{ index: true, element: <RenterDashboard /> }],
            },
        ],
    },
]);
