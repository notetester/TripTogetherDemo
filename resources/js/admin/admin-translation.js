(function (window, document) {
    'use strict';

    const i18n = window.ADMIN_TRANSLATION_UI || {};

    function msg(key, fallback) {
        return Object.prototype.hasOwnProperty.call(i18n, key) ? i18n[key] : (fallback || key);
    }

    function escapeHtml(value) {
        if (value == null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        return date.toLocaleString(window.ADMIN_CONTEXT_LOCALE || undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    function translationOptionLabel(item) {
        const badges = [];
        badges.push((item.targetLang || '').toUpperCase());
        if (item.isPrimary) badges.push(msg('primaryShort', 'Primary'));
        if (item.outdated) badges.push(msg('outdatedShort', 'Old'));
        const versionNo = item.currentRevision && item.currentRevision.versionNo ? item.currentRevision.versionNo : '-';
        badges.push('v' + versionNo);
        return '[' + badges.join('][') + '] ' + (item.title || msg('untitled', 'Untitled'));
    }

    function renderRevisionOptions(revisions, currentRevisionIdx) {
        if (!Array.isArray(revisions) || !revisions.length) {
            return '<option value="">' + escapeHtml(msg('noRevision', 'No revisions')) + '</option>';
        }
        return revisions.map(function (revision) {
            const selected = String(revision.translationRevisionIdx) === String(currentRevisionIdx) ? ' selected' : '';
            const label = 'v' + revision.versionNo
                + ' · ' + (revision.translationType || '-')
                + ' · ' + formatDate(revision.createdAt);
            return '<option value="' + escapeHtml(revision.translationRevisionIdx) + '"' + selected + '>' + escapeHtml(label) + '</option>';
        }).join('');
    }

    function renderTranslationDetail(widget, item) {
        const container = widget.querySelector('.js-translation-detail');
        if (!container) return;
        if (!item) {
            container.innerHTML = '<div class="adm-tr-empty">' + escapeHtml(msg('noTranslationSelected', 'Select a translation')) + '</div>';
            return;
        }

        const currentRevision = item.currentRevision || {};
        const status = item.status || 'DRAFT';
        const visibility = item.visibilityScope || 'ADMIN_ONLY';
        const sourceTextSnapshot = currentRevision.sourceTextSnapshot || widget.dataset.sourceText || '';
        const translatedText = currentRevision.translatedText || '';

        container.innerHTML = ''
            + '<div class="adm-tr-detail-card">'
            + '  <div class="adm-tr-meta">'
            + '    <span class="adm-tr-pill">' + escapeHtml((item.targetLang || '').toUpperCase()) + '</span>'
            + '    <span class="adm-tr-pill">' + escapeHtml(status) + '</span>'
            + '    <span class="adm-tr-pill">' + escapeHtml(visibility) + '</span>'
            + (item.isPrimary ? '    <span class="adm-tr-pill is-primary">' + escapeHtml(msg('primary', 'Primary version')) + '</span>' : '')
            + (item.outdated ? '    <span class="adm-tr-pill is-warn">' + escapeHtml(msg('outdated', 'Source snapshot changed')) + '</span>' : '    <span class="adm-tr-pill is-ok">' + escapeHtml(msg('upToDate', 'Up to date')) + '</span>')
            + '  </div>'
            + '  <div class="adm-tr-row">'
            + '    <label class="adm-tr-label">' + escapeHtml(msg('title', 'Title')) + '</label>'
            + '    <input type="text" class="adm-input js-edit-title" value="' + escapeHtml(item.title || '') + '">'
            + '  </div>'
            + '  <div class="adm-tr-grid">'
            + '    <div>'
            + '      <label class="adm-tr-label">' + escapeHtml(msg('currentSource', 'Current source')) + '</label>'
            + '      <div class="adm-tr-source-box">' + escapeHtml(widget.dataset.sourceText || '') + '</div>'
            + '    </div>'
            + '    <div>'
            + '      <label class="adm-tr-label">' + escapeHtml(msg('basedSource', 'Base source')) + '</label>'
            + '      <div class="adm-tr-source-box">' + escapeHtml(sourceTextSnapshot) + '</div>'
            + '    </div>'
            + '  </div>'
            + '  <div class="adm-tr-row">'
            + '    <label class="adm-tr-label">' + escapeHtml(msg('translatedText', 'Translated text')) + '</label>'
            + '    <textarea class="adm-input adm-tr-textarea js-edit-text">' + escapeHtml(translatedText) + '</textarea>'
            + '  </div>'
            + '  <div class="adm-tr-row">'
            + '    <label class="adm-tr-label">' + escapeHtml(msg('note', 'Note')) + '</label>'
            + '    <textarea class="adm-input adm-tr-note js-edit-note">' + escapeHtml(currentRevision.note || '') + '</textarea>'
            + '  </div>'
            + '  <div class="adm-tr-actions">'
            + '    <label class="adm-tr-check"><input type="checkbox" class="js-edit-primary"' + (item.isPrimary ? ' checked' : '') + '> ' + escapeHtml(msg('setPrimary', 'Mark as primary')) + '</label>'
            + '    <button type="button" class="adm-btn adm-btn-primary js-save-revision">' + escapeHtml(msg('saveRevision', 'Save revision')) + '</button>'
            + '  </div>'
            + '  <div class="adm-tr-history">'
            + '    <div class="adm-tr-history-head">' + escapeHtml(msg('revisionHistory', 'Revision history')) + '</div>'
            + '    <div class="adm-tr-history-row">'
            + '      <select class="adm-input js-revision-select">' + renderRevisionOptions(item.revisions, item.currentRevisionIdx) + '</select>'
            + '      <button type="button" class="adm-btn adm-btn-ghost js-restore-revision">' + escapeHtml(msg('restoreRevision', 'Restore selected revision')) + '</button>'
            + '    </div>'
            + '  </div>'
            + '</div>';

        container.dataset.translationIdx = item.translationIdx;
    }

    function setTranslations(widget, translations) {
        widget.__translations = Array.isArray(translations) ? translations : [];
        const select = widget.querySelector('.js-translation-select');
        if (!select) return;

        if (!widget.__translations.length) {
            select.innerHTML = '<option value="">' + escapeHtml(msg('none', 'No translations')) + '</option>';
            renderTranslationDetail(widget, null);
            return;
        }

        select.innerHTML = widget.__translations.map(function (item, index) {
            const selected = item.isPrimary || index === 0 ? ' selected' : '';
            return '<option value="' + escapeHtml(item.translationIdx) + '"' + selected + '>' + escapeHtml(translationOptionLabel(item)) + '</option>';
        }).join('');

        const selectedId = select.value;
        const selected = widget.__translations.find(function (item) {
            return String(item.translationIdx) === String(selectedId);
        }) || widget.__translations[0];
        if (selected && String(select.value) !== String(selected.translationIdx)) {
            select.value = String(selected.translationIdx);
        }
        renderTranslationDetail(widget, selected);
    }

    function selectedTranslation(widget) {
        const select = widget.querySelector('.js-translation-select');
        if (!select || !widget.__translations) return null;
        return widget.__translations.find(function (item) {
            return String(item.translationIdx) === String(select.value);
        }) || null;
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, options);
        let payload;
        try {
            payload = await response.json();
        } catch (e) {
            throw new Error(msg('requestFailed', 'Request failed'));
        }
        if (!response.ok || !payload.success) {
            throw new Error((payload && payload.message) || msg('requestFailed', 'Request failed'));
        }
        return payload;
    }

    function lookupUrl(widget) {
        const params = new URLSearchParams({
            sourceType: widget.dataset.sourceType,
            sourceIdx: widget.dataset.sourceIdx,
            fieldName: widget.dataset.fieldName,
            sourceText: widget.dataset.sourceText || ''
        });
        return (window.__CTX__ || '') + '/admin/translations/lookup?' + params.toString();
    }

    async function loadTranslations(widget, force) {
        if (widget.dataset.loading === 'true') return;
        if (!force && widget.dataset.loaded === 'true') return;
        widget.dataset.loading = 'true';
        const detail = widget.querySelector('.js-translation-detail');
        if (detail) {
            detail.innerHTML = '<div class="adm-tr-empty">' + escapeHtml(msg('loading', 'Loading...')) + '</div>';
        }
        try {
            const payload = await fetchJson(lookupUrl(widget), {headers: {'Accept': 'application/json'}});
            setTranslations(widget, payload.translations || []);
            widget.dataset.loaded = 'true';
        } catch (error) {
            if (detail) {
                detail.innerHTML = '<div class="adm-tr-empty is-error">' + escapeHtml(error.message || msg('loadFailed', 'Failed to load translations')) + '</div>';
            }
        } finally {
            widget.dataset.loading = 'false';
        }
    }

    async function createTranslation(widget) {
        const sourceLang = widget.querySelector('.js-create-source-lang').value;
        const targetLang = widget.querySelector('.js-create-target-lang').value;
        const title = widget.querySelector('.js-create-title').value.trim();
        const autoTranslate = widget.querySelector('.js-create-auto').checked;
        const translatedText = widget.querySelector('.js-create-translated-text').value.trim();

        if (!autoTranslate && !translatedText) {
            alert(msg('enterTranslatedText', 'Enter translated text'));
            return;
        }

        const payload = {
            sourceType: widget.dataset.sourceType,
            sourceIdx: Number(widget.dataset.sourceIdx),
            fieldName: widget.dataset.fieldName,
            sourceLang: sourceLang,
            targetLang: targetLang,
            sourceText: widget.dataset.sourceText || '',
            title: title,
            autoTranslate: autoTranslate,
            translatedText: translatedText,
            markPrimary: false
        };

        try {
            await fetchJson((window.__CTX__ || '') + '/admin/translations', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (typeof window.adm_toast === 'function') {
                window.adm_toast(msg('created', 'Translation created'));
            }
            widget.dataset.loaded = 'false';
            await loadTranslations(widget, true);
            widget.querySelector('.js-create-title').value = '';
            widget.querySelector('.js-create-translated-text').value = '';
            widget.querySelector('.js-create-box').classList.remove('open');
        } catch (error) {
            alert(error.message || msg('createFailed', 'Failed to create translation'));
        }
    }

    async function saveRevision(widget) {
        const current = selectedTranslation(widget);
        if (!current) return;
        const title = widget.querySelector('.js-edit-title').value.trim();
        const translatedText = widget.querySelector('.js-edit-text').value.trim();
        const note = widget.querySelector('.js-edit-note').value.trim();
        const markPrimary = widget.querySelector('.js-edit-primary').checked;
        if (!translatedText) {
            alert(msg('enterTranslatedText', 'Enter translated text'));
            return;
        }

        const payload = {
            sourceLang: current.sourceLang || widget.dataset.defaultSourceLang || 'ko',
            sourceText: widget.dataset.sourceText || '',
            translatedText: translatedText,
            title: title,
            note: note,
            markPrimary: markPrimary
        };

        try {
            await fetchJson((window.__CTX__ || '') + '/admin/translations/' + current.translationIdx + '/revisions', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (typeof window.adm_toast === 'function') {
                window.adm_toast(msg('saved', 'Revision saved'));
            }
            widget.dataset.loaded = 'false';
            await loadTranslations(widget, true);
        } catch (error) {
            alert(error.message || msg('saveFailed', 'Failed to save translation'));
        }
    }

    async function restoreRevision(widget) {
        const current = selectedTranslation(widget);
        if (!current) return;
        const revisionIdx = widget.querySelector('.js-revision-select').value;
        if (!revisionIdx) return;
        if (!window.confirm(msg('confirmRestore', 'Restore selected revision?'))) {
            return;
        }

        try {
            await fetchJson((window.__CTX__ || '') + '/admin/translations/' + current.translationIdx + '/restore', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
                body: JSON.stringify({revisionIdx: Number(revisionIdx)})
            });
            if (typeof window.adm_toast === 'function') {
                window.adm_toast(msg('restored', 'Revision restored'));
            }
            widget.dataset.loaded = 'false';
            await loadTranslations(widget, true);
        } catch (error) {
            alert(error.message || msg('restoreFailed', 'Failed to restore revision'));
        }
    }

    function bind(widget) {
        widget.addEventListener('click', function (event) {
            const toggleBtn = event.target.closest('.js-translation-toggle');
            if (toggleBtn) {
                const body = widget.querySelector('.js-translation-body');
                const open = body.classList.toggle('open');
                toggleBtn.textContent = open ? msg('hide', 'Hide') : msg('open', 'Translations');
                if (open) {
                    loadTranslations(widget, false);
                }
                return;
            }

            const refreshBtn = event.target.closest('.js-translation-refresh');
            if (refreshBtn) {
                loadTranslations(widget, true);
                return;
            }

            const newBtn = event.target.closest('.js-translation-create-toggle');
            if (newBtn) {
                widget.querySelector('.js-create-box').classList.toggle('open');
                return;
            }

            const createBtn = event.target.closest('.js-create-submit');
            if (createBtn) {
                createTranslation(widget);
                return;
            }

            const saveBtn = event.target.closest('.js-save-revision');
            if (saveBtn) {
                saveRevision(widget);
                return;
            }

            const restoreBtn = event.target.closest('.js-restore-revision');
            if (restoreBtn) {
                restoreRevision(widget);
                return;
            }
        });

        widget.addEventListener('change', function (event) {
            const select = event.target.closest('.js-translation-select');
            if (select) {
                renderTranslationDetail(widget, selectedTranslation(widget));
                return;
            }

            const autoCheck = event.target.closest('.js-create-auto');
            if (autoCheck) {
                const manualWrap = widget.querySelector('.js-create-manual-wrap');
                if (manualWrap) {
                    manualWrap.style.display = autoCheck.checked ? 'none' : '';
                }
            }
        });
    }

    function createMarkup(widget) {
        const title = widget.dataset.label || msg('sectionTitle', 'Translation management');
        const defaultSourceLang = widget.dataset.defaultSourceLang || 'ko';
        widget.innerHTML = ''
            + '<div class="adm-tr-widget-box">'
            + '  <div class="adm-tr-head">'
            + '    <div class="adm-tr-title">' + escapeHtml(title) + '</div>'
            + '    <div class="adm-tr-head-actions">'
            + '      <button type="button" class="adm-btn adm-btn-ghost js-translation-toggle">' + escapeHtml(msg('open', 'Translations')) + '</button>'
            + '    </div>'
            + '  </div>'
            + '  <div class="adm-tr-body js-translation-body">'
            + '    <div class="adm-tr-toolbar">'
            + '      <select class="adm-input js-translation-select"><option value="">' + escapeHtml(msg('none', 'No translations')) + '</option></select>'
            + '      <button type="button" class="adm-btn adm-btn-ghost js-translation-refresh">' + escapeHtml(msg('refresh', 'Refresh')) + '</button>'
            + '      <button type="button" class="adm-btn adm-btn-ghost js-translation-create-toggle">' + escapeHtml(msg('createNew', 'Create new')) + '</button>'
            + '    </div>'
            + '    <div class="adm-tr-create js-create-box">'
            + '      <div class="adm-tr-create-grid">'
            + '        <div><label class="adm-tr-label">' + escapeHtml(msg('sourceLang', 'Source language')) + '</label><select class="adm-input js-create-source-lang">' + langOptions(defaultSourceLang) + '</select></div>'
            + '        <div><label class="adm-tr-label">' + escapeHtml(msg('targetLang', 'Target language')) + '</label><select class="adm-input js-create-target-lang">' + langOptions('en') + '</select></div>'
            + '      </div>'
            + '      <div class="adm-tr-row"><label class="adm-tr-label">' + escapeHtml(msg('title', 'Title')) + '</label><input type="text" class="adm-input js-create-title" placeholder="' + escapeHtml(msg('titlePlaceholder', 'e.g. ko→en draft')) + '"></div>'
            + '      <label class="adm-tr-check"><input type="checkbox" class="js-create-auto" checked> ' + escapeHtml(msg('autoGenerate', 'Generate draft automatically')) + '</label>'
            + '      <div class="adm-tr-row js-create-manual-wrap" style="display:none;"><label class="adm-tr-label">' + escapeHtml(msg('initialText', 'Initial translation')) + '</label><textarea class="adm-input adm-tr-note js-create-translated-text"></textarea></div>'
            + '      <div class="adm-tr-actions"><button type="button" class="adm-btn adm-btn-primary js-create-submit">' + escapeHtml(msg('create', 'Create')) + '</button></div>'
            + '    </div>'
            + '    <div class="js-translation-detail"><div class="adm-tr-empty">' + escapeHtml(msg('collapsedHint', 'Open to load translations')) + '</div></div>'
            + '  </div>'
            + '</div>';
    }

    function langOptions(selectedValue) {
        const langs = i18n.languages || {
            ko: 'Korean',
            en: 'English',
            ja: '日本語',
            zh: '中文'
        };
        return Object.keys(langs).map(function (code) {
            const selected = code === selectedValue ? ' selected' : '';
            return '<option value="' + escapeHtml(code) + '"' + selected + '>' + escapeHtml(langs[code]) + '</option>';
        }).join('');
    }

    function mountWidget(widget) {
        if (!widget || widget.dataset.translationMounted === 'true') return;
        createMarkup(widget);
        bind(widget);
        widget.dataset.translationMounted = 'true';
    }

    function scan(root) {
        (root || document).querySelectorAll('.js-admin-translation-widget').forEach(mountWidget);
    }

    window.TripAdminTranslation = {
        scan: scan,
        mount: mountWidget
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            scan(document);
        });
    } else {
        scan(document);
    }
})(window, document);
