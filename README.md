# 岳岳 × 昆昆的回忆网站

一个只属于岳岳和昆昆的共同记录网站。首页单独展示在一起的天数，进入后显示五个记录入口：

- 一起吃过的
- 要和昆昆做的 100 件小事
- 一起拍下的照片
- 一起吵过的架
- 心动瞬间

网站使用奶油粉手账风、圆角贴纸、Hello Kitty、美乐蒂、库洛米、布丁狗和帕恰狗装饰。

## 当前状态

- 纪念日为 **2026 年 9 月 22 日**，天数按北京时间自动计算，并包含纪念日当天。
- 原来的 100 件小事已经导入，可以勾选、筛选、增加和移除；完成数字会立即刷新。
- 五个页面都有录入区域。
- 一起吃过的东西包含日期、食物、好吃程度和照片四个输入项。
- 十张私人照片已经从公开网站文件中移出，保存在 Supabase 私密 Storage 中。
- 两个人使用同一个共同账号登录，登录后才能读取数据库和查看照片。
- 手机和电脑共用同一份云端数据；电脑关机不会丢失。
- 对方更新后，页面会显示“另一边更新了，点我刷新”。

## 数据与隐私

公开的 GitHub 仓库只保存网页代码和 Sanrio/插画装饰，不保存真人照片或数据库密码。

私人内容分两部分保存：

- 文字记录保存在 Supabase 的 `public.shared_state` 表。
- 照片保存在私密桶 `private-memories`，页面登录后临时生成有效链接。

数据库启用了 Row Level Security，只有已登录的共同账号可以读写。照片桶不是公开桶，未登录无法直接取得照片。

`supabase-config.js` 中的 `publishableKey` 是可以公开在浏览器里的项目公钥。它不是管理密钥，真正的访问控制由登录状态和 RLS 完成。不要把 Supabase 的 `secret` / `service_role` 密钥写入网页或 GitHub。

## 本地打开

直接双击 `index.html` 可以使用本地模式预览和填写，数据保存在这台电脑的浏览器中。

要在本地测试完整云端模式，可在 `outputs` 目录运行：

```powershell
python -m http.server 8080
```

然后打开 `http://localhost:8080`。因为该地址不是 `file://`，网站会显示共同账号登录页。

## 部署

这是纯静态网站，可以直接部署到 GitHub Pages、Cloudflare Pages、Vercel、Netlify 或阿里云 OSS。

部署到 GitHub Pages 时上传以下内容到仓库根目录：

```text
index.html
data.js
app.js
styles.css
theme-final.css
cloud-auth.css
supabase-config.js
site-bootstrap.js
robots.txt
README.md
assets/
```

GitHub Pages 发布后，首次访问需要：

1. 输入共同账号。
2. 输入共同密码。
3. 进入回忆封面，点击“进入回忆”。

登录状态会在设备上保留。退出时点击右下角“退出共同账号”。

## 日常修改

- 双方名字和纪念日：编辑 `data.js` 的 `couple`。
- 新增、删除或修改记录：直接在网页中操作。
- 更换照片：在对应页面选择照片后提交，照片会上传到私密 Storage。
- 修改页面配色、字体或装饰：编辑 CSS 和 `assets/`，然后重新部署网页代码。
- 修改共同账号密码：在 Supabase 的 **Authentication → Users** 中操作。

云端数据库里的记录和照片不会因为重新部署网页代码而被覆盖。

## Sanrio 图片说明

Hello Kitty、美乐蒂、库洛米、布丁狗和帕恰狗的图片来自 Sanrio 日本官方网站角色页，版权归 SANRIO CO., LTD. 所有，仅建议用于个人、非商业用途。

- Hello Kitty：https://www.sanrio.co.jp/character/hellokitty/
- 美乐蒂：https://www.sanrio.co.jp/character/mymelody/
- 库洛米：https://www.sanrio.co.jp/character/kuromi/
- 布丁狗：https://www.sanrio.co.jp/character/pompompurin/
- 帕恰狗：https://www.sanrio.co.jp/character/pochacco/
