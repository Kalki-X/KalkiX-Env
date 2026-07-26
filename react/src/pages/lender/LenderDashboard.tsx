import React from "react";
import { AppstoreAddOutlined, CalendarOutlined, EnvironmentOutlined } from "@ant-design/icons";
import ComingSoon from "../../components/ComingSoon/ComingSoon";

export default function LenderDashboard() {
    return (
        <ComingSoon
            heading="Lender"
            subheading="List items, manage availability, and track incoming bookings."
            phaseLabel="Phase 5"
            features={[
                { icon: <AppstoreAddOutlined />, title: "My listings", desc: "Add, edit, pause, or archive items you're lending out." },
                { icon: <CalendarOutlined />, title: "Availability & bookings", desc: "Set availability windows and review incoming booking requests." },
                { icon: <EnvironmentOutlined />, title: "Pickup location", desc: "Set pickup / pin location and contact details per listing." },
            ]}
        />
    );
}
