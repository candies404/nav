export async function readAdminResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) throw new Error('登录已过期，请重新登录后重试。当前填写内容已保留。')
    const detail = data?.details || data?.error
    throw new Error(typeof detail === 'string' && detail ? detail : `${fallback}（HTTP ${response.status}）`)
  }
  if (data === null) throw new Error(`${fallback}：服务器返回了无效数据`)
  return data as T
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
