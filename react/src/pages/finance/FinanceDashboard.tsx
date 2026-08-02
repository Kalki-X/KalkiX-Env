import React from "react";
import { Link } from "react-router-dom";
import { Row, Col, Card, Typography, Space } from "antd";
import { BarChartOutlined, DollarOutlined, FileSearchOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

const QUICK_LINKS = [
    { icon: <BarChartOutlined />, title: "Revenue reports", desc: "Platform-wide booking volume and revenue over time.", path: "/finance/reports" },
    { icon: <DollarOutlined />, title: "Payment management", desc: "Review payments, refunds, and payout status.", path: "/finance/payments" },
    { icon: <FileSearchOutlined />, title: "Document lookup", desc: "Find any proforma invoice, invoice, or credit note by reference number.", path: "/finance/documents" },
];

export default function FinanceDashboard() {
    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                    Finance
                </Title>
                <Paragraph style={{ color: "#64748b" }}>
                    Manage the GearShare account and reconcile platform payments. Every table below can be
                    exported (CSV/Excel/PDF) for filing outside the system.
                </Paragraph>
            </div>

            <Row gutter={[16, 16]}>
                {QUICK_LINKS.map((s) => (
                    <Col xs={24} sm={12} md={8} key={s.title}>
                        <Link to={s.path}>
                            <Card hoverable>
                                <Space direction="vertical" size={4}>
                                    <Space>
                                        {s.icon}
                                        <strong>{s.title}</strong>
                                    </Space>
                                    <Paragraph style={{ color: "#64748b", marginBottom: 0, fontSize: 13 }}>
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
