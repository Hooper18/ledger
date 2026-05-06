#!/usr/bin/env node
// 非交互式生成 Bubblewrap TWA 项目（绕过 CLI 的 inquirer 在 Node v24 下的 EOF 崩溃）。
// 用法（单行展示，实际从 build-twa.sh 调用）：
//   node scripts/twa-init.mjs --manifestUrl URL --packageId X --name Y --launcherName Z \
//       --keystorePath PATH --keystoreAlias android --outputDir DIR

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const corePath =
  'C:/Users/TuChenguang/AppData/Roaming/npm/node_modules/@bubblewrap/cli/node_modules/@bubblewrap/core';
const { TwaManifest, TwaGenerator, ConsoleLog } = require(corePath);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    const v = argv[i + 1];
    if (!k.startsWith('--')) throw new Error(`Bad arg ${k}`);
    args[k.slice(2)] = v;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const required = ['manifestUrl', 'packageId', 'keystorePath', 'keystoreAlias', 'outputDir'];
for (const r of required) {
  if (!args[r]) {
    console.error(`Missing --${r}`);
    process.exit(1);
  }
}

const outputDir = resolve(args.outputDir);
await mkdir(outputDir, { recursive: true });

console.log(`Fetching manifest: ${args.manifestUrl}`);
const twaManifest = await TwaManifest.fromWebManifest(args.manifestUrl);

twaManifest.packageId = args.packageId;
if (args.name) twaManifest.name = args.name;
if (args.launcherName) twaManifest.launcherName = args.launcherName;
twaManifest.signingKey = {
  path: args.keystorePath,
  alias: args.keystoreAlias,
};
twaManifest.appVersionCode = Math.floor(Date.now() / 60000);
twaManifest.appVersionName = args.appVersionName || '0.1.0';

const validation = twaManifest.validate();
if (validation) {
  console.error(`Manifest invalid: ${validation}`);
  process.exit(1);
}

const log = new ConsoleLog('twa-init');
const generator = new TwaGenerator();
console.log(`Generating TWA project to: ${outputDir}`);
await generator.createTwaProject(outputDir, twaManifest, log);

const manifestFile = resolve(outputDir, 'twa-manifest.json');
await twaManifest.saveToFile(manifestFile);
console.log(`Saved twa-manifest.json to: ${manifestFile}`);
console.log(`packageId: ${twaManifest.packageId}`);
console.log(`versionCode: ${twaManifest.appVersionCode}`);
console.log(`versionName: ${twaManifest.appVersionName}`);
console.log('Done.');
