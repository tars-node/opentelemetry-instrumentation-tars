import TarsLogs from "@tars/logs"
import { ExportResult, ExportResultCode } from "@opentelemetry/core"
import { SpanExporter, ReadableSpan} from "@opentelemetry/sdk-trace-base"

const TraceLogger = new TarsLogs("TarsDate", "_t_trace_", {
    logTo: TarsLogs.LogTo.Remote
})

export class TarsSpanExporter implements SpanExporter{
    
    public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void){
        if(!spans.length) return
        let events  = spans[0].events
        for(let event of events){
            let trace = event.attributes?.trace
            if(!trace) continue
            TraceLogger.info(trace)
            //console.log(trace)
        }
        resultCallback({ code: ExportResultCode.SUCCESS })
    }

    public shutdown(): Promise<void> {
        return Promise.resolve()
    }

    
}