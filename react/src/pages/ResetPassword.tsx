import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout, Row, Col, Card, Typography, Form, Input, Button, Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { resetPassword } from '../features/auth/api/authApi';
import { getApiErrorMessage } from '../services/api/client';

const { Content } = Layout;
const { Title, Text, Paragraph, Link } = Typography;

interface ResetFormValues {
    password: string;
    confirmPassword: string;
}

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        document.title = 'GearShare - Reset password';
    }, []);

    const onFinish = async (values: ResetFormValues) => {
        setErrorMessage(null);
        setSubmitting(true);
        try {
            await resetPassword(token, values.password);
            setDone(true);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Unable to reset your password. The link may have expired.'));
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
                                <Title level={2} style={{ marginBottom: 8, color: '#2B2E4A' }}>
                                    Set a new password
                                </Title>

                                {!token && (
                                    <Alert
                                        type="error"
                                        showIcon
                                        message="This reset link is missing its token. Please use the link from your email, or request a new one."
                                        style={{ marginBottom: 20, borderRadius: 12 }}
                                    />
                                )}

                                {done ? (
                                    <>
                                        <Alert
                                            type="success"
                                            showIcon
                                            message="Your password has been reset."
                                            style={{ marginBottom: 20, borderRadius: 12 }}
                                        />
                                        <Button
                                            type="primary"
                                            block
                                            size="large"
                                            onClick={() => navigate('/login')}
                                            style={{ height: 48, borderRadius: 14, background: '#2B2E4A', borderColor: '#2B2E4A', fontWeight: 600 }}
                                        >
                                            Go to login
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Paragraph style={{ color: '#64748b', marginBottom: 24 }}>
                                            Choose a new password for your account.
                                        </Paragraph>

                                        {errorMessage && (
                                            <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 20, borderRadius: 12 }} />
                                        )}

                                        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
                                            <Form.Item
                                                label="New password"
                                                name="password"
                                                rules={[{ required: true, min: 8, message: 'At least 8 characters' }]}
                                            >
                                                <Input.Password
                                                    prefix={<LockOutlined style={{ color: '#64748b' }} />}
                                                    placeholder="New password"
                                                    size="large"
                                                    style={{ height: 46, borderRadius: 14 }}
                                                />
                                            </Form.Item>

                                            <Form.Item
                                                label="Confirm new password"
                                                name="confirmPassword"
                                                dependencies={['password']}
                                                rules={[
                                                    { required: true, message: 'Please confirm your new password' },
                                                    ({ getFieldValue }) => ({
                                                        validator(_, value) {
                                                            if (!value || getFieldValue('password') === value) {
                                                                return Promise.resolve();
                                                            }
                                                            return Promise.reject(new Error('Passwords do not match'));
                                                        },
                                                    }),
                                                ]}
                                            >
                                                <Input.Password
                                                    prefix={<LockOutlined style={{ color: '#64748b' }} />}
                                                    placeholder="Confirm new password"
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
                                                    disabled={!token}
                                                    style={{ height: 48, borderRadius: 14, background: '#2B2E4A', borderColor: '#2B2E4A', fontWeight: 600 }}
                                                >
                                                    Reset password
                                                </Button>
                                            </Form.Item>
                                        </Form>

                                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                                            <Text style={{ color: '#64748b' }}>
                                                <Link style={{ color: '#5D79BB', fontWeight: 600 }} onClick={() => navigate('/login')}>
                                                    Back to login
                                                </Link>
                                            </Text>
                                        </div>
                                    </>
                                )}
                            </Card>
                        </Col>
                    </Row>
                </div>
            </Content>
        </Layout>
    );
};

export default ResetPassword;
