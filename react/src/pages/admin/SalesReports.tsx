import React, { useEffect, useState } from 'react';
import { Typography, DatePicker, Select, Row, Col, Card, Statistic, Table, Alert, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { getSalesReport, SalesReport } from '../../features/admin/api/adminApi';
import { getApiErrorMessage } from '../../services/api/client';
import ExportButton from '../../components/ExportButton/ExportButton';
import { ExportColumn } from '../../utils/exportTable';

type SalesReportRow = SalesReport['series'][number];

const { Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

export default function SalesReports() {
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
    const [report, setReport] = useState<SalesReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            setReport(
                await getSalesReport({
                    from: dateRange?.[0]?.startOf('day').toISOString(),
                    to: dateRange?.[1]?.endOf('day').toISOString(),
                    groupBy,
                })
            );
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Could not load the sales report.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, groupBy]);

    // Re-fetches with the export flag set (so the backend audit-logs the export) and
    // returns the series rows for the currently selected date range/grouping.
    const fetchAllForExport = async () => {
        const result = await getSalesReport({
            from: dateRange?.[0]?.startOf('day').toISOString(),
            to: dateRange?.[1]?.endOf('day').toISOString(),
            groupBy,
            export: true,
        });
        return result.series;
    };

    const exportColumns: ExportColumn<SalesReportRow>[] = [
        { header: 'Period', accessor: (r) => dayjs(r.period).format(groupBy === 'month' ? 'MMM YYYY' : 'DD MMM YYYY') },
        { header: 'Bookings', accessor: (r) => r.bookings },
        { header: 'Revenue', accessor: (r) => `$${r.revenue.toFixed(2)}` },
    ];

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: '#2B2E4A', marginBottom: 4 }}>
                    Sales reports
                </Title>
                <Paragraph style={{ color: '#64748b' }}>
                    Revenue and booking volume from confirmed/completed bookings.
                </Paragraph>
            </div>

            <Space wrap>
                <RangePicker value={dateRange} onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)} />
                <Select value={groupBy} onChange={setGroupBy} style={{ width: 140 }}>
                    <Option value="day">By day</Option>
                    <Option value="week">By week</Option>
                    <Option value="month">By month</Option>
                </Select>
                <ExportButton
                    fetchAll={fetchAllForExport}
                    columns={exportColumns}
                    baseName="gearshare-sales-report"
                    title="GearShare — Sales Report"
                    disabled={!report}
                />
            </Space>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            {report && (
                <>
                    <Row gutter={16}>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic
                                    title="Total revenue"
                                    value={report.totals.revenue}
                                    precision={2}
                                    prefix="$"
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic title="Bookings" value={report.totals.bookings} />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic
                                    title="Average booking value"
                                    value={report.totals.averageBookingValue}
                                    precision={2}
                                    prefix="$"
                                />
                            </Card>
                        </Col>
                    </Row>

                    <Table
                        rowKey="period"
                        loading={loading}
                        dataSource={report.series}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        columns={[
                            {
                                title: 'Period',
                                dataIndex: 'period',
                                render: (v: string) =>
                                    dayjs(v).format(groupBy === 'month' ? 'MMM YYYY' : 'DD MMM YYYY'),
                            },
                            { title: 'Bookings', dataIndex: 'bookings' },
                            {
                                title: 'Revenue',
                                dataIndex: 'revenue',
                                render: (v: number) => `$${v.toFixed(2)}`,
                            },
                        ]}
                    />
                </>
            )}
        </Space>
    );
}
