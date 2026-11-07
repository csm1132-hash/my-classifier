// 라벨 목록. 칸과 긴급도는 criteria.json에서 읽는다 (칸은 order 순서).
import { loadJson } from './data.js';

const criteria = loadJson('criteria.json');

export const CATEGORIES = [...criteria.categories].sort((a, b) => a.order - b.order).map((c) => c.name);
export const URGENCIES = criteria.urgency.map((u) => u.level);
export const EMOTIONS = ['좋음', '나쁨', '기타'];

export const MAX_SENTENCES = 30;
export const MAX_LENGTH = 300;
