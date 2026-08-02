import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Registration";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import GoogleAuthComplete from "../pages/GoogleAuthComplete";
import ProtectedRoute from "./ProtectedRoute";
import DashboardLayout, { DashboardNavItem } from "../layouts/DashboardLayout";
import SuperAdminDashboard from "../pages/admin/SuperAdminDashboard";
import UserManagement from "../pages/admin/UserManagement";
import DocumentLookup from "../pages/admin/DocumentLookup";
import AuditTrail from "../pages/admin/AuditTrail";
import SalesReports from "../pages/admin/SalesReports";
import PaymentManagement from "../pages/admin/PaymentManagement";
import ErrorReports from "../pages/admin/ErrorReports";
import StaffDashboard from "../pages/staff/StaffDashboard";
import StaffUserManagement from "../pages/staff/UserManagement";
import FinanceDashboard from "../pages/finance/FinanceDashboard";
import LenderDashboard from "../pages/lender/LenderDashboard";
import LenderListings from "../pages/lender/LenderListings";
import LenderListingForm from "../pages/lender/LenderListingForm";
import LenderBookings from "../pages/lender/LenderBookings";
import RenterDashboard from "../pages/renter/RenterDashboard";

const FINANCE_NAV_ITEMS: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/finance" },
    { key: "reports", label: "Revenue Reports", path: "/finance/reports" },
    { key: "payments", label: "Payments", path: "/finance/payments" },
    { key: "documents", label: "Documents", path: "/finance/documents" },
];

const STAFF_NAV_ITEMS: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/staff" },
    { key: "users", label: "Users", path: "/staff/users" },
    { key: "documents", label: "Documents", path: "/staff/documents" },
    { key: "errors", label: "Error Reports", path: "/staff/errors" },
];

const LENDER_NAV_ITEMS: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/lender" },
    { key: "listings", label: "My Listings", path: "/lender/listings" },
    { key: "bookings", label: "Bookings", path: "/lender/bookings" },
];

const ADMIN_NAV_ITEMS: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/admin" },
    { key: "users", label: "Users & Roles", path: "/admin/users" },
    { key: "documents", label: "Documents", path: "/admin/documents" },
    { key: "audit", label: "Audit Trail", path: "/admin/audit" },
    { key: "reports", label: "Sales Reports", path: "/admin/reports" },
    { key: "payments", label: "Payments", path: "/admin/payments" },
    { key: "errors", label: "Error Reports", path: "/admin/errors" },
];

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
        path: "/forgot-password",
        element: <ForgotPassword />
    },
    {
        path: "/reset-password",
        element: <ResetPassword />
    },
    {
        path: "/auth/complete",
        element: <GoogleAuthComplete />
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
                element: <DashboardLayout title="Super Admin" navItems={ADMIN_NAV_ITEMS} />,
                children: [
                    { index: true, element: <SuperAdminDashboard /> },
                    { path: "users", element: <UserManagement /> },
                    { path: "documents", element: <DocumentLookup /> },
                    { path: "audit", element: <AuditTrail /> },
                    { path: "reports", element: <SalesReports /> },
                    { path: "payments", element: <PaymentManagement /> },
                    { path: "errors", element: <ErrorReports /> },
                ],
            },
        ],
    },
    {
        path: "/staff",
        element: <ProtectedRoute roles={["admin", "support"]} />,
        children: [
            {
                element: <DashboardLayout title="Admin & Support" navItems={STAFF_NAV_ITEMS} />,
                children: [
                    { index: true, element: <StaffDashboard /> },
                    { path: "users", element: <StaffUserManagement /> },
                    { path: "documents", element: <DocumentLookup /> },
                    { path: "errors", element: <ErrorReports /> },
                ],
            },
        ],
    },
    {
        path: "/finance",
        element: <ProtectedRoute roles={["finance"]} />,
        children: [
            {
                element: <DashboardLayout title="Finance" navItems={FINANCE_NAV_ITEMS} />,
                children: [
                    { index: true, element: <FinanceDashboard /> },
                    { path: "reports", element: <SalesReports /> },
                    { path: "payments", element: <PaymentManagement /> },
                    { path: "documents", element: <DocumentLookup /> },
                ],
            },
        ],
    },
    {
        path: "/lender",
        element: <ProtectedRoute capability="isLender" />,
        children: [
            {
                element: <DashboardLayout title="Lender" navItems={LENDER_NAV_ITEMS} />,
                children: [
                    { index: true, element: <LenderDashboard /> },
                    { path: "listings", element: <LenderListings /> },
                    { path: "listings/new", element: <LenderListingForm /> },
                    { path: "listings/:id/edit", element: <LenderListingForm /> },
                    { path: "bookings", element: <LenderBookings /> },
                ],
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
