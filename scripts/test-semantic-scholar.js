#!/usr/bin/env node
/**
 * Quick check that Semantic Scholar search works from this machine (rate limit + timeout apply).
 * Usage: node scripts/test-semantic-scholar.js
 * Requires: network; optional SEMANTIC_SCHOLAR_API_KEY in .env (loaded via dotenv from project root).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { searchPapers } = require('../lib/semanticScholar');

(async function main() {
  try {
    const r = await searchPapers('machine learning survey', { limit: 3 });
    console.log('papers:', r.papers.length, 'total:', r.total);
    r.papers.forEach(function (p, i) {
      console.log(i + 1 + '.', p.title || '(no title)', '-', p.year || '?');
    });
    if (!r.papers.length) {
      console.warn('No papers returned (query may be too narrow or API empty).');
    }
    process.exit(0);
  } catch (e) {
    console.error('FAILED:', e.message || e);
    process.exit(1);
  }
})();
