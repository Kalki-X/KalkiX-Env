import React, { useEffect, useMemo, useState } from 'react';
import { Typography, List, Card, Space, Tag, Input, Button, Alert, Tooltip, Popconfirm, Divider, Empty } from 'antd';
import { MailOutlined, ReloadOutlined, SaveOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    listEmailTemplates,
    updateEmailTemplate,
    resetEmailTemplate,
    previewEmailTemplate,
    EmailTemplate,
    EmailTemplateType,
} from '../../features/emailTemplates/api/emailTemplatesApi';
import { getApiErrorMessage } from '../../services/api/client';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

/**
 * Admin-editable predefined email templates (password reset, welcome, staff
 * credentials, and the 4 booking lifecycle emails). Two-pane layout: list of
 * templates on the left, editor + live preview for the selected one on the
 * right. Every save/reset is audited server-side (email_template.updated /
 * email_template.reset_to_default) — nothing extra needed here for that.
 */
export default function EmailTemplates() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    const [selectedType, setSelectedType] = useState<EmailTemplateType | null>(null);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [editSuccess, setEditSuccess] = useState<string | null>(null);

    const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const selected = useMemo(() => templates.find((t) => t.type === selectedType) || null, [templates, selectedType]);

    const load = async () => {
        setLoading(true);
        setListError(null);
        try {
            const list = await listEmailTemplates();
            setTemplates(list);
            if (!selectedType && list.length > 0) {
                selectTemplate(list[0]);
            }
        } catch (err) {
            setListError(getApiErrorMessage(err, "Couldn't load email templates."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectTemplate = (t: EmailTemplate) => {
        setSelectedType(t.type);
        setSubject(t.subject);
        setBody(t.body);
        setEditError(null);
        setEditSuccess(null);
        setPreview(null);
        setPreviewError(null);
    };

    const isDirty = !!selected && (subject !== selected.subject || body !== selected.body);

    const onSave = async () => {
        if (!selected) return;
        if (!subject.trim() || !body.trim()) {
            setEditError('Subject and body are both required.');
            return;
        }
        setSaving(true);
        setEditError(null);
        setEditSuccess(null);
        try {
            const updated = await updateEmailTemplate(selected.type, { subject: subject.trim(), body });
            setTemplates((prev) => prev.map((t) => (t.type === updated.type ? updated : t)));
            setSubject(updated.subject);
            setBody(updated.body);
            setEditSuccess('Saved.');
        } catch (err) {
            setEditError(getApiErrorMessage(err, "Couldn't save this template."));
        } finally {
            setSaving(false);
        }
    };

    const onReset = async () => {
        if (!selected) return;
        setResetting(true);
        setEditError(null);
        setEditSuccess(null);
        try {
            const updated = await resetEmailTemplate(selected.type);
            setTemplates((prev) => prev.map((t) => (t.type === updated.type ? updated : t)));
            setSubject(updated.subject);
            setBody(updated.body);
            setEditSuccess('Reset to the default wording.');
        } catch (err) {
            setEditError(getApiErrorMessage(err, "Couldn't reset this template."));
        } finally {
            setResetting(false);
        }
    };

    const onPreview = async () => {
        if (!selected) return;
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            setPreview(await previewEmailTemplate(selected.type, { subject, body }));
        } catch (err) {
            setPreviewError(getApiErrorMessage(err, "Couldn't render a preview."));
        } finally {
            setPreviewLoading(false);
        }
    };

    const insertPlaceholder = (token: string) => {
        setBody((prev) => `${prev}{{${token}}}`);
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: 'var(--gs-heading)', marginBottom: 4 }}>
                    Email templates
                </Title>
                <Paragraph style={{ color: 'var(--color-muted)' }}>
                    Customize the wording of every predefined system email. Action buttons/links (e.g. "Reset password",
                    "View &amp; Decide") are always appended automatically — editing the text above never removes them.
                </Paragraph>
            </div>

            {listError && <Alert type="error" showIcon message={listError} />}

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Card
                    title={
                        <Space>
                            <MailOutlined /> Templates
                        </Space>
                    }
                    style={{ width: 300, flexShrink: 0 }}
                    loading={loading}
                    bodyStyle={{ padding: 0 }}
                >
                    <List
                        dataSource={templates}
                        renderItem={(t) => (
                            <List.Item
                                onClick={() => selectTemplate(t)}
                                style={{
                                    cursor: 'pointer',
                                    padding: '12px 16px',
                                    background: t.type === selectedType ? '#eef2ff' : undefined,
                                }}
                            >
                                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                    <Text strong={t.type === selectedType} style={{ color: 'var(--gs-heading)' }}>
                                        {t.label}
                                    </Text>
                                    {!t.isDefault && (
                                        <Tag color="blue" style={{ marginTop: 4 }}>
                                            Customized
                                        </Tag>
                                    )}
                                </Space>
                            </List.Item>
                        )}
                    />
                </Card>

                <div style={{ flex: 1, minWidth: 320 }}>
                    {!selected ? (
                        <Card>
                            <Empty description="Select a template to edit it" />
                        </Card>
                    ) : (
                        <Card
                            title={selected.label}
                            extra={
                                <Space>
                                    {selected.updatedAt && (
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            Last updated {dayjs(selected.updatedAt).format('DD MMM YYYY, HH:mm')}
                                        </Text>
                                    )}
                                </Space>
                            }
                        >
                            <Paragraph style={{ color: 'var(--color-muted)' }}>{selected.description}</Paragraph>

                            {selected.placeholders.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <Text style={{ color: 'var(--color-muted)', marginRight: 8 }}>Insert placeholder:</Text>
                                    <Space size={[4, 4]} wrap>
                                        {selected.placeholders.map((p) => (
                                            <Tooltip key={p} title={`Click to insert {{${p}}} into the body`}>
                                                <Tag
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => insertPlaceholder(p)}
                                                >
                                                    {`{{${p}}}`}
                                                </Tag>
                                            </Tooltip>
                                        ))}
                                    </Space>
                                </div>
                            )}

                            {editError && <Alert type="error" showIcon message={editError} style={{ marginBottom: 16 }} />}
                            {editSuccess && <Alert type="success" showIcon message={editSuccess} style={{ marginBottom: 16 }} />}

                            <div style={{ marginBottom: 12 }}>
                                <Text strong>Subject</Text>
                                <Input
                                    size="large"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    style={{ marginTop: 4 }}
                                />
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <Text strong>Body</Text>
                                <TextArea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    autoSize={{ minRows: 6, maxRows: 14 }}
                                    style={{ marginTop: 4 }}
                                />
                            </div>

                            <Space wrap>
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    loading={saving}
                                    disabled={!isDirty}
                                    onClick={onSave}
                                >
                                    Save
                                </Button>
                                <Button icon={<EyeOutlined />} loading={previewLoading} onClick={onPreview}>
                                    Preview with sample data
                                </Button>
                                <Popconfirm
                                    title="Reset to default wording?"
                                    description="This discards your customization and can't be undone."
                                    okText="Reset"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={onReset}
                                    disabled={selected.isDefault}
                                >
                                    <Button icon={<ReloadOutlined />} loading={resetting} disabled={selected.isDefault}>
                                        Reset to default
                                    </Button>
                                </Popconfirm>
                            </Space>

                            {previewError && <Alert type="error" showIcon message={previewError} style={{ marginTop: 16 }} />}

                            {preview && (
                                <>
                                    <Divider />
                                    <Text style={{ color: 'var(--color-muted)' }}>Preview (rendered with sample data)</Text>
                                    <Card size="small" style={{ marginTop: 8, background: '#f8fafc' }}>
                                        <Text strong>Subject: </Text>
                                        <Text>{preview.subject}</Text>
                                        <Divider style={{ margin: '12px 0' }} />
                                        <div dangerouslySetInnerHTML={{ __html: preview.html }} />
                                    </Card>
                                </>
                            )}
                        </Card>
                    )}
                </div>
            </div>
        </Space>
    );
}
