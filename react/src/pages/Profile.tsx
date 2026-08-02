import React, { useState } from "react";
import { Typography, Card, Form, Input, Button, Avatar, Space, Upload, message, Alert } from "antd";
import { UserOutlined, SaveOutlined, CameraOutlined } from "@ant-design/icons";
import type { UploadRequestOption } from "@rc-component/upload/lib/interface";
import { useAuth } from "../features/auth/context/AuthContext";
import { updateProfile, uploadAvatar, userAvatarUrl } from "../features/auth/api/authApi";
import { getApiErrorMessage } from "../services/api/client";

const { Title, Paragraph } = Typography;

// Reachable by any authenticated user regardless of role — see router.tsx, mounted
// with no `roles`/`capability` restriction on its ProtectedRoute. Per the current
// scope, only the avatar and phone number are editable; email is the login identity
// and is fixed here (changing it would need re-verification, which is separate work),
// and role/status/capabilities stay Super Admin/staff-only.
export default function Profile() {
    const { user, refresh } = useAuth();
    const [form] = Form.useForm<{ phone?: string }>();
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!user) return null;

    const onSave = async (values: { phone?: string }) => {
        setSaving(true);
        setErrorMessage(null);
        try {
            await updateProfile(values.phone || null);
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
        <Space direction="vertical" size="large" style={{ width: "100%", maxWidth: 560 }}>
            <div>
                <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                    My profile
                </Title>
                <Paragraph style={{ color: "#64748b" }}>
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
                        initialValues={{ phone: user.phone || "" }}
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
