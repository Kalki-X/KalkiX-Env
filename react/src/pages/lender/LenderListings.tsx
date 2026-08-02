import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Table, Tag, Button, Space, Alert, Popconfirm, message, Avatar, Select } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import {
    Item,
    ItemStatus,
    listMyItems,
    updateItemStatus,
    deleteItem,
    itemImageUrl,
} from "../../features/listings/api/listingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph } = Typography;
const { Option } = Select;

const STATUS_COLOR: Record<ItemStatus, string> = {
    draft: "default",
    active: "success",
    paused: "warning",
    archived: "error",
};

export default function LenderListings() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            setItems(await listMyItems());
        } catch (err) {
            setErrorMessage(getApiErrorMessage(err, "Could not load your listings."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const onStatusChange = async (item: Item, status: ItemStatus) => {
        try {
            await updateItemStatus(item.id, status);
            message.success(`"${item.title}" is now ${status}.`);
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not update status."));
        }
    };

    const onDelete = async (item: Item) => {
        try {
            await deleteItem(item.id);
            message.success(`"${item.title}" deleted.`);
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not delete this listing."));
        }
    };

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
                <div>
                    <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                        My listings
                    </Title>
                    <Paragraph style={{ color: "#64748b", marginBottom: 0 }}>
                        Add, edit, pause, or archive the items you're lending out.
                    </Paragraph>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/lender/listings/new")}>
                    Add listing
                </Button>
            </Space>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Table<Item>
                rowKey="id"
                loading={loading}
                dataSource={items}
                scroll={{ x: "max-content" }}
                columns={[
                    {
                        title: "",
                        key: "thumb",
                        width: 56,
                        render: (_, item) =>
                            item.primaryImageId ? (
                                <Avatar shape="square" size={40} src={itemImageUrl(item.id, item.primaryImageId)} />
                            ) : (
                                <Avatar shape="square" size={40} icon={<InboxOutlined />} />
                            ),
                    },
                    { title: "Title", dataIndex: "title" },
                    { title: "Category", dataIndex: "category", render: (c: string | null) => c || "—" },
                    {
                        title: "Price/day",
                        key: "price",
                        render: (_, item) => `${item.currency} ${item.pricePerDay.toFixed(2)}`,
                    },
                    {
                        title: "Status",
                        key: "status",
                        render: (_, item) => (
                            <Select
                                size="small"
                                value={item.status}
                                style={{ width: 120 }}
                                onChange={(status) => onStatusChange(item, status)}
                            >
                                <Option value="active">
                                    <Tag color={STATUS_COLOR.active}>active</Tag>
                                </Option>
                                <Option value="paused">
                                    <Tag color={STATUS_COLOR.paused}>paused</Tag>
                                </Option>
                                <Option value="archived">
                                    <Tag color={STATUS_COLOR.archived}>archived</Tag>
                                </Option>
                            </Select>
                        ),
                    },
                    {
                        title: "",
                        key: "actions",
                        render: (_, item) => (
                            <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/lender/listings/${item.id}/edit`)}>
                                    Edit
                                </Button>
                                <Popconfirm
                                    title="Delete this listing?"
                                    description="Only possible if it has no bookings on record — otherwise archive it instead."
                                    onConfirm={() => onDelete(item)}
                                >
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]}
            />
        </Space>
    );
}
