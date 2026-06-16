/*
 * TripTogether Admin section list tools
 * - Section-aware table utilities for admin/superAdmin list screens
 * - Local current-screen filtering, paging, sorting, sort reset
 * - Row selection, selected action bar, current/filtered/selected CSV/XLS download
 *
 * /admin/blocks and /admin/members are intentionally excluded because they own
 * richer domain-specific server/AJAX section logic and mutation endpoints.
 * Legacy data-admin-list-ignore="true" is no longer treated as a hard skip:
 * older admin pages used it too broadly and lost row selection/export controls.
 */
(function () {
    'use strict';

    if (window.__TT_ADMIN_LIST_TOOLS_LOADED__) return;
    window.__TT_ADMIN_LIST_TOOLS_LOADED__ = true;

    const TEXT = {
        currentFilterField: '현재 화면 전체',
        currentKeyword: '현재 화면 내 검색',
        filterReset: '필터 초기화',
        pageSize: '표시',
        pageSizeAll: '전체',
        loadMode: '로드 방식',
        loadCurrent: '페이지 로드',
        loadFull: '전체 로드',
        loadFullHint: '전체 로드 시 최대 500건까지 서버에서 다시 불러옵니다.',
        displayCurrent: '페이지 로드',
        displayAll: '전체 로드',
        prev: '이전',
        next: '다음',
        pageInfo: '{0}건 중 {1}건 표시 · {2}/{3}쪽',
        noRows: '현재 조건에 맞는 항목이 없습니다.',
        exportLabel: '내보내기',
        downloadPage: '현재 페이지 내보내기',
        downloadFiltered: '검색 결과 내보내기',
        downloadSelected: '선택 내보내기',
        clearSelection: '선택 해제',
        selectedPrefix: '선택',
        selectedSuffix: '건',
        sortReset: '정렬 초기화',
        noSelection: '선택된 항목이 없습니다.',
        csv: 'CSV',
        excel: 'Excel'
    };

    const SELECTOR = '.adm-content table.adm-table, .adm-content table.sa-salary-table#salaryTable';
    const SKIP_PATHS = [
        '/admin/blocks',
        '/admin/members',
        '/admin/business-applications',
        '/admin/login-risk/provider-configs',
        '/admin/login-risk/provider-health-history',
        '/admin/login-risk/reviews',
        '/admin/login-risk/assessments',
        '/admin/login-risk/security-assessments',
        '/admin/login-risk/security-reviews',
        '/admin/login-risk/appeals',
        '/admin/login-risk/waf-sync'
    ];

    const tableStates = new WeakMap();
    let enhanceTimer = null;

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function shouldSkipPage() {
        const path = window.location.pathname || '';
        return SKIP_PATHS.some(function (skip) { return path.indexOf(skip) !== -1; });
    }

    function closestCard(table) {
        return table.closest('.adm-card, .sa-card') || table.parentElement;
    }

    function closestWrap(table) {
        return table.closest('.adm-table-wrap, .sa-table-wrap') || table.parentElement;
    }

    function isModalTable(table) {
        return !!table.closest('.adm-modal, .adm-modal-overlay, .modal, [role="dialog"]');
    }

    function isEnhanceableTable(table) {
        if (!table || table.dataset.adminListIgnore === 'hard') return false;
        if (table.dataset.adminListToolsEnhanced === 'true') return false;
        if (isModalTable(table)) return false;
        if (table.closest('.adm-managed-section-card[data-enhanced="true"]')) return false;
        if (table.classList.contains('history-table') || table.classList.contains('sa-audit-table')) return false;
        if (table.id === 'salaryPreviewTable') return false;
        if (!table.querySelector('thead tr') || !table.querySelector('tbody')) return false;
        return true;
    }

    function cleanText(el) {
        return (el && (el.innerText || el.textContent) ? (el.innerText || el.textContent) : '')
            .replace(/[↕▲▼]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function csvEscape(value) {
        const s = String(value == null ? '' : value);
        return '"' + s.replace(/"/g, '""') + '"';
    }


    function excelXmlEscape(value) {
        return String(value == null ? '' : value)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function excelXmlCell(value, styleId) {
        const styleAttr = styleId ? ' ss:StyleID="' + styleId + '"' : '';
        return '<Cell' + styleAttr + '><Data ss:Type="String">' + excelXmlEscape(value) + '</Data></Cell>';
    }

    function buildExcelXml(headers, rows, worksheetName) {
        const safeSheetName = excelXmlEscape(worksheetName || 'export').slice(0, 31) || 'export';
        const headerXml = '<Row>' + headers.map(function (h) { return excelXmlCell(h, 'header'); }).join('') + '</Row>';
        const bodyXml = rows.map(function (row) {
            return '<Row>' + row.map(function (v) { return excelXmlCell(v); }).join('') + '</Row>';
        }).join('');

        return '<?xml version="1.0" encoding="UTF-8"?>'
            + '<?mso-application progid="Excel.Sheet"?>'
            + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
            + 'xmlns:o="urn:schemas-microsoft-com:office:office" '
            + 'xmlns:x="urn:schemas-microsoft-com:office:excel" '
            + 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" '
            + 'xmlns:html="http://www.w3.org/TR/REC-html40">'
            + '<Styles>'
            + '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="맑은 고딕" ss:Size="10"/></Style>'
            + '<Style ss:ID="header"><Font ss:FontName="맑은 고딕" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style>'
            + '</Styles>'
            + '<Worksheet ss:Name="' + safeSheetName + '"><Table>'
            + headerXml + bodyXml
            + '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet>'
            + '</Workbook>';
    }
    function format(text) {
        const args = Array.prototype.slice.call(arguments, 1);
        return String(text).replace(/\{(\d+)}/g, function (_, i) {
            return args[Number(i)] == null ? '' : String(args[Number(i)]);
        });
    }

    function safeFileName(value) {
        const raw = (value || document.title || 'admin_list').replace(/\s+/g, '_');
        return raw.replace(/[\\/:*?"<>|]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'admin_list';
    }

    function downloadBlob(content, filename, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function toast(message, type) {
        if (typeof window.adm_toast === 'function') window.adm_toast(message, type || 'success');
        else alert(message);
    }

    function ensureTableId(table, index) {
        if (!table.id) table.id = 'admSectionListTable' + index;
        return table.id;
    }

    function hasDataRow(row) {
        if (!row) return false;
        if (row.dataset.adminListEmptyRow === 'true') return false;
        return !(row.children.length === 1 && row.children[0].hasAttribute('colspan'));
    }

    function tableHeaders(table) {
        return Array.from(table.querySelectorAll('thead tr:last-child th'));
    }

    function isActionHeader(th) {
        const text = cleanText(th).toLowerCase();
        return text === '' || text === '관리' || text === '작업' || text === '처리' || text === '검토'
            || text === '상세' || text === '액션' || text === 'action' || text === 'actions';
    }

    function isSelectionHeader(th) {
        return !!(th && th.querySelector('input[type="checkbox"]'));
    }

    function firstCellCheckbox(row) {
        const first = row && row.children ? row.children[0] : null;
        return first ? first.querySelector('input[type="checkbox"]') : null;
    }

    function looksLikeManualSelectionTable(table) {
        const firstHead = tableHeaders(table)[0];
        if (!isSelectionHeader(firstHead)) return false;
        return Array.from(table.querySelectorAll('tbody tr')).some(function (row) {
            return hasDataRow(row) && !!firstCellCheckbox(row);
        });
    }

    function hasPageOwnedSelectionControls(table) {
        const card = closestCard(table);
        if (!card) return false;
        return !!card.querySelector('#bulkBar, [class*="bulk-bar"], [class*="bulkbar"]');
    }

    function insertCompactManualTools(table) {
        const card = closestCard(table);
        if (!card) return null;

        const existing = card.querySelector('.js-admin-list-tools-toolbar[data-table-id="' + table.id + '"]');
        if (existing) return existing;

        const target = card.querySelector('.adm-card-head [class*="list-controls"], .adm-card-head [class*="controls"], .adm-card-head') || card;
        const bulkBar = card.querySelector('#bulkBar, [class*="bulk-bar"], [class*="bulkbar"]');

        if (bulkBar && !bulkBar.querySelector('.js-admin-list-clear-selection')) {
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'adm-btn adm-btn-ghost js-admin-list-clear-selection';
            clear.textContent = TEXT.clearSelection;
            bulkBar.appendChild(clear);
        }

        const tools = document.createElement('div');
        tools.className = 'adm-export-control adm-admin-list-compact-export js-admin-list-tools-toolbar';
        tools.dataset.tableId = table.id;
        tools.innerHTML =
            '<select class="adm-select js-admin-list-export-format" aria-label="' + TEXT.exportLabel + ' 형식">'
            + '<option value="csv">' + TEXT.csv + '</option>'
            + '<option value="excel">' + TEXT.excel + '</option>'
            + '</select>'
            + '<div class="adm-export-menu">'
            + '<button type="button" class="adm-btn adm-btn-ghost js-export-toggle">' + TEXT.exportLabel + ' ▾</button>'
            + '<div class="adm-export-dropdown">'
            + '<button type="button" class="js-admin-list-export" data-scope="page">' + TEXT.downloadPage + '</button>'
            + '<button type="button" class="js-admin-list-export js-admin-list-export-selected" data-scope="selected" disabled>' + TEXT.downloadSelected + ' (0)</button>'
            + '</div></div>';

        target.appendChild(tools);
        return tools;
    }

    function rowSelectionCheckbox(row) {
        return row ? row.querySelector('input.js-admin-list-row-check[data-admin-list-select="true"]') : null;
    }

    function allSelectionCheckboxes(table) {
        return getState(table).rows
            .map(rowSelectionCheckbox)
            .filter(Boolean);
    }

    function selectedRowsOf(table) {
        return getState(table).rows.filter(function (row) {
            const cb = rowSelectionCheckbox(row);
            return cb && cb.checked;
        });
    }

    function getState(table) {
        return tableStates.get(table);
    }

    function captureState(table) {
        const allBodyRows = Array.from(table.querySelectorAll('tbody tr'));
        const rows = allBodyRows.filter(hasDataRow);
        const originalEmptyRows = allBodyRows.filter(function (row) { return !hasDataRow(row); });
        rows.forEach(function (row, idx) {
            row.dataset.adminListOrigOrder = String(idx);
            row.dataset.adminListVisible = 'true';
        });
        originalEmptyRows.forEach(function (row) {
            row.dataset.adminListOriginalEmptyRow = 'true';
            row.style.display = 'none';
        });
        const state = {
            rows: rows,
            originalEmptyRows: originalEmptyRows,
            filteredRows: rows.slice(),
            visibleRows: rows.slice(),
            page: 1,
            pageSize: 20,
            sortIndex: -1,
            sortDir: 'ASC',
            hasManualSelection: looksLikeManualSelectionTable(table)
        };
        tableStates.set(table, state);
        return state;
    }

    function insertToolbar(table) {
        const wrap = closestWrap(table);
        const parent = wrap ? wrap.parentElement : null;
        if (!parent) return null;

        const existing = parent.querySelector('.js-admin-list-tools-toolbar[data-table-id="' + table.id + '"]');
        if (existing) return existing;

        const toolbar = document.createElement('div');
        toolbar.className = 'adm-section-list-toolbar adm-admin-list-controlbar js-admin-list-tools-toolbar';
        toolbar.dataset.tableId = table.id;
        toolbar.innerHTML =
            '<div class="adm-admin-list-selection adm-admin-list-bulkbar" aria-live="polite">'
            + '<span class="adm-admin-list-selected-count"></span>'
            + '<button type="button" class="adm-btn adm-btn-ghost js-admin-list-clear-selection">' + TEXT.clearSelection + '</button>'
            + '</div>'
            + '<div class="adm-admin-list-toolcluster">'
            + '<div class="adm-admin-list-primary-tools js-admin-list-primary-tools">'
            + '<label class="adm-admin-list-tool adm-section-list-mode"><span>' + TEXT.loadMode + '</span>'
            + '<select class="adm-select js-admin-list-mode">'
            + '<option value="page">' + TEXT.displayCurrent + '</option>'
            + '<option value="full">' + TEXT.displayAll + '</option>'
            + '</select></label>'
            + '<div class="adm-admin-list-tool adm-section-list-filter">'
            + '<select class="adm-select js-admin-list-field" title="현재 화면 기준 필드"></select>'
            + '<div class="adm-search-box adm-section-list-search">'
            + '<span class="adm-search-ico adm-admin-list-search-ico" aria-hidden="true"></span>'
            + '<input type="text" class="adm-input js-admin-list-keyword" placeholder="' + TEXT.currentKeyword + '">'
            + '</div>'
            + '<button type="button" class="adm-btn adm-btn-ghost js-admin-list-filter-reset">↺ ' + TEXT.filterReset + '</button>'
            + '</div>'
            + '<label class="adm-admin-list-tool adm-section-list-size"><span>' + TEXT.pageSize + '</span>'
            + '<select class="adm-select js-admin-list-page-size">'
            + '<option value="10">10</option><option value="20" selected>20</option><option value="50">50</option><option value="100">100</option><option value="all">' + TEXT.pageSizeAll + '</option>'
            + '</select></label>'
            + '<button type="button" class="adm-btn adm-btn-ghost js-admin-list-sort-reset" style="display:none;">↺ ' + TEXT.sortReset + '</button>'
            + '<div class="adm-export-control adm-admin-list-export-tool">'
            + '<select class="adm-select js-admin-list-export-format"><option value="csv">' + TEXT.csv + '</option><option value="excel">' + TEXT.excel + '</option></select>'
            + '<div class="adm-export-menu">'
            + '<button type="button" class="adm-btn adm-btn-ghost js-export-toggle">' + TEXT.exportLabel + ' ▾</button>'
            + '<div class="adm-export-dropdown">'
            + '<button type="button" class="js-admin-list-export" data-scope="page">' + TEXT.downloadPage + '</button>'
            + '<button type="button" class="js-admin-list-export" data-scope="filtered">' + TEXT.downloadFiltered + '</button>'
            + '<button type="button" class="js-admin-list-export js-admin-list-export-selected" data-scope="selected" disabled>' + TEXT.downloadSelected + ' (0)</button>'
            + '</div></div></div>'
            + '</div>'
            + '<div class="adm-admin-list-overflow-menu js-admin-list-overflow-menu">'
            + '<button type="button" class="adm-btn adm-btn-ghost adm-admin-list-overflow-toggle js-admin-list-overflow-toggle" aria-expanded="false">옵션 ▾</button>'
            + '<div class="adm-admin-list-overflow-panel js-admin-list-overflow-panel"></div>'
            + '</div>'
            + '</div>';

        const footer = document.createElement('div');
        footer.className = 'adm-section-list-footer js-admin-list-tools-footer';
        footer.dataset.tableId = table.id;
        footer.innerHTML =
            '<span class="adm-section-list-page-info js-admin-list-page-info"></span>'
            + '<div class="adm-section-list-page-tools">'
            + '<button type="button" class="adm-btn adm-btn-ghost js-admin-list-prev">' + TEXT.prev + '</button>'
            + '<button type="button" class="adm-btn adm-btn-ghost js-admin-list-next">' + TEXT.next + '</button>'
            + '</div>';

        parent.insertBefore(toolbar, wrap);
        if (wrap.nextSibling) parent.insertBefore(footer, wrap.nextSibling);
        else parent.appendChild(footer);
        return toolbar;
    }

    function populateFieldSelect(table, toolbar) {
        const select = toolbar.querySelector('.js-admin-list-field');
        if (!select) return;

        const headers = tableHeaders(table);
        const options = ['<option value="all">' + TEXT.currentFilterField + '</option>'];
        headers.forEach(function (th, idx, arr) {
            if (isSelectionHeader(th)) return;
            if (idx === arr.length - 1 && isActionHeader(th)) return;
            const label = cleanText(th);
            if (!label) return;
            options.push('<option value="' + idx + '">' + escapeHtml(label) + '</option>');
        });
        select.innerHTML = options.join('');
    }

    function configureLoadMode(table, toolbar) {
        const mode = toolbar.querySelector('.js-admin-list-mode');
        if (!mode) return;
        if (table.dataset.adminListServerSort === 'true') {
            const size = Number(new URLSearchParams(window.location.search).get('size') || 30);
            const pageSize = toolbar.querySelector('.js-admin-list-page-size');
            mode.innerHTML = '<option value="page">' + TEXT.loadCurrent + '</option><option value="full">' + TEXT.loadFull + '</option>';
            mode.value = size >= 500 ? 'full' : 'page';
            mode.title = TEXT.loadFullHint;
            if (pageSize && size >= 500) pageSize.value = 'all';
        } else {
            mode.innerHTML = '<option value="page">' + TEXT.displayCurrent + '</option><option value="full">' + TEXT.displayAll + '</option>';
        }
    }

    function isVisibleToolbarItem(item) {
        if (!item) return false;
        return !item.classList.contains('js-admin-list-sort-reset') || item.style.display !== 'none';
    }

    function syncToolbarOverflow(toolbar) {
        if (toolbar && typeof toolbar.__adminListOverflowSync === 'function') {
            toolbar.__adminListOverflowSync();
        }
    }

    function initToolbarOverflow(toolbar) {
        const primary = toolbar.querySelector('.js-admin-list-primary-tools');
        const menu = toolbar.querySelector('.js-admin-list-overflow-menu');
        const panel = toolbar.querySelector('.js-admin-list-overflow-panel');
        const toggle = toolbar.querySelector('.js-admin-list-overflow-toggle');
        if (!primary || !menu || !panel || !toggle) return;

        const items = [
            { node: toolbar.querySelector('.js-admin-list-sort-reset'), breakpoint: 1560 },
            { node: toolbar.querySelector('.adm-section-list-filter'), breakpoint: 1380 },
            { node: toolbar.querySelector('.adm-section-list-mode'), breakpoint: 1180 },
            { node: toolbar.querySelector('.adm-section-list-size'), breakpoint: 1040 }
        ].filter(function (item) { return !!item.node; });

        toolbar.__adminListOverflowSync = function () {
            const width = window.innerWidth || document.documentElement.clientWidth || 1600;
            items.forEach(function (item) {
                const target = width <= item.breakpoint ? panel : primary;
                if (item.node.parentElement !== target) target.appendChild(item.node);
            });
            const hasItems = Array.from(panel.children).some(isVisibleToolbarItem);
            menu.classList.toggle('has-items', hasItems);
            if (!hasItems) {
                menu.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        };

        toggle.addEventListener('click', function () {
            const willOpen = !menu.classList.contains('open');
            menu.classList.toggle('open', willOpen);
            toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
        document.addEventListener('click', function (event) {
            if (!menu.contains(event.target)) {
                menu.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
        window.addEventListener('resize', function () { syncToolbarOverflow(toolbar); }, { passive: true });
        syncToolbarOverflow(toolbar);
    }

    function normalizeManualSelection(table) {
        const firstHead = tableHeaders(table)[0];
        const checkAll = firstHead ? firstHead.querySelector('input[type="checkbox"]') : null;
        if (checkAll) {
            checkAll.classList.add('js-admin-list-check-all');
            checkAll.dataset.tableId = table.id;
            checkAll.dataset.adminListSelectAll = 'true';
        }

        getState(table).rows.forEach(function (row) {
            const cb = firstCellCheckbox(row);
            if (!cb) return;
            cb.classList.add('js-admin-list-row-check');
            cb.dataset.tableId = table.id;
            cb.dataset.adminListSelect = 'true';
        });
    }

    function injectSelection(table) {
        const headRow = table.querySelector('thead tr:last-child');
        if (!headRow) return;

        const th = document.createElement('th');
        th.className = 'adm-admin-list-check-cell';
        th.style.width = '42px';
        th.style.textAlign = 'center';
        th.innerHTML = '<input type="checkbox" class="adm-check js-admin-list-check-all" data-table-id="' + table.id + '" data-admin-list-select-all="true" aria-label="전체 선택">';
        headRow.insertBefore(th, headRow.firstElementChild);

        getState(table).rows.forEach(function (row) {
            const td = document.createElement('td');
            td.className = 'adm-admin-list-check-cell';
            td.style.textAlign = 'center';
            td.innerHTML = '<input type="checkbox" class="adm-check js-admin-list-row-check" data-table-id="' + table.id + '" data-admin-list-select="true" aria-label="행 선택">';
            row.insertBefore(td, row.firstElementChild);
        });
    }

    function enhanceSelection(table) {
        if (getState(table).hasManualSelection) normalizeManualSelection(table);
        else injectSelection(table);
    }

    function updateSelectionUi(table) {
        const toolbar = document.querySelector('.js-admin-list-tools-toolbar[data-table-id="' + table.id + '"]');
        if (!toolbar) return;

        const boxes = allSelectionCheckboxes(table);
        const selected = boxes.filter(function (cb) { return cb.checked; });
        const selectedCount = selected.length;
        const all = table.querySelector('.js-admin-list-check-all[data-table-id="' + table.id + '"][data-admin-list-select-all="true"]');
        const visibleBoxes = getState(table).visibleRows.map(rowSelectionCheckbox).filter(Boolean);

        if (all) {
            all.checked = visibleBoxes.length > 0 && visibleBoxes.every(function (cb) { return cb.checked; });
            all.indeterminate = visibleBoxes.some(function (cb) { return cb.checked; }) && !all.checked;
        }

        const selectedBox = toolbar.querySelector('.adm-admin-list-selection');
        const selectedCountEl = toolbar.querySelector('.adm-admin-list-selected-count');
        const selectedExport = toolbar.querySelector('.js-admin-list-export-selected');

        if (selectedBox) {
            selectedBox.classList.toggle('is-active', selectedCount > 0);
            selectedBox.setAttribute('aria-hidden', selectedCount > 0 ? 'false' : 'true');
            selectedBox.querySelectorAll('button').forEach(function (btn) {
                btn.disabled = selectedCount === 0;
            });
        }
        if (selectedCountEl) selectedCountEl.textContent = TEXT.selectedPrefix + ' ' + selectedCount + TEXT.selectedSuffix;
        if (selectedExport) {
            selectedExport.disabled = selectedCount === 0;
            selectedExport.textContent = TEXT.downloadSelected + ' (' + selectedCount + ')';
        }
    }

    function exportableHeaderIndexes(table) {
        const headers = tableHeaders(table);
        return headers.map(function (th, idx) { return { th: th, idx: idx }; }).filter(function (item, i, arr) {
            if (isSelectionHeader(item.th)) return false;
            if (i === arr.length - 1 && isActionHeader(item.th)) return false;
            return true;
        }).map(function (item) { return item.idx; });
    }

    function exportRows(table, scope) {
        const state = getState(table);
        if (scope === 'selected') {
            const selected = selectedRowsOf(table);
            if (!selected.length) {
                toast(TEXT.noSelection, 'error');
                return null;
            }
            return selected;
        }
        if (scope === 'filtered') return state.filteredRows.slice();
        return state.visibleRows.slice();
    }

    function exportTable(table, scope) {
        const toolbar = document.querySelector('.js-admin-list-tools-toolbar[data-table-id="' + table.id + '"]');
        if (!toolbar) return;
        const rows = exportRows(table, scope || 'page');
        if (!rows) return;

        const indexes = exportableHeaderIndexes(table);
        const headers = indexes.map(function (idx) { return cleanText(tableHeaders(table)[idx]); });
        const body = rows.map(function (row) {
            return indexes.map(function (idx) { return cleanText(row.children[idx]); });
        });
        const formatSelect = toolbar.querySelector('.js-admin-list-export-format');
        const format = formatSelect ? formatSelect.value : 'csv';
        const base = safeFileName((document.title || 'admin_list') + '_' + table.id + '_' + (scope || 'page') + '_' + new Date().toISOString().slice(0, 10));

        if (format === 'excel') {
            const worksheetName = safeFileName((table.id || 'admin_list') + '_export').slice(0, 31) || 'export';
            const xls = buildExcelXml(headers, body, worksheetName);
            downloadBlob('\ufeff' + xls, base + '.xls', 'application/vnd.ms-excel;charset=utf-8');
        } else {
            const csv = [headers].concat(body).map(function (row) { return row.map(csvEscape).join(','); }).join('\n');
            downloadBlob('\ufeff' + csv, base + '.csv', 'text/csv;charset=utf-8');
        }
    }

    function parseSortableValue(value) {
        const v = String(value || '').trim();
        const compactDate = v.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
        if (compactDate) {
            const y = compactDate[1];
            const m = compactDate[2].padStart(2, '0');
            const d = compactDate[3].padStart(2, '0');
            const hh = (compactDate[4] || '0').padStart(2, '0');
            const mm = (compactDate[5] || '0').padStart(2, '0');
            const ss = (compactDate[6] || '0').padStart(2, '0');
            const t = Date.parse(y + '-' + m + '-' + d + 'T' + hh + ':' + mm + ':' + ss);
            if (!Number.isNaN(t)) return { type: 'number', value: t };
        }
        const numeric = v.replace(/,/g, '').match(/^-?\d+(?:\.\d+)?$/);
        if (numeric) return { type: 'number', value: Number(v.replace(/,/g, '')) };
        return { type: 'string', value: v.toLowerCase() };
    }

    function compareValues(a, b) {
        const av = parseSortableValue(a);
        const bv = parseSortableValue(b);
        if (av.type === 'number' && bv.type === 'number') return av.value - bv.value;
        return String(av.value).localeCompare(String(bv.value), document.documentElement.lang || undefined, { numeric: true, sensitivity: 'base' });
    }

    function getCellSearchText(row, fieldIndex) {
        if (fieldIndex === 'all') return cleanText(row);
        const idx = Number(fieldIndex);
        return cleanText(row.children[idx]);
    }

    function hasSortQuery() {
        const params = new URLSearchParams(window.location.search);
        return !!(params.get('sortField') || params.get('sortBy') || params.get('sortDir'));
    }

    function resetServerSort() {
        const url = new URL(window.location.href);
        ['sortField', 'sortBy', 'sortDir'].forEach(function (key) { url.searchParams.delete(key); });
        if (url.searchParams.has('page')) url.searchParams.set('page', '1');
        window.location.href = url.toString();
    }

    function applyServerLoadMode(mode) {
        const url = new URL(window.location.href);
        url.searchParams.set('page', '1');
        if (mode === 'full') {
            url.searchParams.set('size', '500');
        } else {
            const currentSize = Number(url.searchParams.get('size') || 30);
            if (!currentSize || currentSize > 100) url.searchParams.set('size', '30');
        }
        window.location.href = url.toString();
    }

    function hasServerManagedSort(table) {
        return tableHeaders(table).some(function (th) {
            return th.hasAttribute('data-sort') || !!th.getAttribute('onclick');
        });
    }

    function updateSortIndicators(table) {
        if (table.dataset.adminListServerSort === 'true') {
            const state = getState(table);
            tableHeaders(table).forEach(function (th, idx) {
                const active = state && state.sortIndex === idx;
                const ico = th.querySelector('.sort-ico-generic');
                if (ico) {
                    th.classList.toggle('sorted', active);
                    ico.textContent = active ? (state.sortDir === 'ASC' ? '▲' : '▼') : '';
                    ico.style.color = active ? (state.sortDir === 'ASC' ? '#ef4444' : '#3b82f6') : '';
                }
            });
            const toolbar = document.querySelector('.js-admin-list-tools-toolbar[data-table-id="' + table.id + '"]');
            const reset = toolbar ? toolbar.querySelector('.js-admin-list-sort-reset') : null;
            if (reset) reset.style.display = hasSortQuery() || (state && state.sortIndex >= 0) ? '' : 'none';
            syncToolbarOverflow(toolbar);
            return;
        }
        const state = getState(table);
        tableHeaders(table).forEach(function (th, idx) {
            const active = state.sortIndex === idx;
            th.classList.toggle('sorted', active);
            const ico = th.querySelector('.sort-ico-generic');
            if (ico) {
                ico.textContent = active ? (state.sortDir === 'ASC' ? '▲' : '▼') : '';
                ico.style.color = active ? (state.sortDir === 'ASC' ? '#ef4444' : '#3b82f6') : '';
            }
        });
        const toolbar = document.querySelector('.js-admin-list-tools-toolbar[data-table-id="' + table.id + '"]');
        const reset = toolbar ? toolbar.querySelector('.js-admin-list-sort-reset') : null;
        if (reset) reset.style.display = state.sortIndex >= 0 || hasSortQuery() ? '' : 'none';
        syncToolbarOverflow(toolbar);
    }

    function renderTable(table) {
        const state = getState(table);
        const toolbar = document.querySelector('.js-admin-list-tools-toolbar[data-table-id="' + table.id + '"]');
        const footer = document.querySelector('.js-admin-list-tools-footer[data-table-id="' + table.id + '"]');
        const tbody = table.querySelector('tbody');
        if (!state || !toolbar || !tbody) return;

        const field = (toolbar.querySelector('.js-admin-list-field') || {}).value || 'all';
        const keyword = ((toolbar.querySelector('.js-admin-list-keyword') || {}).value || '').trim().toLowerCase();
        const pageSizeRaw = (toolbar.querySelector('.js-admin-list-page-size') || {}).value || '20';

        state.filteredRows = state.rows.filter(function (row) {
            if (!keyword) return true;
            return getCellSearchText(row, field).toLowerCase().indexOf(keyword) !== -1;
        });

        if (state.sortIndex >= 0) {
            state.filteredRows.sort(function (ra, rb) {
                const av = cleanText(ra.children[state.sortIndex]);
                const bv = cleanText(rb.children[state.sortIndex]);
                const cmp = compareValues(av, bv);
                return state.sortDir === 'ASC' ? cmp : -cmp;
            });
        } else {
            state.filteredRows.sort(function (a, b) {
                return Number(a.dataset.adminListOrigOrder || 0) - Number(b.dataset.adminListOrigOrder || 0);
            });
        }

        const total = state.filteredRows.length;
        const pageSize = pageSizeRaw === 'all' ? Math.max(total, 1) : Math.max(1, Number(pageSizeRaw || 20));
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (state.page > totalPages) state.page = totalPages;
        if (state.page < 1) state.page = 1;

        const start = (state.page - 1) * pageSize;
        const end = start + pageSize;
        state.visibleRows = state.filteredRows.slice(start, end);

        Array.from(tbody.querySelectorAll('tr[data-admin-list-empty-row="true"]')).forEach(function (row) { row.remove(); });
        (state.originalEmptyRows || []).forEach(function (row) { row.style.display = 'none'; });
        state.rows.forEach(function (row) {
            row.style.display = 'none';
        });
        state.visibleRows.forEach(function (row) {
            tbody.appendChild(row);
            row.style.display = '';
        });

        if (!state.visibleRows.length) {
            const tr = document.createElement('tr');
            tr.dataset.adminListEmptyRow = 'true';
            const td = document.createElement('td');
            td.colSpan = Math.max(1, tableHeaders(table).length);
            td.style.textAlign = 'center';
            td.style.color = '#64748b';
            td.style.padding = '28px 12px';
            td.textContent = TEXT.noRows;
            tr.appendChild(td);
            tbody.appendChild(tr);
        }

        const pageInfo = (footer || toolbar).querySelector('.js-admin-list-page-info');
        const prev = (footer || toolbar).querySelector('.js-admin-list-prev');
        const next = (footer || toolbar).querySelector('.js-admin-list-next');
        if (pageInfo) pageInfo.textContent = format(TEXT.pageInfo, total, state.visibleRows.length, state.page, totalPages);
        if (prev) prev.disabled = state.page <= 1;
        if (next) next.disabled = state.page >= totalPages;

        updateSortIndicators(table);
        updateSelectionUi(table);
    }

    function enhanceSorting(table) {
        const headers = tableHeaders(table);
        if (hasServerManagedSort(table)) {
            table.dataset.adminListServerSort = 'true';
            table.classList.add('adm-admin-list-server-table');
            headers.forEach(function (th, idx) {
                if (isSelectionHeader(th)) return;
                if (th.querySelector('input, button, select, a')) return;
                if (th.hasAttribute('data-sort') || th.getAttribute('onclick')) return;
                if (th.dataset.adminListSortable === 'true') return;
                th.dataset.adminListSortable = 'true';
                th.style.cursor = 'pointer';
                th.style.userSelect = 'none';
                if (!th.querySelector('.sort-ico-generic')) {
                    th.insertAdjacentHTML('beforeend', ' <span class="sort-ico-generic" aria-hidden="true"></span>');
                }
                th.addEventListener('click', function (event) {
                    if (event.target.closest('button, a, input, select, label')) return;
                    const state = getState(table);
                    if (state.sortIndex === idx) {
                        state.sortDir = state.sortDir === 'ASC' ? 'DESC' : 'ASC';
                    } else {
                        state.sortIndex = idx;
                        state.sortDir = 'ASC';
                    }
                    state.page = 1;
                    renderTable(table);
                });
            });
            updateSortIndicators(table);
            return;
        }
        headers.forEach(function (th, idx, arr) {
            if (isSelectionHeader(th)) return;
            if (th.querySelector('input, button, select, a')) return;
            if (th.dataset.adminListSortable === 'true') return;
            th.dataset.adminListSortable = 'true';
            th.style.cursor = 'pointer';
            th.style.userSelect = 'none';
            if (!th.querySelector('.sort-ico-generic')) {
                th.insertAdjacentHTML('beforeend', ' <span class="sort-ico-generic" aria-hidden="true"></span>');
            }
            th.addEventListener('click', function (event) {
                if (event.target.closest('button, a, input, select, label')) return;
                const state = getState(table);
                if (state.sortIndex === idx) {
                    state.sortDir = state.sortDir === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    state.sortIndex = idx;
                    state.sortDir = 'ASC';
                }
                state.page = 1;
                renderTable(table);
            });
        });
    }

    function clearSelection(table) {
        const changed = [];
        allSelectionCheckboxes(table).forEach(function (cb) {
            if (cb.checked) changed.push(cb);
            cb.checked = false;
        });
        const all = table.querySelector('.js-admin-list-check-all[data-table-id="' + table.id + '"][data-admin-list-select-all="true"]');
        if (all) {
            all.checked = false;
            all.indeterminate = false;
        }
        changed.forEach(function (cb) {
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
        updateSelectionUi(table);
    }

    function bindToolbar(table, toolbar) {
        const footer = document.querySelector('.js-admin-list-tools-footer[data-table-id="' + table.id + '"]');
        const handleClick = function (event) {
            const exportBtn = event.target.closest('.js-admin-list-export');
            if (exportBtn) {
                exportTable(table, exportBtn.dataset.scope || 'page');
                return;
            }
            if (event.target.closest('.js-admin-list-clear-selection')) {
                clearSelection(table);
                return;
            }
            if (event.target.closest('.js-admin-list-filter-reset')) {
                const field = toolbar.querySelector('.js-admin-list-field');
                const keyword = toolbar.querySelector('.js-admin-list-keyword');
                if (field) field.value = 'all';
                if (keyword) keyword.value = '';
                const state = getState(table);
                state.page = 1;
                renderTable(table);
                return;
            }
            if (event.target.closest('.js-admin-list-prev')) {
                const state = getState(table);
                state.page -= 1;
                renderTable(table);
                return;
            }
            if (event.target.closest('.js-admin-list-next')) {
                const state = getState(table);
                state.page += 1;
                renderTable(table);
                return;
            }
            if (event.target.closest('.js-admin-list-sort-reset')) {
                if (hasSortQuery()) {
                    resetServerSort();
                } else {
                    const state = getState(table);
                    state.sortIndex = -1;
                    state.sortDir = 'ASC';
                    state.page = 1;
                    renderTable(table);
                }
            }
        };

        toolbar.addEventListener('click', handleClick);
        if (footer) footer.addEventListener('click', handleClick);
        if (toolbar.classList.contains('adm-admin-list-compact-export')) {
            const card = closestCard(table);
            if (card) {
                card.querySelectorAll('#bulkBar, [class*="bulk-bar"], [class*="bulkbar"]').forEach(function (bar) {
                    bar.addEventListener('click', handleClick);
                });
            }
        }

        toolbar.addEventListener('change', function (event) {
            if (event.target.matches('.js-admin-list-mode')) {
                const state = getState(table);
                if (table.dataset.adminListServerSort === 'true') {
                    applyServerLoadMode(event.target.value);
                    return;
                }
                const pageSize = toolbar.querySelector('.js-admin-list-page-size');
                if (pageSize) pageSize.value = event.target.value === 'full' ? 'all' : '20';
                state.page = 1;
                renderTable(table);
                return;
            }
            if (event.target.matches('.js-admin-list-field, .js-admin-list-page-size')) {
                const state = getState(table);
                state.page = 1;
                renderTable(table);
            }
        });
        toolbar.addEventListener('input', function (event) {
            if (event.target.matches('.js-admin-list-keyword')) {
                const state = getState(table);
                state.page = 1;
                renderTable(table);
            }
        });
    }

    function bindSelection(table) {
        table.addEventListener('change', function (event) {
            if (event.target.matches('.js-admin-list-check-all[data-table-id="' + table.id + '"][data-admin-list-select-all="true"]')) {
                const checked = event.target.checked;
                getState(table).visibleRows.forEach(function (row) {
                    const cb = rowSelectionCheckbox(row);
                    if (cb && !cb.disabled) cb.checked = checked;
                });
                updateSelectionUi(table);
                return;
            }
            if (event.target.matches('.js-admin-list-row-check[data-table-id="' + table.id + '"][data-admin-list-select="true"]')) {
                updateSelectionUi(table);
            }
        });
    }

    function enhanceTable(table, index) {
        if (!isEnhanceableTable(table)) return;
        ensureTableId(table, index);
        table.dataset.adminListToolsEnhanced = 'true';
        table.classList.add('adm-admin-list-table');

        captureState(table);
        if (getState(table).hasManualSelection && table.dataset.adminListIgnore === 'true' && hasPageOwnedSelectionControls(table)) {
            const compactToolbar = insertCompactManualTools(table);
            if (!compactToolbar) return;
            normalizeManualSelection(table);
            bindToolbar(table, compactToolbar);
            bindSelection(table);
            updateSelectionUi(table);
            return;
        }

        const toolbar = insertToolbar(table);
        if (!toolbar) return;

        enhanceSelection(table);
        populateFieldSelect(table, toolbar);
        enhanceSorting(table);
        configureLoadMode(table, toolbar);
        initToolbarOverflow(toolbar);
        bindToolbar(table, toolbar);
        bindSelection(table);
        renderTable(table);
    }

    function enhanceAll() {
        if (shouldSkipPage()) return;
        Array.from(document.querySelectorAll(SELECTOR)).forEach(enhanceTable);
    }

    function scheduleEnhance() {
        if (shouldSkipPage()) return;
        window.clearTimeout(enhanceTimer);
        enhanceTimer = window.setTimeout(enhanceAll, 80);
    }

    ready(function () {
        enhanceAll();
        if (!window.MutationObserver || !document.body) return;
        const observer = new MutationObserver(function (mutations) {
            const hasTableMutation = mutations.some(function (mutation) {
                return Array.from(mutation.addedNodes || []).some(function (node) {
                    if (!node || node.nodeType !== 1) return false;
                    return (node.matches && node.matches('table, .adm-table-wrap'))
                        || (node.querySelector && node.querySelector(SELECTOR));
                });
            });
            if (hasTableMutation) scheduleEnhance();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
