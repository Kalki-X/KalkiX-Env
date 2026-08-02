import React from "react";
import { Link } from "react-router-dom";
import { Row, Col, Card, Typography, Space } from "antd";
import { TeamOutlined, FileSearchOutlined, BugOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

const QUICK_LINKS = [
    { icon: <TeamOutlined />, title: "User management", desc: "Look up platform users, toggle renter/lender capabilities, suspend or reactivate accounts.", path: "/staff/users" },
    { icon: <FileSearchOutlined />, title: "Document lookup", desc: "Find any proforma invoice, invoice, or credit note by reference number.", path: "/staff/documents" },
    { icon: <BugOutlined />, title: "System error reports", desc: "Surfaced backend errors for triage.", path: "/staff/errors" },
];

export default function StaffDashboard() {
    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                    Admin & Support
                </Title>
                <Paragraph style={{ color: "#64748b" }}>
                    User management and platform oversight tools for support cases.
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
