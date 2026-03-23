/**
 * When enabled, saving a section draft bumps `project_sections.draft_revision` and removes
 * open suggestions tied to an older revision. Applied/ignored rows are kept.
 * Set ANVIL_DRAFT_STALE_FEEDBACK=0 or unset to restore legacy behavior (no bump / no delete).
 */
function staleFeedbackEnabled() {
  const v = process.env.ANVIL_DRAFT_STALE_FEEDBACK;
  return v === '1' || String(v || '').toLowerCase() === 'true';
}

module.exports = { staleFeedbackEnabled };
