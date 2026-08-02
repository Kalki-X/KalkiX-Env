import { apiClient } from "../../../services/api/client";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface Booking {
    id: number;
    itemId: number;
    renterId: number;
    startDate: string;
    endDate: string;
    status: BookingStatus;
    totalAmount: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
    // Populated by /mine and /owner (not by the raw POST/confirm/cancel responses,
    // which only ever operate on a single booking the caller already has context for).
    item?: { id: number; title: string };
    // The other side of the booking: for a renter's own list this is the item's owner;
    // for an owner's list this is the renter. Named generically since which one it is
    // depends on which endpoint returned it.
    otherParty?: { id: number; name: string; email: string };
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
}

export async function listMyBookings(): Promise<Booking[]> {
    const { data } = await apiClient.get("/api/bookings/mine");
    return data.bookings;
}

export async function listOwnerBookings(): Promise<Booking[]> {
    const { data } = await apiClient.get("/api/bookings/owner");
    return data.bookings;
}

export async function getBookingDocuments(bookingId: number): Promise<BookingDocument[]> {
    const { data } = await apiClient.get(`/api/bookings/${bookingId}/documents`);
    return data.documents;
}

export async function createBooking(payload: { itemId: number; startDate: string; endDate: string }): Promise<{ booking: Booking; document: BookingDocument }> {
    const { data } = await apiClient.post("/api/bookings", payload);
    return { booking: data.booking, document: data.document };
}

export async function confirmBooking(id: number, method = "card"): Promise<{ booking: Booking; document: BookingDocument }> {
    const { data } = await apiClient.post(`/api/bookings/${id}/confirm`, { method });
    return { booking: data.booking, document: data.document };
}

export async function cancelBooking(id: number, reason?: string): Promise<{ booking: Booking; document: BookingDocument | null }> {
    const { data } = await apiClient.post(`/api/bookings/${id}/cancel`, { reason });
    return { booking: data.booking, document: data.document };
}
