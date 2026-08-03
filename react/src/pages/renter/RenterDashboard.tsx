import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Row, Col, Card, Statistic, Typography, Space, Spin, Alert } from "antd";
import { SearchOutlined, HistoryOutlined } from "@ant-design/icons";
import { listMyBookings, Booking } from "../../features/bookings/api/bookingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph } = Typography;

const QUICK_LINKS = [
    { icon: <SearchOutlined />, title: "Browse", desc: "Search everything currently available to rent.", path: "/renter/browse" },
    { icon: <HistoryOutlined />, title: "My bookings", desc: "Track requests, pay to confirm, and access your documents.", path: "/renter/bookings" },
];

export default function RenterDashboard() {
    const [bookings, setBookings] = useState<Booking[] | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        listMyBookings()
            .then(setBookings)
            .catch((err) => setErrorMessage(getApiErrorMessage(err, "Could not load your dashboard.")));
    }, []);

    const pendingApprovalCount = bookings?.filter((b) => b.status === "pending_approval").length ?? 0;
    const awaitingPaymentCount = bookings?.filter((b) => b.status === "awaiting_payment").length ?? 0;
    const confirmedCount = bookings?.filter((b) => b.status === "confirmed").length ?? 0;

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "var(--gs-heading)", marginBottom: 4 }}>
                    Renter
                </Title>
                <Paragraph style={{ color: "var(--color-muted)" }}>
                    Browse items, book rentals, and keep track of your bookings and documents.
                </Paragraph>
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            {bookings ? (
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic title="Awaiting lender approval" value={pendingApprovalCount} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic title="Awaiting payment" value={awaitingPaymentCount} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic title="Confirmed bookings" value={confirmedCount} />
                        </Card>
                    </Col>
                </Row>
            ) : (
                !errorMessage && (
                    <div style={{ textAlign: "center", padding: 40 }}>
                        <Spin />
                    </div>
                )
            )}

            <Row gutter={[16, 16]}>
                {QUICK_LINKS.map((s) => (
                    <Col xs={24} sm={12} key={s.title}>
                        <Link to={s.path}>
                            <Card hoverable>
                                <Space direction="vertical" size={4}>
                                    <Space>
                                        {s.icon}
                                        <strong>{s.title}</strong>
                                    </Space>
                                    <Paragraph style={{ color: "var(--color-muted)", marginBottom: 0, fontSize: 13 }}>
                                        {s.desc}
                                    </Paragraph>
                                </Space>
                            </Card>
                        </Link>
                    </Col>
                ))}
            </Row>
        </Space>
    );
}
