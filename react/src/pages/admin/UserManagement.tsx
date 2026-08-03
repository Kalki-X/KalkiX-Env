import React, { useEffect, useState } from 'react';
import {
    Typography,
    Input,
    Select,
    Table,
    Tag,
    Button,
    Modal,
    Form,
    Checkbox,
    Alert,
    Space,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import {
    listUsers,
    updateUser,
    PlatformUser,
    UserRole,
    UserStatus,
    UpdateUserPayload,
} from '../../features/admin/api/adminApi';
import { getApiErrorMessage } from '../../services/api/client';
import ExportButton from '../../components/ExportButton/ExportButton';
import { ExportColumn } from '../../utils/exportTable';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const ROLE_COLOR: Record<UserRole, string> = {
    super_admin: 'gold',
    admin: 'blue',
    support: 'cyan',
    finance: 'green',
    platform_user: 'default',
};

const STATUS_COLOR: Record<UserStatus, string> = {
    active: 'success',
    suspended: 'warning',
    deactivated: 'error',
};

export default function UserManagement() {
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState('');
    const [role, setRole] = useState<UserRole | undefined>(undefined);
    const [status, setStatus] = useState<UserStatus | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
    const [form] = Form.useForm<UpdateUserPayload>();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const result = await listUsers({ search: search || undefined, role, status, page, pageSize });
            setUsers(result.users);
            setTotal(result.total);
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, 'Could not load users.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, role, status]);

    const onSearch = () => {
        setPage(1);
        load();
    };

    // Fetches every user matching the current search/role/status filters (not just
    // the current page) so exports reflect the full filtered result set.
    const fetchAllForExport = async () => {
        const result = await listUsers({ search: search || undefined, role, status, page: 1, pageSize: 5000, export: true });
        return result.users;
    };

    const exportColumns: ExportColumn<PlatformUser>[] = [
        { header: 'Name', accessor: (u) => `${u.firstName} ${u.lastName}` },
        { header: 'Email', accessor: (u) => u.email },
        { header: 'Role', accessor: (u) => u.role },
        { header: 'Renter', accessor: (u) => (u.isRenter ? 'Yes' : 'No') },
        { header: 'Lender', accessor: (u) => (u.isLender ? 'Yes' : 'No') },
        { header: 'Status', accessor: (u) => u.status },
        { header: 'Created', accessor: (u) => dayjs(u.createdAt).format('DD MMM YYYY') },
    ];

    const openEdit = (user: PlatformUser) => {
        setEditingUser(user);
        setSaveError(null);
        form.setFieldsValue({
            role: user.role,
            isRenter: user.isRenter,
            isLender: user.isLender,
            status: user.status,
        });
    };

    const onSave = async (values: UpdateUserPayload) => {
        if (!editingUser) return;
        setSaving(true);
        setSaveError(null);
        try {
            await updateUser(editingUser.id, values);
            setEditingUser(null);
            load();
        } catch (err) {
            setSaveError(getApiErrorMessage(err, 'Could not save changes.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Title level={2} style={{ color: 'var(--gs-heading)', marginBottom: 4 }}>
                    Role management
                </Title>
                <Paragraph style={{ color: 'var(--color-muted)' }}>
                    Search platform users, change roles/capabilities, and suspend or reactivate accounts.
                </Paragraph>
            </div>

            <Space wrap>
                <Input.Search
                    placeholder="Search by name or email"
                    allowClear
                    style={{ width: 280 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onSearch={onSearch}
                />
                <Select
                    allowClear
                    placeholder="Role"
                    style={{ width: 160 }}
                    value={role}
                    onChange={(v) => {
                        setPage(1);
                        setRole(v);
                    }}
                >
                    <Option value="super_admin">Super Admin</Option>
                    <Option value="admin">Admin</Option>
                    <Option value="support">Support</Option>
                    <Option value="finance">Finance</Option>
                    <Option value="platform_user">Platform User</Option>
                </Select>
                <Select
                    allowClear
                    placeholder="Status"
                    style={{ width: 160 }}
                    value={status}
                    onChange={(v) => {
                        setPage(1);
                        setStatus(v);
                    }}
                >
                    <Option value="active">Active</Option>
                    <Option value="suspended">Suspended</Option>
                    <Option value="deactivated">Deactivated</Option>
                </Select>
                <ExportButton
                    fetchAll={fetchAllForExport}
                    columns={exportColumns}
                    baseName="gearshare-users"
                    title="GearShare — Platform Users"
                />
            </Space>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Table<PlatformUser>
                rowKey="id"
                loading={loading}
                dataSource={users}
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
                        title: 'Name',
                        key: 'name',
                        render: (_, u) => `${u.firstName} ${u.lastName}`,
                    },
                    { title: 'Email', dataIndex: 'email' },
                    {
                        title: 'Role',
                        dataIndex: 'role',
                        render: (r: UserRole) => <Tag color={ROLE_COLOR[r]}>{r.replace('_', ' ')}</Tag>,
                    },
                    {
                        title: 'Capabilities',
                        key: 'capabilities',
                        render: (_, u) => (
                            <Space size={4}>
                                {u.isRenter && <Tag>Renter</Tag>}
                                {u.isLender && <Tag>Lender</Tag>}
                            </Space>
                        ),
                    },
                    {
                        title: 'Status',
                        dataIndex: 'status',
                        render: (s: UserStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
                    },
                    {
                        title: '',
                        key: 'actions',
                        render: (_, u) => (
                            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)}>
                                Edit
                            </Button>
                        ),
                    },
                ]}
            />

            <Modal
                title={editingUser ? `Edit ${editingUser.firstName} ${editingUser.lastName}` : ''}
                open={!!editingUser}
                onCancel={() => setEditingUser(null)}
                onOk={() => form.submit()}
                confirmLoading={saving}
                okText="Save changes"
            >
                {saveError && <Alert type="error" showIcon message={saveError} style={{ marginBottom: 16 }} />}
                <Form form={form} layout="vertical" onFinish={onSave}>
                    <Form.Item label="Role" name="role" rules={[{ required: true }]}>
                        <Select>
                            <Option value="super_admin">Super Admin</Option>
                            <Option value="admin">Admin</Option>
                            <Option value="support">Support</Option>
                            <Option value="finance">Finance</Option>
                            <Option value="platform_user">Platform User</Option>
                        </Select>
                    </Form.Item>
                    <Space size="large">
                        <Form.Item name="isRenter" valuePropName="checked" style={{ marginBottom: 0 }}>
                            <Checkbox>Renter capability</Checkbox>
                        </Form.Item>
                        <Form.Item name="isLender" valuePropName="checked" style={{ marginBottom: 0 }}>
                            <Checkbox>Lender capability</Checkbox>
                        </Form.Item>
                    </Space>
                    <Form.Item label="Status" name="status" rules={[{ required: true }]} style={{ marginTop: 16 }}>
                        <Select>
                            <Option value="active">Active</Option>
                            <Option value="suspended">Suspended</Option>
                            <Option value="deactivated">Deactivated</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </Space>
    );
}
