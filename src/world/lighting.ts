import * as THREE from 'three'

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'dusk'
export type Weather = 'sunny' | 'overcast' | 'windy'

export interface LightingPreset {
  evScene: number
  sunDir: THREE.Vector3
  sunColor: THREE.Color
  sunIntensity: number
  skyColor: THREE.Color
  groundColor: THREE.Color
  hemiIntensity: number
  background: THREE.Color
  fogDensity: number
}

/**
 * 每個預設都正規化成「曝光正確時 18% 灰卡面向太陽約為 0.18」：
 * MeshToon 的輸出 = albedo × (sun + hemi × 約0.75) / π，所以 sun + 0.75·hemi ≈ π。
 */
export interface LightingOverride {
  sunAzDeg?: number
  /** 樹冠下：場景 EV 直接指定，直射光弱、散射光強、霧偏綠 */
  shadeEv?: number
}

export function lightingPreset(time: TimeOfDay, weather: Weather, over?: number | LightingOverride): LightingPreset {
  const ov: LightingOverride = typeof over === 'number' ? { sunAzDeg: over } : over ?? {}
  const sunAzDeg = ov.sunAzDeg
  const base = {
    dawn:    { ev: 11, elev: 12, az: 70,  sun: new THREE.Color('#ffd0a0'), sky: new THREE.Color('#f7e7cf') },
    morning: { ev: 13, elev: 35, az: 110, sun: new THREE.Color('#fff2dc'), sky: new THREE.Color('#f6eedc') },
    noon:    { ev: 15, elev: 70, az: 180, sun: new THREE.Color('#ffffff'), sky: new THREE.Color('#f3ecdc') },
    dusk:    { ev: 11, elev: 10, az: 260, sun: new THREE.Color('#ffb070'), sky: new THREE.Color('#f8dcc0') },
  }[time]
  const overcast = weather === 'overcast'
  const sunI = overcast ? 0.9 : 2.6
  const hemiI = overcast ? 2.9 : 0.7
  const el = (base.elev * Math.PI) / 180
  const az = ((sunAzDeg ?? base.az) * Math.PI) / 180
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize()
  if (ov.shadeEv !== undefined) {
    // 樹冠下：sun + 0.75·hemi 仍約為 π，但幾乎都是綠色的散射光
    const sky = new THREE.Color('#9fb27a')
    return {
      evScene: ov.shadeEv,
      sunDir: dir,
      sunColor: base.sun.clone().lerp(new THREE.Color('#d9e6b0'), 0.5),
      sunIntensity: 0.6,
      skyColor: sky,
      groundColor: new THREE.Color('#3f4a2c'),
      hemiIntensity: 3.4,
      background: new THREE.Color('#3b4a30'),
      fogDensity: 0.02,
    }
  }
  return {
    evScene: overcast ? Math.min(base.ev, 12) : base.ev,
    sunDir: dir,
    sunColor: overcast ? new THREE.Color('#e8e8e8') : base.sun,
    sunIntensity: sunI,
    skyColor: base.sky,
    groundColor: new THREE.Color('#6d7a4a'),
    hemiIntensity: hemiI,
    background: base.sky.clone().multiplyScalar(0.55),
    fogDensity: overcast ? 0.012 : 0.006,
  }
}

export function applyLighting(scene: THREE.Scene, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, p: LightingPreset): void {
  sun.position.copy(p.sunDir).multiplyScalar(100)
  sun.color.copy(p.sunColor)
  sun.intensity = p.sunIntensity
  hemi.color.copy(p.skyColor)
  hemi.groundColor.copy(p.groundColor)
  hemi.intensity = p.hemiIntensity
  scene.background = p.background
  scene.fog = new THREE.FogExp2(p.background, p.fogDensity)
}
