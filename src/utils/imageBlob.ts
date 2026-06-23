export class FetchError extends Error {
  readonly status: number
  constructor(status: number, url: string) {
    super(`HTTP ${status}: ${url}`)
    this.status = status
  }
}

export async function fetchAsBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { mode: 'cors', signal })
  if (!response.ok) throw new FetchError(response.status, url)
  return response.blob()
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}
