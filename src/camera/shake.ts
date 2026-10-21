/** 安全快門 1/f 推出的手持基準角速度（rad/s）。 */
export const HANDHELD_SIGMA = 0.03

/** 1D 平滑值雜訊，輸出大致在 -1 到 1，標準差約 0.5。 */
export class ValueNoise1D {
  private values: number[] = []
  constructor(private seed = 1) {}
  private rand(i: number): number {
    if (this.values[i] === undefined) {
      // 簡單的 LCG，讓同一個 seed 可重現
      let x = (i * 374761393 + this.seed * 668265263) >>> 0
      x = (x ^ (x >>> 13)) * 1274126177 >>> 0
      x = (x ^ (x >>> 16)) >>> 0
      this.values[i] = (x / 4294967295) * 2 - 1
    }
    return this.values[i]
  }
  at(t: number): number {
    const i = Math.floor(t)
    const f = t - i
    const u = f * f * (3 - 2 * f)
    return this.rand(i) * (1 - u) + this.rand(i + 1) * u
  }
}

export interface ShakeParams {
  /** 基準 sigma 乘上支撐倍率與防手震衰減後的值（rad/s）。 */
  sigmaRadS: number
}

export function effectiveSigma(supportMul: number, isStops: number, base = HANDHELD_SIGMA): number {
  return base * supportMul * Math.pow(2, -isStops)
}

/** 手震模型：兩個軸各自的角速度，加弱彈簧避免漂移。 */
export class ShakeModel {
  private t = 0
  private nYaw1 = new ValueNoise1D(11)
  private nYaw2 = new ValueNoise1D(23)
  private nPitch1 = new ValueNoise1D(37)
  private nPitch2 = new ValueNoise1D(53)
  yaw = 0
  pitch = 0
  omegaYaw = 0
  omegaPitch = 0
  sigma = HANDHELD_SIGMA

  /** 把雜訊的標準差正規化成 1，兩個頻率混合。 */
  private noise(a: ValueNoise1D, b: ValueNoise1D, t: number): number {
    return (a.at(t * 1.5) * 1.0 + b.at(t * 5.0) * 0.5) / 0.56
  }

  update(dt: number): void {
    this.t += dt
    this.omegaYaw = this.sigma * this.noise(this.nYaw1, this.nYaw2, this.t)
    this.omegaPitch = this.sigma * this.noise(this.nPitch1, this.nPitch2, this.t + 100)
    this.yaw += this.omegaYaw * dt
    this.pitch += this.omegaPitch * dt
    // 弱彈簧：讓偏移在幾秒內回到零，不然會一直漂
    const k = 1 - Math.exp(-dt * 0.8)
    this.yaw -= this.yaw * k
    this.pitch -= this.pitch * k
  }

  /** 目前的總角速度（rad/s），給動態模糊用。 */
  omega(): number {
    return Math.hypot(this.omegaYaw, this.omegaPitch)
  }
}
