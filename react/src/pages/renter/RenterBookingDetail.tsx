import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Typography, Card, Descriptions, Tag, Button, Space, Alert, Spin, Modal, Select, List, message } from "antd";
import { ArrowLeftOutlined, FilePdfOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
    BookingDetail,
    BookingStatus,
    BookingDocument,
    getBookingDetail,
    getBookingDocuments,
    confirmBooking,
    cancelBooking,
    documentPdfUrl,
} from "../../features/bookings/api/bookingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const STATUS_COLOR: Record<BookingStatus, string> = {
    pending_approval: "gold",
    awaiting_payment: "blue",
    rejected: "default",
    confirmed: "success",
    cancelled: "error",
    completed: "processing",
};

const STATUS_LABEL: Record<BookingStatus, string> = {
    pending_approval: "Awaiting lender approval",
    awaiting_payment: "Approved — payment due",
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

export default function RenterBookingDetail() {
    const { id } = useParams<{ id: string }>();
    const bookingId = Number(id);
    const navigate = useNavigate();

    const [booking, setBooking] = useState<BookingDetail | null>(null);
    const [docs, setDocs] = useState<BookingDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [paying, setPaying] = useState(false);
    const [payMethod, setPayMethod] = useState("card");

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

    const onPay = async () => {
        setBusy(true);
        try {
            await confirmBooking(bookingId, payMethod);
            message.success("Payment successful — booking confirmed.");
            setPaying(false);
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Payment failed."));
        } finally {
            setBusy(false);
        }
    };

    const onCancel = async () => {
        setBusy(true);
        try {
            await cancelBooking(bookingId, "Cancelled by renter");
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
                <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/renter/bookings")} style={{ paddingLeft: 0 }}>
                    Back to my bookings
                </Button>
                <Alert type="error" showIcon message={errorMessage || "Booking not found."} />
            </Space>
        );
    }

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/renter/bookings")} style={{ paddingLeft: 0 }}>
                Back to my bookings
            </Button>

            <div>
                <Space align="center">
                    <Title level={2} style={{ color: "var(--gs-heading)", marginBottom: 4 }}>
                        {booking.item.title}
                    </Title>
                    <Tag color={STATUS_COLOR[booking.status]}>{STATUS_LABEL[booking.status]}</Tag>
                </Space>
                <Paragraph style={{ color: "var(--color-muted)" }}>
                    Booking #{booking.id} · requested {dayjs(booking.createdAt).format("DD MMM YYYY, HH:mm")}
                </Paragraph>
            </div>

            <Card title="Details">
                <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Lender">
                        {booking.otherParty.name} ({booking.otherParty.email})
                    </Descriptions.Item>
                    <Descriptions.Item label="Dates">
                        {dayjs(booking.startDate).format("DD MMM YYYY")} – {dayjs(booking.endDate).format("DD MMM YYYY")}
                    </Descriptions.Item>
                    <Descriptions.Item label="Amount">
                        {booking.currency} {booking.totalAmount.toFixed(2)}
                    </Descriptions.Item>
                    {booking.item.pickupAddress && <Descriptions.Item label="Pickup">{booking.item.pickupAddress}</Descriptions.Item>}
                    {booking.renterNote && <Descriptions.Item label="Your note">{booking.renterNote}</Descriptions.Item>}
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

            {["pending_approval", "awaiting_payment", "confirmed"].includes(booking.status) && (
                <Card title="Manage">
                    <Space>
                        {booking.status === "awaiting_payment" && (
                            <Button type="primary" onClick={() => setPaying(true)}>
                                Pay {booking.currency} {booking.totalAmount.toFixed(2)}
                            </Button>
                        )}
                        <Button danger loading={busy} onClick={onCancel}>
                            Cancel booking
                        </Button>
                    </Space>
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
                        <List.Item
                            actions={[
                                <Button
                                    key="pdf"
                                    size="small"
                                    icon={<FilePdfOutlined />}
                                    onClick={() => window.open(documentPdfUrl(bookingId, doc.id), "_blank")}
                                >
                                    Download PDF
                                </Button>,
                            ]}
                        >
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
                title="Complete payment"
                open={paying}
                onCancel={() => setPaying(false)}
                onOk={onPay}
                confirmLoading={busy}
                okText={`Pay ${booking.currency} ${booking.totalAmount.toFixed(2)}`}
            >
                <Paragraph style={{ color: "var(--color-muted)" }}>
                    This is a simulated payment — no real payment provider is connected yet. Confirming here marks
                    the booking as paid and issues an invoice.
                </Paragraph>
                <Select value={payMethod} onChange={setPayMethod} style={{ width: "100%" }}>
                    <Option value="card">Credit / debit card</Option>
                    <Option value="paypal">PayPal</Option>
                    <Option value="bank_transfer">Bank transfer</Option>
                </Select>
            </Modal>
        </Space>
    );
}
