# HD Avatar — SillyTavern 插件

将 SillyTavern 聊天界面中角色 / 用户的小头像从 **JPG** 实时转换为 **PNG**，消除 JPEG 压缩伪影，让头像更清晰锐利。

---

## 安装方法

1. 将整个 `hd-avatar` 文件夹复制到 SillyTavern 的插件目录：

```
SillyTavern/public/scripts/extensions/third-party/hd-avatar/
```

2. 启动（或重启）SillyTavern。

3. 进入 **扩展（Extensions）** 面板，找到 **HD Avatar** 并启用。

---

## 工作原理

| 步骤 | 说明 |
|------|------|
| 1 | 插件在页面加载后扫描 `#chat` 区域内所有 `<img>` 头像元素 |
| 2 | 通过 HTML5 **Canvas** 将图像重新绘制并导出为 `image/png` Data URL |
| 3 | 将 `<img>` 的 `src` 替换为 PNG Data URL，浏览器即以 PNG 无损格式渲染 |
| 4 | **MutationObserver** 持续监听新消息，自动对新出现的头像执行相同转换 |
| 5 | 每张图片只转换一次（通过 `data-hd-converted` 标记去重） |

> **注意**：Canvas 转换受浏览器同源策略限制。若头像图片来自跨域 CDN 且服务器未设置 CORS 头，转换会静默跳过（原 JPG 仍正常显示）。本地存储的头像文件不受此限制。

---

## 文件结构

```
hd-avatar/
├── manifest.json   # 插件元数据
├── index.js        # 核心逻辑（Canvas PNG 转换 + MutationObserver）
├── style.css       # 补充 CSS（高质量渲染提示）
└── README.md       # 本说明文件
```

---

## 调试

在 `index.js` 顶部将 `const DEBUG = false` 改为 `true`，即可在浏览器控制台看到转换日志。
