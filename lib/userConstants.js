/** Mirrors registration rules — keep in sync with Account profile forms. */
const {
  TITLE_KEYS_ORDERED,
  SEARCH_ENGINE_KEYS_ORDERED,
} = require('./canonicalSelects');

/** @deprecated use TITLE_KEYS_ORDERED — kept name for gradual migration */
const ALLOWED_TITLES = TITLE_KEYS_ORDERED;

/** Canonical keys; labels from locales via searchEngineOptions.* */
const SEARCH_ENGINES = SEARCH_ENGINE_KEYS_ORDERED;

module.exports = { ALLOWED_TITLES, SEARCH_ENGINES, TITLE_KEYS_ORDERED, SEARCH_ENGINE_KEYS_ORDERED };
