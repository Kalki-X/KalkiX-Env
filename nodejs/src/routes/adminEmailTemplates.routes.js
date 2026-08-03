const express = require('express');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const {
    TEMPLATE_TYPES,
    listTemplates,
    getTemplate,
    updateTemplate,
    resetTemplateToDefault,
    previewTemplate,
} = require('../models/emailTemplateModel');

const router = express.Router();

// Per the feature request: both Super Admin and Admin (not Support/Finance) can view
// and customize these — unlike most of admin.routes.js, which is Super Admin only.
router.use(attachUser, requireAuth, requireRole('super_admin', 'admin'));

router.get('/', async (_req, res) => {
    const templates = await listTemplates();
    res.json({ ok: true, templates });
});

router.get('/:type', async (req, res) => {
    if (!TEMPLATE_TYPES.includes(req.params.type)) {
        return res.status(404).json({ ok: false, error: 'Unknown email template type' });
    }
    const template = await getTemplate(req.params.type);
    res.json({ ok: true, template });
});

router.put('/:type', async (req, res) => {
    const { type } = req.params;
    if (!TEMPLATE_TYPES.includes(type)) {
        return res.status(404).json({ ok: false, error: 'Unknown email template type' });
    }
    const { subject, body } = req.body || {};
    if (!subject || !subject.trim() || !body || !body.trim()) {
        return res.status(400).json({ ok: false, error: 'Subject and body are both required' });
    }

    const updated = await updateTemplate(type, { subject: subject.trim(), body }, req.user.id);

    await logAudit({
        userId: req.user.id,
        action: 'email_template.updated',
        entityType: 'email_template',
        entityId: type,
        metadata: { type },
        ip: clientIp(req),
    });

    res.json({ ok: true, template: updated });
});

router.post('/:type/reset', async (req, res) => {
    const { type } = req.params;
    if (!TEMPLATE_TYPES.includes(type)) {
        return res.status(404).json({ ok: false, error: 'Unknown email template type' });
    }

    const updated = await resetTemplateToDefault(type, req.user.id);

    await logAudit({
        userId: req.user.id,
        action: 'email_template.reset_to_default',
        entityType: 'email_template',
        entityId: type,
        metadata: { type },
        ip: clientIp(req),
    });

    res.json({ ok: true, template: updated });
});

// Renders with sample/dummy data — either the saved template, or (if subject/body are
// passed in the request body) an in-progress edit the admin hasn't saved yet, so they
// can preview before committing.
router.post('/:type/preview', async (req, res) => {
    const { type } = req.params;
    if (!TEMPLATE_TYPES.includes(type)) {
        return res.status(404).json({ ok: false, error: 'Unknown email template type' });
    }
    const { subject, body } = req.body || {};
    const preview = await previewTemplate(type, { subject, body });
    res.json({ ok: true, preview });
});

module.exports = router;
