# Dazzle Pocket Camera Lab

做一个手机端优先（宽度390px）的复古相机App原型，名字叫"Dazz Lab"，中文界面。这是课程作业的交互原型，不需要真实后端，状态用React state管理即可。

【视觉风格】

背景接近纯黑 #000000。相机图标要有立体感和高饱和色彩（参考常见的3D渲染图标风格，不要做成极简线条），每台相机外观和配色都不一样，这是整个App最有辨识度的部分。

标题用衬线字体（Noto Serif SC），标签和数值用等宽字体（IBM Plex Mono），正文用无衬线字体。

强调色：琥珀橙 #E8923A（Pro标记和主按钮），青绿 #5BC0B5（AI建议标记）。

照片处理相关的页面（工作台、成品）可以切换到暖灰或米白背景，和相机选择页的纯黑形成"选相机→进暗房→出成品"的节奏变化。

【全局规则】

1. 所有Pro功能都可以正常试用，统一用一个小的琥珀色圆环图标标记（类似"R"角标的样式），点击只显示一行提示"Pro 功能 · 试用中"，不弹窗打断。

2. AI推荐/AI生成的内容用一个小的青绿色四角星图标标记，和Pro图标明显区分，不能互相混淆。

3. 凡是在用户相册照片上模拟相机效果的地方，显示小标签"近似预览"。

4. 所有效果调整必须实时：用Canvas处理一张缩小的预览图，拖动控件时同步更新；导出和保存时用原图重新渲染。

5. 提供"安静模式"开关，关闭后隐藏非必要动效。

6. 照片的上传和处理全部在浏览器本地完成，不上传到服务器，入口页用小字说明这一点。

【照片上传与下载】

1. 真实支持从设备相册选择照片（input accept="image/*"），按原始方向显示。

2. 预览用长边约1080px的缩小图实时渲染；导出/保存时用原图重新渲染，长边最大4000px，导出为JPG质量0.92。

3. 保存按钮文案"保存到相册"，优先用navigator.share（带文件）调用系统分享，不支持时触发普通下载。

4. 所有照片状态只存在内存里，不使用localStorage。

先生成：底部两个标签（Lab、我的）和一个空的Lab入口页，后面我会逐屏告诉你要加什么。

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dazzle-pocket-camera-lab.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/94409de1-9854-4ec0-9d5e-af8f7a1e5dac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
