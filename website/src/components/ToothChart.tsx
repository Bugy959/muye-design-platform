import { cn } from '@/lib/utils'
import type { ToothCode } from '@/types'
import { toothSort } from '@/types'

/**
 * 牙位选择图 —— 上下颌双行布局
 * 上颌：左半 8→1，中线，右半 1→8
 * 下颌：同上
 */

const LEFT = [8, 7, 6, 5, 4, 3, 2, 1] // 中线左侧（从外到内）
const RIGHT = [1, 2, 3, 4, 5, 6, 7, 8] // 中线右侧

function JawRow({
  jaw,
  jawName,
  selected,
  onToggle,
  readOnly,
}: {
  jaw: 'U' | 'D'
  jawName: string
  selected: ToothCode[]
  onToggle?: (t: ToothCode) => void
  readOnly?: boolean
}) {
  const cell = (side: 'L' | 'R', n: number) => {
    // FDI 双位数编码：左半 上 1n / 下 4n，右半 上 2n / 下 3n
    const code = `${jaw === 'U' ? (side === 'L' ? 1 : 2) : side === 'L' ? 4 : 3}${n}`
    const isSel = selected.includes(code)
    return (
      <button
        key={code}
        type="button"
        disabled={readOnly}
        onClick={() => onToggle?.(code)}
        className={cn(
          'flex w-7 flex-col items-center gap-0.5 py-1 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-1',
          !readOnly && !isSel && 'hover:bg-stone-200/60',
        )}
      >
        <span
          className={cn(
            'flex h-4 w-4 items-center justify-center border transition-colors duration-150',
            isSel
              ? 'border-brand bg-brand'
              : readOnly
                ? 'border-stone-200 bg-transparent'
                : 'border-stone-400 bg-white',
          )}
        >
          {isSel && (
            <svg width="9" height="7" viewBox="0 0 11 9" fill="none" aria-hidden>
              <path d="M1 4.5L4 7.5L10 1" stroke="#faf9f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className={cn('font-mono text-[10px] tabular-nums', isSel ? 'font-semibold text-brand' : readOnly ? 'text-stone-300' : 'text-stone-600')}>
          {code}
        </span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="w-8 shrink-0 text-[14px] font-medium text-stone-700">{jawName}</span>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex">{LEFT.map((n) => cell('L', n))}</div>
        <div className="mx-1 h-10 w-px bg-stone-400" aria-hidden />
        <div className="flex">{RIGHT.map((n) => cell('R', n))}</div>
      </div>
    </div>
  )
}

export function ToothChart({
  selected,
  onToggle,
  readOnly = false,
}: {
  selected: ToothCode[]
  onToggle?: (tooth: ToothCode) => void
  readOnly?: boolean
}) {
  const sorted = [...selected].sort(toothSort)
  return (
    <div className="select-none">
      <div className="divide-y divide-stone-200">
        <JawRow jaw="U" jawName="上颌" selected={selected} onToggle={onToggle} readOnly={readOnly} />
        <JawRow jaw="D" jawName="下颌" selected={selected} onToggle={onToggle} readOnly={readOnly} />
      </div>
      <div className="mt-3 flex items-center justify-end border-t border-stone-200 pt-2">
        <span className="font-mono text-[12px] tabular-nums text-stone-600">
          已选 {selected.length} 颗{selected.length > 0 && ` · ${sorted.join(' / ')}`}
        </span>
      </div>
    </div>
  )
}

/**
 * 迷你牙位图（只读）—— 用于设计师端长条订单
 * 格子 14×14，上下两排各 18 列（8 颗 + 间隔 + 8 颗）；十字分区线 + 下方列出选中编号
 */
const MINI_UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28']
const MINI_LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']

export function ToothChartMini({ selected }: { selected: ToothCode[] }) {
  const cells: (string | null)[] = []
  for (let i = 0; i < MINI_UPPER.length; i++) {
    if (i === 8) cells.push(null, null) // 左右半之间的间隔列（十字竖线位置）
    cells.push(MINI_UPPER[i], MINI_LOWER[i])
  }
  const sorted = [...selected].sort(toothSort)
  return (
    <div className="inline-block select-none">
      <div className="relative inline-block rounded border border-stone-200 bg-stone-50/60 px-1.5 pb-2 pt-2">
        <span className="absolute bottom-1 left-1/2 top-1 border-l border-dashed border-stone-400" aria-hidden />
        <span className="absolute left-1.5 right-1.5 top-[23px] border-t border-stone-200" aria-hidden />
        <div className="grid grid-flow-col grid-rows-2 gap-[2px]" style={{ gridAutoColumns: '14px' }}>
          {cells.map((t, i) =>
            t === null ? (
              <span key={i} className="h-3.5 w-2.5" aria-hidden />
            ) : (
              <span
                key={i}
                title={`牙位 ${t}`}
                className={cn(
                  'h-3.5 w-3.5 rounded-[3px] border',
                  selected.includes(t) ? 'border-brand bg-brand' : 'border-stone-300 bg-white',
                )}
              />
            ),
          )}
        </div>
      </div>
      <div className="mt-1 whitespace-nowrap text-center font-mono text-[11px] font-semibold tabular-nums text-brand">
        已选 {selected.length} 颗{selected.length > 0 && `：${sorted.join(' · ')}`}
      </div>
    </div>
  )
}