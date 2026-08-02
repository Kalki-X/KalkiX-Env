import React, { useEffect, useState } from "react";
import { List, Tag, Button, DatePicker, Input, Space, Popconfirm, message, Empty, Spin } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import {
    UnavailableRange,
    getAvailability,
    addAvailabilityBlock,
    removeAvailabilityBlock,
} from "../../features/listings/api/listingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { RangePicker } = DatePicker;

// Lets a lender see every date range their item is unavailable for (both bookings and
// their own blackout blocks) and add/remove blocks. Bookings show up read-only here —
// cancel the booking itself (from the Bookings page) to free those dates back up.
export default function ItemAvailabilityManager({ itemId }: { itemId: number }) {
    const [ranges, setRanges] = useState<UnavailableRange[]>([]);
    const [loading, setLoading] = useState(true);
    const [newRange, setNewRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            // Look a year ahead — plenty for a lender managing near-term availability.
            const from = dayjs().format("YYYY-MM-DD");
            const to = dayjs().add(1, "year").format("YYYY-MM-DD");
            setRanges(await getAvailability(itemId, { from, to }));
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not load availability."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId]);

    const onAddBlock = async () => {
        if (!newRange) return;
        setSaving(true);
        try {
            await addAvailabilityBlock(itemId, {
                startDate: newRange[0].format("YYYY-MM-DD"),
                endDate: newRange[1].format("YYYY-MM-DD"),
                reason: reason || undefined,
            });
            setNewRange(null);
            setReason("");
            message.success("Dates blocked.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not block those dates."));
        } finally {
            setSaving(false);
        }
    };

    const onRemoveBlock = async (blockId: number) => {
        try {
            await removeAvailabilityBlock(itemId, blockId);
            message.success("Block removed.");
            load();
        } catch (err) {
            message.error(getApiErrorMessage(err, "Could not remove that block."));
        }
    };

    return (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Space wrap>
                <RangePicker
                    value={newRange}
                    onChange={(v) => setNewRange(v as [Dayjs, Dayjs] | null)}
                    disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
                />
                <Input
                    placeholder="Reason (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ width: 200 }}
                />
                <Button type="primary" icon={<PlusOutlined />} loading={saving} disabled={!newRange} onClick={onAddBlock}>
                    Block these dates
                </Button>
            </Space>

            {loading ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                    <Spin />
                </div>
            ) : (
                <List
                    size="small"
                    dataSource={ranges}
                    locale={{ emptyText: <Empty description="No blocked or booked dates in the next year." /> }}
                    renderItem={(r) => (
                        <List.Item
                            actions={
                                r.id !== null
                                    ? [
                                          <Popconfirm key="del" title="Remove this block?" onConfirm={() => onRemoveBlock(r.id as number)}>
                                              <Button size="small" danger icon={<DeleteOutlined />} />
                                          </Popconfirm>,
                                      ]
                                    : []
                            }
                        >
                            <Space>
                                <span>
                                    {dayjs(r.startDate).format("DD MMM YYYY")} – {dayjs(r.endDate).format("DD MMM YYYY")}
                                </span>
                                <Tag color={r.id !== null ? "default" : "processing"}>{r.reason}</Tag>
                            </Space>
                        </List.Item>
                    )}
                />
            )}
        </Space>
    );
}
