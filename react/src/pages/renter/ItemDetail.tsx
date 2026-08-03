import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Typography, Card, Image, Space, Tag, Button, DatePicker, Alert, Spin, Row, Col, message } from "antd";
import { EnvironmentOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import {
    Item,
    ItemImage,
    UnavailableRange,
    getItem,
    listItemImages,
    itemImageUrl,
    getAvailability,
} from "../../features/listings/api/listingsApi";
import { createBooking } from "../../features/bookings/api/bookingsApi";
import { getApiErrorMessage } from "../../services/api/client";

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

// Leaflet only needs to load for pages that actually render a map — see the identical
// note on the Lender listing form.
const LocationPicker = React.lazy(() => import("../../components/LocationPicker/LocationPicker"));

function daysBetween(start: Dayjs, end: Dayjs): number {
    return Math.max(1, end.diff(start, "day") + 1); // inclusive, matches the backend's daysBetween
}

export default function ItemDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const itemId = Number(id);

    const [item, setItem] = useState<Item | null>(null);
    const [images, setImages] = useState<ItemImage[]>([]);
    const [unavailable, setUnavailable] = useState<UnavailableRange[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [booking, setBooking] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setErrorMessage(null);
        const from = dayjs().format("YYYY-MM-DD");
        const to = dayjs().add(1, "year").format("YYYY-MM-DD");
        Promise.all([getItem(itemId), listItemImages(itemId), getAvailability(itemId, { from, to })])
            .then(([itemRes, imagesRes, availabilityRes]) => {
                setItem(itemRes);
                setImages(imagesRes);
                setUnavailable(availabilityRes);
            })
            .catch((err) => setErrorMessage(getApiErrorMessage(err, "Could not load this listing.")))
            .finally(() => setLoading(false));
    }, [itemId]);

    const isDateUnavailable = (d: Dayjs) => {
        if (d.isBefore(dayjs().startOf("day"))) return true;
        return unavailable.some((u) => !d.isBefore(dayjs(u.startDate)) && !d.isAfter(dayjs(u.endDate)));
    };

    // Also blocks a range that merely spans over an unavailable day in the middle,
    // even if the start/end days themselves are pickable.
    const rangeCrossesUnavailable = (start: Dayjs, end: Dayjs) => {
        let cursor = start;
        while (!cursor.isAfter(end)) {
            if (isDateUnavailable(cursor)) return true;
            cursor = cursor.add(1, "day");
        }
        return false;
    };

    const onBook = async () => {
        if (!range) return;
        const [start, end] = range;
        if (rangeCrossesUnavailable(start, end)) {
            setBookingError("Those dates overlap something already booked or blocked — pick a different range.");
            return;
        }
        setBooking(true);
        setBookingError(null);
        try {
            await createBooking({
                itemId,
                startDate: start.format("YYYY-MM-DD"),
                endDate: end.format("YYYY-MM-DD"),
            });
            message.success("Booking requested — head to My Bookings to complete payment.");
            navigate("/renter/bookings");
        } catch (err) {
            setBookingError(getApiErrorMessage(err, "Could not create this booking."));
        } finally {
            setBooking(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
            </div>
        );
    }

    if (errorMessage || !item) {
        return <Alert type="error" showIcon message={errorMessage || "Listing not found."} />;
    }

    const days = range ? daysBetween(range[0], range[1]) : 0;
    const total = days * item.pricePerDay;

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate("/renter/browse")}
                style={{ paddingLeft: 0 }}
            >
                Back to browse
            </Button>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={14}>
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                        {images.length > 0 ? (
                            <Image.PreviewGroup>
                                <Space wrap>
                                    {images.map((img) => (
                                        <Image
                                            key={img.id}
                                            src={itemImageUrl(item.id, img.id)}
                                            width={140}
                                            height={140}
                                            style={{ objectFit: "cover", borderRadius: 8 }}
                                        />
                                    ))}
                                </Space>
                            </Image.PreviewGroup>
                        ) : (
                            <div
                                style={{
                                    height: 200,
                                    background: "#eef3fb",
                                    borderRadius: 8,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#94a3b8",
                                }}
                            >
                                No photos yet
                            </div>
                        )}

                        <div>
                            <Title level={2} style={{ color: "#2B2E4A", marginBottom: 4 }}>
                                {item.title}
                            </Title>
                            {item.category && <Tag>{item.category}</Tag>}
                            <Paragraph style={{ color: "#334155", marginTop: 12 }}>
                                {item.description || "No description provided."}
                            </Paragraph>
                        </div>

                        {item.pickupAddress && (
                            <Card size="small" title={<Space><EnvironmentOutlined /> Pickup location</Space>}>
                                <Paragraph style={{ marginBottom: item.pickupLat !== null ? 12 : 0 }}>
                                    {item.pickupAddress}
                                </Paragraph>
                                {item.pickupLat !== null && item.pickupLng !== null && (
                                    <React.Suspense fallback={<Spin />}>
                                        <LocationPicker lat={item.pickupLat} lng={item.pickupLng} readOnly height={220} />
                                    </React.Suspense>
                                )}
                            </Card>
                        )}
                    </Space>
                </Col>

                <Col xs={24} md={10}>
                    <Card>
                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                            <Text style={{ fontSize: 22, fontWeight: 700, color: "#2B2E4A" }}>
                                {item.currency} {item.pricePerDay.toFixed(2)} <Text style={{ fontSize: 14, fontWeight: 400, color: "#64748b" }}>/ day</Text>
                            </Text>

                            {bookingError && <Alert type="error" showIcon message={bookingError} />}

                            <div>
                                <Text style={{ display: "block", marginBottom: 8 }}>Select rental dates</Text>
                                <RangePicker
                                    style={{ width: "100%" }}
                                    value={range}
                                    onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
                                    disabledDate={isDateUnavailable}
                                />
                            </div>

                            {range && (
                                <Space direction="vertical" size={4}>
                                    <Text>
                                        {days} day{days === 1 ? "" : "s"} × {item.currency} {item.pricePerDay.toFixed(2)}
                                    </Text>
                                    <Text strong style={{ fontSize: 18 }}>
                                        Total: {item.currency} {total.toFixed(2)}
                                    </Text>
                                </Space>
                            )}

                            <Button type="primary" size="large" block loading={booking} disabled={!range} onClick={onBook}>
                                Request booking
                            </Button>
                            <Text style={{ color: "#94a3b8", fontSize: 12 }}>
                                A proforma invoice is issued immediately. You'll pay from My Bookings to confirm.
                            </Text>
                        </Space>
                    </Card>
                </Col>
            </Row>
        </Space>
    );
}
