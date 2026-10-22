/** 畫質：低畫質關掉前景紗幕、景深取樣減半，給手機與舊機器用。 */
export type Quality = 'high' | 'low'
const KEY = 'rookie-birder.quality'

export function loadQuality(defaultQ: Quality): Quality {
  try { const v = localStorage.getItem(KEY); if (v === 'high' || v === 'low') return v } catch { /* 私密視窗 */ }
  return defaultQ
}
export function storeQuality(q: Quality): void {
  try { localStorage.setItem(KEY, q) } catch { /* 私密視窗 */ }
}
