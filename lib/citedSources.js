const { plainLinesFromSectionBody } = require('./documentExport');

function sectionPlainFromBody(body) {
  return plainLinesFromSectionBody(body != null ? String(body) : '').join('\n\n').trim();
}

function findReferencesSection(sections) {
  if (!sections || !sections.length) return null;
  for (const s of sections) {
    const slug = String(s.slug || '').toLowerCase();
    const title = String(s.title || '').trim().toLowerCase();
    if (
      slug === 'references' ||
      slug === 'works-cited' ||
      slug === 'bibliography' ||
      title === 'references' ||
      title === 'works cited' ||
      title === 'bibliography'
    ) {
      return s;
    }
  }
  return null;
}

/** Combined plain text from all sections except the References row (avoids self-matching). */
function combinedDraftPlainExcludingReferences(bundle) {
  const ref = findReferencesSection(bundle.sections);
  const excludeId = ref ? Number(ref.id) : null;
  const parts = [];
  for (const sec of bundle.sections || []) {
    if (excludeId != null && Number(sec.id) === excludeId) continue;
    const p = sectionPlainFromBody(sec.body);
    if (p) parts.push(p);
  }
  return parts.join('\n\n');
}

function extractYear(citationText) {
  const m = String(citationText || '').match(/\b(19\d{2}|20\d{2})\b/);
  return m ? m[1] : '';
}

function extractAuthorLastName(citationText) {
  const s = String(citationText || '').trim();
  let m = s.match(/^\s*([A-Za-z][A-Za-z'\-]+),/);
  if (m) return m[1];
  m = s.match(/^\s*([A-Za-z][A-Za-z'\-]+)\s+(?:&|and)\s+/i);
  if (m) return m[1];
  m = s.match(/^([A-Za-z][A-Za-z'\-]+)\s+/);
  if (m) return m[1];
  return 'Source';
}

function buildInTextCitation(citationText, styleRaw, ieeeIndex) {
  const style = String(styleRaw || 'APA').toUpperCase();
  const author = extractAuthorLastName(citationText);
  const year = extractYear(citationText) || 'n.d.';
  if (style === 'IEEE') {
    return '[' + ieeeIndex + ']';
  }
  if (style === 'MLA') {
    return '(' + author + ')';
  }
  if (style === 'CHICAGO' || style === 'TURABIAN') {
    return '(' + author + ' ' + year + ')';
  }
  return '(' + author + ', ' + year + ')';
}

/**
 * Sources linked in Crucible (≥1 section) that appear cited in non-References sections.
 * @returns {Array<object>} source rows (DB shape), ordered for bibliography (IEEE: order of appearance; else alphabetical by author).
 */
function findCitedLinkedSources(sources, bundle, citationStyle) {
  const combined = combinedDraftPlainExcludingReferences(bundle);
  if (!String(combined).trim()) return [];

  const style = String(citationStyle || 'APA').toUpperCase();
  const plainLower = combined.toLowerCase();

  const linked = (sources || []).filter((s) => (s.sectionIds || []).length > 0);
  const globalOrder = linked.slice().sort((a, b) => {
    const oa = a.sort_order != null ? a.sort_order : 0;
    const ob = b.sort_order != null ? b.sort_order : 0;
    if (oa !== ob) return oa - ob;
    return a.id - b.id;
  });

  const scored = [];

  for (let i = 0; i < globalOrder.length; i += 1) {
    const src = globalOrder[i];
    const cite = String(src.citation_text || '').trim();
    if (cite.length < 3) continue;

    let firstIndex = Infinity;

    const chunk = cite.length > 100 ? cite.slice(0, 100) : cite;
    const idxSub = plainLower.indexOf(chunk.toLowerCase());
    if (idxSub >= 0) firstIndex = Math.min(firstIndex, idxSub);

    const preview = buildInTextCitation(cite, style, i + 1);
    const idxPrev = plainLower.indexOf(preview.toLowerCase());
    if (idxPrev >= 0) firstIndex = Math.min(firstIndex, idxPrev);

    if (style === 'IEEE') {
      const re = new RegExp('\\[' + (i + 1) + '\\]');
      const m = combined.match(re);
      if (m && m.index != null) firstIndex = Math.min(firstIndex, m.index);
    }

    if (firstIndex !== Infinity) {
      scored.push({ src, firstIndex });
    }
  }

  if (!scored.length) return [];

  let ordered;
  if (style === 'IEEE') {
    ordered = scored.slice().sort((a, b) => a.firstIndex - b.firstIndex || a.src.id - b.src.id);
  } else {
    ordered = scored.slice().sort((a, b) =>
      extractAuthorLastName(a.src.citation_text).localeCompare(
        extractAuthorLastName(b.src.citation_text),
        undefined,
        { sensitivity: 'base' }
      )
    );
  }

  return ordered.map((x) => x.src);
}

module.exports = {
  findReferencesSection,
  combinedDraftPlainExcludingReferences,
  findCitedLinkedSources,
  extractAuthorLastName,
  extractYear,
};
