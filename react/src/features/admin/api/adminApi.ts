import { apiClient } from "../../../services/api/client";

export interface PlatformStats {
    totalUsers: number;
    byRole: {
        superAdmins: number;
        admins: number;
        support: number;
        finance: number;
        platformUsers: number;
    };
    renters: number;
    lenders: number;
    suspended: number;
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
    const { data } = await apiClient.get("/api/admin/stats");
    return data.stats as PlatformStats;
}

export type StaffRole = "admin" | "support" | "finance";

export interface CreateStaffPayload {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    // Optional now: leave blank (recommended) to email the new staff member a secure
    // one-time link to set their own password instead of handing one over directly.
    password?: string;
    role: StaffRole;
    isRenter?: boolean;
    isLender?: boolean;
}

export async function createStaffAccount(payload: CreateStaffPayload): Promise<{ user: PlatformUser; credentialsEmailSent: boolean }> {
    const { data } = await apiClient.post("/api/admin/users", payload);
    return { user: data.user, credentialsEmailSent: data.credentialsEmailSent };
}

// ---------- Role management ----------

export type UserRole = "super_admin" | "admin" | "support" | "finance" | "platform_user";
export type UserStatus = "active" | "suspended" | "deactivated";

export interface PlatformUser {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: UserRole;
    isRenter: boolean;
    isLender: boolean;
    status: UserStatus;
    createdAt: string;
}

export interface Paginated<T> {
    total: number;
    page: number;
    pageSize: number;
}

export interface ListUsersParams {
    search?: string;
    role?: UserRole;
    status?: UserStatus;
    page?: number;
    pageSize?: number;
    export?: boolean;
}

export async function listUsers(params: ListUsersParams): Promise<Paginated<PlatformUser> & { users: PlatformUser[] }> {
    const { data } = await apiClient.get("/api/admin/users", { params });
    return data;
}

export interface UpdateUserPayload {
    role?: UserRole;
    isRenter?: boolean;
    isLender?: boolean;
    status?: UserStatus;
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<PlatformUser> {
    const { data } = await apiClient.patch(`/api/admin/users/${id}`, payload);
    return data.user as PlatformUser;
}

// ---------- Document lookup ----------

export interface DocumentLookupResult {
    id: number;
    bookingId: number;
    type: "proforma_invoice" | "invoice" | "credit_note";
    documentNumber: string;
    amount: number;
    currency: string;
    payload: Record<string, unknown>;
    issuedAt: string;
    voided?: boolean;
    voidedAt?: string | null;
    booking: { id: number; startDate: string; endDate: string; status: string; totalAmount: number };
    item: { id: number; title: string };
    renter: { id: number; name: string; email: string };
    owner: { id: number; name: string; email: string };
}

export async function lookupDocument(documentNumber: string): Promise<DocumentLookupResult> {
    const { data } = await apiClient.get(`/api/admin/documents/${encodeURIComponent(documentNumber)}`);
    return data.document as DocumentLookupResult;
}

// ---------- Audit trail ----------

export interface AuditEntry {
    id: number;
    action: string;
    entityType: string | null;
    entityId: string | null;
    metadata: Record<string, unknown>;
    ipAddress: string | null;
    createdAt: string;
    user: { id: number; name: string; email: string } | null;
}

export interface ListAuditParams {
    userId?: number;
    action?: string;
    entityType?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    export?: boolean;
}

export async function listAuditLog(params: ListAuditParams): Promise<Paginated<AuditEntry> & { entries: AuditEntry[] }> {
    const { data } = await apiClient.get("/api/admin/audit", { params });
    return data;
}

// ---------- Sales reports ----------

export interface SalesReport {
    groupBy: "day" | "week" | "month";
    series: { period: string; bookings: number; revenue: number }[];
    totals: { bookings: number; revenue: number; averageBookingValue: number };
}

export async function getSalesReport(params: { from?: string; to?: string; groupBy?: string; export?: boolean }): Promise<SalesReport> {
    const { data } = await apiClient.get("/api/admin/reports/sales", { params });
    return data.report as SalesReport;
}

// ---------- Payment management ----------

export interface PaymentRecord {
    id: number;
    bookingId: number;
    amount: number;
    currency: string;
    method: string | null;
    status: "pending" | "succeeded" | "failed" | "refunded";
    providerRef: string | null;
    createdAt: string;
    item: { id: number; title: string } | null;
    renter: { id: number; name: string; email: string } | null;
}

export async function listPayments(params: {
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    export?: boolean;
}): Promise<Paginated<PaymentRecord> & { payments: PaymentRecord[] }> {
    const { data } = await apiClient.get("/api/admin/payments", { params });
    return data;
}

export async function refundPayment(id: number): Promise<PaymentRecord> {
    const { data } = await apiClient.patch(`/api/admin/payments/${id}/refund`);
    return data.payment as PaymentRecord;
}

// ---------- System error reports ----------

export interface SystemError {
    id: number;
    message: string;
    stack: string | null;
    method: string | null;
    route: string | null;
    statusCode: number | null;
    userId: number | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}

export async function listSystemErrors(params: { page?: number; pageSize?: number; export?: boolean }): Promise<Paginated<SystemError> & { errors: SystemError[] }> {
    const { data } = await apiClient.get("/api/admin/errors", { params });
    return data;
}
