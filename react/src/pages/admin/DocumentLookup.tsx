import React, { useState } from 'react';
import { Typography, Input, Button, Alert, Card, Descriptions, Space, Tag } from 'antd';
import { SearchOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { lookupDocument, DocumentLookupResult } from '../../features/admin/api/adminApi';
import { getApiErrorMessage } from '../../services/api/client';

const { Title, Paragraph } = Typography;

const TYPE_LABEL: Record<DocumentLookupResult['type'], string> = {
    proforma_invoice: 'Proforma Invoice',
    invoice: 'Invoice',
    credit_note: 'Credit Note',
};

export default function DocumentLookup() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [result, setResult] = useState<DocumentLookupResult | null>(null);

    const onSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setErrorMessage(null);
        setResult(null);
        try {
            setResult(await lookupDocument(query.trim()));
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'No document found with that reference number.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: '#2B2E4A', marginBottom: 4 }}>
                    Document lookup
                </Title>
                <Paragraph style={{ color: '#64748b' }}>
                    Find any proforma invoice, invoice, or credit note by its reference number.
                </Paragraph>
            </div>

            <Space.Compact style={{ width: '100%', maxWidth: 480 }}>
                <Input
                    size="large"
                    placeholder="e.g. INV-000123"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onPressEnter={onSearch}
                />
                <Button type="primary" size="large" icon={<SearchOutlined />} loading={loading} onClick={onSearch}>
                    Search
                </Button>
            </Space.Compact>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            {result && (
                <Card
                    id="document-lookup-result"
                    title={
                        <Space>
                            <span>{result.documentNumber}</span>
                            <Tag color="blue">{TYPE_LABEL[result.type]}</Tag>
                        </Space>
                    }
                    extra={
                        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                            Print / Save as PDF
                        </Button>
                    }
                >
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="Amount">
                            {result.currency} {result.amount.toFixed(2)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Issued">
                            {dayjs(result.issuedAt).format('DD MMM YYYY, HH:mm')}
                        </Descriptions.Item>
                        <Descriptions.Item label="Booking #">{result.booking.id}</Descriptions.Item>
                        <Descriptions.Item label="Booking status">
                            <Tag>{result.booking.status}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Booking dates">
                            {dayjs(result.booking.startDate).format('DD MMM YYYY')} –{' '}
                            {dayjs(result.booking.endDate).format('DD MMM YYYY')}
                        </Descriptions.Item>
                        <Descriptions.Item label="Item">{result.item.title}</Descriptions.Item>
                        <Descriptions.Item label="Renter">
                            {result.renter.name} ({result.renter.email})
                        </Descriptions.Item>
                        <Descriptions.Item label="Lender">
                            {result.owner.name} ({result.owner.email})
                        </Descriptions.Item>
                    </Descriptions>
                </Card>
            )}
        </Space>
    );
}
