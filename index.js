/**

- HD Avatar Plugin for SillyTavern v4.0
- 通过API自动修改缩略图配置：PNG格式 + 最高质量 + 大尺寸
  */

(async function () {
‘use strict’;

```
const MODULE_NAME = 'hd-avatar';

function log(...args) {
    console.log(`[${MODULE_NAME}]`, ...args);
}

// ========== 核心：通过API修改缩略图配置 ==========

async function applyHDSettings() {
    try {
        // 获取当前设置
        const getResp = await fetch('/api/settings/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        if (!getResp.ok) throw new Error('获取设置失败 ' + getResp.status);
        const settings = await getResp.json();

        log('当前设置:', JSON.stringify(settings).substring(0, 200));

        // 修改缩略图相关配置
        // 格式改为PNG
        if ('thumbnailFormat' in settings) settings.thumbnailFormat = 'png';
        if ('thumbnail_format' in settings) settings.thumbnail_format = 'png';

        // 质量改为100
        if ('thumbnailQuality' in settings) settings.thumbnailQuality = 100;
        if ('thumbnail_quality' in settings) settings.thumbnail_quality = 100;

        // 尝试直接写入所有可能的字段名
        settings.thumbnailFormat = 'png';
        settings.thumbnailQuality = 100;
        settings.avatarThumbnailWidth = 864;
        settings.avatarThumbnailHeight = 1280;
        settings.personaThumbnailWidth = 864;
        settings.personaThumbnailHeight = 1280;

        // 保存设置
        const saveResp = await fetch('/api/settings/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });

        if (!saveResp.ok) throw new Error('保存设置失败 ' + saveResp.status);
        log('设置保存成功');
        return { success: true, method: 'api-settings' };

    } catch (e) {
        log('settings API 失败:', e.message);
    }

    // 备用：尝试通过 /api/admin/config 接口
    try {
        const resp = await fetch('/api/admin/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                thumbnails: {
                    enabled: true,
                    format: 'png',
                    quality: 100,
                    dimensions: {
                        bg: [160, 90],
                        avatar: [864, 1280],
                        persona: [864, 1280],
                    }
                }
            }),
        });
        if (resp.ok) {
            log('admin/config API 成功');
            return { success: true, method: 'api-admin' };
        }
    } catch (e) {
        log('admin/config API 失败:', e.message);
    }

    return { success: false };
}

// ========== 删除旧缩略图缓存 ==========

async function clearThumbnailCache() {
    try {
        // 尝试清除缩略图缓存的API
        const resp = await fetch('/api/thumbnails/purge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (resp.ok) {
            log('缩略图缓存已清除');
            return true;
        }
    } catch (e) {
        log('清除缓存失败:', e.message);
    }

    // 备用：尝试其他可能的清除接口
    try {
        const resp = await fetch('/api/thumbnails/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (resp.ok) {
            log('缩略图缓存已清除(clear)');
            return true;
        }
    } catch (e) {
        log('clear API 失败:', e.message);
    }

    return false;
}

// ========== 强制替换页面上的缩略图为高清原图 ==========

function forceHDImage(imgEl) {
    if (imgEl.dataset.hdDone === '1') return;
    imgEl.dataset.hdDone = '1';

    const src = imgEl.src || imgEl.getAttribute('src') || '';
    if (!src) return;

    // 如果是缩略图URL，替换为原图
    // 酒馆缩略图格式: /thumbnails/avatar?file=xxx&type=roundy
    if (src.includes('/thumbnails/')) {
        const url = new URL(src, window.location.origin);
        const file = url.searchParams.get('file');
        const type = url.searchParams.get('type') || '';

        if (file) {
            // 判断是角色头像还是用户头像
            let originalSrc = '';
            if (src.includes('/thumbnails/avatar') || src.includes('avatar')) {
                originalSrc = `/characters/${file}`;
            } else if (src.includes('/thumbnails/persona') || src.includes('persona')) {
                originalSrc = `/User Avatars/${file}`;
            } else {
                originalSrc = `/characters/${file}`;
            }

            tryLoadImage(imgEl, originalSrc);
        }
    }
}

function tryLoadImage(imgEl, newSrc) {
    const test = new Image();
    test.onload = () => {
        imgEl.src = newSrc;
        imgEl.style.imageRendering = 'high-quality';
        log('✅ 替换为原图:', newSrc);
    };
    test.onerror = () => {
        // 原图路径不对，尝试其他路径
        const fileName = newSrc.split('/').pop();
        const altPaths = [
            `/characters/${fileName}`,
            `/User Avatars/${fileName}`,
            `/data/default-user/characters/${fileName}`,
        ];
        tryAltPaths(imgEl, altPaths, 0);
    };
    test.src = newSrc;
}

function tryAltPaths(imgEl, paths, index) {
    if (index >= paths.length) return;
    const test = new Image();
    test.onload = () => {
        imgEl.src = paths[index];
        log('✅ 备用路径成功:', paths[index]);
    };
    test.onerror = () => tryAltPaths(imgEl, paths, index + 1);
    test.src = paths[index];
}

// ========== 扫描所有头像 ==========

function scanAll() {
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
        '.avatar img',
    ];
    const seen = new Set();
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(img => {
            if (!seen.has(img)) {
                seen.add(img);
                forceHDImage(img);
            }
        });
    });
}

// ========== MutationObserver ==========

function observe() {
    new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                (node.querySelectorAll ? node.querySelectorAll('img') : [])
                    .forEach(forceHDImage);
                if (node.tagName === 'IMG') forceHDImage(node);
            });
        });
    }).observe(document.body, { childList: true, subtree: true });
}

// ========== UI 面板 ==========

function createUI() {
    // 浮动按钮
    const btn = document.createElement('div');
    btn.id = 'hd-avatar-btn';
    btn.innerHTML = '🖼️';
    btn.title = 'HD Avatar';
    btn.style.cssText = `
        position: fixed; bottom: 76px; right: 12px;
        width: 38px; height: 38px; border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; cursor: pointer; z-index: 99999;
        box-shadow: 0 3px 12px rgba(102,126,234,0.5);
    `;
    document.body.appendChild(btn);

    // 面板
    const panel = document.createElement('div');
    panel.id = 'hd-avatar-panel';
    panel.style.cssText = `
        position: fixed; bottom: 124px; right: 12px;
        background: #1e1e2e; border: 1px solid #44475a;
        border-radius: 14px; padding: 14px; color: #cdd6f4;
        font-size: 13px; z-index: 99999; width: 200px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6); display: none;
        font-family: sans-serif;
    `;
    panel.innerHTML = `
        <div style="font-weight:700;font-size:15px;margin-bottom:4px;">🖼️ HD Avatar</div>
        <div style="color:#6c7086;font-size:11px;margin-bottom:12px;">头像高清化插件 v4.0</div>
        <div id="hd-status" style="
            background:#313244;border-radius:8px;padding:8px;
            margin-bottom:10px;font-size:12px;color:#a6adc8;line-height:1.5;
        ">准备就绪</div>
        <button id="hd-apply-btn" style="
            width:100%;padding:8px;border:none;border-radius:8px;
            background:linear-gradient(135deg,#667eea,#764ba2);
            color:#fff;cursor:pointer;font-size:13px;font-weight:600;
            margin-bottom:6px;
        ">一键高清化</button>
        <div style="color:#6c7086;font-size:10px;text-align:center;">
            修改配置后需重启酒馆完全生效
        </div>
    `;
    document.body.appendChild(panel);

    // 切换面板
    btn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // 一键高清化
    panel.querySelector('#hd-apply-btn').addEventListener('click', async () => {
        const applyBtn = panel.querySelector('#hd-apply-btn');
        const status = panel.querySelector('#hd-status');

        applyBtn.disabled = true;
        applyBtn.textContent = '处理中...';
        status.textContent = '⏳ 正在修改配置...';

        const result = await applyHDSettings();

        if (result.success) {
            status.innerHTML = '✅ 配置修改成功！<br>格式: PNG | 质量: 100<br>尺寸: 864×1280<br><br>⚠️ 请重启酒馆生效';
            status.style.color = '#a6e3a1';
        } else {
            status.innerHTML = '⚠️ API修改失败<br>已启用备用方案<br>（直接替换页面图片）';
            status.style.color = '#fab387';
        }

        // 清除缓存
        const cleared = await clearThumbnailCache();
        if (cleared) {
            status.innerHTML += '<br>🗑️ 缓存已清除';
        }

        // 无论如何都执行页面替换
        scanAll();
        applyBtn.textContent = '✅ 已应用';
        setTimeout(() => {
            applyBtn.disabled = false;
            applyBtn.textContent = '一键高清化';
        }, 3000);
    });
}

// ========== 初始化 ==========

async function init() {
    log('HD Avatar v4.0 启动');
    createUI();
    observe();

    // 自动静默应用
    const result = await applyHDSettings();
    await clearThumbnailCache();
    setTimeout(scanAll, 500);

    const status = document.querySelector('#hd-status');
    if (status) {
        status.textContent = result.success
            ? '✅ 已自动应用高清配置'
            : '⚠️ 备用方案运行中';
    }

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
