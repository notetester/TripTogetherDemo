(function () {
    'use strict';

    const bell = document.getElementById('notiBell');
    const dropdown = document.getElementById('notiDropdown');
    const markAllBtn = document.getElementById('notiMarkAll');
    if (!bell || !dropdown) return;

    const body = dropdown.querySelector('.noti-dropdown-body');
    if (!body) return;

    const cfg = window.__notificationConfig || {};
    const labels = cfg.labels || {};
    const locale = cfg.locale || undefined;

    // contextPath 추출 (예: /TripTogether)
    const ctx = cfg.ctx || (function () {
        const script = document.currentScript
            || document.querySelector('script[src*="/resources/js/common/notification.js"]');
        if (!script) return '';
        const match = script.getAttribute('src').match(/^(.*)\/resources\/js\/common\/notification\.js/);
        return match ? match[1] : '';
    })();

    // 소스 타입 → 표시 라벨
    const TYPE_LABELS = {
        community:     labels.typeCommunity || '[Community]',
        inquiry:       labels.typeInquiry || '[Inquiry]',
        report:        labels.typeReport || '[Report]',
        levelup:       labels.typeLevelup || '[Level Up]',
        grade:         labels.typeGrade || '[Grade]',
        account_block: labels.typeAccountBlock || '[Account]'
    };
    function typeLabel(sourceType) {
        return TYPE_LABELS[sourceType] || labels.typeDefault || '[Notification]';
    }

    // 날짜 포맷 (MM-dd HH:mm)
    function formatDate(value) {
        const d = value ? new Date(value) : new Date();
        const pad = function (n) { return String(n).padStart(2, '0'); };
        return new Intl.DateTimeFormat(locale, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(d).replace(',', '');
    }

    // ===== 드롭다운 토글 =====
    function closeDropdown() { dropdown.hidden = true; }
    function toggleDropdown() {
        if (dropdown.hidden) dropdown.hidden = false;
        else closeDropdown();
    }

    bell.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown();
    });
    dropdown.addEventListener('click', function (e) {
        e.stopPropagation();
    });
    document.addEventListener('click', function () {
        if (!dropdown.hidden) closeDropdown();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !dropdown.hidden) closeDropdown();
    });

    // ===== 배지 조작 =====
    function getBadge() {
        return bell.querySelector('.noti-badge');
    }
    function hideBadge() {
        const badge = getBadge();
        if (badge) badge.remove();
    }
    function decrementBadge() {
        const badge = getBadge();
        if (!badge) return;
        const current = badge.textContent;
        if (current === '99+') return;
        const next = parseInt(current, 10) - 1;
        if (next <= 0) badge.remove();
        else badge.textContent = String(next);
    }
    function incrementBadge() {
        let badge = getBadge();
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'noti-badge';
            badge.textContent = '1';
            bell.appendChild(badge);
            return;
        }
        const current = badge.textContent;
        if (current === '99+') return;
        const next = parseInt(current, 10) + 1;
        badge.textContent = next > 99 ? '99+' : String(next);
    }

    // ===== 드롭다운 행 생성/삽입 =====
    const MAX_ROWS = 5;

    function createRow(noti) {
        const row = document.createElement('div');
        row.className = 'noti-row';
        row.dataset.id = noti.notificationId;
        row.dataset.target = noti.targetUrl || '/mypage';

        const type = document.createElement('span');
        type.className = 'noti-type';
        type.textContent = typeLabel(noti.sourceType);

        const msg = document.createElement('span');
        msg.className = 'noti-msg';
        msg.textContent = noti.message || '';

        const date = document.createElement('span');
        date.className = 'noti-date';
        date.textContent = formatDate(noti.createdAt);

        row.appendChild(type);
        row.appendChild(msg);
        row.appendChild(date);
        return row;
    }

    function prependRow(noti) {
        const empty = body.querySelector('.noti-empty');
        if (empty) empty.remove();

        body.insertBefore(createRow(noti), body.firstChild);

        const rows = body.querySelectorAll('.noti-row');
        for (let i = MAX_ROWS; i < rows.length; i++) {
            rows[i].remove();
        }
    }

    // ===== 이벤트 위임: 행 클릭 → 읽음 처리 + 이동 =====
    body.addEventListener('click', function (e) {
        const row = e.target.closest('.noti-row');
        if (!row) return;
        const id = row.dataset.id;
        const fallback = ctx + (row.dataset.target || '/mypage');
        const wasUnread = !row.classList.contains('is-read');

        fetch(ctx + '/api/notifications/' + id + '/read', {
            method: 'POST',
            headers: {'X-Requested-With': 'XMLHttpRequest'}
        }).then(function (r) { return r.json(); })
          .then(function (data) {
              if (wasUnread) {
                  row.classList.add('is-read');
                  decrementBadge();
              }
              location.href = (data.success && data.targetUrl)
                  ? ctx + data.targetUrl
                  : fallback;
          })
          .catch(function () { location.href = fallback; });
    });

    // ===== 모두 읽음 =====
    if (markAllBtn) {
        markAllBtn.addEventListener('click', function () {
            fetch(ctx + '/api/notifications/read-all', {
                method: 'POST',
                headers: {'X-Requested-With': 'XMLHttpRequest'}
            }).then(function (r) { return r.json(); })
              .then(function (data) {
                  if (!data.success) return;
                  body.querySelectorAll('.noti-row').forEach(function (row) {
                      row.classList.add('is-read');
                  });
                  hideBadge();
              })
              .catch(function () {});
        });
    }

    // ===== 토스트 =====
    const TOAST_AUTO_HIDE_MS = 3000;
    const TOAST_MAX_STACK = 5;
    let toastStack = null;

    function ensureToastStack() {
        if (toastStack && document.body.contains(toastStack)) return toastStack;
        toastStack = document.createElement('div');
        toastStack.className = 'noti-toast-stack';
        document.body.appendChild(toastStack);
        return toastStack;
    }

    function removeToast(toast) {
        if (!toast || toast.classList.contains('is-hiding')) return;
        toast.classList.add('is-hiding');
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }

    // sourceType별 아이콘 이모지
    const TYPE_ICONS = {
        community:     '💬',
        inquiry:       '📮',
        report:        '⚠️',
        levelup:       '🎉',
        grade:         '🏅',
        account_block: '🔒'
    };
    function typeIcon(sourceType) {
        return TYPE_ICONS[sourceType] || '🔔';
    }

    // "[커뮤니티]" → "커뮤니티"
    function stripBrackets(label) {
        if (!label) return '';
        return String(label).replace(/^[\[\(【［]+|[\]\)】］]+$/g, '').trim();
    }

    // i18n 키가 해결되지 않은 경우 (값이 'header.' 등으로 시작) fallback 사용
    function resolveLabel(key, fallback) {
        const val = labels[key];
        if (!val) return fallback;
        if (/^(header|footer|mypage|common)\./.test(val)) return fallback;
        return val;
    }

    function goToTarget(noti) {
        const targetUrl = noti.targetUrl || '/mypage';
        fetch(ctx + '/api/notifications/' + noti.notificationId + '/read', {
            method: 'POST',
            headers: {'X-Requested-With': 'XMLHttpRequest'}
        }).catch(function () {});
        location.href = ctx + targetUrl;
    }

    function showToast(noti) {
        const stack = ensureToastStack();

        const toast = document.createElement('div');
        toast.className = 'noti-toast';

        const iconEl = document.createElement('div');
        iconEl.className = 'noti-toast-icon';
        iconEl.textContent = typeIcon(noti.sourceType);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'noti-toast-body';

        const type = document.createElement('span');
        type.className = 'noti-toast-type';
        type.textContent = stripBrackets(typeLabel(noti.sourceType));

        const msg = document.createElement('div');
        msg.className = 'noti-toast-msg';
        msg.textContent = noti.message || '';

        const meta = document.createElement('div');
        meta.className = 'noti-toast-meta';
        meta.textContent = resolveLabel('justNow', 'Just now');

        bodyEl.appendChild(type);
        bodyEl.appendChild(msg);
        bodyEl.appendChild(meta);

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'noti-toast-action';
        actionBtn.textContent = resolveLabel('view', 'View');
        actionBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            goToTarget(noti);
        });

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'noti-toast-close';
        closeBtn.setAttribute('aria-label', labels.close || 'Close');
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            removeToast(toast);
        });

        toast.appendChild(iconEl);
        toast.appendChild(bodyEl);
        toast.appendChild(actionBtn);
        toast.appendChild(closeBtn);

        toast.addEventListener('click', function () {
            goToTarget(noti);
        });

        stack.insertBefore(toast, stack.firstChild);

        // 최대 개수 초과 시 가장 오래된 것 제거
        const items = stack.querySelectorAll('.noti-toast');
        for (let i = TOAST_MAX_STACK; i < items.length; i++) {
            removeToast(items[i]);
        }

        // 자동 숨김
        setTimeout(function () { removeToast(toast); }, TOAST_AUTO_HIDE_MS);
    }

    // ===== SSE 구독 =====
    if (typeof EventSource === 'undefined') return;

    const sse = new EventSource(ctx + '/sse/notifications');
    sse.addEventListener('notification', function (e) {
        try {
            const noti = JSON.parse(e.data);
            incrementBadge();
            prependRow(noti);
            showToast(noti);
        } catch (err) {
            // JSON 파싱 실패 무시
        }
    });
    // 브라우저가 자동 재연결 처리 (기본 3초 간격)
    sse.onerror = function () {};
})();
