#!/usr/bin/env node
// 给 Capacitor 生成的 Android 项目刷启动器图标。
// 用法: node scripts/gen-android-icons.mjs <source-png> <android-app-res-dir>
// 例: node scripts/gen-android-icons.mjs schedule-app/public/pwa-512.png \
//        schedule-app/android/app/src/main/res

import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jimpPath = 'C:/Users/TuChenguang/AppData/Roaming/npm/node_modules/@bubblewrap/cli/node_modules/jimp';
const Jimp = require(jimpPath);

const [, , sourcePath, resDir] = process.argv;
if (!sourcePath || !resDir) {
  console.error('Usage: gen-android-icons.mjs <source-png> <android-res-dir>');
  process.exit(1);
}

// Standard Android launcher icon sizes per density.
const densities = [
  { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

const src = await Jimp.read(resolve(sourcePath));
console.log(`Loaded ${sourcePath}: ${src.bitmap.width}x${src.bitmap.height}`);

for (const { dir, launcher, foreground } of densities) {
  const dirPath = resolve(resDir, dir);
  await mkdir(dirPath, { recursive: true });

  // ic_launcher.png — 标准方形启动图标
  const square = src.clone().resize(launcher, launcher);
  const squareBuf = await square.getBufferAsync(Jimp.MIME_PNG);
  await writeFile(resolve(dirPath, 'ic_launcher.png'), squareBuf);

  // ic_launcher_round.png — 旧设备的圆形启动图标（用同一张图，让 Android 处理）
  await writeFile(resolve(dirPath, 'ic_launcher_round.png'), squareBuf);

  // ic_launcher_foreground.png — 自适应图标前景层（Android O+）
  // 内容缩到 75%（接近 Material 推荐的 72/108dp 标准区域），居中放置；
  // 周围由 colors.xml 的 ic_launcher_background 同色填充，确保任何系统遮罩下都
  // 没有白边、视觉尺寸和其他 app 一致。
  const inner = Math.round(foreground * 0.75);
  const fgInner = src.clone().resize(inner, inner);
  const fg = new Jimp(foreground, foreground, 0x00000000);
  const offset = Math.round((foreground - inner) / 2);
  fg.composite(fgInner, offset, offset);
  const fgBuf = await fg.getBufferAsync(Jimp.MIME_PNG);
  await writeFile(resolve(dirPath, 'ic_launcher_foreground.png'), fgBuf);

  console.log(`  ${dir}: launcher ${launcher}px, foreground ${foreground}px`);
}

console.log('Done.');
