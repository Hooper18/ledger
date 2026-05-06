// 给 Capacitor 生成的 Android 项目刷启动 splash 图。
// 默认 splash 是白底 Capacitor logo，启动闪一下白屏对深色主题的 APP 很突兀。
// 这里替换成 [bg-color 纯色 + 图标居中] 的版本，跟 ic_launcher 主题一致。
//
// 用法: node scripts/gen-android-splash.mjs <icon-png> <bg-hex> <android-res-dir>
// 例:
//   node scripts/gen-android-splash.mjs schedule-app/public/pwa-512.png \
//        '#3b82f6' schedule-app/android/app/src/main/res
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Jimp = require(
  'C:/Users/TuChenguang/AppData/Roaming/npm/node_modules/@bubblewrap/cli/node_modules/jimp',
)

const [, , iconPath, bgHex, resDir] = process.argv
if (!iconPath || !bgHex || !resDir) {
  console.error('Usage: gen-android-splash.mjs <icon-png> <bg-hex> <android-res-dir>')
  process.exit(1)
}

// Standard splash sizes per density.
const splashes = [
  { dir: 'drawable',                w: 480,  h: 320  },
  { dir: 'drawable-port-mdpi',      w: 320,  h: 480  },
  { dir: 'drawable-port-hdpi',      w: 480,  h: 800  },
  { dir: 'drawable-port-xhdpi',     w: 720,  h: 1280 },
  { dir: 'drawable-port-xxhdpi',    w: 960,  h: 1600 },
  { dir: 'drawable-port-xxxhdpi',   w: 1280, h: 1920 },
  { dir: 'drawable-land-mdpi',      w: 480,  h: 320  },
  { dir: 'drawable-land-hdpi',      w: 800,  h: 480  },
  { dir: 'drawable-land-xhdpi',     w: 1280, h: 720  },
  { dir: 'drawable-land-xxhdpi',    w: 1600, h: 960  },
  { dir: 'drawable-land-xxxhdpi',   w: 1920, h: 1280 },
]

function hexToInt(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return Jimp.rgbaToInt(r, g, b, 255)
}

const bg = hexToInt(bgHex)
const icon = await Jimp.read(resolve(iconPath))

for (const { dir, w, h } of splashes) {
  const canvas = new Jimp(w, h, bg)
  // 图标占短边的 30%，居中
  const short = Math.min(w, h)
  const iconSize = Math.round(short * 0.3)
  const placed = icon.clone().resize(iconSize, iconSize)
  const x = Math.round((w - iconSize) / 2)
  const y = Math.round((h - iconSize) / 2)
  canvas.composite(placed, x, y)
  const buf = await canvas.getBufferAsync(Jimp.MIME_PNG)
  await writeFile(resolve(resDir, dir, 'splash.png'), buf)
  console.log(`  ${dir}: ${w}x${h}`)
}

console.log('Done.')
