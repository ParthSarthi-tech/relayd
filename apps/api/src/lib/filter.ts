export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'in'
  | 'exists'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'

export interface FilterCondition {
  field: string
  op: FilterOperator
  value: unknown
}

export interface FilterRules {
  conditions: FilterCondition[]
}

export interface EventContext {
  eventType: string
  payload: Record<string, unknown>
  headers: Record<string, string>
}

function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function applyOperator(value: unknown, op: FilterOperator, target: unknown): boolean {
  switch (op) {
    case 'equals':
      return value === target
    case 'not_equals':
      return value !== target
    case 'contains':
      if (typeof value === 'string' && typeof target === 'string') {
        return value.includes(target)
      }
      if (Array.isArray(value)) {
        return value.includes(target)
      }
      return false
    case 'starts_with':
      return typeof value === 'string' && typeof target === 'string' && value.startsWith(target)
    case 'in':
      return Array.isArray(target) && target.includes(value)
    case 'exists':
      return value !== null && value !== undefined
    case 'gt':
      return typeof value === 'number' && typeof target === 'number' && value > target
    case 'gte':
      return typeof value === 'number' && typeof target === 'number' && value >= target
    case 'lt':
      return typeof value === 'number' && typeof target === 'number' && value < target
    case 'lte':
      return typeof value === 'number' && typeof target === 'number' && value <= target
    default:
      return false
  }
}

export function evaluateFilters(
  rules: FilterRules | null | undefined,
  event: EventContext,
): boolean {
  if (!rules || !rules.conditions || rules.conditions.length === 0) {
    return true
  }

  const eventObj: Record<string, unknown> = {
    event_type: event.eventType,
    payload: event.payload,
    headers: event.headers,
  }

  return rules.conditions.every((condition) => {
    const value = getFieldValue(eventObj, condition.field)
    return applyOperator(value, condition.op, condition.value)
  })
}
