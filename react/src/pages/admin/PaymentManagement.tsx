import React, { useEffect, useState } from 'react';
import { Typography, Select, Table, Tag, Button, Alert, Space, Popconfirm, message } from 'antd';
import dayjs from 'dayjs';
import { listPayments, refundPayment, PaymentRecord } from '../../features/admin/api/adminApi';
import { getApiErrorMessage } from '../../services/api/client';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const STATUS_COLOR: Record<PaymentRecord['status'], string> = {
    pending: 'default',
    succeeded: 'success',
    failed: 'error',
    refunded: 'warning',
};

export default function PaymentManagement() {
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [status, setStatus] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [refundingId, setRefundingId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const result = await listPayments({ status, page, pageSize });
            setPayments(result.payments);
            setTotal(result.total);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Could not load payments.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, status]);

    const onRefund = async (id: number) => {
        setRefundingId(id);
        try {
            await refundPayment(id);
            message.success('Payment marked as refunded.');
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, 'Could not refund this payment.'));
        } finally {
            setRefundingId(null);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: '#2B2E4A', marginBottom: 4 }}>
                    Payment management
                </Title>
                <Paragraph style={{ color: '#64748b' }}>
                    Every payment across the platform, with the ability to mark one as refunded.
                </Paragraph>
            </div>

            <Select
                allowClear
                placeholder="Status"
                style={{ width: 180 }}
                value={status}
                onChange={(v) => {
                    setPage(1);
                    setStatus(v);
                }}
            >
                <Option value="pending">Pending</Option>
                <Option value="succeeded">Succeeded</Option>
                <Option value="failed">Failed</Option>
                <Option value="refunded">Refunded</Option>
            </Select>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Table<PaymentRecord>
                rowKey="id"
                loading={loading}
                dataSource={payments}
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
                        title: 'Date',
                        dataIndex: 'createdAt',
                        render: (v: string) => dayjs(v).format('DD MMM YYYY, HH:mm'),
                    },
                    {
                        title: 'Item',
                        key: 'item',
                        render: (_, p) => p.item?.title ?? '—',
                    },
                    {
                        title: 'Renter',
                        key: 'renter',
                        render: (_, p) => (p.renter ? `${p.renter.name} (${p.renter.email})` : '—'),
                    },
                    {
                        title: 'Amount',
                        key: 'amount',
                        render: (_, p) => `${p.currency} ${p.amount.toFixed(2)}`,
                    },
                    { title: 'Method', dataIndex: 'method', render: (v: string | null) => v || '—' },
                    {
                        title: 'Status',
                        dataIndex: 'status',
                        render: (s: PaymentRecord['status']) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
                    },
                    {
                        title: '',
                        key: 'actions',
                        render: (_, p) =>
                            p.status === 'succeeded' ? (
                                <Popconfirm
                                    title="Mark this payment as refunded?"
                                    description="This only updates the payment record, not the booking."
                                    onConfirm={() => onRefund(p.id)}
                                >
                                    <Button size="small" loading={refundingId === p.id}>
                                        Refund
                                    </Button>
                                </Popconfirm>
                            ) : null,
                    },
                ]}
            />
        </Space>
    );
}
