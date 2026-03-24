/**
 * HD Avatar Plugin for SillyTavern
 * 将聊天消息中的角色头像由 JPG 转换为 PNG，提升清晰度
 */

(async function () {
    'use strict';

    const MODULE_NAME = 'hd-avatar';
    const DEBUG = false;

    function log(...args) {
        if (DEBUG) console.log(`[${MODULE_NAME}]`, ...args);
    }

    /**
     * 将一个 <img> 元素的 src（JPG/JPEG）转换为 PNG Data URL
     * 通过 Canvas 重绘实现无损转换
     */
    function convertImgToPng(imgEl) {
        // 已经处理过的跳过
        if (imgEl.dataset.hdConverted === '1') return;

        const src = imgEl.src || imgEl.getAttribute('src') || '';

        // 只处理非 PNG、非 data: 的图片（即 jpg/jpeg 路径）
        if (!src || src.startsWith('data:image/png') || src.endsWith('.png')) {
            imgEl.dataset.hdConverted = '1';
            return;
        }

        // 如果图片已经加载完成，直接转换；否则等待 load
        if (imgEl.complete && imgEl.naturalWidth > 0) {
            doConvert(imgEl);
        } else {
            imgEl.addEventListener('load', () => doConvert(imgEl), { once: true });
            imgEl.addEventListener('error', () => {
                imgEl.dataset.hdConverted = '1'; // 出错则跳过
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

            // 替换 src 为 PNG Data URL
            imgEl.src = pngDataUrl;
            imgEl.dataset.hdConverted = '1';
            log('Converted avatar to PNG:', imgEl.className);
        } catch (e) {
            // 跨域图片无法通过 Canvas 读取，标记跳过
            imgEl.dataset.hdConverted = '1';
            log('Canvas convert failed (possibly CORS):', e.message);
        }
    }

    /**
     * 找到聊天区域中的所有头像 img 并执行转换
     * SillyTavern 的消息头像通常在 .avatar img 或 img.avatar 中
     */
    function processAllAvatars() {
        // 常见选择器：覆盖用户头像和角色头像
        const selectors = [
            '#chat .avatar img',
            '#chat img.avatar',
            '#chat .mes_block .avatar img',
            '#chat .ch_name .avatar img',
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
     * 使用 MutationObserver 监听新消息插入，自动处理新头像
     */
    function observeChat() {
        const chatEl = document.getElementById('chat');
        if (!chatEl) {
            // chat 元素还未出现，稍后重试
            setTimeout(observeChat, 500);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    // 直接检查新增节点中的头像
                    const imgs = node.querySelectorAll
                        ? node.querySelectorAll('img')
                        : [];

                    imgs.forEach(img => convertImgToPng(img));

                    // 节点本身也可能是 img
                    if (node.tagName === 'IMG') convertImgToPng(node);
                }
            }
        });

        observer.observe(chatEl, { childList: true, subtree: true });
        log('MutationObserver attached to #chat');
    }

    /**
     * 插件入口：等待 SillyTavern 初始化完毕后启动
     */
    function init() {
        log('HD Avatar plugin loaded');

        // 处理已有头像
        processAllAvatars();

        // 监听后续新消息
        observeChat();

        // 切换聊天时重新扫描（SillyTavern 会触发此事件）
        document.addEventListener('chat_loaded', () => {
            log('chat_loaded event — re-scanning avatars');
            setTimeout(processAllAvatars, 300);
        });

        // 兼容旧版本事件名
        document.addEventListener('chatLoaded', () => {
            setTimeout(processAllAvatars, 300);
        });
    }

    // 等待 DOM 就绪
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
