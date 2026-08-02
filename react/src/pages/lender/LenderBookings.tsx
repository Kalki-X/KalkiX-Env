import React, { useEffect, useState } from "react";
import { Typography, Table, Tag, Button, Space, Alert, Popconfirm, message } from "antd";
import dayjs from "dayjs";
import { Booking, BookingStatus, listOwnerBookings, cancelBooking } from "../../features/bookings/api/bookingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph } = Typography;

const STATUS_COLOR: Record<BookingStatus, string> = {
    pending: "default",
    confirmed: "success",
    cancelled: "error",
    completed: "processing",
};

export default function LenderBookings() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            setBookings(await listOwnerBookings());
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not load bookings."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const onCancel = async (booking: Booking) => {
        setCancellingId(booking.id);
        try {
            await cancelBooking(booking.id, "Cancelled by lender");
            message.success("Booking cancelled.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not cancel this booking."));
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                    Bookings
                </Title>
                <Paragraph style={{ color: "#64748b" }}>
                    Incoming and past bookings across everything you're lending out.
                </Paragraph>
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Table<Booking>
                rowKey="id"
                loading={loading}
                dataSource={bookings}
                scroll={{ x: "max-content" }}
                columns={[
                    { title: "Item", key: "item", render: (_, b) => b.item?.title ?? `#${b.itemId}` },
                    { title: "Renter", key: "renter", render: (_, b) => (b.otherParty ? `${b.otherParty.name} (${b.otherParty.email})` : "—") },
                    {
                        title: "Dates",
                        key: "dates",
                        render: (_, b) => `${dayjs(b.startDate).format("DD MMM YYYY")} – ${dayjs(b.endDate).format("DD MMM YYYY")}`,
                    },
                    { title: "Amount", key: "amount", render: (_, b) => `${b.currency} ${b.totalAmount.toFixed(2)}` },
                    { title: "Status", dataIndex: "status", render: (s: BookingStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
                    {
                        title: "",
                        key: "actions",
                        render: (_, b) =>
                            ["pending", "confirmed"].includes(b.status) ? (
                                <Popconfirm
                                    title="Cancel this booking?"
                                    description={b.status === "confirmed" ? "A credit note will be issued since it was already paid." : undefined}
                                    onConfirm={() => onCancel(b)}
                                >
                                    <Button size="small" danger loading={cancellingId === b.id}>
                                        Cancel
                                    </Button>
                                </Popconfirm>
                            ) : null,
                    },
                ]}
            />
        </Space>
    );
}
