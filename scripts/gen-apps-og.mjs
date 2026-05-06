// 生成 /apps 页的 OG 分享图：1200×630 深底，中央放 4 个 APP 图标 + 副标题。
// 风格匹配 tuchenguang.com 主题（#0a192f bg, #64ffda accent, #ccd6f6 text）。
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Jimp = require(
  'C:/Users/TuChenguang/AppData/Roaming/npm/node_modules/@bubblewrap/cli/node_modules/jimp',
)

const W = 1200
const H = 630
const BG = 0x0a192fff // #0a192f
const ACCENT_HEX = '#64ffda'
const TEXT_HEX = '#ccd6f6'
const SLATE_HEX = '#8892b0'

const ICON_SIZE = 156
const ICON_GAP = 32
const ICON_RADIUS = 32

const slugs = ['schedule', 'ledger', 'billiards', 'tuner']

async function main() {
  const canvas = new Jimp(W, H, BG)

  // Jimp 自带字体不支持中文，所以 OG 图全用英文。视觉上"应用下载"由图标本身传达。
  const fontMono = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE)
  canvas.print(fontMono, 0, 90, { text: '06 / tuchenguang.com', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, W)

  const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE)
  canvas.print(fontTitle, 0, 140, { text: 'Android Apps', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, W)

  // 图标条 — 居中横排
  const totalWidth = slugs.length * ICON_SIZE + (slugs.length - 1) * ICON_GAP
  const startX = Math.round((W - totalWidth) / 2)
  const iconY = 370

  // 圆角遮罩函数
  function makeRoundedMask(size, radius) {
    const mask = new Jimp(size, size, 0x00000000)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const insideX = x >= radius && x <= size - radius
        const insideY = y >= radius && y <= size - radius
        let inside = insideX || insideY
        if (!inside) {
          // 角落：判断到最近角点的距离
          const cx = x < radius ? radius : size - radius
          const cy = y < radius ? radius : size - radius
          const dx = x - cx
          const dy = y - cy
          inside = dx * dx + dy * dy <= radius * radius
        }
        if (inside) mask.setPixelColor(0xffffffff, x, y)
      }
    }
    return mask
  }

  const mask = makeRoundedMask(ICON_SIZE, ICON_RADIUS)

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    const iconPath = resolve('tuchenguang-site/public/icons', `${slug}.png`)
    const icon = (await Jimp.read(iconPath)).resize(ICON_SIZE, ICON_SIZE)
    icon.mask(mask, 0, 0)
    const x = startX + i * (ICON_SIZE + ICON_GAP)
    canvas.composite(icon, x, iconY)
  }

  // 底部域名 / 副标题
  canvas.print(fontMono, 0, H - 80, { text: 'schedule  ledger  billiards  tuner', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, W)

  const out = resolve('tuchenguang-site/public/og-apps.png')
  await canvas.writeAsync(out)
  // 顺便 stat
  const buf = await canvas.getBufferAsync(Jimp.MIME_PNG)
  writeFileSync(out, buf)
  console.log(`Wrote ${out}: ${(buf.length / 1024).toFixed(1)} KB`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
