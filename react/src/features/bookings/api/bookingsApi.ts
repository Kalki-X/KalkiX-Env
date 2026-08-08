import { apiClient, apiBaseUrl } from "../../../services/api/client";

// A request now starts life as 'pending_approval' and only becomes 'awaiting_payment'
// once the lender approves it (or 'rejected', terminal, if they decline). 'confirmed' /
// 'cancelled' / 'completed' are unchanged from before.
export type BookingStatus = "pending_approval" | "awaiting_payment" | "rejected" | "confirmed" | "cancelled" | "completed";

export interface Booking {
    id: number;
    itemId: number;
    renterId: number;
    startDate: string;
    endDate: string;
    status: BookingStatus;
    totalAmount: number;
    currency: string;
    // Optional note the renter attached to their request, visible to the lender before
    // they decide.
    renterNote: string | null;
    // Set only when the lender rejects — mandatory on the server, so non-null whenever
    // status is 'rejected'.
    rejectionReason: string | null;
    decidedAt: string | null;
    decidedBy: number | null;
    // Cancellation policy snapshotted from the item at request time; both null means "no
    // policy — a cancelled+paid booking always gets a full refund".
    cancellationFreeDays: number | null;
    cancellationFeePercent: number | null;
    createdAt: string;
    updatedAt: string;
    // Populated by /mine and /owner (not by the raw POST/approve/reject/confirm/cancel
    // responses, which only ever operate on a single booking the caller already has
    // context for).
    item?: { id: number; title: string };
    // The other side of the booking: for a renter's own list this is the item's owner;
    // for an owner's list this is the renter. Named generically since which one it is
    // depends on which endpoint returned it.
    otherParty?: { id: number; name: string; email: string };
}

// Returned only by GET /api/bookings/:id — the dedicated detail view, powering the
// per-booking Lender/Renter pages (and what notification emails/the bell link to).
// `isOwner`/`otherParty` are pre-computed server-side from the viewer's perspective.
export interface BookingDetail extends Booking {
    item: { id: number; title: string; pricePerDay: number; currency: string; pickupAddress: string | null };
    owner: { id: number; name: string; email: string };
    renter: { id: number; name: string; email: string };
    otherParty: { id: number; name: string; email: string };
    isOwner: boolean;
}

export interface BookingDocument {
    id: number;
    bookingId: number;
    type: "proforma_invoice" | "invoice" | "credit_note";
    documentNumber: string;
    amount: number;
    currency: string;
    payload: Record<string, unknown>;
    issuedAt: string;
    // Only ever true for a proforma_invoice/invoice that was superseded by a credit note
    // when a paid booking got cancelled. Renters/lenders never see voided documents at
    // all (the API filters them out); this field only shows up in the staff (Admin/
    // Super Admin/Finance) view.
    voided?: boolean;
    voidedAt?: string | null;
}

export async function listMyBookings(): Promise<Booking[]> {
    const { data } = await apiClient.get("/api/bookings/mine");
    return data.bookings;
}

export async function listOwnerBookings(): Promise<Booking[]> {
    const { data } = await apiClient.get("/api/bookings/owner");
    return data.bookings;
}

export async function getBookingDetail(bookingId: number): Promise<BookingDetail> {
    const { data } = await apiClient.get(`/api/bookings/${bookingId}`);
    return data.booking;
}

export async function getBookingDocuments(bookingId: number): Promise<BookingDocument[]> {
    const { data } = await apiClient.get(`/api/bookings/${bookingId}/documents`);
    return data.documents;
}

// A plain URL, not an axios call — opened directly in a new tab (window.open) so the
// browser renders the PDF itself. The httpOnly auth cookie rides along automatically on
// a normal navigation (it's withCredentials/sameSite=lax, not a bearer token), so no
// token needs to be embedded in the URL.
export function documentPdfUrl(bookingId: number, documentId: number): string {
    return `${apiBaseUrl}/api/bookings/${bookingId}/documents/${documentId}/pdf`;
}

// No document comes back here anymore — a request no longer issues a proforma invoice
// immediately; that only happens once the lender approves (see approveBooking below).
export async function createBooking(payload: { itemId: number; startDate: string; endDate: string; note?: string }): Promise<{ booking: Booking }> {
    const { data } = await apiClient.post("/api/bookings", payload);
    return { booking: data.booking };
}

export async function approveBooking(id: number): Promise<{ booking: Booking; document: BookingDocument }> {
    const { data } = await apiClient.post(`/api/bookings/${id}/approve`);
    return { booking: data.booking, document: data.document };
}

export async function rejectBooking(id: number, reason: string): Promise<{ booking: Booking }> {
    const { data } = await apiClient.post(`/api/bookings/${id}/reject`, { reason });
    return { booking: data.booking };
}

export async function confirmBooking(id: number, method = "card"): Promise<{ booking: Booking; document: BookingDocument }> {
    const { data } = await apiClient.post(`/api/bookings/${id}/confirm`, { method });
    return { booking: data.booking, document: data.document };
}

export async function cancelBooking(id: number, reason?: string): Promise<{ booking: Booking; document: BookingDocument | null }> {
    const { data } = await apiClient.post(`/api/bookings/${id}/cancel`, { reason });
    return { booking: data.booking, document: data.document };
}
