/**
 * 광고 노출 트래킹.
 * 페이지에서 data-ad-id 를 가진 .comm-ad-banner 를 찾아 IntersectionObserver 로
 * viewport 에 처음 들어온 순간 impression 카운트를 한 번만 기록한다.
 *
 * 필요 환경: window.AD_TRACKER_CTX (contextPath) JSP 에서 주입
 */
(function () {
    var CTX = window.AD_TRACKER_CTX || '';
    var banners = document.querySelectorAll('.comm-ad-banner[data-ad-id]');
    if (!banners.length) return;

    function fireImpression(adId) {
        if (!adId) return;
        try {
            fetch(CTX + '/ad/' + adId + '/impression', {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                keepalive: true
            }).catch(function () {});
        } catch (e) { /* 무시 */ }
    }

    if (typeof IntersectionObserver === 'undefined') {
        banners.forEach(function (b) { fireImpression(b.dataset.adId); });
        return;
    }

    var io = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                fireImpression(entry.target.dataset.adId);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    banners.forEach(function (b) { io.observe(b); });
})();
