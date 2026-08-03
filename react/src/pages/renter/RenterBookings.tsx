import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Table, Tag, Button, Space, Alert, Popconfirm, message, Modal, Select, List } from "antd";
import { FileTextOutlined, EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
    Booking,
    BookingStatus,
    BookingDocument,
    listMyBookings,
    confirmBooking,
    cancelBooking,
    getBookingDocuments,
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

export default function RenterBookings() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<number | null>(null);

    const [payingBooking, setPayingBooking] = useState<Booking | null>(null);
    const [payMethod, setPayMethod] = useState("card");
    const [paying, setPaying] = useState(false);

    const [docsBooking, setDocsBooking] = useState<Booking | null>(null);
    const [docs, setDocs] = useState<BookingDocument[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            setBookings(await listMyBookings());
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not load your bookings."));
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
            await cancelBooking(booking.id, "Cancelled by renter");
            message.success("Booking cancelled.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not cancel this booking."));
        } finally {
            setCancellingId(null);
        }
    };

    const onPay = async () => {
        if (!payingBooking) return;
        setPaying(true);
        try {
            await confirmBooking(payingBooking.id, payMethod);
            message.success("Payment successful — booking confirmed.");
            setPayingBooking(null);
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Payment failed."));
        } finally {
            setPaying(false);
        }
    };

    const onViewDocs = async (booking: Booking) => {
        setDocsBooking(booking);
        setDocsLoading(true);
        try {
            setDocs(await getBookingDocuments(booking.id));
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not load documents."));
        } finally {
            setDocsLoading(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "var(--gs-heading)", marginBottom: 4 }}>
                    My bookings
                </Title>
                <Paragraph style={{ color: "var(--color-muted)" }}>
                    Track your rental requests, pay once approved, and access your documents.
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
                    { title: "Lender", key: "lender", render: (_, b) => (b.otherParty ? `${b.otherParty.name} (${b.otherParty.email})` : "—") },
                    {
                        title: "Dates",
                        key: "dates",
                        render: (_, b) => `${dayjs(b.startDate).format("DD MMM YYYY")} – ${dayjs(b.endDate).format("DD MMM YYYY")}`,
                    },
                    { title: "Amount", key: "amount", render: (_, b) => `${b.currency} ${b.totalAmount.toFixed(2)}` },
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
                                <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/renter/bookings/${b.id}`)}>
                                    View
                                </Button>
                                {b.status === "awaiting_payment" && (
                                    <Button size="small" type="primary" onClick={() => setPayingBooking(b)}>
                                        Pay
                                    </Button>
                                )}
                                {["pending_approval", "awaiting_payment", "confirmed"].includes(b.status) && (
                                    <Popconfirm
                                        title="Cancel this booking?"
                                        description={b.status === "confirmed" ? "A credit note will be issued since it was already paid." : undefined}
                                        onConfirm={() => onCancel(b)}
                                    >
                                        <Button size="small" danger loading={cancellingId === b.id}>
                                            Cancel
                                        </Button>
                                    </Popconfirm>
                                )}
                                <Button size="small" icon={<FileTextOutlined />} onClick={() => onViewDocs(b)}>
                                    Documents
                                </Button>
                            </Space>
                        ),
                    },
                ]}
            />

            <Modal
                title="Complete payment"
                open={!!payingBooking}
                onCancel={() => setPayingBooking(null)}
                onOk={onPay}
                confirmLoading={paying}
                okText={payingBooking ? `Pay ${payingBooking.currency} ${payingBooking.totalAmount.toFixed(2)}` : "Pay"}
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

            <Modal
                title={docsBooking ? `Documents — ${docsBooking.item?.title ?? `Booking #${docsBooking.id}`}` : "Documents"}
                open={!!docsBooking}
                onCancel={() => setDocsBooking(null)}
                footer={null}
            >
                <List
                    loading={docsLoading}
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
            </Modal>
        </Space>
    );
}
