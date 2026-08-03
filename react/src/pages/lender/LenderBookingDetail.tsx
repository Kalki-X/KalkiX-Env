import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Typography, Card, Descriptions, Tag, Button, Space, Alert, Spin, Modal, Input, List, message } from "antd";
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
    BookingDetail,
    BookingStatus,
    BookingDocument,
    getBookingDetail,
    getBookingDocuments,
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

const DOC_LABEL: Record<BookingDocument["type"], string> = {
    proforma_invoice: "Proforma invoice",
    invoice: "Invoice",
    credit_note: "Credit note",
};

export default function LenderBookingDetail() {
    const { id } = useParams<{ id: string }>();
    const bookingId = Number(id);
    const navigate = useNavigate();

    const [booking, setBooking] = useState<BookingDetail | null>(null);
    const [docs, setDocs] = useState<BookingDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const [detail, documents] = await Promise.all([getBookingDetail(bookingId), getBookingDocuments(bookingId)]);
            setBooking(detail);
            setDocs(documents);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not load this booking."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookingId]);

    const onApprove = async () => {
        setBusy(true);
        try {
            await approveBooking(bookingId);
            message.success("Request approved — the renter can now pay.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not approve this request."));
        } finally {
            setBusy(false);
        }
    };

    const onReject = async () => {
        if (!rejectReason.trim()) return;
        setBusy(true);
        try {
            await rejectBooking(bookingId, rejectReason.trim());
            message.success("Request rejected.");
            setRejecting(false);
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not reject this request."));
        } finally {
            setBusy(false);
        }
    };

    const onCancel = async () => {
        setBusy(true);
        try {
            await cancelBooking(bookingId, "Cancelled by lender");
            message.success("Booking cancelled.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not cancel this booking."));
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
            </div>
        );
    }

    if (errorMessage || !booking) {
        return (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/lender/bookings")} style={{ paddingLeft: 0 }}>
                    Back to bookings
                </Button>
                <Alert type="error" showIcon message={errorMessage || "Booking not found."} />
            </Space>
        );
    }

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/lender/bookings")} style={{ paddingLeft: 0 }}>
                Back to bookings
            </Button>

            <div>
                <Space align="center">
                    <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                        {booking.item.title}
                    </Title>
                    <Tag color={STATUS_COLOR[booking.status]}>{STATUS_LABEL[booking.status]}</Tag>
                </Space>
                <Paragraph style={{ color: "#64748b" }}>
                    Booking #{booking.id} · requested {dayjs(booking.createdAt).format("DD MMM YYYY, HH:mm")}
                </Paragraph>
            </div>

            <Card title="Details">
                <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Renter">
                        {booking.otherParty.name} ({booking.otherParty.email})
                    </Descriptions.Item>
                    <Descriptions.Item label="Dates">
                        {dayjs(booking.startDate).format("DD MMM YYYY")} – {dayjs(booking.endDate).format("DD MMM YYYY")}
                    </Descriptions.Item>
                    <Descriptions.Item label="Amount">
                        {booking.currency} {booking.totalAmount.toFixed(2)}
                    </Descriptions.Item>
                    {booking.renterNote && <Descriptions.Item label="Renter's note">{booking.renterNote}</Descriptions.Item>}
                    {booking.status === "rejected" && booking.rejectionReason && (
                        <Descriptions.Item label="Rejection reason">{booking.rejectionReason}</Descriptions.Item>
                    )}
                    {booking.cancellationFreeDays !== null && booking.cancellationFeePercent !== null && (
                        <Descriptions.Item label="Cancellation policy">
                            Free up to {booking.cancellationFreeDays} day{booking.cancellationFreeDays === 1 ? "" : "s"} before start, then a{" "}
                            {booking.cancellationFeePercent}% fee
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </Card>

            {booking.status === "pending_approval" && (
                <Card title="Decide">
                    <Space>
                        <Button type="primary" icon={<CheckOutlined />} loading={busy} onClick={onApprove}>
                            Approve
                        </Button>
                        <Button danger icon={<CloseOutlined />} onClick={() => setRejecting(true)}>
                            Reject
                        </Button>
                    </Space>
                </Card>
            )}

            {["awaiting_payment", "confirmed"].includes(booking.status) && (
                <Card title="Manage">
                    <Button danger loading={busy} onClick={onCancel}>
                        Cancel booking
                    </Button>
                    {booking.status === "confirmed" && (
                        <Text style={{ display: "block", marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
                            A credit note will be issued since this was already paid.
                        </Text>
                    )}
                </Card>
            )}

            <Card title="Documents">
                <List
                    dataSource={docs}
                    locale={{ emptyText: "No documents yet." }}
                    renderItem={(doc) => (
                        <List.Item>
                            <Space direction="vertical" size={0} style={{ width: "100%" }}>
                                <Space>
                                    <Tag>{DOC_LABEL[doc.type]}</Tag>
                                    <span style={{ fontFamily: "monospace" }}>{doc.documentNumber}</span>
                                </Space>
                                <span>
                                    {doc.currency} {doc.amount.toFixed(2)} — issued {dayjs(doc.issuedAt).format("DD MMM YYYY, HH:mm")}
                                </span>
                            </Space>
                        </List.Item>
                    )}
                />
            </Card>

            <Modal
                title="Reject booking request"
                open={rejecting}
                onCancel={() => setRejecting(false)}
                onOk={onReject}
                confirmLoading={busy}
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
