import * as THREE from 'three'
import { ShakeModel } from './shake'

/** 雲台：玩家的俯仰與水平角，加上手震偏移，寫進 three.js 相機。 */
export class Rig {
  yaw = 0
  pitch = 0
  shake = new ShakeModel()
  /** 玩家轉動雲台的角速度（rad/s），給動態模糊用。 */
  panOmega = 0
  panOmegaYaw = 0
  panOmegaPitch = 0
  private pendingYaw = 0
  private pendingPitch = 0
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ')

  constructor(public camera: THREE.PerspectiveCamera) {}

  /** 滑鼠位移（px）換算成角度：畫面上的移動量固定，所以長焦時每像素的角度較小。 */
  addMouse(dx: number, dy: number, viewportH: number): void {
    const fovRad = (this.camera.fov * Math.PI) / 180
    const radPerPx = fovRad / viewportH
    this.pendingYaw -= dx * radPerPx
    this.pendingPitch -= dy * radPerPx
  }

  update(dt: number): void {
    const maxPitch = Math.PI / 2 - 0.05
    this.yaw += this.pendingYaw
    this.pitch = Math.min(maxPitch, Math.max(-maxPitch, this.pitch + this.pendingPitch))
    this.panOmegaYaw = dt > 0 ? this.pendingYaw / dt : 0
    this.panOmegaPitch = dt > 0 ? this.pendingPitch / dt : 0
    this.panOmega = Math.hypot(this.panOmegaYaw, this.panOmegaPitch)
    this.pendingYaw = 0
    this.pendingPitch = 0

    this.shake.update(dt)
    this.euler.set(this.pitch + this.shake.pitch, this.yaw + this.shake.yaw, 0)
    this.camera.quaternion.setFromEuler(this.euler)
  }
}
