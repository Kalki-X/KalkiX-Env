import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layout,
    Row,
    Col,
    Card,
    Typography,
    Form,
    Input,
    Button,
    Divider,
    Checkbox,
    Space,
    Alert,
} from 'antd';
import {
    MailOutlined,
    LockOutlined,
    GoogleOutlined,
    LoginOutlined,
} from '@ant-design/icons';
import { useAuth } from '../features/auth/context/AuthContext';
import { getApiErrorMessage } from '../services/api/client';
import { resolveHomeRoute } from '../features/auth/utils/resolveHomeRoute';

const { Content } = Layout;
const { Title, Text, Paragraph, Link } = Typography;

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        document.title = 'GearShare - Login';
    }, []);

    const onFinish = async (values: { email: string; password: string }) => {
        setErrorMessage(null);
        setSubmitting(true);
        try {
            const loggedInUser = await login({ email: values.email, password: values.password });
            navigate(resolveHomeRoute(loggedInUser));
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Unable to log in. Please check your credentials.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#E7EEF7' }}>
            <Content
                style={{
                    padding: '40px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div style={{ width: '100%', maxWidth: 1180 }}>
                    <Row gutter={[32, 32]} align="middle">
                        {/* Left branding panel */}
                        <Col xs={24} lg={12}>
                            <div
                                style={{
                                    background: 'linear-gradient(135deg, #2B2E4A, #5D79BB)',
                                    borderRadius: 28,
                                    padding: '48px 40px',
                                    minHeight: 620,
                                    color: '#fff',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                }}
                            >
                                <div
                                    style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: 18,
                                        background: 'rgba(255,255,255,0.16)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        fontSize: 22,
                                        marginBottom: 24,
                                    }}
                                >
                                    GS
                                </div>

                                <Title level={1} style={{ color: '#fff', marginBottom: 12 }}>
                                    Welcome back to GearShare
                                </Title>

                                <Paragraph
                                    style={{
                                        color: '#eef2ff',
                                        fontSize: 16,
                                        maxWidth: 500,
                                        marginBottom: 32,
                                    }}
                                >
                                    Sign in to manage your rentals, track bookings, save favourite items,
                                    and continue exploring the things you need without the full cost of ownership.
                                </Paragraph>

                                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                    <div
                                        style={{
                                            background: 'rgba(255,255,255,0.12)',
                                            border: '1px solid rgba(255,255,255,0.18)',
                                            borderRadius: 18,
                                            padding: 18,
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: 700, display: 'block' }}>
                                            Trusted marketplace
                                        </Text>
                                        <Text style={{ color: '#e2e8f0' }}>
                                            Rent with confidence through verified users, secure payments, and simple booking flows.
                                        </Text>
                                    </div>

                                    <div
                                        style={{
                                            background: 'rgba(255,255,255,0.12)',
                                            border: '1px solid rgba(255,255,255,0.18)',
                                            borderRadius: 18,
                                            padding: 18,
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: 700, display: 'block' }}>
                                            Earn from your items
                                        </Text>
                                        <Text style={{ color: '#e2e8f0' }}>
                                            List your gear, accept bookings, and turn unused items into income.
                                        </Text>
                                    </div>
                                </Space>
                            </div>
                        </Col>

                        {/* Right login form */}
                        <Col xs={24} lg={12}>
                            <Card
                                style={{
                                    borderRadius: 28,
                                    borderColor: '#d9e1f2',
                                    boxShadow: '0 16px 40px rgba(43,46,74,0.08)',
                                }}
                                styles={{
                                    body: {
                                        padding: 36,
                                    },
                                }}
                            >
                                <div style={{ marginBottom: 24 }}>
                                    <Text
                                        style={{
                                            color: '#5D79BB',
                                            fontWeight: 700,
                                            fontSize: 14,
                                            textTransform: 'uppercase',
                                            letterSpacing: 1,
                                        }}
                                    >
                                        Account Access
                                    </Text>
                                    <Title level={2} style={{ marginTop: 8, marginBottom: 8, color: '#2B2E4A' }}>
                                        Login
                                    </Title>
                                    <Text style={{ color: '#64748b' }}>
                                        Enter your details to access your GearShare account.
                                    </Text>
                                </div>

                                <Button
                                    block
                                    size="large"
                                    icon={<GoogleOutlined />}
                                    style={{
                                        height: 46,
                                        borderRadius: 14,
                                        marginBottom: 18,
                                    }}
                                >
                                    Continue with Google
                                </Button>

                                <Divider style={{ color: '#94a3b8' }}>or sign in with email</Divider>

                                {errorMessage && (
                                    <Alert
                                        type="error"
                                        message={errorMessage}
                                        showIcon
                                        closable
                                        onClose={() => setErrorMessage(null)}
                                        style={{ marginBottom: 20, borderRadius: 12 }}
                                    />
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

                                    <Form.Item
                                        label="Password"
                                        name="password"
                                        rules={[{ required: true, message: 'Please enter your password' }]}
                                    >
                                        <Input.Password
                                            prefix={<LockOutlined style={{ color: '#64748b' }} />}
                                            placeholder="Enter your password"
                                            size="large"
                                            style={{ height: 46, borderRadius: 14 }}
                                        />
                                    </Form.Item>

                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: 20,
                                            flexWrap: 'wrap',
                                            gap: 10,
                                        }}
                                    >
                                        <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 0 }}>
                                            <Checkbox>Remember me</Checkbox>
                                        </Form.Item>

                                        <Link style={{ color: '#5D79BB' }}>Forgot password?</Link>
                                    </div>

                                    <Form.Item style={{ marginBottom: 16 }}>
                                        <Button
                                            htmlType="submit"
                                            type="primary"
                                            block
                                            size="large"
                                            loading={submitting}
                                            icon={<LoginOutlined />}
                                            style={{
                                                height: 48,
                                                borderRadius: 14,
                                                background: '#2B2E4A',
                                                borderColor: '#2B2E4A',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Login
                                        </Button>
                                    </Form.Item>
                                </Form>

                                <div style={{ textAlign: 'center' }}>
                                    <Text style={{ color: '#64748b' }}>
                                        Don&apos;t have an account?{' '}
                                        <Link style={{ color: '#5D79BB', fontWeight: 600 }} onClick={() => navigate('/register')}>
                                            Create one
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

export default Login;