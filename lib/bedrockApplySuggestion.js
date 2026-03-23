const { invokeClaudeMessages, draftPlainFromHtml } = require('./bedrockReview');

const MAX_HTML_CHARS = 120000;
const MAX_SUGGESTION_CHARS = 8000;
const MIN_PLAIN_CHARS = 5;

function stripScripts(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
}

function parseApplyJsonFromModelText(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  let parsed;
  try {
    parsed = JSON.parse(t);
  } catch (e) {
    const i = t.indexOf('{');
    const j = t.lastIndexOf('}');
    if (i >= 0 && j > i) {
      parsed = JSON.parse(t.slice(i, j + 1));
    } else {
      throw new Error('Model did not return valid JSON');
    }
  }
  return parsed;
}

function buildApplyPrompt({ sectionTitle, citationStyle, draftHtml, suggestionText }) {
  const title = String(sectionTitle || 'Section').trim() || 'Section';
  const style = String(citationStyle || 'APA').trim() || 'APA';
  return `You are revising academic draft content in HTML as used inside a rich text editor (paragraphs, lists, bold, links, headings).

Section title: ${title}
Citation style (preserve in-text and reference conventions where present): ${style}

The author wants this feedback applied to the draft:
"""
${suggestionText}
"""

Current draft HTML (return the full revised HTML for the entire draft, same overall structure as the input):
"""
${draftHtml}
"""

Return ONLY a JSON object with a single key "html" whose value is the complete revised HTML. No markdown fences, no commentary outside the JSON.

If you cannot apply the suggestion safely, return: {"error":"brief reason"}`;
}

/**
 * @param {{ html: string, suggestionText: string, sectionTitle?: string, citationStyle?: string }} opts
 * @returns {Promise<{ html: string }>}
 */
async function applySuggestionToDraftHtml(opts) {
  const suggestionText = String(opts.suggestionText || '').trim().slice(0, MAX_SUGGESTION_CHARS);
  if (!suggestionText) {
    throw new Error('Empty suggestion');
  }

  const htmlIn = String(opts.html != null ? opts.html : '').slice(0, MAX_HTML_CHARS);
  const plain = draftPlainFromHtml(htmlIn);
  if (plain.length < MIN_PLAIN_CHARS) {
    throw new Error('Draft is too short to revise');
  }

  const prompt = buildApplyPrompt({
    sectionTitle: opts.sectionTitle,
    citationStyle: opts.citationStyle,
    draftHtml: htmlIn,
    suggestionText,
  });

  const assistantText = await invokeClaudeMessages(prompt, { maxTokens: 8192, temperature: 0.15 });
  const parsed = parseApplyJsonFromModelText(assistantText);

  if (parsed && parsed.error) {
    throw new Error(String(parsed.error));
  }
  if (!parsed || typeof parsed.html !== 'string' || !String(parsed.html).trim()) {
    throw new Error('Model did not return revised html');
  }

  return { html: stripScripts(parsed.html) };
}

module.exports = {
  applySuggestionToDraftHtml,
};
