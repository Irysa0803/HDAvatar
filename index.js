/**

- HD Avatar Plugin for SillyTavern v3.0
- 通过调用酒馆 API 关闭缩略图压缩，让头像直接显示原图
  */

(async function () {
‘use strict’;

```
const MODULE_NAME = 'hd-avatar';

function log(...args) {
    console.log(`[${MODULE_NAME}]`, ...args);
}

// ========== 核心：通过 API 关闭缩略图 ==========

async function setThumbnailsEnabled(enabled) {
    try {
        // 先获取当前设置
        const getResp = await fetch('/api/settings/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        if (!getResp.ok) throw new Error('获取设置失败');
        const settings = await getResp.json();

        // 修改缩略图开关
        if (!settings.thumbnailsEnabled === undefined) {
            settings.thumbnailsEnabled = enabled;
        }
        settings.thumbnailsEnabled = enabled;

        // 保存设置
        const saveResp = await fetch('/api/settings/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });

        if (!saveResp.ok) throw new Error('保存设置失败');
        log('缩略图设置已更新:', enabled ? '开启' : '关闭');
        return true;
    } catch (e) {
        log('API 调用失败:', e.message);
        return false;
    }
}

// ========== 备用方案：强制替换头像为原图路径 ==========

/**
 * 把缩略图路径替换成原图路径
 * 酒馆缩略图路径格式: /thumbnails/avatar?file=xxx.jpg
 * 原图路径格式: /characters/xxx.jpg 或 /User Avatars/xxx.jpg
 */
function replaceThumbnailSrc(imgEl) {
    if (imgEl.dataset.hdFixed === '1') return;

    const src = imgEl.src || '';
    if (!src) return;

    let newSrc = null;

    // 处理角色头像缩略图
    if (src.includes('/thumbnails/avatar') || src.includes('thumbnail')) {
        const urlParams = new URLSearchParams(src.split('?')[1] || '');
        const file = urlParams.get('file');
        if (file) {
            newSrc = `/characters/${file}`;
        }
    }

    // 处理用户头像缩略图
    if (src.includes('/thumbnails/persona')) {
        const urlParams = new URLSearchParams(src.split('?')[1] || '');
        const file = urlParams.get('file');
        if (file) {
            newSrc = `/User Avatars/${file}`;
        }
    }

    if (newSrc) {
        // 尝试加载原图，成功则替换
        const testImg = new Image();
        testImg.onload = () => {
            imgEl.src = newSrc;
            imgEl.dataset.hdFixed = '1';
            log('替换为原图:', newSrc);
        };
        testImg.onerror = () => {
            // 原图加载失败，用 Canvas 转 PNG 作为兜底
            convertToPng(imgEl);
        };
        testImg.src = newSrc;
    } else {
        convertToPng(imgEl);
    }

    imgEl.dataset.hdFixed = '1';
}

function convertToPng(imgEl) {
    if (!imgEl.complete || imgEl.naturalWidth === 0) {
        imgEl.addEventListener('load', () => convertToPng(imgEl), { once: true });
        return;
    }
    try {
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth;
        canvas.height = imgEl.naturalHeight;
        canvas.getContext('2d').drawImage(imgEl, 0, 0);
        imgEl.src = canvas.toDataURL('image/png');
    } catch (e) {
        log('Canvas 转换失败:', e.message);
    }
}

// ========== 扫描所有头像 ==========

function processAllAvatars() {
    const selectors = [
        '#chat .avatar img',
        '.mes .avatar img',
        '.zoomed_avatar img',
        '#zoomed_avatar img',
        '.character_select img',
        '#rm_print_characters_block img',
        '#user_avatar_block img',
        '#your_persona_avatar img',
        '.character_popup img',
    ];
    const seen = new Set();
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(img => {
            if (!seen.has(img)) {
                seen.add(img);
                replaceThumbnailSrc(img);
            }
        });
    });
}

// ========== MutationObserver ==========

function observeAll() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                (node.querySelectorAll ? node.querySelectorAll('img') : [])
                    .forEach(img => replaceThumbnailSrc(img));
                if (node.tagName === 'IMG') replaceThumbnailSrc(node);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ========== UI 面板 ==========

function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'hd-avatar-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 16px;
        background: #1a1a2e;
        border: 1px solid #4a4a8a;
        border-radius: 12px;
        padding: 12px 16px;
        color: #fff;
        font-size: 13px;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        min-width: 180px;
        display: none;
    `;
    panel.innerHTML = `
        <div style="font-weight:bold;margin-bottom:10px;font-size:14px;">🖼️ HD Avatar</div>
        <div id="hd-status" style="margin-bottom:10px;color:#aaa;font-size:12px;">检测中...</div>
        <button id="hd-toggle-btn" style="
            width:100%;padding:6px;border:none;border-radius:8px;
            background:#5555aa;color:#fff;cursor:pointer;font-size:13px;
        ">关闭缩略图压缩</button>
        <div style="margin-top:8px;font-size:11px;color:#888;">重启酒馆后生效</div>
    `;
    document.body.appendChild(panel);

    // 触发按钮（浮动小图标）
    const trigger = document.createElement('div');
    trigger.id = 'hd-avatar-trigger';
    trigger.title = 'HD Avatar 设置';
    trigger.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 16px;
        width: 36px;
        height: 36px;
        background: #5555aa;
        border-radius: 50%;
        cursor: pointer;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    `;
    trigger.textContent = '🖼';
    document.body.appendChild(trigger);

    trigger.addEventListener('click', () => {
        const visible = panel.style.display !== 'none';
        panel.style.display = visible ? 'none' : 'block';
        trigger.style.display = visible ? 'flex' : 'none';
    });

    panel.querySelector('#hd-toggle-btn').addEventListener('click', async () => {
        const btn = panel.querySelector('#hd-toggle-btn');
        const status = panel.querySelector('#hd-status');
        btn.textContent = '处理中...';
        btn.disabled = true;

        const success = await setThumbnailsEnabled(false);
        if (success) {
            status.textContent = '✅ 已关闭压缩，重启酒馆生效';
            status.style.color = '#88ff88';
            btn.textContent = '已关闭缩略图压缩';
        } else {
            status.textContent = '⚠️ API 失败，已用备用方案';
            status.style.color = '#ffaa44';
            btn.textContent = '重试';
            btn.disabled = false;
        }

        // 无论如何都执行备用方案
        processAllAvatars();
    });

    // 关闭按钮
    panel.addEventListener('dblclick', () => {
        panel.style.display = 'none';
        trigger.style.display = 'flex';
    });
}

// ========== 初始化 ==========

async function init() {
    log('HD Avatar v3.0 启动');

    createPanel();
    processAllAvatars();
    observeAll();

    // 自动尝试关闭缩略图
    const success = await setThumbnailsEnabled(false);
    const status = document.querySelector('#hd-status');
    if (status) {
        if (success) {
            status.textContent = '✅ 已自动关闭压缩';
            status.style.color = '#88ff88';
        } else {
            status.textContent = '⚠️ 用备用方案运行中';
            status.style.color = '#ffaa44';
        }
    }

    document.addEventListener('chat_loaded', () => setTimeout(processAllAvatars, 300));
    document.addEventListener('character_loaded', () => setTimeout(processAllAvatars, 300));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

})();
