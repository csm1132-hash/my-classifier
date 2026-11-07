// scripts/tune-rules.js 가 만든 파일. 손으로 고치지 말고 npm run tune:rules 로 다시 만든다.
export default {
  "measuredOn": "2026-11-07",
  "data": "data/practice.json (60문장)",
  "method": "leave-one-out, 칸·긴급도·감정 따로, 맞힌 개수 최대 (같으면 목록에서 먼저 나온 조합)",
  "grid": {
    "minLen": [
      1,
      2,
      3
    ],
    "minDocs": [
      1,
      2,
      3
    ],
    "minRatio": [
      0.5,
      0.6,
      0.7,
      0.8,
      0.9,
      1
    ]
  },
  "looHits": {
    "칸": "28/60",
    "긴급도": "35/60",
    "감정": "40/60"
  },
  "chosen": {
    "칸": {
      "minLen": 2,
      "minDocs": 3,
      "minRatio": 0.5
    },
    "긴급도": {
      "minLen": 2,
      "minDocs": 1,
      "minRatio": 0.7
    },
    "감정": {
      "minLen": 2,
      "minDocs": 2,
      "minRatio": 0.8
    }
  }
};
