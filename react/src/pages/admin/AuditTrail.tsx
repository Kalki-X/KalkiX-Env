import React, { useEffect, useState } from 'react';
import { Typography, Input, DatePicker, Table, Tag, Alert, Space, Tooltip } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { listAuditLog, AuditEntry } from '../../features/admin/api/adminApi';
import { getApiErrorMessage } from '../../services/api/client';
import ExportButton from '../../components/ExportButton/ExportButton';
import { ExportColumn } from '../../utils/exportTable';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

export default function AuditTrail() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [action, setAction] = useState('');
    const [entityType, setEntityType] = useState('');
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const result = await listAuditLog({
                action: action || undefined,
                entityType: entityType || undefined,
                from: dateRange?.[0]?.startOf('day').toISOString(),
                to: dateRange?.[1]?.endOf('day').toISOString(),
                page,
                pageSize,
            });
            setEntries(result.entries);
            setTotal(result.total);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Could not load the audit trail.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, dateRange]);

    // Fetches every entry matching the current action/entity/date filters (not just
    // the current page) so exports reflect the full filtered result set.
    const fetchAllForExport = async () => {
        const result = await listAuditLog({
            action: action || undefined,
            entityType: entityType || undefined,
            from: dateRange?.[0]?.startOf('day').toISOString(),
            to: dateRange?.[1]?.endOf('day').toISOString(),
            page: 1,
            pageSize: 5000,
            export: true,
        });
        return result.entries;
    };

    const exportColumns: ExportColumn<AuditEntry>[] = [
        { header: 'Time', accessor: (e) => dayjs(e.createdAt).format('DD MMM YYYY, HH:mm:ss') },
        { header: 'User', accessor: (e) => (e.user ? `${e.user.name} (${e.user.email})` : '') },
        { header: 'Action', accessor: (e) => e.action },
        { header: 'Entity', accessor: (e) => (e.entityType ? `${e.entityType} #${e.entityId}` : '') },
        { header: 'Details', accessor: (e) => (Object.keys(e.metadata || {}).length ? JSON.stringify(e.metadata) : '') },
        { header: 'IP', accessor: (e) => e.ipAddress || '' },
    ];

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: 'var(--gs-heading)', marginBottom: 4 }}>
                    Audit trail
                </Title>
                <Paragraph style={{ color: 'var(--color-muted)' }}>
                    Every login, payment, document generation, and sensitive action on the platform.
                </Paragraph>
            </div>

            <Space wrap>
                <Input
                    placeholder="Action prefix (e.g. auth., payment., booking.)"
                    style={{ width: 280 }}
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    onPressEnter={() => {
                        setPage(1);
                        load();
                    }}
                />
                <Input
                    placeholder="Entity type (e.g. booking, user, document)"
                    style={{ width: 220 }}
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    onPressEnter={() => {
                        setPage(1);
                        load();
                    }}
                />
                <RangePicker
                    value={dateRange}
                    onChange={(v) => {
                        setPage(1);
                        setDateRange(v as [Dayjs, Dayjs] | null);
                    }}
                />
                <ExportButton
                    fetchAll={fetchAllForExport}
                    columns={exportColumns}
                    baseName="gearshare-audit-trail"
                    title="GearShare — Audit Trail"
                />
            </Space>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Table<AuditEntry>
                rowKey="id"
                loading={loading}
                dataSource={entries}
                scroll={{ x: 'max-content' }}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    },
                }}
                columns={[
                    {
                        title: 'Time',
                        dataIndex: 'createdAt',
                        width: 170,
                        render: (v: string) => dayjs(v).format('DD MMM YYYY, HH:mm:ss'),
                    },
                    {
                        title: 'User',
                        key: 'user',
                        render: (_, e) => (e.user ? `${e.user.name} (${e.user.email})` : <Text type="secondary">—</Text>),
                    },
                    {
                        title: 'Action',
                        dataIndex: 'action',
                        render: (a: string) => <Tag>{a}</Tag>,
                    },
                    {
                        title: 'Entity',
                        key: 'entity',
                        render: (_, e) => (e.entityType ? `${e.entityType} #${e.entityId}` : '—'),
                    },
                    {
                        title: 'Details',
                        dataIndex: 'metadata',
                        render: (m: Record<string, unknown>) =>
                            Object.keys(m || {}).length ? (
                                <Tooltip title={<pre style={{ margin: 0 }}>{JSON.stringify(m, null, 2)}</pre>}>
                                    <Text type="secondary" style={{ cursor: 'help' }}>
                                        {Object.keys(m).length} field(s)
                                    </Text>
                                </Tooltip>
                            ) : (
                                '—'
                            ),
                    },
                    { title: 'IP', dataIndex: 'ipAddress', render: (v: string | null) => v || '—' },
                ]}
            />
        </Space>
    );
}
