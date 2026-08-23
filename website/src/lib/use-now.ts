import { useState } from 'react'

/**
 * 挂载时取一次当前时间，供渲染期做「超时未接」等时间比较。
 * 惰性初始化只在首次渲染执行一次，避免在渲染期间直接调用 Date.now()。
 */
export function useNow(): number {
  const [now] = useState(() => Date.now())
  return now
}
