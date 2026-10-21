import { createStore, get, set, del, keys, clear } from 'idb-keyval'
import type { PhotoRecord } from './types'

const store = createStore('bird-photo-game', 'photos')

export async function savePhoto(p: PhotoRecord): Promise<void> {
  await set(p.id, p, store)
}

export async function getPhoto(id: string): Promise<PhotoRecord | undefined> {
  return get<PhotoRecord>(id, store)
}

export async function deletePhoto(id: string): Promise<void> {
  await del(id, store)
}

export async function clearPhotos(): Promise<void> {
  await clear(store)
}

/** 由新到舊。 */
export async function listPhotos(): Promise<PhotoRecord[]> {
  const ks = await keys<string>(store)
  const all = await Promise.all(ks.map((k) => get<PhotoRecord>(k, store)))
  return all.filter((p): p is PhotoRecord => !!p).sort((a, b) => b.takenAt - a.takenAt)
}
