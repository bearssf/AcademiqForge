'use strict';

/**
 * Stable canonical values for profile/project dropdowns (language-agnostic).
 * Labels come from locale JSON (e.g. accountTitles.mr, searchEngineOptions.googleScholar).
 * Legacy English DB values are normalized on read; new writes store canonical keys.
 */

const LEGACY_TITLE_TO_KEY = {
  'Mr.': 'mr',
  'Mrs.': 'mrs',
  'Ms.': 'ms',
  Miss: 'miss',
  'Mx.': 'mx',
  'Dr.': 'dr',
};

const TITLE_KEYS_ORDERED = ['mr', 'mrs', 'ms', 'miss', 'mx', 'dr'];

const LEGACY_SEARCH_ENGINE_TO_KEY = {
  'Google Scholar': 'googleScholar',
  'Worldcat.org': 'worldcat',
  'PubMed Central': 'pubMedCentral',
  JSTOR: 'jstor',
  CORE: 'core',
  'Semantic Scholar': 'semanticScholar',
  ResearchGate: 'researchGate',
  'Lens.org': 'lens',
  'Other/University Specific': 'otherUniversity',
};

const SEARCH_ENGINE_KEYS_ORDERED = [
  'googleScholar',
  'worldcat',
  'pubMedCentral',
  'jstor',
  'core',
  'semanticScholar',
  'researchGate',
  'lens',
  'otherUniversity',
];

const LEGACY_PURPOSE_TO_KEY = {
  'Academic Assignment': 'academicAssignment',
  'Academic Publication': 'academicPublication',
  Conference: 'conference',
  'Dissertation/Thesis': 'dissertationThesis',
  Other: 'other',
};

const PURPOSE_KEYS_ORDERED = [
  'academicAssignment',
  'academicPublication',
  'conference',
  'dissertationThesis',
  'other',
];

function normalizeTitleToKey(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (LEGACY_TITLE_TO_KEY[s]) return LEGACY_TITLE_TO_KEY[s];
  if (TITLE_KEYS_ORDERED.includes(s)) return s;
  return '';
}

function normalizeSearchEngineToKey(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (LEGACY_SEARCH_ENGINE_TO_KEY[s]) return LEGACY_SEARCH_ENGINE_TO_KEY[s];
  if (SEARCH_ENGINE_KEYS_ORDERED.includes(s)) return s;
  return '';
}

function normalizePurposeToKey(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (LEGACY_PURPOSE_TO_KEY[s]) return LEGACY_PURPOSE_TO_KEY[s];
  if (PURPOSE_KEYS_ORDERED.includes(s)) return s;
  return '';
}

function isAllowedTitleKey(key) {
  return TITLE_KEYS_ORDERED.includes(key);
}

function isAllowedSearchEngineKey(key) {
  return SEARCH_ENGINE_KEYS_ORDERED.includes(key);
}

function isAllowedPurposeKey(key) {
  return PURPOSE_KEYS_ORDERED.includes(key);
}

module.exports = {
  TITLE_KEYS_ORDERED,
  SEARCH_ENGINE_KEYS_ORDERED,
  PURPOSE_KEYS_ORDERED,
  normalizeTitleToKey,
  normalizeSearchEngineToKey,
  normalizePurposeToKey,
  isAllowedTitleKey,
  isAllowedSearchEngineKey,
  isAllowedPurposeKey,
};
