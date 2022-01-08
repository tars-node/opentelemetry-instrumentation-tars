import ClsContext from "../cls-context"
import { createContextKey, TextMapPropagator, TextMapSetter, TextMapGetter } from "@opentelemetry/api"
import { TRACE_ID_KEY, SPAN_ID_KEY, PARENT_SPAN_ID_KEY, SERVER_SPAN_ID_KEY, STATUS_TRACE_KEY, SpanType } from "./constants"

/**
 * 用于设置tars的请求体status
 */
class TarsStautsSetter implements TextMapSetter{
    public set(carrier: any, key: string, value: string): void {
        carrier.set(key, value)
    }
}

/**
 * 用于从tars的status中获取值
 */
class TarsStautsGetter implements TextMapGetter{
    public keys(carrier: any): string[]{
        return Object.keys(carrier.value)
    }

    public get(carrier: any, key: string): undefined | string | string[]{
        return carrier.get(key)
    }
}

/**
 * 用于在tars调用时传递和解析上下文
 */
class TarsPropagation implements TextMapPropagator{
    private _setter = new TarsStautsSetter()
    private _getter = new TarsStautsGetter()

    /**
     * 向 tars 请求的 status 中注入
     * @param context 
     * @param carrier 
     */
    public inject(context: ClsContext, carrier: any): void {
        let traceId = context.getValue(createContextKey(TRACE_ID_KEY))
        let spanId = context.getValue(createContextKey(SPAN_ID_KEY))
        this._setter.set(carrier, STATUS_TRACE_KEY, `${traceId}|${spanId}`)
    }

    public extract(context: ClsContext, carrier: any): ClsContext {
        let traceKey = this._getter.get(carrier, STATUS_TRACE_KEY) as string
        if(traceKey){
            let [traceId, spanId] = traceKey.split("|")
            context.setValue(createContextKey(TRACE_ID_KEY), traceId)
            context.setValue(createContextKey(SERVER_SPAN_ID_KEY), spanId)
        }
        return context
    }

    public fields(){
        return []
    }
}

export {TarsStautsSetter, TarsStautsGetter, TarsPropagation}