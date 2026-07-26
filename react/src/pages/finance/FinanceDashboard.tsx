import React from "react";
import { DollarOutlined, FileTextOutlined, BankOutlined } from "@ant-design/icons";
import ComingSoon from "../../components/ComingSoon/ComingSoon";

export default function FinanceDashboard() {
    return (
        <ComingSoon
            heading="Finance"
            subheading="Tools to manage the GearShare account and reconcile platform payments."
            phaseLabel="Phase 4"
            features={[
                { icon: <DollarOutlined />, title: "Payment management", desc: "Review payments, refunds, and payouts across all bookings." },
                { icon: <FileTextOutlined />, title: "Document access", desc: "Pull invoices and credit notes for filing and reconciliation." },
                { icon: <BankOutlined />, title: "Returns / reporting", desc: "Export the data needed to file returns." },
            ]}
        />
    );
}
