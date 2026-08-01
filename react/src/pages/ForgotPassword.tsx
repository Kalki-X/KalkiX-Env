import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Row, Col, Card, Typography, Form, Input, Button, Alert } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { requestPasswordReset } from '../features/auth/api/authApi';
import { getApiErrorMessage } from '../services/api/client';

const { Content } = Layout;
const { Title, Text, Paragraph, Link } = Typography;

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        document.title = 'GearShare - Forgot password';
    }, []);

    const onFinish = async (values: { email: string }) => {
        setErrorMessage(null);
        setSuccessMessage(null);
        setSubmitting(true);
        try {
            const message = await requestPasswordReset(values.email);
            setSuccessMessage(message);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Something went wrong. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#E7EEF7' }}>
            <Content style={{ padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 480 }}>
                    <Row>
                        <Col span={24}>
                            <Card
                                style={{ borderRadius: 28, borderColor: '#d9e1f2', boxShadow: '0 16px 40px rgba(43,46,74,0.08)' }}
                                styles={{ body: { padding: 36 } }}
                            >
                                <Button
                                    type="text"
                                    icon={<ArrowLeftOutlined />}
                                    onClick={() => navigate('/login')}
                                    style={{ marginBottom: 12, paddingLeft: 0, color: '#64748b' }}
                                >
                                    Back to login
                                </Button>

                                <Title level={2} style={{ marginBottom: 8, color: '#2B2E4A' }}>
                                    Forgot your password?
                                </Title>
                                <Paragraph style={{ color: '#64748b', marginBottom: 24 }}>
                                    Enter the email on your account and we'll send you a link to reset it.
                                </Paragraph>

                                {errorMessage && (
                                    <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 20, borderRadius: 12 }} />
                                )}
                                {successMessage && (
                                    <Alert type="success" showIcon message={successMessage} style={{ marginBottom: 20, borderRadius: 12 }} />
                                )}

                                <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
                                    <Form.Item
                                        label="Email address"
                                        name="email"
                                        rules={[
                                            { required: true, message: 'Please enter your email' },
                                            { type: 'email', message: 'Please enter a valid email' },
                                        ]}
                                    >
                                        <Input
                                            prefix={<MailOutlined style={{ color: '#64748b' }} />}
                                            placeholder="Enter your email"
                                            size="large"
                                            style={{ height: 46, borderRadius: 14 }}
                                        />
                                    </Form.Item>

                                    <Form.Item style={{ marginBottom: 0 }}>
                                        <Button
                                            htmlType="submit"
                                            type="primary"
                                            block
                                            size="large"
                                            loading={submitting}
                                            style={{
                                                height: 48,
                                                borderRadius: 14,
                                                background: '#2B2E4A',
                                                borderColor: '#2B2E4A',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Send reset link
                                        </Button>
                                    </Form.Item>
                                </Form>

                                <div style={{ textAlign: 'center', marginTop: 20 }}>
                                    <Text style={{ color: '#64748b' }}>
                                        Remembered it?{' '}
                                        <Link style={{ color: '#5D79BB', fontWeight: 600 }} onClick={() => navigate('/login')}>
                                            Log in
                                        </Link>
                                    </Text>
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </div>
            </Content>
        </Layout>
    );
};

export default ForgotPassword;
