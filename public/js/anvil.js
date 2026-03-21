/**
 * The Anvil — section draft editor with autosave (PATCH /api/projects/:pid/sections/:sid body).
 */
(function () {
  const root = document.getElementById('anvil-root');
  if (!root) return;

  const projectId = parseInt(root.dataset.projectId, 10);
  if (Number.isNaN(projectId)) return;

  let bundle = null;
  let selectedId = null;
  let debounceTimer = null;
  const DEBOUNCE_MS = 900;

  async function api(path, method, body) {
    const opts = {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error('Invalid response from server');
    }
    if (!res.ok) {
      const msg = (data && data.error) || res.statusText || 'Request failed';
      throw new Error(msg);
    }
    return data;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function getTextarea() {
    return document.getElementById('anvil-body');
  }

  function sectionById(id) {
    if (!bundle || !bundle.sections) return null;
    const n = Number(id);
    return bundle.sections.find(function (s) {
      return Number(s.id) === n;
    });
  }

  function setStatus(html) {
    const el = document.getElementById('anvil-status');
    if (el) el.innerHTML = html;
  }

  function setError(msg) {
    const el = document.getElementById('anvil-error');
    if (!el) return;
    if (!msg) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = msg;
  }

  async function saveDraft(reason) {
    if (selectedId == null || bundle == null) return;
    const ta = getTextarea();
    const text = ta ? ta.value : '';
    const sec = sectionById(selectedId);
    const prev = sec && sec.body != null ? String(sec.body) : '';
    if (prev === text) {
      setStatus('<span class="anvil-status-ok">Saved</span>');
      return;
    }

    setStatus('<span class="anvil-status-wait">Saving…</span>');
    setError('');
    try {
      bundle = await api(
        '/projects/' + projectId + '/sections/' + selectedId,
        'PATCH',
        { body: text }
      );
      setStatus(
        '<span class="anvil-status-ok">Saved' +
          (reason ? ' · ' + escapeHtml(reason) : '') +
          '</span>'
      );
    } catch (e) {
      setError(e.message);
      setStatus('<span class="anvil-status-err">Not saved</span>');
    }
  }

  function scheduleSave() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      saveDraft();
    }, DEBOUNCE_MS);
    setStatus('<span class="anvil-status-wait">Unsaved changes…</span>');
  }

  async function flushAndSwitch(newId) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    await saveDraft();
    selectedId = newId;
    render();
    setStatus('<span class="anvil-status-ok">Saved</span>');
  }

  function render() {
    if (!bundle) return;

    const sections = bundle.sections || [];
    if (!sections.length) {
      root.innerHTML =
        '<div class="anvil-panel"><p class="anvil-muted">No sections in this project. Add sections via your project template or create a new project.</p></div>';
      return;
    }

    if (selectedId == null) selectedId = Number(sections[0].id);

    let current = sectionById(selectedId);
    if (!current && sections.length) {
      selectedId = Number(sections[0].id);
      current = sectionById(selectedId);
    }
    const draft = current && current.body != null ? String(current.body) : '';

    let nav = '<nav class="anvil-nav" aria-label="Sections">';
    sections.forEach(function (s) {
      const sid = Number(s.id);
      const active = sid === Number(selectedId) ? ' is-active' : '';
      nav +=
        '<button type="button" class="anvil-nav-item' +
        active +
        '" data-section-id="' +
        sid +
        '">' +
        escapeHtml(s.title) +
        '</button>';
    });
    nav += '</nav>';

    const editor =
      '<div class="anvil-editor">' +
      '<label class="anvil-editor-label" for="anvil-body">Draft for <strong>' +
      escapeHtml(current ? current.title : '') +
      '</strong></label>' +
      '<textarea id="anvil-body" class="anvil-textarea" rows="18" spellcheck="true" placeholder="Write your draft here. Autosaves after you pause typing.">' +
      escapeHtml(draft) +
      '</textarea>' +
      '<div class="anvil-editor-footer">' +
      '<span id="anvil-status" class="anvil-status"><span class="anvil-status-ok">Saved</span></span>' +
      '<button type="button" class="anvil-save-now" id="anvil-save-now">Save now</button>' +
      '</div>' +
      '<div id="anvil-error" class="anvil-error-banner" style="display:none" role="alert"></div>' +
      '</div>';

    root.innerHTML =
      '<div class="anvil-panel"><div class="anvil-layout">' + nav + editor + '</div></div>';

    const ta = getTextarea();
    if (ta) {
      ta.addEventListener('input', function () {
        scheduleSave();
      });
      ta.addEventListener('blur', function () {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        saveDraft('manual');
      });
    }

    root.querySelectorAll('.anvil-nav-item').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const sid = parseInt(btn.getAttribute('data-section-id'), 10);
        if (Number.isNaN(sid) || sid === Number(selectedId)) return;
        await flushAndSwitch(sid);
      });
    });

    const saveBtn = document.getElementById('anvil-save-now');
    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        await saveDraft('saved now');
      });
    }
  }

  async function load() {
    root.innerHTML = '<p class="anvil-loading">Loading workspace…</p>';
    try {
      bundle = await api('/projects/' + projectId, 'GET');
      selectedId = null;
      if (bundle.sections && bundle.sections.length) {
        selectedId = Number(bundle.sections[0].id);
      }
      render();
    } catch (e) {
      root.innerHTML =
        '<div class="anvil-panel"><p class="anvil-error-banner" role="alert">Could not load project. ' +
        escapeHtml(e.message) +
        '</p></div>';
    }
  }

  load();
})();
