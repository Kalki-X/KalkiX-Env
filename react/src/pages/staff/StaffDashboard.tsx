import React from "react";
import { TeamOutlined, FileSearchOutlined, BugOutlined } from "@ant-design/icons";
import ComingSoon from "../../components/ComingSoon/ComingSoon";

export default function StaffDashboard() {
    return (
        <ComingSoon
            heading="Admin & Support"
            subheading="User management and platform oversight tools for this account."
            phaseLabel="Phase 3"
            features={[
                { icon: <TeamOutlined />, title: "User management", desc: "Look up, suspend, or reactivate platform users." },
                { icon: <FileSearchOutlined />, title: "View any document", desc: "Look up proforma invoices, invoices, and credit notes for support cases." },
                { icon: <BugOutlined />, title: "System error reports", desc: "Surfaced backend errors for triage." },
            ]}
        />
    );
}
