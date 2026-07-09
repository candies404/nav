export type ResourceReference = {
  type: string
  location: string
  title?: string
}

export type ResourceReferenceMap = Record<string, ResourceReference[]>

export type ResourceMetadataItem = {
  hash: string
  path: string
  pathname?: string
  url?: string
  downloadUrl?: string
  size?: number
  uploadedAt?: string
}

export type ResourceCardItem = {
  title: string
  description: string
  icon: string
  url: string
  pathname?: string
  size?: number
  uploadedAt?: string
}

export type ResourceCardResource = {
  id: string
  title: string
  items: ResourceCardItem[]
}

export type UploadResourceResponse = {
  success: boolean
  imageUrl: string
  hash?: string
}

type UploadProgressHandlers = {
  onProgress?: (progress: number) => void
  onSpeed?: (bytesPerSecond: number) => void
}

export async function listResources() {
  const response = await fetch('/api/resource')
  const data = await readJsonResponse<{ metadata?: ResourceMetadataItem[] }>(response, '加载图片资源失败')

  if (!Array.isArray(data.metadata)) {
    throw new Error('图片资源数据不可用')
  }

  return data.metadata.map<ResourceCardResource>((item, index) => ({
    id: item.hash,
    title: item.pathname || item.path || `图片资源 ${index + 1}`,
    items: [{
      title: item.pathname || item.path,
      description: '',
      icon: '',
      url: item.url || (item.path.startsWith('http') || item.path.startsWith('/') ? item.path : `/${item.path}`),
      pathname: item.pathname || item.hash,
      size: item.size,
      uploadedAt: item.uploadedAt,
    }],
  }))
}

export async function uploadResourceImage(image: string) {
  const response = await fetch('/api/resource', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image }),
  })

  return readJsonResponse<UploadResourceResponse>(response, '上传图片资源失败')
}

export function uploadResourceImageWithProgress(
  image: string,
  handlers: UploadProgressHandlers = {}
) {
  const xhr = new XMLHttpRequest()
  const startTime = Date.now()

  const promise = new Promise<UploadResourceResponse>((resolve, reject) => {
    xhr.open('POST', '/api/resource', true)
    xhr.setRequestHeader('Content-Type', 'application/json')

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return

      const progress = Math.round((Number(event.loaded) / Number(event.total)) * 100)
      const elapsedTime = Math.max((Date.now() - startTime) / 1000, 0.001)
      handlers.onProgress?.(progress)
      handlers.onSpeed?.(event.loaded / elapsedTime)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText || '{}') as UploadResourceResponse)
        } catch {
          reject(new Error('上传响应解析失败'))
        }
        return
      }

      reject(new Error(getXhrErrorMessage(xhr, '上传图片资源失败')))
    }

    xhr.onerror = () => reject(new Error('网络错误，上传失败'))
    xhr.onabort = () => {
      const error = new Error('上传已取消')
      error.name = 'AbortError'
      reject(error)
    }

    xhr.send(JSON.stringify({ image }))
  })

  return {
    promise,
    abort: () => xhr.abort(),
  }
}

export async function deleteResources(resourceHashes: string[]) {
  const response = await fetch('/api/resource', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resourceHashes }),
  })

  return readJsonResponse<{ success: boolean; deletedCount: number; message?: string }>(
    response,
    '删除图片资源失败'
  )
}

export async function checkResourceReferences(resourcePaths: string[]) {
  const response = await fetch('/api/resource/check-references', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resourcePaths }),
  })
  const data = await readJsonResponse<{ references: ResourceReferenceMap }>(
    response,
    '检查图片资源引用失败'
  )

  return data.references
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || `${fallbackMessage}: ${response.status} ${response.statusText}`)
  }

  return data as T
}

function getXhrErrorMessage(xhr: XMLHttpRequest, fallbackMessage: string) {
  try {
    const data = JSON.parse(xhr.responseText || '{}')
    return data.error || `${fallbackMessage}: ${xhr.status} ${xhr.statusText}`
  } catch {
    return `${fallbackMessage}: ${xhr.status} ${xhr.statusText}`
  }
}
