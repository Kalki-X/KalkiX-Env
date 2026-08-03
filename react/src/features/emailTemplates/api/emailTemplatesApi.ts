import { apiClient } from "../../../services/api/client";

// Mirrors the 7 fixed types in nodejs/src/models/emailTemplateModel.js's TEMPLATE_METADATA.
// Keep this list in sync if a new templated email is ever added on the backend.
export type EmailTemplateType =
    | "password_reset"
    | "welcome"
    | "staff_credentials"
    | "booking_requested"
    | "booking_approved"
    | "booking_rejected"
    | "booking_cancelled";

export interface EmailTemplate {
    type: EmailTemplateType;
    label: string;
    description: string;
    placeholders: string[];
    subject: string;
    body: string;
    updatedAt: string;
    updatedBy: number | null;
    isDefault: boolean;
}

export interface EmailTemplatePreview {
    subject: string;
    html: string;
}

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
    const { data } = await apiClient.get("/api/admin/email-templates");
    return data.templates as EmailTemplate[];
}

export async function getEmailTemplate(type: EmailTemplateType): Promise<EmailTemplate> {
    const { data } = await apiClient.get(`/api/admin/email-templates/${type}`);
    return data.template as EmailTemplate;
}

export async function updateEmailTemplate(
    type: EmailTemplateType,
    payload: { subject: string; body: string }
): Promise<EmailTemplate> {
    const { data } = await apiClient.put(`/api/admin/email-templates/${type}`, payload);
    return data.template as EmailTemplate;
}

export async function resetEmailTemplate(type: EmailTemplateType): Promise<EmailTemplate> {
    const { data } = await apiClient.post(`/api/admin/email-templates/${type}/reset`);
    return data.template as EmailTemplate;
}

// Renders sample/dummy data through either the saved template (omit `override`) or an
// in-progress, not-yet-saved subject/body the admin is currently editing.
export async function previewEmailTemplate(
    type: EmailTemplateType,
    override?: { subject?: string; body?: string }
): Promise<EmailTemplatePreview> {
    const { data } = await apiClient.post(`/api/admin/email-templates/${type}/preview`, override || {});
    return data.preview as EmailTemplatePreview;
}
