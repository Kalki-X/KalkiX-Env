const express = require('express');
const multer = require('multer');
const { attachUser, requireAuth, requireRole } = require('../middleware/auth');
const { logAudit, clientIp } = require('../utils/audit');
const { validateImageUpload } = require('../utils/imageSpecs');
const {
    listSections,
    findSectionById,
    createSection,
    updateSection,
    setSectionImage,
    clearSectionImage,
    deleteSection,
} = require('../models/homepageSectionModel');
const { VALID_SEVERITIES, VALID_AUDIENCES, listNotices, findNoticeById, createNotice, updateNotice, deleteNotice } = require('../models/siteNoticeModel');

const router = express.Router();

// Homepage content sections + site notices (Phase 12). Same RBAC as adminSite.routes.js
// (Super Admin and Admin both manage marketplace-facing content) — matches the
// established precedent for anything under "manage what the public/platform sees".
router.use(attachUser, requireAuth, requireRole('super_admin', 'admin'));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
        cb(null, true);
    },
});

// Only http(s) URLs are accepted — this ends up as an <iframe>/<video> src on the
// public homepage, so a scheme like javascript: must never be allowed through.
function isSafeVideoUrl(url) {
    if (!url) return true; // optional field
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_err) {
        return false;
    }
}

// ---------- Homepage sections ----------

router.get('/sections', async (_req, res) => {
    res.json({ ok: true, sections: await listSections({ activeOnly: false }) });
});

router.post('/sections', async (req, res) => {
    const { title, body, videoUrl, sortOrder } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ ok: false, error: 'title is required' });
    if (!isSafeVideoUrl(videoUrl)) return res.status(400).json({ ok: false, error: 'videoUrl must be a valid http(s) URL' });

    const section = await createSection(
        { title: title.trim(), body, videoUrl, sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined },
        req.user.id
    );
    await logAudit({ userId: req.user.id, action: 'homepage_section.created', entityType: 'homepage_section', entityId: section.id, metadata: { title: section.title }, ip: clientIp(req) });
    res.status(201).json({ ok: true, section });
});

router.patch('/sections/:id', async (req, res) => {
    const existing = await findSectionById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Section not found' });

    const { title, body, videoUrl, sortOrder, active } = req.body || {};
    if (title !== undefined && !title.trim()) return res.status(400).json({ ok: false, error: 'title cannot be empty' });
    if (videoUrl !== undefined && !isSafeVideoUrl(videoUrl)) return res.status(400).json({ ok: false, error: 'videoUrl must be a valid http(s) URL' });

    const section = await updateSection(
        req.params.id,
        { title: title?.trim(), body, videoUrl, sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined, active },
        req.user.id
    );
    await logAudit({ userId: req.user.id, action: 'homepage_section.updated', entityType: 'homepage_section', entityId: section.id, metadata: { title, sortOrder, active }, ip: clientIp(req) });
    res.json({ ok: true, section });
});

router.post('/sections/:id/image', upload.single('image'), async (req, res) => {
    const existing = await findSectionById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Section not found' });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No image file uploaded (field name must be "image")' });

    const error = validateImageUpload(req.file, 'homepageSection');
    if (error) return res.status(400).json({ ok: false, error });

    const section = await setSectionImage(req.params.id, { mimeType: req.file.mimetype, data: req.file.buffer }, req.user.id);
    await logAudit({ userId: req.user.id, action: 'homepage_section.image_updated', entityType: 'homepage_section', entityId: section.id, ip: clientIp(req) });
    res.json({ ok: true, section });
});

router.delete('/sections/:id/image', async (req, res) => {
    const existing = await findSectionById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Section not found' });

    const section = await clearSectionImage(req.params.id, req.user.id);
    await logAudit({ userId: req.user.id, action: 'homepage_section.image_removed', entityType: 'homepage_section', entityId: section.id, ip: clientIp(req) });
    res.json({ ok: true, section });
});

router.delete('/sections/:id', async (req, res) => {
    const existing = await findSectionById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Section not found' });

    await deleteSection(req.params.id);
    await logAudit({ userId: req.user.id, action: 'homepage_section.deleted', entityType: 'homepage_section', entityId: Number(req.params.id), metadata: { title: existing.title }, ip: clientIp(req) });
    res.json({ ok: true });
});

// ---------- Site notices ----------

router.get('/notices', async (_req, res) => {
    res.json({ ok: true, notices: await listNotices({ activeOnly: false }) });
});

router.post('/notices', async (req, res) => {
    const { message, severity, audience } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ ok: false, error: 'message is required' });
    if (severity !== undefined && !VALID_SEVERITIES.includes(severity)) {
        return res.status(400).json({ ok: false, error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` });
    }
    if (audience !== undefined && !VALID_AUDIENCES.includes(audience)) {
        return res.status(400).json({ ok: false, error: `audience must be one of: ${VALID_AUDIENCES.join(', ')}` });
    }

    const notice = await createNotice({ message: message.trim(), severity, audience }, req.user.id);
    await logAudit({ userId: req.user.id, action: 'site_notice.created', entityType: 'site_notice', entityId: notice.id, metadata: { severity: notice.severity, audience: notice.audience }, ip: clientIp(req) });
    res.status(201).json({ ok: true, notice });
});

router.patch('/notices/:id', async (req, res) => {
    const existing = await findNoticeById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Notice not found' });

    const { message, severity, audience, active } = req.body || {};
    if (message !== undefined && !message.trim()) return res.status(400).json({ ok: false, error: 'message cannot be empty' });
    if (severity !== undefined && !VALID_SEVERITIES.includes(severity)) {
        return res.status(400).json({ ok: false, error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` });
    }
    if (audience !== undefined && !VALID_AUDIENCES.includes(audience)) {
        return res.status(400).json({ ok: false, error: `audience must be one of: ${VALID_AUDIENCES.join(', ')}` });
    }

    const notice = await updateNotice(req.params.id, { message: message?.trim(), severity, audience, active }, req.user.id);
    await logAudit({ userId: req.user.id, action: 'site_notice.updated', entityType: 'site_notice', entityId: notice.id, metadata: { severity, audience, active }, ip: clientIp(req) });
    res.json({ ok: true, notice });
});

router.delete('/notices/:id', async (req, res) => {
    const existing = await findNoticeById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Notice not found' });

    await deleteNotice(req.params.id);
    await logAudit({ userId: req.user.id, action: 'site_notice.deleted', entityType: 'site_notice', entityId: Number(req.params.id), ip: clientIp(req) });
    res.json({ ok: true });
});

// Multer errors (oversized file, wrong mimetype) reach here as regular thrown errors.
router.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError || (err && /image files/i.test(err.message))) {
        return res.status(400).json({ ok: false, error: err.message });
    }
    next(err);
});

module.exports = router;
