import React, { useEffect, useState } from "react";
import { Typography, Table, Tag, Button, Space, Alert, Popconfirm, Modal, Input, Tooltip, message } from "antd";
import { CheckOutlined, CloseOutlined, InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
    Booking,
    BookingStatus,
    listOwnerBookings,
    approveBooking,
    rejectBooking,
    cancelBooking,
} from "../../features/bookings/api/bookingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR: Record<BookingStatus, string> = {
    pending_approval: "gold",
    awaiting_payment: "blue",
    rejected: "default",
    confirmed: "success",
    cancelled: "error",
    completed: "processing",
};

const STATUS_LABEL: Record<BookingStatus, string> = {
    pending_approval: "Awaiting your decision",
    awaiting_payment: "Awaiting payment",
    rejected: "Rejected",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    completed: "Completed",
};

export default function LenderBookings() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [rejecting, setRejecting] = useState(false);

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

    const onApprove = async (booking: Booking) => {
        setBusyId(booking.id);
        try {
            await approveBooking(booking.id);
            message.success("Request approved — the renter can now pay.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not approve this request."));
        } finally {
            setBusyId(null);
        }
    };

    const openReject = (booking: Booking) => {
        setRejectingBooking(booking);
        setRejectReason("");
    };

    const onReject = async () => {
        if (!rejectingBooking || !rejectReason.trim()) return;
        setRejecting(true);
        try {
            await rejectBooking(rejectingBooking.id, rejectReason.trim());
            message.success("Request rejected.");
            setRejectingBooking(null);
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not reject this request."));
        } finally {
            setRejecting(false);
        }
    };

    const onCancel = async (booking: Booking) => {
        setBusyId(booking.id);
        try {
            await cancelBooking(booking.id, "Cancelled by lender");
            message.success("Booking cancelled.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not cancel this booking."));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                    Bookings
                </Title>
                <Paragraph style={{ color: "#64748b" }}>
                    Incoming requests and past bookings across everything you're lending out.
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
                    {
                        title: "Note",
                        key: "note",
                        render: (_, b) =>
                            b.renterNote ? (
                                <Tooltip title={b.renterNote}>
                                    <InfoCircleOutlined style={{ color: "#2B2E4A" }} />
                                </Tooltip>
                            ) : (
                                "—"
                            ),
                    },
                    {
                        title: "Status",
                        key: "status",
                        render: (_, b) => (
                            <Space direction="vertical" size={0}>
                                <Tag color={STATUS_COLOR[b.status]}>{STATUS_LABEL[b.status]}</Tag>
                                {b.status === "rejected" && b.rejectionReason && (
                                    <Text style={{ fontSize: 12, color: "#94a3b8" }}>Reason: {b.rejectionReason}</Text>
                                )}
                            </Space>
                        ),
                    },
                    {
                        title: "",
                        key: "actions",
                        render: (_, b) => (
                            <Space wrap>
                                {b.status === "pending_approval" && (
                                    <>
                                        <Button
                                            size="small"
                                            type="primary"
                                            icon={<CheckOutlined />}
                                            loading={busyId === b.id}
                                            onClick={() => onApprove(b)}
                                        >
                                            Approve
                                        </Button>
                                        <Button size="small" danger icon={<CloseOutlined />} onClick={() => openReject(b)}>
                                            Reject
                                        </Button>
                                    </>
                                )}
                                {["awaiting_payment", "confirmed"].includes(b.status) && (
                                    <Popconfirm
                                        title="Cancel this booking?"
                                        description={b.status === "confirmed" ? "A credit note will be issued since it was already paid." : undefined}
                                        onConfirm={() => onCancel(b)}
                                    >
                                        <Button size="small" danger loading={busyId === b.id}>
                                            Cancel
                                        </Button>
                                    </Popconfirm>
                                )}
                            </Space>
                        ),
                    },
                ]}
            />

            <Modal
                title="Reject booking request"
                open={!!rejectingBooking}
                onCancel={() => setRejectingBooking(null)}
                onOk={onReject}
                confirmLoading={rejecting}
                okText="Reject request"
                okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
            >
                <Paragraph style={{ color: "#64748b" }}>
                    A reason is required — this is shown to the renter and kept on the booking record.
                </Paragraph>
                <TextArea
                    rows={3}
                    placeholder="e.g. Item unavailable that week, needs servicing..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    maxLength={500}
                />
            </Modal>
        </Space>
    );
}
