/**

- HD Avatar Plugin for SillyTavern v5.0
- 集成到魔法棒菜单，一键高清化头像
  */

(async function () {
‘use strict’;

```
const MODULE_NAME = 'hd-avatar';

function log(...args) {
    console.log(`[${MODULE_NAME}]`, ...args);
}

// ========== 核心：修改缩略图配置 ==========

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

// ========== 替换缩略图为原图 ==========

function forceHDImage(imgEl) {
    if (imgEl.dataset.hdDone === '1') return;
    imgEl.dataset.hdDone = '1';
    const src = imgEl.src || '';
    if (!src || !src.includes('/thumbnails/')) return;

    const url = new URL(src, window.location.origin);
    const file = url.searchParams.get('file');
    if (!file) return;

    const paths = src.includes('persona')
        ? [`/User Avatars/${file}`, `/characters/${file}`]
        : [`/characters/${file}`, `/User Avatars/${file}`];

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

// ========== 执行高清化 ==========

async function runHD() {
    const ok = await applyHDSettings();
    await clearCache();
    scanAll();
    return ok;
}

// ========== 注入到魔法棒菜单 ==========

function injectWandMenu() {
    // 等待魔法棒菜单容器出现
    const tryInject = () => {
        // SillyTavern 魔法棒菜单的容器选择器
        const menuSelectors = [
            '#extensionsMenu',
            '#options_button_extensions_menu',
            '.extensions_menu',
            '#send_form .right-tabs',
            '#rightSendForm',
        ];

        // 找到魔法棒按钮弹出的菜单列表
        let menuList = null;
        for (const sel of menuSelectors) {
            const el = document.querySelector(sel);
            if (el) { menuList = el; break; }
        }

        // 查找包含"生成图片"等菜单项的列表
        const allMenuItems = document.querySelectorAll('.extraMesButtons, #extensionsMenu ul, .options-content ul');
        if (allMenuItems.length > 0) menuList = allMenuItems[0];

        if (!menuList) {
            setTimeout(tryInject, 500);
            return;
        }

        if (document.getElementById('hd-avatar-menu-item')) return;

        const item = document.createElement('div');
        item.id = 'hd-avatar-menu-item';
        item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;';
        item.innerHTML = `<span style="font-size:16px;">🖼️</span><span>HD头像高清化</span>`;

        item.addEventListener('click', async () => {
            item.querySelector('span:last-child').textContent = '处理中...';
            const ok = await runHD();
            item.querySelector('span:last-child').textContent = ok
                ? '✅ 已高清化（重启生效）'
                : '⚠️ 备用方案已应用';
            setTimeout(() => {
                item.querySelector('span:last-child').textContent = 'HD头像高清化';
            }, 3000);
        });

        menuList.appendChild(item);
        log('已注入魔法棒菜单');
    };

    setTimeout(tryInject, 1000);
}

// ========== 备用：注入到扩展按钮区域 ==========

function injectExtensionsArea() {
    // 尝试注入到酒馆底部工具栏
    const tryInject = () => {
        // 找到扩展按钮容器
        const containers = [
            document.querySelector('#extensionsMenu'),
            document.querySelector('.extensions_block'),
            document.querySelector('#extension_button_area'),
            document.querySelector('#send_textarea')?.closest('form'),
        ].filter(Boolean);

        if (containers.length === 0) {
            setTimeout(tryInject, 800);
            return;
        }

        if (document.getElementById('hd-wand-item')) return;

        // 找到现有的菜单项，克隆样式
        const existingItem = document.querySelector('.list-group-item[id^="extension_"], .extensionMenuItem, [data-extension-name]');

        const item = document.createElement('a');
        item.id = 'hd-wand-item';
        item.className = existingItem ? existingItem.className : '';
        item.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:6px;';
        item.innerHTML = `<i class="fa-solid fa-image"></i> <span>HD头像高清化</span>`;

        item.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const span = item.querySelector('span');
            span.textContent = '处理中...';
            const ok = await runHD();
            span.textContent = ok ? '✅ 已高清化' : '⚠️ 已应用';
            setTimeout(() => { span.textContent = 'HD头像高清化'; }, 3000);
        });

        containers[0].appendChild(item);
        log('已注入扩展区域');
    };

    setTimeout(tryInject, 1200);
}

// ========== 监听魔法棒菜单打开事件 ==========

function watchWandMenu() {
    // 监听 DOM，当魔法棒菜单出现时注入
    new MutationObserver(() => {
        const menus = [
            document.querySelector('#extensionsMenu:not([style*="display: none"])'),
            document.querySelector('.options-content:not(.hidden)'),
            document.querySelector('#options:not(.hidden)'),
        ].filter(Boolean);

        menus.forEach(menu => {
            if (menu && !menu.querySelector('#hd-avatar-wand-btn')) {
                const btn = document.createElement('div');
                btn.id = 'hd-avatar-wand-btn';
                btn.className = 'list-group-item';
                btn.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:8px;padding:8px 12px;';
                btn.innerHTML = `<i class="fa-solid fa-image"></i><span>HD头像高清化</span>`;
                btn.addEventListener('click', async () => {
                    btn.querySelector('span').textContent = '处理中...';
                    const ok = await runHD();
                    btn.querySelector('span').textContent = ok ? '✅ 已高清化（重启生效）' : '⚠️ 已应用备用方案';
                    setTimeout(() => { btn.querySelector('span').textContent = 'HD头像高清化'; }, 3000);
                });
                menu.appendChild(btn);
                log('注入魔法棒菜单成功');
            }
        });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
}

// ========== 初始化 ==========

async function init() {
    log('HD Avatar v5.0 启动');

    observe();
    watchWandMenu();
    injectWandMenu();
    injectExtensionsArea();

    // 自动静默执行
    await runHD();

    document.addEventListener('chat_loaded', () => setTimeout(scanAll, 300));
    document.addEventListener('character_loaded', () => setTimeout(scanAll, 300));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

})();
