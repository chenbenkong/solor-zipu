// 把 dist 同步到发布目录 deploy-wb（WorkBuddy 托管用）
// 用法：npm run build:wb   → 构建并同步
import { cp, rm, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const dist = join(root, 'dist');
const target = join(root, 'deploy-wb');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(dist, target, { recursive: true });

const count = await readdir(target);
console.log(`[publish] 已同步 ${count.length} 项到 deploy-wb/`);
