import React, { useEffect, useState } from 'react';
import { Typography, Table, Tag, Alert, Space, Empty } from 'antd';
import dayjs from 'dayjs';
import { listSystemErrors, SystemError } from '../../features/admin/api/adminApi';
import { getApiErrorMessage } from '../../services/api/client';

const { Title, Paragraph, Text } = Typography;

export default function ErrorReports() {
    const [errors, setErrors] = useState<SystemError[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setErrorMessage(null);
        listSystemErrors({ page, pageSize })
            .then((result) => {
                setErrors(result.errors);
                setTotal(result.total);
            })
            .catch((err) => setErrorMessage(getApiErrorMessage(err, 'Could not load error reports.')))
            .finally(() => setLoading(false));
    }, [page, pageSize]);

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: '#2B2E4A', marginBottom: 4 }}>
                    System error reports
                </Title>
                <Paragraph style={{ color: '#64748b' }}>
                    Every unhandled 500 the API has returned, for triage.
                </Paragraph>
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Table<SystemError>
                rowKey="id"
                loading={loading}
                dataSource={errors}
                locale={{ emptyText: <Empty description="No errors recorded — good sign." /> }}
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
                expandable={{
                    expandedRowRender: (e) => (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                            {e.stack || 'No stack trace recorded.'}
                        </pre>
                    ),
                }}
                columns={[
                    {
                        title: 'Time',
                        dataIndex: 'createdAt',
                        width: 170,
                        render: (v: string) => dayjs(v).format('DD MMM YYYY, HH:mm:ss'),
                    },
                    {
                        title: 'Route',
                        key: 'route',
                        render: (_, e) => (
                            <Text code>
                                {e.method} {e.route}
                            </Text>
                        ),
                    },
                    { title: 'Message', dataIndex: 'message' },
                    {
                        title: 'Status',
                        dataIndex: 'statusCode',
                        render: (v: number | null) => (v ? <Tag color="error">{v}</Tag> : '—'),
                    },
                    { title: 'User', dataIndex: 'userId', render: (v: number | null) => (v ? `#${v}` : '—') },
                ]}
            />
        </Space>
    );
}
