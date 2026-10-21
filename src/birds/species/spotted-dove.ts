import type { SpeciesDef } from '../types'

/** 珠頸斑鳩：動作慢、體型中等，教學鳥。 */
export const spottedDove: SpeciesDef = {
  id: 'spotted-dove',
  nameZh: '珠頸斑鳩',
  nameEn: 'Spotted Dove',
  bodyHeightM: 0.17,
  albedo: 0.42,
  sprites: {
    side:    { file: '/birds/spotted-dove-side.png',    view: 'side',    eyeUv: [0.8658, 0.6996], contentW: 0.966, contentH: 0.551, sizeM: 0.31, viewAngleDeg: 90 },
    '3q':    { file: '/birds/spotted-dove-3q.png',      view: '3q',      eyeUv: [0.8487, 0.7746], contentW: 0.958, contentH: 0.726, sizeM: 0.30, viewAngleDeg: 45 },
    takeoff: { file: '/birds/spotted-dove-takeoff.png', view: 'takeoff', eyeUv: [0.8748, 0.5776], contentW: 0.963, contentH: 0.628, sizeM: 0.44, viewAngleDeg: 90 },
  },
  dwell: { min: 18, max: 40 },
  interval: { min: 12, max: 30 },
  stateDurations: { S1: { min: 2.5, max: 7 }, S2: { min: 1.5, max: 4 }, S3: { min: 0.5, max: 0.9 } },
  transitions: {
    S1: { S2: 0.6, S3: 0.3, S4: 0.1 },
    S2: { S1: 0.65, S3: 0.3, S4: 0.05 },
    S3: { S1: 0.6, S2: 0.4 },
  },
  flightSpeedMs: 7,
  hopDistM: 0.45,
  call: { baseHz: 430, notes: 3, noteS: 0.32, gapS: 0.12 },
  rarity: 'common',
}
