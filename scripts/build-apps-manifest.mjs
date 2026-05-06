// 扫 tuchenguang-site/public/downloads/ 下所有 APK，用 apkanalyzer 抽
// versionCode/versionName，写出 apps-manifest.json 给装机后的 APP 拉来比版本。
import { execSync } from 'node:child_process'
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APKANALYZER =
  'C:/Users/TuChenguang/AppData/Local/Android/Sdk/cmdline-tools/latest/bin/apkanalyzer.bat'
const downloadsDir = resolve('tuchenguang-site/public/downloads')
const out = resolve('tuchenguang-site/public/apps-manifest.json')

const manifest = {}

for (const file of readdirSync(downloadsDir)) {
  if (!file.endsWith('.apk')) continue
  const apkPath = resolve(downloadsDir, file)
  const slug = file.replace(/-v.*\.apk$/, '')
  const versionCode = Number(
    execSync(`"${APKANALYZER}" manifest version-code "${apkPath}"`, {
      encoding: 'utf8',
    }).trim(),
  )
  const versionName = execSync(
    `"${APKANALYZER}" manifest version-name "${apkPath}"`,
    { encoding: 'utf8' },
  ).trim()
  const size = statSync(apkPath).size
  manifest[slug] = {
    versionCode,
    versionName,
    sizeBytes: size,
    downloadUrl: `https://tuchenguang.com/downloads/${file}`,
    filename: file,
  }
  console.log(`  ${slug}: versionCode=${versionCode} versionName=${versionName}`)
}

writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Wrote ${out}`)
