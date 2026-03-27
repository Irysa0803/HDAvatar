/**

- HD Avatar Plugin for SillyTavern v5.1
- 精准注入魔法棒菜单（options-content）
  */

(async function () {
‘use strict’;

```
const MODULE_NAME = 'hd-avatar';
function log(...args) { console.log(`[${MODULE_NAME}]`, ...args); }

async function applyHDSettings() {
    try {
        const getResp = await fetch('/api/settings/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (!getResp.ok) throw new Error('get failed');
        const settings = await getResp.json();
        settings.thumbnailFormat = 'png';
        settings.thumbnailQuality = 100;
        settings.avatarThumbnailWidth = 864;
        settings.avatarThumbnailHeight = 1280;
        settings.personaThumbnailWidth = 864;
        settings.personaThumbnailHeight = 1280;
        const saveResp = await fetch('/api/settings/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        if (!saveResp.ok) throw new Error('save failed');
        return true;
    } catch (e) {
        log('settings API failed:', e.message);
        return false;
    }
}

async function clearCache() {
    for (const url of ['/api/thumbnails/purge', '/api/thumbnails/clear']) {
        try {
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            if (r.ok) return true;
        } catch (e) {}
    }
    return false;
}

function forceHDImage(imgEl) {
    if (imgEl.dataset.hdDone === '1') return;
    imgEl.dataset.hdDone = '1';
    const src = imgEl.src || '';
    if (!src || !src.includes('/thumbnails/')) return;
    const url = new URL(src, window.location.origin);
    const file = url.searchParams.get('file');
    if (!file) return;
    const paths = src.includes('persona')
        ? ['/User Avatars/' + file, '/characters/' + file]
        : ['/characters/' + file, '/User Avatars/' + file];
    tryPaths(imgEl, paths, 0);
}

function tryPaths(imgEl, paths, i) {
    if (i >= paths.length) return;
    const t = new Image();
    t.onload = () => { imgEl.src = paths[i]; };
    t.onerror = () => tryPaths(imgEl, paths, i + 1);
    t.src = paths[i];
}

function scanAll() {
    document.querySelectorAll('.avatar img, #chat img, .character_select img, .zoomed_avatar img, #zoomed_avatar img, #user_avatar_block img').forEach(forceHDImage);
}

function observe() {
    new MutationObserver(muts => {
        muts.forEach(m => m.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            (n.querySelectorAll ? n.querySelectorAll('img') : []).forEach(forceHDImage);
            if (n.tagName === 'IMG') forceHDImage(n);
        }));
    }).observe(document.body, { childList: true, subtree: true });
}

async function runHD() {
    const ok = await applyHDSettings();
    await clearCache();
    scanAll();
    return ok;
}

function injectMenuItem() {
    if (document.getElementById('hd-avatar-wand-btn')) return;
    const menu = document.querySelector('.options-content[role="list"]');
    if (!menu) return;

    const existingLink = menu.querySelector('a');
    const existingClass = existingLink ? existingLink.className : '';

    const item = document.createElement('a');
    item.id = 'hd-avatar-wand-btn';
    item.className = existingClass;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.style.cursor = 'pointer';
    item.innerHTML = '<i class="fa-lg fa-solid fa-image"></i><span id="hd-wand-label">HD头像高清化</span>';

    item.addEventListener('click', async function(e) {
        e.preventDefault();
        var label = document.getElementById('hd-wand-label');
        if (label) label.textContent = '⏳ 处理中...';
        var ok = await runHD();
        if (label) {
            label.textContent = ok ? '✅ 已高清化（重启生效）' : '⚠️ 备用方案已应用';
            setTimeout(function() { label.textContent = 'HD头像高清化'; }, 3000);
        }
    });

    menu.appendChild(item);
    log('已注入魔法棒菜单');
}

function watchMenu() {
    new MutationObserver(function() {
        var menu = document.querySelector('.options-content[role="list"]');
        if (menu && !document.getElementById('hd-avatar-wand-btn')) {
            injectMenuItem();
        }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
}

async function init() {
    log('HD Avatar v5.1 启动');
    observe();
    watchMenu();
    setTimeout(injectMenuItem, 500);
    await runHD();
    document.addEventListener('chat_loaded', function() { setTimeout(scanAll, 300); });
    document.addEventListener('character_loaded', function() { setTimeout(scanAll, 300); });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

})();
