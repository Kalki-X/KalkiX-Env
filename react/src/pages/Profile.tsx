import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Card, Form, Input, Button, Avatar, Space, Upload, message, Alert, Row, Col } from "antd";
import { UserOutlined, SaveOutlined, CameraOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import type { UploadRequestOption } from "@rc-component/upload/lib/interface";
import { useAuth } from "../features/auth/context/AuthContext";
import { updateProfile, uploadAvatar, userAvatarUrl, ProfileUpdatePayload } from "../features/auth/api/authApi";
import { resolveHomeRoute } from "../features/auth/utils/resolveHomeRoute";
import { getApiErrorMessage } from "../services/api/client";

const { Title, Paragraph } = Typography;

// Reachable by any authenticated user regardless of role — see router.tsx, mounted
// with no `roles`/`capability` restriction on its ProtectedRoute. Per the current
// scope, the avatar, phone number, and an optional postal address are editable; email
// is the login identity and is fixed here (changing it would need re-verification,
// which is separate work), and role/status/capabilities stay Super Admin/staff-only.
// The address is optional for every user, but matters most for lenders — it's what
// shows up on the "From" block of a PDF document (proforma invoice / invoice / credit
// note) whenever they're the lender on a booking.
export default function Profile() {
    const { user, refresh } = useAuth();
    const navigate = useNavigate();
    const [form] = Form.useForm<ProfileUpdatePayload>();
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!user) return null;

    const onSave = async (values: ProfileUpdatePayload) => {
        setSaving(true);
        setErrorMessage(null);
        try {
            await updateProfile(values);
            await refresh();
            message.success("Profile updated.");
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not update your profile."));
        } finally {
            setSaving(false);
        }
    };

    const customAvatarRequest = async (options: UploadRequestOption) => {
        setUploading(true);
        setErrorMessage(null);
        try {
            await uploadAvatar(options.file as File);
            await refresh();
            options.onSuccess?.({});
            message.success("Profile photo updated.");
        } catch (err) {
            options.onError?.(err as Error);
            setErrorMessage(getApiErrorMessage(err, "Could not upload that photo."));
        } finally {
            setUploading(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: "100%", maxWidth: 640 }}>
            <div>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(resolveHomeRoute(user))}
                    style={{ paddingLeft: 0, marginBottom: 4 }}
                >
                    Back to dashboard
                </Button>
                <Title level={2} style={{ color: "var(--gs-heading)", marginBottom: 4 }}>
                    My profile
                </Title>
                <Paragraph style={{ color: "var(--color-muted)" }}>
                    Update your photo and phone number. Your email address can't be changed here.
                </Paragraph>
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Card>
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                    <Space align="center" size="large">
                        <Avatar
                            size={80}
                            icon={<UserOutlined />}
                            src={user.hasAvatar ? userAvatarUrl(user.id) : undefined}
                        />
                        <Upload
                            accept="image/*"
                            showUploadList={false}
                            customRequest={customAvatarRequest}
                            disabled={uploading}
                        >
                            <Button icon={<CameraOutlined />} loading={uploading}>
                                Change photo
                            </Button>
                        </Upload>
                    </Space>

                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={onSave}
                        initialValues={{
                            phone: user.phone || "",
                            addressLine1: user.addressLine1 || "",
                            addressLine2: user.addressLine2 || "",
                            city: user.city || "",
                            state: user.state || "",
                            postalCode: user.postalCode || "",
                            country: user.country || "",
                        }}
                        requiredMark={false}
                    >
                        <Form.Item label="Name">
                            <Input value={`${user.firstName} ${user.lastName}`} disabled />
                        </Form.Item>
                        <Form.Item label="Email">
                            <Input value={user.email} disabled />
                        </Form.Item>
                        <Form.Item label="Phone number" name="phone">
                            <Input size="large" placeholder="e.g. +1 555 123 4567" />
                        </Form.Item>

                        <Title level={5} style={{ color: "var(--gs-heading)", marginTop: 8 }}>
                            Postal address
                        </Title>
                        <Paragraph style={{ color: "var(--color-muted)", marginTop: -8, marginBottom: 16 }}>
                            Optional — if you list items to rent, this appears on the "From" section of any invoice
                            or credit note generated for your bookings.
                        </Paragraph>
                        <Form.Item label="Address line 1" name="addressLine1">
                            <Input placeholder="Street address" />
                        </Form.Item>
                        <Form.Item label="Address line 2" name="addressLine2">
                            <Input placeholder="Apartment, suite, etc. (optional)" />
                        </Form.Item>
                        <Row gutter={16}>
                            <Col xs={24} sm={8}>
                                <Form.Item label="City" name="city">
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Form.Item label="State / Province" name="state">
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Form.Item label="Postal code" name="postalCode">
                                    <Input />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item label="Country" name="country">
                            <Input />
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 0 }}>
                            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                                Save changes
                            </Button>
                        </Form.Item>
                    </Form>
                </Space>
            </Card>
        </Space>
    );
}
