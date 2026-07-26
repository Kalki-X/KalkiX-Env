import React from "react";
import { Card, Typography, Space, Row, Col, Tag } from "antd";

const { Title, Paragraph } = Typography;

interface Feature {
    icon: React.ReactNode;
    title: string;
    desc: string;
}

interface ComingSoonProps {
    heading: string;
    subheading: string;
    phaseLabel: string;
    features: Feature[];
}

/** Shared placeholder body for dashboards whose features land in a later phase. */
export default function ComingSoon({ heading, subheading, phaseLabel, features }: ComingSoonProps) {
    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Space align="center" size="middle">
                    <Title level={2} style={{ color: "#2B2E4A", margin: 0 }}>
                        {heading}
                    </Title>
                    <Tag color="processing">{phaseLabel}</Tag>
                </Space>
                <Paragraph style={{ color: "#64748b", marginTop: 8 }}>{subheading}</Paragraph>
            </div>

            <Row gutter={[16, 16]}>
                {features.map((f) => (
                    <Col xs={24} sm={12} md={8} key={f.title}>
                        <Card size="small" style={{ opacity: 0.7 }}>
                            <Space direction="vertical" size={4}>
                                <Space>
                                    {f.icon}
                                    <strong>{f.title}</strong>
                                </Space>
                                <Paragraph style={{ color: "#64748b", marginBottom: 0, fontSize: 13 }}>
                                    {f.desc}
                                </Paragraph>
                            </Space>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Space>
    );
}
