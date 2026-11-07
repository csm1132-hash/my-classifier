import fs from 'node:fs';
import path from 'node:path';

const cache = new Map();

// 프로젝트 폴더 기준 경로의 JSON을 읽는다 (예: 'data/practice.json', 'criteria.json').
// Vercel에서는 vercel.json의 includeFiles로 함께 배포된다.
export function loadJson(relPath) {
  if (!cache.has(relPath)) {
    const file = path.join(process.cwd(), relPath);
    cache.set(relPath, JSON.parse(fs.readFileSync(file, 'utf-8')));
  }
  return cache.get(relPath);
}
