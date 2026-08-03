import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Row,
    Col,
    Card,
    Statistic,
    Typography,
    Form,
    Input,
    Select,
    Checkbox,
    Button,
    Alert,
    Space,
    Spin,
} from "antd";
import {
    TeamOutlined,
    UserAddOutlined,
    BarChartOutlined,
    DollarOutlined,
    FileSearchOutlined,
    AuditOutlined,
    BugOutlined,
    IdcardOutlined,
} from "@ant-design/icons";
import { fetchPlatformStats, createStaffAccount, PlatformStats, StaffRole } from "../../features/admin/api/adminApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph } = Typography;
const { Option } = Select;

interface StaffFormValues {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password?: string;
    role: StaffRole;
    isRenter?: boolean;
    isLender?: boolean;
}

const QUICK_LINKS = [
    { icon: <IdcardOutlined />, title: "Role management", desc: "Edit permissions per role, suspend/reactivate accounts.", path: "/admin/users" },
    { icon: <BarChartOutlined />, title: "Sales reports", desc: "Platform-wide booking volume and revenue over time.", path: "/admin/reports" },
    { icon: <DollarOutlined />, title: "Payment management", desc: "Review payments, refunds, and payout status.", path: "/admin/payments" },
    { icon: <FileSearchOutlined />, title: "Document lookup", desc: "Find any proforma invoice, invoice, or credit note by reference number.", path: "/admin/documents" },
    { icon: <AuditOutlined />, title: "Audit trail", desc: "Search the full audit_log — logins, payments, document generation.", path: "/admin/audit" },
    { icon: <BugOutlined />, title: "System error reports", desc: "Surfaced backend errors for triage.", path: "/admin/errors" },
];

export default function SuperAdminDashboard() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [form] = Form.useForm<StaffFormValues>();
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);

    const loadStats = async () => {
        try {
            setStats(await fetchPlatformStats());
            setStatsError(null);
        } catch (err) {
            setStatsError(getApiErrorMessage(err, "Couldn't load platform stats."));
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const onCreateStaff = async (values: StaffFormValues) => {
        setFormError(null);
        setFormSuccess(null);
        setSubmitting(true);
        try {
            const { user: created, credentialsEmailSent } = await createStaffAccount(values);
            setFormSuccess(
                `${created.firstName} ${created.lastName} (${created.email}) was created as ${created.role}.` +
                    (credentialsEmailSent
                        ? ' They\'ve been emailed a secure link to set their own password.'
                        : ' No email was sent — you set their password directly.')
            );
            form.resetFields();
            loadStats(); // refresh the counts now that a new user exists
        } catch (err) {
            setFormError(getApiErrorMessage(err, "Couldn't create that account."));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ color: "var(--gs-heading)", marginBottom: 4 }}>
                    Super Admin
                </Title>
                <Paragraph style={{ color: "var(--color-muted)" }}>
                    Platform overview and staff account provisioning.
                </Paragraph>
            </div>

            {statsError && <Alert type="error" showIcon message={statsError} />}

            {stats ? (
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8} md={6}>
                        <Card>
                            <Statistic title="Total users" value={stats.totalUsers} prefix={<TeamOutlined />} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8} md={6}>
                        <Card>
                            <Statistic title="Renters" value={stats.renters} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8} md={6}>
                        <Card>
                            <Statistic title="Lenders" value={stats.lenders} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8} md={6}>
                        <Card>
                            <Statistic title="Suspended" value={stats.suspended} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8} md={6}>
                        <Card>
                            <Statistic title="Admins" value={stats.byRole.admins} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8} md={6}>
                        <Card>
                            <Statistic title="Support" value={stats.byRole.support} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8} md={6}>
                        <Card>
                            <Statistic title="Finance" value={stats.byRole.finance} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8} md={6}>
                        <Card>
                            <Statistic title="Super Admins" value={stats.byRole.superAdmins} />
                        </Card>
                    </Col>
                </Row>
            ) : (
                !statsError && (
                    <div style={{ textAlign: "center", padding: 40 }}>
                        <Spin />
                    </div>
                )
            )}

            <Card
                title={
                    <Space>
                        <UserAddOutlined /> Create an Admin, Support, or Finance account
                    </Space>
                }
            >
                <Paragraph style={{ color: "var(--color-muted)" }}>
                    These roles can't self-register — only a Super Admin can create them.
                </Paragraph>

                {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
                {formSuccess && <Alert type="success" showIcon message={formSuccess} style={{ marginBottom: 16 }} />}

                <Form form={form} layout="vertical" onFinish={onCreateStaff} requiredMark={false}>
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item label="First name" name="firstName" rules={[{ required: true }]}>
                                <Input size="large" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label="Last name" name="lastName" rules={[{ required: true }]}>
                                <Input size="large" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Email"
                                name="email"
                                rules={[{ required: true }, { type: "email" }]}
                            >
                                <Input size="large" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label="Phone" name="phone">
                                <Input size="large" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item label="Role" name="role" rules={[{ required: true }]}>
                                <Select size="large" placeholder="Select role">
                                    <Option value="admin">Admin</Option>
                                    <Option value="support">Support</Option>
                                    <Option value="finance">Finance</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Password (optional)"
                                name="password"
                                extra="Recommended: leave this blank. They'll be emailed a secure one-time link to set their own password instead of you handing one over directly."
                                rules={[{ min: 8, message: "At least 8 characters" }]}
                            >
                                <Input.Password size="large" placeholder="Leave blank to email a secure set-password link" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Space size="large" style={{ marginBottom: 16 }}>
                        <Form.Item name="isRenter" valuePropName="checked" style={{ marginBottom: 0 }}>
                            <Checkbox>Can also act as a renter</Checkbox>
                        </Form.Item>
                        <Form.Item name="isLender" valuePropName="checked" style={{ marginBottom: 0 }}>
                            <Checkbox>Can also act as a lender</Checkbox>
                        </Form.Item>
                    </Space>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            Create account
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <div>
                <Title level={4} style={{ color: "var(--gs-heading)" }}>
                    Manage
                </Title>
                <Row gutter={[16, 16]}>
                    {QUICK_LINKS.map((s) => (
                        <Col xs={24} sm={12} md={8} key={s.title}>
                            <Link to={s.path}>
                                <Card size="small" hoverable>
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
            </div>
        </Space>
    );
}
