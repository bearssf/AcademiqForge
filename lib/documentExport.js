const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

/**
 * Strip Quill/HTML to plain lines for .txt / .docx.
 */
function htmlToPlainLines(html) {
  if (html == null || !String(html).trim()) return [];
  let s = String(html);
  s = s.replace(/<\/p>/gi, '\n');
  s = s.replace(/<\/li>/gi, '\n');
  s = s.replace(/<\/h[1-6][^>]*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&quot;/g, '"');
  return s
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function sanitizeFilename(name) {
  const base = String(name || 'export')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return base || 'export';
}

function buildPlainTextForProject(projectName, sections) {
  const lines = [];
  lines.push(String(projectName || 'Project'));
  lines.push('');
  (sections || []).forEach(function (sec) {
    lines.push(String(sec.title || 'Section'));
    lines.push('');
    htmlToPlainLines(sec.body).forEach(function (line) {
      lines.push(line);
    });
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

function paragraphChildrenFromHtml(html) {
  const lines = htmlToPlainLines(html);
  if (!lines.length) {
    return [new Paragraph({ children: [new TextRun('')] })];
  }
  return lines.map(function (line) {
    return new Paragraph({ children: [new TextRun(line)] });
  });
}

async function buildSectionDocxBuffer({ title, html }) {
  const heading = String(title || 'Section').trim() || 'Section';
  const bodyChildren = paragraphChildrenFromHtml(html);
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(heading)],
    }),
    ...bodyChildren,
  ];
  const doc = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

async function buildProjectDocxBuffer({ projectName, sections }) {
  const title = String(projectName || 'Project').trim() || 'Project';
  const flat = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(title)],
    }),
  ];
  for (let i = 0; i < (sections || []).length; i++) {
    const sec = sections[i];
    flat.push(new Paragraph({ text: '' }));
    flat.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(String(sec.title || 'Section'))],
      })
    );
    paragraphChildrenFromHtml(sec.body).forEach((p) => flat.push(p));
  }
  const doc = new Document({
    sections: [{ children: flat }],
  });
  return Packer.toBuffer(doc);
}

function contentDispositionAttachment(filename) {
  const f = String(filename);
  const ascii = f.replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f)}`;
}

module.exports = {
  htmlToPlainLines,
  sanitizeFilename,
  buildPlainTextForProject,
  buildSectionDocxBuffer,
  buildProjectDocxBuffer,
  contentDispositionAttachment,
};
