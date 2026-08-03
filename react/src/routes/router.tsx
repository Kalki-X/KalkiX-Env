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
import EmailTemplates from "../pages/admin/EmailTemplates";
import StaffDashboard from "../pages/staff/StaffDashboard";
import StaffUserManagement from "../pages/staff/UserManagement";
import FinanceDashboard from "../pages/finance/FinanceDashboard";
import Profile from "../pages/Profile";
import Notifications from "../pages/Notifications";
import LenderDashboard from "../pages/lender/LenderDashboard";
import LenderListings from "../pages/lender/LenderListings";
import LenderListingForm from "../pages/lender/LenderListingForm";
import LenderBookings from "../pages/lender/LenderBookings";
import LenderBookingDetail from "../pages/lender/LenderBookingDetail";
import RenterDashboard from "../pages/renter/RenterDashboard";
import RenterBrowse from "../pages/renter/RenterBrowse";
import ItemDetail from "../pages/renter/ItemDetail";
import RenterBookings from "../pages/renter/RenterBookings";
import RenterBookingDetail from "../pages/renter/RenterBookingDetail";
import { useAuth } from "../features/auth/context/AuthContext";

const FINANCE_NAV_ITEMS: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/finance" },
    { key: "reports", label: "Revenue Reports", path: "/finance/reports" },
    { key: "payments", label: "Payments", path: "/finance/payments" },
    { key: "documents", label: "Documents", path: "/finance/documents" },
];

// Support (unlike Admin) isn't allowed to touch email templates server-side
// (see adminEmailTemplates.routes.js: requireRole('super_admin', 'admin')), so the
// nav link for it is only added for Admin — see StaffLayout below, which picks
// between these two arrays based on the logged-in user's role.
const STAFF_NAV_ITEMS_BASE: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/staff" },
    { key: "users", label: "Users", path: "/staff/users" },
    { key: "documents", label: "Documents", path: "/staff/documents" },
    { key: "errors", label: "Error Reports", path: "/staff/errors" },
];
const STAFF_NAV_ITEMS_ADMIN: DashboardNavItem[] = [
    ...STAFF_NAV_ITEMS_BASE,
    { key: "email-templates", label: "Email Templates", path: "/staff/email-templates" },
];

function StaffLayout() {
    const { user } = useAuth();
    const navItems = user?.role === "admin" ? STAFF_NAV_ITEMS_ADMIN : STAFF_NAV_ITEMS_BASE;
    return <DashboardLayout title="Admin & Support" navItems={navItems} />;
}

const LENDER_NAV_ITEMS: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/lender" },
    { key: "listings", label: "My Listings", path: "/lender/listings" },
    { key: "bookings", label: "Bookings", path: "/lender/bookings" },
];

const RENTER_NAV_ITEMS: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/renter" },
    { key: "browse", label: "Browse", path: "/renter/browse" },
    { key: "bookings", label: "My Bookings", path: "/renter/bookings" },
];

const ADMIN_NAV_ITEMS: DashboardNavItem[] = [
    { key: "overview", label: "Overview", path: "/admin" },
    { key: "users", label: "Users & Roles", path: "/admin/users" },
    { key: "documents", label: "Documents", path: "/admin/documents" },
    { key: "audit", label: "Audit Trail", path: "/admin/audit" },
    { key: "reports", label: "Sales Reports", path: "/admin/reports" },
    { key: "payments", label: "Payments", path: "/admin/payments" },
    { key: "errors", label: "Error Reports", path: "/admin/errors" },
    { key: "email-templates", label: "Email Templates", path: "/admin/email-templates" },
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

    // Any authenticated user, regardless of role — no `roles`/`capability` restriction.
    {
        path: "/profile",
        element: <ProtectedRoute />,
        children: [
            {
                element: <DashboardLayout title="My Profile" />,
                children: [{ index: true, element: <Profile /> }],
            },
        ],
    },
    {
        path: "/notifications",
        element: <ProtectedRoute />,
        children: [
            {
                element: <DashboardLayout title="Notifications" />,
                children: [{ index: true, element: <Notifications /> }],
            },
        ],
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
                    { path: "email-templates", element: <EmailTemplates /> },
                ],
            },
        ],
    },
    {
        path: "/staff",
        element: <ProtectedRoute roles={["admin", "support"]} />,
        children: [
            {
                element: <StaffLayout />,
                children: [
                    { index: true, element: <StaffDashboard /> },
                    { path: "users", element: <StaffUserManagement /> },
                    { path: "documents", element: <DocumentLookup /> },
                    { path: "errors", element: <ErrorReports /> },
                    {
                        // Support can't access this — see requireRole('super_admin', 'admin')
                        // on the backend route; redirect them to their own dashboard instead
                        // of letting them hit a raw 403 from the API.
                        element: <ProtectedRoute roles={["admin"]} />,
                        children: [{ path: "email-templates", element: <EmailTemplates /> }],
                    },
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
                    { path: "bookings/:id", element: <LenderBookingDetail /> },
                ],
            },
        ],
    },
    {
        path: "/renter",
        element: <ProtectedRoute capability="isRenter" />,
        children: [
            {
                element: <DashboardLayout title="Renter" navItems={RENTER_NAV_ITEMS} />,
                children: [
                    { index: true, element: <RenterDashboard /> },
                    { path: "browse", element: <RenterBrowse /> },
                    { path: "items/:id", element: <ItemDetail /> },
                    { path: "bookings", element: <RenterBookings /> },
                    { path: "bookings/:id", element: <RenterBookingDetail /> },
                ],
            },
        ],
    },
]);
