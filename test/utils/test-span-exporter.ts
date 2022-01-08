import { ExportResultCode } from '@opentelemetry/core'
import type { ExportResult } from '@opentelemetry/core'
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'

/**
 * 用于存储 span 上报结果
 */
const testSpans: ReadableSpan[] = []
export const getTestSpans = (): ReadableSpan[] => testSpans
export const clearTestSpans = (): void => {
  testSpans.splice(0, testSpans.length)
}

/**
 * 测试使用的 span exporter ，用于确认 span 是否正确
 */
export class TestSpanExporter implements SpanExporter {
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    testSpans.unshift(...spans)
    resultCallback({ code: ExportResultCode.SUCCESS })
  }
  shutdown(): Promise<void> {
    return Promise.resolve()
  }
}
