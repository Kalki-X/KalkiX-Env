import React, { useEffect, useState } from 'react';
import { Typography, Card, Descriptions, Button, Space, Alert, Tag, Row, Col } from 'antd';
import { DatabaseOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getSystemInfo, testDatabaseConnection, SystemInfo, TestConnectionResult } from '../../features/admin/api/systemApi';
import { getApiErrorMessage } from '../../services/api/client';

const { Title, Paragraph, Text } = Typography;

function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds % 60}s`;
}

// Super Admin-only infrastructure diagnostics: database connection details (masked —
// see systemApi.ts for why the password is never part of this data at all) plus a live
// Test Connection check, and basic server/runtime info. Read-only by design — changing
// the actual DB credentials is an environment-variable + restart operation, not
// something this screen offers to do live.
export default function SystemSettings() {
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
    const [testedAt, setTestedAt] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            setInfo(await getSystemInfo());
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Couldn't load system info."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const onTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const result = await testDatabaseConnection();
            setTestResult(result);
            setTestedAt(new Date().toISOString());
        } catch (err) {
            setTestResult({ ok: false, latencyMs: 0, error: getApiErrorMessage(err, 'Connection test failed.') });
            setTestedAt(new Date().toISOString());
        } finally {
            setTesting(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: 'var(--gs-heading)', marginBottom: 4 }}>
                    System settings
                </Title>
                <Paragraph style={{ color: 'var(--color-muted)' }}>
                    Database connection info and server diagnostics. The database password is never shown here or
                    sent to the browser — it stays in the server's own environment configuration.
                </Paragraph>
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Card
                title={
                    <Space>
                        <DatabaseOutlined /> Database connection
                    </Space>
                }
                loading={loading}
                extra={
                    <Button type="primary" icon={<ThunderboltOutlined />} loading={testing} onClick={onTestConnection}>
                        Test Connection
                    </Button>
                }
            >
                {info && (
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="Host">{info.database.host || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Port">{info.database.port ?? '—'}</Descriptions.Item>
                        <Descriptions.Item label="Database name">{info.database.database || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Username">
                            <Text style={{ fontFamily: 'monospace' }}>{info.database.username || '—'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="SSL">
                            <Tag color={info.database.ssl ? 'success' : 'default'}>{info.database.ssl ? 'Enabled' : 'Disabled'}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Connection pool">
                            {info.pool.totalCount} total · {info.pool.idleCount} idle · {info.pool.waitingCount} waiting
                        </Descriptions.Item>
                    </Descriptions>
                )}

                {testResult && (
                    <Alert
                        style={{ marginTop: 16 }}
                        type={testResult.ok ? 'success' : 'error'}
                        showIcon
                        icon={testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        message={
                            testResult.ok
                                ? `Connected successfully (${testResult.latencyMs}ms)`
                                : `Connection failed: ${testResult.error || 'Unknown error'}`
                        }
                        description={testedAt ? `Tested ${dayjs(testedAt).format('DD MMM YYYY, HH:mm:ss')}` : undefined}
                    />
                )}
            </Card>

            <Card title="Server" loading={loading}>
                {info && (
                    <Row gutter={[24, 16]}>
                        <Col xs={12} sm={6}>
                            <Text type="secondary">Environment</Text>
                            <br />
                            <Tag color={info.server.environment === 'production' ? 'success' : 'blue'}>{info.server.environment}</Tag>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Text type="secondary">Node version</Text>
                            <br />
                            <Text style={{ color: 'var(--gs-heading)' }}>{info.server.nodeVersion}</Text>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Text type="secondary">Platform</Text>
                            <br />
                            <Text style={{ color: 'var(--gs-heading)' }}>{info.server.platform}</Text>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Text type="secondary">Uptime</Text>
                            <br />
                            <Text style={{ color: 'var(--gs-heading)' }}>{formatUptime(info.server.uptimeSeconds)}</Text>
                        </Col>
                    </Row>
                )}
            </Card>
        </Space>
    );
}
