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
    Select,
    Alert,
} from 'antd';
import {
    UserOutlined,
    MailOutlined,
    LockOutlined,
    PhoneOutlined,
    GoogleOutlined,
    UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '../features/auth/context/AuthContext';
import { getApiErrorMessage } from '../services/api/client';
import type { AccountType } from '../features/auth/api/authApi';

const { Content } = Layout;
const { Title, Text, Paragraph, Link } = Typography;
const { Option } = Select;

interface RegisterFormValues {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    accountType: AccountType;
    password: string;
    confirmPassword: string;
    terms: boolean;
}

const Register = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        document.title = 'GearShare - Register';
    }, []);

    const onFinish = async (values: RegisterFormValues) => {
        setErrorMessage(null);
        setSubmitting(true);
        try {
            await register({
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                phone: values.phone,
                password: values.password,
                accountType: values.accountType,
            });
            navigate('/');
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Unable to create your account. Please try again.'));
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
                <div style={{ width: '100%', maxWidth: 1240 }}>
                    <Row gutter={[32, 32]} align="middle">
                        {/* Left info panel */}
                        <Col xs={24} lg={11}>
                            <div
                                style={{
                                    background: '#f7f4ea',
                                    border: '1px solid #d9e1f2',
                                    borderRadius: 28,
                                    padding: '48px 40px',
                                    minHeight: 680,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        color: '#5D79BB',
                                        fontWeight: 700,
                                        fontSize: 14,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                    }}
                                >
                                    Join the marketplace
                                </Text>

                                <Title level={1} style={{ color: '#2B2E4A', marginTop: 12, marginBottom: 12 }}>
                                    Create your GearShare account
                                </Title>

                                <Paragraph style={{ color: '#475569', fontSize: 16, marginBottom: 28 }}>
                                    Sign up to start renting items you need or listing items you own. Whether you are
                                    here to save money or earn extra income, GearShare gives you a simple and trusted place to do both.
                                </Paragraph>

                                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                    <div
                                        style={{
                                            borderRadius: 20,
                                            background: '#ffffff',
                                            border: '1px solid #d9e1f2',
                                            padding: 18,
                                        }}
                                    >
                                        <Text style={{ display: 'block', color: '#2B2E4A', fontWeight: 700 }}>
                                            For renters
                                        </Text>
                                        <Text style={{ color: '#64748b' }}>
                                            Discover quality items, compare options, and book the things you need quickly.
                                        </Text>
                                    </div>

                                    <div
                                        style={{
                                            borderRadius: 20,
                                            background: '#ffffff',
                                            border: '1px solid #d9e1f2',
                                            padding: 18,
                                        }}
                                    >
                                        <Text style={{ display: 'block', color: '#2B2E4A', fontWeight: 700 }}>
                                            For owners
                                        </Text>
                                        <Text style={{ color: '#64748b' }}>
                                            Create listings, accept bookings, and turn unused items into recurring income.
                                        </Text>
                                    </div>

                                    <div
                                        style={{
                                            borderRadius: 20,
                                            background: 'linear-gradient(135deg, #2B2E4A, #5D79BB)',
                                            padding: 20,
                                        }}
                                    >
                                        <Text style={{ display: 'block', color: '#fff', fontWeight: 700 }}>
                                            Built for trust
                                        </Text>
                                        <Text style={{ color: '#eef2ff' }}>
                                            Secure payments, clear booking flows, and smoother rentals from start to finish.
                                        </Text>
                                    </div>
                                </Space>
                            </div>
                        </Col>

                        {/* Right form */}
                        <Col xs={24} lg={13}>
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
                                    <Title level={2} style={{ marginBottom: 8, color: '#2B2E4A' }}>
                                        Registration
                                    </Title>
                                    <Text style={{ color: '#64748b' }}>
                                        Create your account and start your GearShare journey today.
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
                                    Sign up with Google
                                </Button>

                                <Divider style={{ color: '#94a3b8' }}>or register with email</Divider>

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
                                    <Row gutter={16}>
                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                label="First name"
                                                name="firstName"
                                                rules={[{ required: true, message: 'Please enter your first name' }]}
                                            >
                                                <Input
                                                    prefix={<UserOutlined style={{ color: '#64748b' }} />}
                                                    placeholder="First name"
                                                    size="large"
                                                    style={{ height: 46, borderRadius: 14 }}
                                                />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                label="Last name"
                                                name="lastName"
                                                rules={[{ required: true, message: 'Please enter your last name' }]}
                                            >
                                                <Input
                                                    prefix={<UserOutlined style={{ color: '#64748b' }} />}
                                                    placeholder="Last name"
                                                    size="large"
                                                    style={{ height: 46, borderRadius: 14 }}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={16}>
                                        <Col xs={24} md={12}>
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
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                label="Phone number"
                                                name="phone"
                                                rules={[{ required: true, message: 'Please enter your phone number' }]}
                                            >
                                                <Input
                                                    prefix={<PhoneOutlined style={{ color: '#64748b' }} />}
                                                    placeholder="Enter your phone"
                                                    size="large"
                                                    style={{ height: 46, borderRadius: 14 }}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Form.Item
                                        label="Account type"
                                        name="accountType"
                                        rules={[{ required: true, message: 'Please choose an account type' }]}
                                    >
                                        <Select
                                            placeholder="Select account type"
                                            size="large"
                                            style={{ height: 46 }}
                                        >
                                            <Option value="renter">Renter</Option>
                                            <Option value="owner">Owner</Option>
                                            <Option value="both">Both</Option>
                                        </Select>
                                    </Form.Item>

                                    <Row gutter={16}>
                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                label="Password"
                                                name="password"
                                                rules={[{ required: true, message: 'Please enter your password' }]}
                                            >
                                                <Input.Password
                                                    prefix={<LockOutlined style={{ color: '#64748b' }} />}
                                                    placeholder="Create password"
                                                    size="large"
                                                    style={{ height: 46, borderRadius: 14 }}
                                                />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                label="Confirm password"
                                                name="confirmPassword"
                                                dependencies={['password']}
                                                rules={[
                                                    { required: true, message: 'Please confirm your password' },
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
                                                    placeholder="Confirm password"
                                                    size="large"
                                                    style={{ height: 46, borderRadius: 14 }}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Form.Item
                                        name="terms"
                                        valuePropName="checked"
                                        rules={[
                                            {
                                                validator: (_, value) =>
                                                    value
                                                        ? Promise.resolve()
                                                        : Promise.reject(new Error('You must accept the terms')),
                                            },
                                        ]}
                                    >
                                        <Checkbox>
                                            I agree to the <Link>Terms of Service</Link> and <Link>Privacy Policy</Link>
                                        </Checkbox>
                                    </Form.Item>

                                    <Form.Item style={{ marginBottom: 16 }}>
                                        <Button
                                            htmlType="submit"
                                            type="primary"
                                            block
                                            size="large"
                                            loading={submitting}
                                            icon={<UserAddOutlined />}
                                            style={{
                                                height: 48,
                                                borderRadius: 14,
                                                background: '#2B2E4A',
                                                borderColor: '#2B2E4A',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Create account
                                        </Button>
                                    </Form.Item>
                                </Form>

                                <div style={{ textAlign: 'center' }}>
                                    <Text style={{ color: '#64748b' }}>
                                        Already have an account?{' '}
                                        <Link style={{ color: '#5D79BB', fontWeight: 600 }} onClick={() => navigate('/login')}>
                                            Login
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

export default Register;