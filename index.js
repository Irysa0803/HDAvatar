/**

- HD Avatar Plugin for SillyTavern
- 将聊天消息中的角色头像由 JPG 转换为 PNG，提升清晰度
- 同时处理：聊天小头像 + 点开的大头像弹窗
  */

(async function () {
‘use strict’;

```
const MODULE_NAME = 'hd-avatar';
const DEBUG = false;

function log(...args) {
    if (DEBUG) console.log(`[${MODULE_NAME}]`, ...args);
}

/**
 * 将一个 <img> 元素的 src 转换为 PNG Data URL
 */
function convertImgToPng(imgEl) {
    if (imgEl.dataset.hdConverted === '1') return;

    const src = imgEl.src || imgEl.getAttribute('src') || '';
    if (!src || src.startsWith('data:image/png') || src.endsWith('.png')) {
        imgEl.dataset.hdConverted = '1';
        return;
    }

    if (imgEl.complete && imgEl.naturalWidth > 0) {
        doConvert(imgEl);
    } else {
        imgEl.addEventListener('load', () => doConvert(imgEl), { once: true });
        imgEl.addEventListener('error', () => {
            imgEl.dataset.hdConverted = '1';
        }, { once: true });
    }
}

function doConvert(imgEl) {
    if (imgEl.dataset.hdConverted === '1') return;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth || imgEl.width || 100;
        canvas.height = imgEl.naturalHeight || imgEl.height || 100;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0);
        const pngDataUrl = canvas.toDataURL('image/png');
        imgEl.src = pngDataUrl;
        imgEl.dataset.hdConverted = '1';
        log('Converted to PNG:', imgEl.className);
    } catch (e) {
        imgEl.dataset.hdConverted = '1';
        log('Canvas convert failed (possibly CORS):', e.message);
    }
}

/**
 * 处理聊天区域的小头像
 */
function processAllAvatars() {
    const selectors = [
        '#chat .avatar img',
        '#chat img.avatar',
        '#chat .mes_block .avatar img',
        '.mes .avatar img',
        '.mes img.avatar',
    ];

    const seen = new Set();
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(img => {
            if (!seen.has(img)) {
                seen.add(img);
                convertImgToPng(img);
            }
        });
    });
}

/**
 * 处理角色卡列表、角色信息面板里的头像（包括点开的大图）
 */
function processLargeAvatars() {
    const selectors = [
        // 角色卡大图
        '#character_cross_talk_avatar img',
        '#avatar_load_preview',
        '.avatar_load_preview',
        // 弹窗 / 详情面板里的大头像
        '#character_popup img',
        '.character_popup img',
        '#char_popup img',
        '.zoomed_avatar img',
        '#zoomed_avatar img',
        // 角色卡列表缩略图
        '.character_select img',
        '.char_select img',
        '#rm_print_characters_block img',
        // 用户头像设置预览
        '#user_avatar_block img',
        '#your_persona_avatar img',
    ];

    const seen = new Set();
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(img => {
            if (!seen.has(img)) {
                seen.add(img);
                convertImgToPng(img);
            }
        });
    });
}

/**
 * 统一处理所有头像
 */
function processAll() {
    processAllAvatars();
    processLargeAvatars();
}

/**
 * MutationObserver 监听全局 DOM 变化
 * 包括聊天新消息、弹窗打开、角色卡加载等
 */
function observeAll() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;

                const imgs = node.querySelectorAll
                    ? node.querySelectorAll('img')
                    : [];
                imgs.forEach(img => convertImgToPng(img));

                if (node.tagName === 'IMG') convertImgToPng(node);
            }
        }
    });

    // 监听整个 body，捕获弹窗、侧边栏等所有区域
    observer.observe(document.body, { childList: true, subtree: true });
    log('MutationObserver attached to document.body');
}

/**
 * 插件入口
 */
function init() {
    log('HD Avatar plugin loaded (full coverage mode)');

    // 初始扫描
    processAll();

    // 持续监听
    observeAll();

    // 切换聊天时重新扫描
    document.addEventListener('chat_loaded', () => {
        log('chat_loaded — re-scanning');
        setTimeout(processAll, 300);
    });
    document.addEventListener('chatLoaded', () => {
        setTimeout(processAll, 300);
    });

    // 角色卡列表刷新时重新扫描
    document.addEventListener('character_loaded', () => {
        setTimeout(processLargeAvatars, 300);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

})();
