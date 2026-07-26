import React from 'react';
import {
    Layout,
    Space,
    Typography, Row, Col,
} from 'antd';

const { Footer } = Layout;
const { Text, Paragraph, Link } = Typography;

const FooterComponent = () => {

    return (
        <Footer
            style={{
                background: '#ffffff',
                borderTop: '1px solid #d9e1f2',
                padding: '32px 24px',
            }}
        >
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <Row gutter={[24, 24]} justify="space-between">
                    <Col xs={24} md={10}>
                        <Text style={{ display: 'block', fontSize: 18, fontWeight: 700, color: '#2B2E4A' }}>
                            GearShare
                        </Text>
                        <Paragraph style={{ color: '#64748b', marginTop: 8, marginBottom: 0 }}>
                            Rent smarter. Share more. Access the things you need without the full cost of
                            ownership.
                        </Paragraph>
                    </Col>

                    <Col xs={24} md={12}>
                        <Row gutter={[16, 16]}>
                            <Col xs={12} sm={6}>
                                <Space orientation="vertical" size="small">
                                    <Link>About</Link>
                                    <Link>How it works</Link>
                                    <Link>Categories</Link>
                                </Space>
                            </Col>
                            <Col xs={12} sm={6}>
                                <Space orientation="vertical" size="small">
                                    <Link>Trust & Safety</Link>
                                    <Link>Pricing</Link>
                                    <Link>Community</Link>
                                </Space>
                            </Col>
                            <Col xs={12} sm={6}>
                                <Space orientation="vertical" size="small">
                                    <Link>Terms</Link>
                                    <Link>Privacy</Link>
                                    <Link>Support</Link>
                                </Space>
                            </Col>
                            <Col xs={12} sm={6}>
                                <Space orientation="vertical" size="small">
                                    <Link>Contact</Link>
                                    <Link>FAQ</Link>
                                    <Link>Help Centre</Link>
                                </Space>
                            </Col>
                        </Row>
                    </Col>
                </Row>

                <div
                    style={{
                        marginTop: 24,
                        paddingTop: 16,
                        borderTop: '1px solid #eef2f7',
                        textAlign: 'center',
                    }}
                >
                    <Text style={{ color: '#64748b' }}>© 2026 GearShare. All rights reserved.</Text>
                </div>
            </div>
        </Footer>
    );
};

export default FooterComponent


//Sponsored ads - company pay to view its rental stuff - paid, to add a section on homepage