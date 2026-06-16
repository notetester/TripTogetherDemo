(function () {
    'use strict';

    const root = document.getElementById('chatbot-box');
    if (!root) return;

    // ===== Config injected by footer.jsp through window.__chatbotConfig =====
    const cfg = window.__chatbotConfig || {};
    const ctx = cfg.ctx || '';
    const loggedIn = !!cfg.loggedIn;
    const locale = cfg.locale || undefined;
    const msg = cfg.msg || {};

    const STORAGE_KEY = loggedIn ? null : 'chatbot_anon_conv_id';

    // ===== DOM =====
    const toggle   = document.getElementById('chatbot-toggle');
    const box      = root;
    const sidebar  = document.getElementById('cb-sidebar');
    const convList = document.getElementById('cb-conv-list');
    const newBtn   = document.getElementById('cb-new');
    const body     = document.getElementById('cb-body');
    const input    = document.getElementById('cb-input');
    const sendBtn  = document.getElementById('cb-send');
    const badge    = document.getElementById('chatbot-badge');
    const suggs    = document.getElementById('cb-suggestions');
    const titleEl  = document.getElementById('cb-header-title');
    const resetBtn = document.getElementById('cb-reset');

    // ===== State =====
    let isOpen = false;
    let isTyping = false;
    let currentConvId = null;      // Active conversation ID. null means a fresh conversation.

    const INITIAL_SUGGESTIONS = [
        { label: msg.suggestPopular,   msg: msg.suggestPopularMsg },
        { label: msg.suggestCourses,   msg: msg.suggestCoursesMsg },
        { label: msg.suggestAssistant, msg: msg.suggestAssistantMsg },
        { label: msg.suggestCommunity, msg: msg.suggestCommunityMsg },
        ...(!loggedIn ? [{ label: msg.suggestAuth, msg: msg.suggestAuthMsg }] : [])
    ];

    // ===== Toggle =====
    function openChat() {
        isOpen = true;
        box.classList.add('open');
        toggle.classList.add('open');
        document.getElementById('cb-toggle-icon').textContent = '✕';
        if (badge) badge.classList.remove('show');

        // Load conversations only on the first open.
        if (!box.dataset.initialized) {
            box.dataset.initialized = '1';
            initChat();
        }
        setTimeout(() => { input.focus(); scrollBottom(); }, 50);
    }

    function closeChat() {
        isOpen = false;
        box.classList.remove('open');
        toggle.classList.remove('open');
        document.getElementById('cb-toggle-icon').textContent = '✈️';
    }

    toggle.addEventListener('click', () => isOpen ? closeChat() : openChat());
    document.getElementById('cb-close').addEventListener('click', closeChat);

    // ===== 현재 대화 초기화 (헤더 버튼) =====
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            if (!currentConvId) return;
            cbConfirm(msg.confirmReset || 'Reset current conversation?', {
                danger: true,
                yesLabel: msg.confirmYes,
                noLabel:  msg.confirmNo
            }).then(function (ok) {
                if (!ok) return;
                const idToDelete = currentConvId;
                currentConvId = null;
                if (STORAGE_KEY) sessionStorage.removeItem(STORAGE_KEY);
                body.innerHTML = '';
                if (titleEl) titleEl.textContent = msg.welcomeTitle || '';
                renderWelcome();
                updateResetBtnVisibility();
                fetch(ctx + '/chatbot/conversations/' + idToDelete, { method: 'DELETE' })
                    .catch(function () {})
                    .finally(function () {
                        if (loggedIn) loadConversationList();
                    });
            });
        });
    }

    function updateResetBtnVisibility() {
        if (!resetBtn) return;
        resetBtn.hidden = !currentConvId;
    }

    // ===== 초기화 =====
    async function initChat() {
        if (loggedIn) {
            await loadConversationList();
            // Open the most recent conversation when one exists.
            const convs = convList ? convList.querySelectorAll('[data-conv-id]') : [];
            if (convs.length > 0) {
                openConversation(parseInt(convs[0].dataset.convId, 10));
            } else {
                renderWelcome();
            }
        } else {
            // Anonymous users restore a conversation ID from sessionStorage.
            const savedId = STORAGE_KEY ? sessionStorage.getItem(STORAGE_KEY) : null;
            if (savedId) {
                await openConversation(parseInt(savedId, 10));
            } else {
                renderWelcome();
            }
        }
    }

    // ===== Conversation list for signed-in users =====
    async function loadConversationList() {
        if (!convList) return;
        try {
            const res = await fetch(ctx + '/chatbot/conversations');
            const data = await res.json();
            renderConversationList(data.conversations || []);
        } catch (e) {
            convList.innerHTML = '';
        }
    }

    function renderConversationList(list) {
        if (!convList) return;
        convList.innerHTML = '';
        list.forEach(c => {
            const row = document.createElement('div');
            row.className = 'cb-conv-item';
            row.dataset.convId = c.conversationId;
            row.draggable = true;
            if (currentConvId === c.conversationId) row.classList.add('active');

            const title = document.createElement('span');
            title.className = 'cb-conv-title';
            title.textContent = c.title || (msg.welcomeTitle || '새 대화');
            title.addEventListener('click', () => openConversation(c.conversationId));

            const menu = document.createElement('button');
            menu.className = 'cb-conv-menu';
            menu.type = 'button';
            menu.textContent = '⋯';
            menu.addEventListener('click', (e) => {
                e.stopPropagation();
                openConvMenu(c, row, menu);
            });

            row.appendChild(title);
            row.appendChild(menu);
            bindDnD(row);
            convList.appendChild(row);
        });
    }

    // ===== 대화 목록 드래그앤드롭 =====
    let dragSrc = null;

    function bindDnD(row) {
        row.addEventListener('dragstart', function (e) {
            dragSrc = row;
            row.classList.add('is-dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', row.dataset.convId || ''); } catch (err) {}
            }
        });
        row.addEventListener('dragend', function () {
            row.classList.remove('is-dragging');
            clearDropIndicators();
            dragSrc = null;
        });
        row.addEventListener('dragover', function (e) {
            if (!dragSrc || dragSrc === row) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            const rect = row.getBoundingClientRect();
            const before = (e.clientY - rect.top) < rect.height / 2;
            clearDropIndicators();
            row.classList.add(before ? 'is-drop-before' : 'is-drop-after');
        });
        row.addEventListener('dragleave', function () {
            row.classList.remove('is-drop-before', 'is-drop-after');
        });
        row.addEventListener('drop', function (e) {
            if (!dragSrc || dragSrc === row) return;
            e.preventDefault();
            const before = row.classList.contains('is-drop-before');
            clearDropIndicators();
            if (before) convList.insertBefore(dragSrc, row);
            else convList.insertBefore(dragSrc, row.nextSibling);
            persistConvOrder();
        });
    }

    function clearDropIndicators() {
        if (!convList) return;
        convList.querySelectorAll('.is-drop-before, .is-drop-after').forEach(function (el) {
            el.classList.remove('is-drop-before', 'is-drop-after');
        });
    }

    function persistConvOrder() {
        if (!convList) return;
        const ids = Array.from(convList.querySelectorAll('.cb-conv-item[data-conv-id]'))
            .map(function (el) { return parseInt(el.dataset.convId, 10); })
            .filter(function (n) { return !isNaN(n); });
        if (ids.length === 0) return;
        fetch(ctx + '/chatbot/conversations/order', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids })
        }).catch(function () {});
    }

    // ===== 대화 메뉴 팝오버 =====
    let openPopover = null;
    let docClickHandler = null;

    function closeConvMenu() {
        if (openPopover && openPopover.parentNode) openPopover.parentNode.removeChild(openPopover);
        openPopover = null;
        if (docClickHandler) {
            document.removeEventListener('click', docClickHandler, true);
            docClickHandler = null;
        }
    }

    function openConvMenu(conv, rowEl, anchorBtn) {
        closeConvMenu();
        const pop = document.createElement('div');
        pop.className = 'cb-conv-pop';
        pop.innerHTML =
            '<button type="button" class="cb-conv-pop-item" data-act="rename">' + escHtml(msg.menuRename || 'Rename') + '</button>' +
            '<button type="button" class="cb-conv-pop-item cb-conv-pop-danger" data-act="delete">' + escHtml(msg.menuDelete || 'Delete') + '</button>';
        rowEl.appendChild(pop);
        openPopover = pop;

        pop.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            e.stopPropagation();
            const act = btn.dataset.act;
            if (act === 'rename') {
                closeConvMenu();
                startInlineRename(conv, rowEl);
            } else if (act === 'delete') {
                closeConvMenu();
                cbConfirm(msg.confirmDelete || 'Delete this conversation?', {
                    danger: true,
                    yesLabel: msg.confirmYes,
                    noLabel:  msg.confirmNo
                }).then(function (ok) {
                    if (ok) deleteConversation(conv.conversationId);
                });
            }
        });

        // 다음 틱에 문서 클릭 감지 설치 (현재 클릭 이벤트 버블링으로 즉시 닫히지 않게)
        setTimeout(function () {
            docClickHandler = function (e) {
                if (!pop.contains(e.target) && e.target !== anchorBtn) closeConvMenu();
            };
            document.addEventListener('click', docClickHandler, true);
        }, 0);
    }

    function startInlineRename(conv, rowEl) {
        const titleEl = rowEl.querySelector('.cb-conv-title');
        if (!titleEl) return;
        const originalText = titleEl.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cb-conv-title-input';
        input.value = originalText;
        input.placeholder = msg.editPlaceholder || '';

        titleEl.replaceWith(input);
        input.focus();
        input.setSelectionRange(0, input.value.length);

        let done = false;
        function finish(save) {
            if (done) return;
            done = true;
            const newValue = input.value.trim();
            // 원래 span 복원
            const newTitle = document.createElement('span');
            newTitle.className = 'cb-conv-title';
            if (save && newValue && newValue !== originalText) {
                newTitle.textContent = newValue;
                newTitle.addEventListener('click', () => openConversation(conv.conversationId));
                input.replaceWith(newTitle);
                renameConversation(conv.conversationId, newValue);
            } else {
                newTitle.textContent = originalText;
                newTitle.addEventListener('click', () => openConversation(conv.conversationId));
                input.replaceWith(newTitle);
            }
        }

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', function () { finish(true); });
    }

    async function renameConversation(convId, newTitle) {
        try {
            await fetch(ctx + '/chatbot/conversations/' + convId + '/title', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            });
            await loadConversationList();
        } catch (e) {}
    }

    async function deleteConversation(convId) {
        try {
            await fetch(ctx + '/chatbot/conversations/' + convId, { method: 'DELETE' });
            if (currentConvId === convId) {
                currentConvId = null;
                renderWelcome();
                updateResetBtnVisibility();
            }
            await loadConversationList();
        } catch (e) {}
    }

    // ===== Start a new conversation =====
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            currentConvId = null;
            if (STORAGE_KEY) sessionStorage.removeItem(STORAGE_KEY);
            body.innerHTML = '';
            if (titleEl) titleEl.textContent = msg.welcomeTitle || msg.untitledConversation || 'New Conversation';
            renderWelcome();
            updateResetBtnVisibility();
            if (loggedIn) loadConversationList();
            input.focus();
        });
    }

    // ===== Open a conversation =====
    async function openConversation(convId) {
        try {
            const res = await fetch(ctx + '/chatbot/conversations/' + convId + '/messages');
            if (!res.ok) {
                // 403/404 can happen when an anonymous session expires.
                if (STORAGE_KEY) sessionStorage.removeItem(STORAGE_KEY);
                currentConvId = null;
                renderWelcome();
                updateResetBtnVisibility();
                return;
            }
            const data = await res.json();
            currentConvId = convId;
            updateResetBtnVisibility();
            if (STORAGE_KEY) sessionStorage.setItem(STORAGE_KEY, String(convId));
            if (titleEl && data.conversation) titleEl.textContent = data.conversation.title || msg.untitledConversation || 'New Conversation';
            body.innerHTML = '';
            suggs.innerHTML = '';
            (data.messages || []).forEach(m => {
                if (m.role === 'user') {
                    appendUserMsg(m.content, false);
                } else {
                    try {
                        const parsed = JSON.parse(m.content);
                        parsed.messageId = m.messageId;
                        appendBotResponse(parsed, false);
                    } catch (e) {
                        appendBotResponse({ message: m.content, links: [], quickReplies: [], messageId: m.messageId }, false);
                    }
                }
            });
            if (loggedIn) {
                renderConversationList(
                    Array.from(convList.children).map(el => ({
                        conversationId: parseInt(el.dataset.convId, 10),
                        title: el.querySelector('.cb-conv-title').textContent
                    }))
                );
            }
            scrollBottom();
        } catch (e) {
            renderWelcome();
        }
    }

    // ===== Welcome screen =====
    function renderWelcome() {
        body.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'cb-msg-wrap bot';
        wrap.innerHTML = '<div class="cb-welcome">' +
            '<div class="cb-welcome-title">' + escHtml(msg.welcomeTitle || 'Hello!') + '</div>' +
            escHtml(msg.welcomeBody1 || '') + '<br>' +
            escHtml(msg.welcomeBody2 || '') +
            '</div>';
        body.appendChild(wrap);
        renderSuggestions(INITIAL_SUGGESTIONS.map(s => s.label));
    }

    function renderSuggestions(chips) {
        suggs.innerHTML = '';
        chips.forEach(label => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cb-suggest-chip';
            chip.textContent = label;
            chip.addEventListener('click', () => {
                const found = INITIAL_SUGGESTIONS.find(s => s.label === label);
                input.value = found ? found.msg : label;
                suggs.innerHTML = '';
                sendMessage();
            });
            suggs.appendChild(chip);
        });
    }

    function appendUserMsg(text, shouldScroll) {
        const wrap = document.createElement('div');
        wrap.className = 'cb-msg-wrap user';
        wrap.innerHTML = '<div class="cb-msg user">' + escHtml(text) + '</div>' +
            '<div class="cb-time">' + getTime() + '</div>';
        body.appendChild(wrap);
        if (shouldScroll !== false) scrollBottom();
    }

    function showTyping() {
        const el = document.createElement('div');
        el.id = 'cb-typing';
        el.className = 'cb-msg-wrap bot';
        el.innerHTML = '<div class="cb-typing"><span></span><span></span><span></span></div>';
        body.appendChild(el);
        scrollBottom();
    }

    function hideTyping() {
        const el = document.getElementById('cb-typing');
        if (el) el.remove();
    }

    function appendBotResponse(data, shouldScroll) {
        const wrap = document.createElement('div');
        wrap.className = 'cb-msg-wrap bot';

        if (data.message) {
            const msgEl = document.createElement('div');
            msgEl.className = 'cb-msg bot' + (data.inappropriate ? ' warn' : '');
            msgEl.innerHTML = formatBotText(data.message);
            wrap.appendChild(msgEl);
        }
        body.appendChild(wrap);

        if (data.links && data.links.length > 0) {
            const linksWrap = document.createElement('div');
            linksWrap.className = 'cb-links';
            const msgId = data.messageId;
            data.links.forEach(link => {
                const row = document.createElement('div');
                row.className = 'cb-link-row';

                const a = document.createElement('a');
                a.className = 'cb-link-btn';
                a.href = ctx + link.url;
                a.innerHTML = '<span class="cb-link-icon">' + (link.icon || '→') + '</span>' + escHtml(link.label);
                if (msgId) {
                    a.addEventListener('click', function () {
                        sendLinkClickBeacon(msgId, link.url, link.label);
                    });
                }
                row.appendChild(a);

                const newTabBtn = document.createElement('button');
                newTabBtn.type = 'button';
                newTabBtn.className = 'cb-link-newtab';
                newTabBtn.title = msg.openNewTab || 'Open in new tab';
                newTabBtn.setAttribute('aria-label', msg.openNewTab || 'Open in new tab');
                newTabBtn.textContent = '↗';
                newTabBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (msgId) sendLinkClickBeacon(msgId, link.url, link.label);
                    window.open(ctx + link.url, '_blank', 'noopener');
                });
                row.appendChild(newTabBtn);

                linksWrap.appendChild(row);
            });
            body.appendChild(linksWrap);
        }

        const timeEl = document.createElement('div');
        timeEl.className = 'cb-time';
        timeEl.style.alignSelf = 'flex-start';
        timeEl.textContent = getTime();
        body.appendChild(timeEl);

        if (data.quickReplies && data.quickReplies.length > 0) {
            renderQuickReplies(data.quickReplies);
        } else {
            suggs.innerHTML = '';
        }

        if (shouldScroll !== false) scrollBottom();
    }

    function renderQuickReplies(replies) {
        suggs.innerHTML = '';
        replies.forEach(r => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cb-suggest-chip';
            chip.textContent = r;
            chip.addEventListener('click', () => {
                input.value = r;
                suggs.innerHTML = '';
                sendMessage();
            });
            suggs.appendChild(chip);
        });
    }

    // ===== Send message =====
    async function sendMessage() {
        const text = input.value.trim();
        if (!text || isTyping) return;

        input.value = '';
        suggs.innerHTML = '';
        appendUserMsg(text);

        isTyping = true;
        sendBtn.disabled = true;
        showTyping();

        try {
            const res = await fetch(ctx + '/chatbot/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    conversationId: currentConvId,
                    currentPath: window.location.pathname.replace(ctx, ''),
                    loggedIn: loggedIn
                })
            });
            const data = await res.json();
            hideTyping();
            appendBotResponse(data);

            // Store the conversation ID when the server created a new one.
            if (!currentConvId && data.conversationId) {
                currentConvId = data.conversationId;
                if (STORAGE_KEY) sessionStorage.setItem(STORAGE_KEY, String(currentConvId));
                updateResetBtnVisibility();
                if (loggedIn) loadConversationList();
            }
        } catch (e) {
            hideTyping();
            appendBotResponse({ message: msg.error || 'An error occurred.', links: [], quickReplies: [] });
        } finally {
            isTyping = false;
            sendBtn.disabled = false;
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ===== Utilities =====
    function scrollBottom() {
        requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
    }

    function getTime() {
        return new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatBotText(text) {
        return escHtml(text).replace(/\n/g, '<br>');
    }

    // ===== 공통 확인 모달 =====
    let confirmModalEl = null;
    function cbConfirm(messageText, opts) {
        opts = opts || {};
        const danger    = !!opts.danger;
        const yesLabel  = opts.yesLabel || msg.confirmYes || 'Confirm';
        const noLabel   = opts.noLabel  || msg.confirmNo  || 'Cancel';

        return new Promise(function (resolve) {
            if (!confirmModalEl) {
                confirmModalEl = document.createElement('div');
                confirmModalEl.className = 'cb-confirm-modal';
                confirmModalEl.hidden = true;
                confirmModalEl.innerHTML =
                    '<div class="cb-confirm-backdrop"></div>' +
                    '<div class="cb-confirm-dialog" role="dialog" aria-modal="true">' +
                        '<div class="cb-confirm-msg"></div>' +
                        '<div class="cb-confirm-actions">' +
                            '<button type="button" class="cb-confirm-no"></button>' +
                            '<button type="button" class="cb-confirm-yes"></button>' +
                        '</div>' +
                    '</div>';
                box.appendChild(confirmModalEl);
            }
            const msgEl = confirmModalEl.querySelector('.cb-confirm-msg');
            const yesEl = confirmModalEl.querySelector('.cb-confirm-yes');
            const noEl  = confirmModalEl.querySelector('.cb-confirm-no');
            const backdrop = confirmModalEl.querySelector('.cb-confirm-backdrop');
            msgEl.textContent = messageText;
            yesEl.textContent = yesLabel;
            noEl.textContent  = noLabel;
            yesEl.classList.toggle('is-danger', danger);

            confirmModalEl.hidden = false;
            requestAnimationFrame(function () { confirmModalEl.classList.add('is-open'); });

            function cleanup(result) {
                confirmModalEl.classList.remove('is-open');
                confirmModalEl.hidden = true;
                yesEl.onclick = null;
                noEl.onclick = null;
                backdrop.onclick = null;
                document.removeEventListener('keydown', onKey);
                resolve(result);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
                else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
            }
            yesEl.onclick = function () { cleanup(true); };
            noEl.onclick  = function () { cleanup(false); };
            backdrop.onclick = function () { cleanup(false); };
            document.addEventListener('keydown', onKey);
            setTimeout(function () { yesEl.focus(); }, 0);
        });
    }

    // 링크 클릭 이력을 서버에 비동기 전송 (네비게이션은 그대로 진행)
    function sendLinkClickBeacon(messageId, url, label) {
        if (!messageId || !currentConvId) return;
        try {
            const payload = JSON.stringify({
                messageId: messageId,
                conversationId: currentConvId,
                url: url,
                label: label
            });
            const endpoint = ctx + '/chatbot/link-click';
            if (navigator.sendBeacon) {
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(endpoint, blob);
            } else {
                fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    keepalive: true
                }).catch(() => {});
            }
        } catch (e) {}
    }
})();
