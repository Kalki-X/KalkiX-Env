import React from "react";
import { SearchOutlined, HistoryOutlined, FileTextOutlined } from "@ant-design/icons";
import ComingSoon from "../../components/ComingSoon/ComingSoon";

export default function RenterDashboard() {
    return (
        <ComingSoon
            heading="Renter"
            subheading="Browse items, book rentals, and keep track of your bookings and documents."
            phaseLabel="Phase 5"
            features={[
                { icon: <SearchOutlined />, title: "Browse & filter", desc: "Search and filter items available to rent." },
                { icon: <HistoryOutlined />, title: "Past & upcoming bookings", desc: "Track your rental history and active bookings." },
                { icon: <FileTextOutlined />, title: "My documents", desc: "Proforma invoices, invoices, and credit notes for your bookings." },
            ]}
        />
    );
}
