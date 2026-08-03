import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Row, Col, Card, Statistic, Typography, Space, Spin, Alert } from "antd";
import { AppstoreAddOutlined, CalendarOutlined, ShoppingOutlined } from "@ant-design/icons";
import { listMyItems, Item } from "../../features/listings/api/listingsApi";
import { listOwnerBookings, Booking } from "../../features/bookings/api/bookingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph } = Typography;

const QUICK_LINKS = [
    { icon: <AppstoreAddOutlined />, title: "My listings", desc: "Add, edit, pause, or archive items you're lending out.", path: "/lender/listings" },
    { icon: <CalendarOutlined />, title: "Bookings", desc: "Review incoming and past bookings on your listings.", path: "/lender/bookings" },
];

export default function LenderDashboard() {
    const [items, setItems] = useState<Item[] | null>(null);
    const [bookings, setBookings] = useState<Booking[] | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([listMyItems(), listOwnerBookings()])
            .then(([itemsRes, bookingsRes]) => {
                setItems(itemsRes);
                setBookings(bookingsRes);
            })
            .catch((err) => setErrorMessage(getApiErrorMessage(err, "Could not load your dashboard.")));
    }, []);

    const activeCount = items?.filter((i) => i.status === "active").length ?? 0;
    const pendingApprovalCount = bookings?.filter((b) => b.status === "pending_approval").length ?? 0;
    const confirmedCount = bookings?.filter((b) => b.status === "confirmed").length ?? 0;

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "var(--gs-heading)", marginBottom: 4 }}>
                    Lender
                </Title>
                <Paragraph style={{ color: "var(--color-muted)" }}>
                    List items, manage availability, and track incoming bookings.
                </Paragraph>
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            {items && bookings ? (
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic title="Active listings" value={activeCount} prefix={<ShoppingOutlined />} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic title="Awaiting your decision" value={pendingApprovalCount} />
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
