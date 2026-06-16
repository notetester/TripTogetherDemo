/* =====================================================================
 * TripTogether 데모 mock 레이어
 * 정적 GitHub Pages 환경에서 백엔드 없이 "둘러보기"가 되도록:
 *   - 상단에 데모 모드 안내 배너
 *   - 모든 폼 제출 가로채기 (로그인 폼은 홈으로, 나머지는 안내 토스트)
 *   - fetch / XMLHttpRequest 가로채기 → 조용히 빈 응답 + 안내
 *   - 서버로 가는 내비게이션( /TripTogether/... 절대경로 링크 )은 데모 안내
 * 이 파일은 모든 스냅샷 HTML에 주입된다.
 * ===================================================================== */
(function () {
  'use strict';
  var DEMO_HOME = (window.__DEMO_BASE__ || '') + 'index.html';

  // ---------- 배너 ----------
  function injectBanner() {
    if (document.getElementById('demo-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'demo-banner';
    bar.innerHTML = '🧭 <b>TripTogether 데모</b> — 실제 데이터가 아닌 둘러보기용 화면입니다. 저장·결제·로그인은 동작하지 않습니다.';
    bar.style.cssText = 'position:relative;z-index:99999;background:linear-gradient(90deg,#2563eb,#0ea5e9);color:#fff;' +
      'font-size:13px;line-height:1.5;padding:7px 14px;text-align:center;font-family:system-ui,sans-serif;letter-spacing:-.2px';
    if (document.body) document.body.insertBefore(bar, document.body.firstChild);
  }

  // ---------- 토스트 ----------
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('demo-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'demo-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:100000;' +
        'background:rgba(17,24,39,.95);color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;' +
        'font-family:system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .2s;max-width:88vw';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = '0'; }, 2600);
  }
  window.__demoToast = toast;

  // ---------- 로그인 폼 판별 ----------
  function isLoginForm(form) {
    return !!form.querySelector('input[name="identifier"], input[name="password"]') &&
           /login|auth/i.test((form.getAttribute('action') || '') + location.pathname);
  }

  // ---------- 폼 제출 가로채기 ----------
  document.addEventListener('submit', function (e) {
    var form = e.target;
    e.preventDefault();
    e.stopPropagation();
    if (isLoginForm(form)) {
      toast('데모 계정으로 로그인되었습니다. 홈으로 이동합니다.');
      setTimeout(function () { location.href = DEMO_HOME; }, 700);
    } else {
      toast('데모 모드에서는 저장·전송이 지원되지 않습니다.');
    }
    return false;
  }, true);

  // ---------- fetch 가로채기 ----------
  var _fetch = window.fetch;
  window.fetch = function (input) {
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    if (/\/TripTogether\//.test(url) || /^\/(?!\/)/.test(url)) {
      return Promise.resolve(new Response(JSON.stringify({ demo: true, message: '데모 모드', data: [], list: [], content: [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }
    return _fetch.apply(this, arguments);
  };

  // ---------- XHR 가로채기 ----------
  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) {
    this.__demoUrl = url || '';
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var u = this.__demoUrl || '';
    if (/\/TripTogether\//.test(u) || /^\/(?!\/)/.test(u)) {
      var self = this;
      setTimeout(function () {
        Object.defineProperty(self, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(self, 'status', { value: 200, configurable: true });
        Object.defineProperty(self, 'responseText', { value: '{"demo":true,"data":[],"list":[]}', configurable: true });
        Object.defineProperty(self, 'response', { value: '{"demo":true,"data":[],"list":[]}', configurable: true });
        if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
        if (typeof self.onload === 'function') self.onload();
      }, 50);
      return;
    }
    return _send.apply(this, arguments);
  };

  // ---------- 서버 절대경로 링크 클릭 가로채기 ----------
  // 정적 파일로 rewrite 안 된 /TripTogether/... 링크는 데모 안내
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('/TripTogether/') === 0) {
      e.preventDefault();
      toast('이 화면은 데모에 포함되지 않았습니다.');
    }
  }, true);

  // ---------- 초기화 ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner);
  } else {
    injectBanner();
  }
})();
