import { uuidGenerator } from "@tars/utils"
import { Context, Span, createContextKey } from "@opentelemetry/api"
import { TRACE_ID_KEY, SPAN_ID_KEY, SERVER_SPAN_ID_KEY, SpanType } from "./constants"

interface SpanHelperInterface {
    //当前的span
    span: Span
    //当前的调用链context
    ctx: Context
    //traceFlag 0x1111 标记flat是否上报请求体，从低位到高位分别控制CS、CR、SR、SS，为1则输出对应参数
    traceFlag: number
    //请求体上报的最大大小，单位为kb
    maxLen: number
    //服务名
    server: string
    //函数名
    func: string
}

interface TarsTraceField {
    traceId: string
    spanId: string
    parentId: string
    client: string
    server: string
    func: string
    [property: string]: any
}

abstract class SpanHelperBase {
    public static STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg
    public static ARGUMENT_NAMES = /([^\s,]+)/g
    public static OVER_LIMIT =  Buffer.from("{\"trace_param_over_max_len\":true}").toString("base64")
    protected _options: SpanHelperInterface
    protected _trace: TarsTraceField
    public constructor(options: SpanHelperInterface){
        this._options = options
    }

    /**
     * 设置 traceId、spanId 等主要内容
     */
    protected _setup(isClient: boolean){
        let {span, ctx, traceFlag, maxLen, server, func} = this._options
        let traceId = ctx.getValue(createContextKey(TRACE_ID_KEY)) as string
        let spanId = ctx.getValue(createContextKey(SPAN_ID_KEY)) as string
        let serverSpanId = ctx.getValue(createContextKey(SERVER_SPAN_ID_KEY)) as string
        //如果没有traceId，自动生成一个，并添加到context中
        if (!traceId) {
            traceId = `${traceFlag.toString(16)}.${maxLen}-${uuidGenerator.genID()}`
            ctx.setValue(createContextKey(TRACE_ID_KEY), traceId)
        }
        let spanContext = span.spanContext()
        //如果是 client send，则需要生成一个 spanid，并设置给 context
        if(isClient){
            spanId = uuidGenerator.genID()
            ctx.setValue(createContextKey(SPAN_ID_KEY), spanId)
        }
        spanContext.traceId = traceId
        //如果是 server recive 或者 server send，spanId应该使用上游传过来的
        spanContext.spanId = (isClient ? spanId : serverSpanId)
        //cs、cr、ts、tr 四种类型的 parent 设置为上游传递过来的spanId，如果没有则设置为 spanId 自身， sr、ss，parentId 设置为 *
        let parentId = "*"
        if(isClient){
            parentId = (serverSpanId || spanId)
        }
        let client = process.env.name || "DEFAULT"
        span.setAttribute("parentId", parentId)
        span.setAttribute("client", client)
        span.setAttribute("server", server)
        span.setAttribute("func", func)
        let _span = span as any
        _span.parentSpanId = parentId
        this._trace = {traceId, spanId, parentId, client, server, func}
    }

    protected _addAnnotation(annotation:number, ret: number, data: string) {
        if(!this._trace) return

        let {traceId, spanId, parentId, client, server, func, ex=""} = this._trace
        let traceKey = `${traceId}|${spanId}|${parentId}`
        let timestamp = Math.round( new Date().getTime() / 1000)
        this._options.span.addEvent("annotation", {
            trace: `${traceKey}|${annotation}|${client}|${server}|${func}|${timestamp}|${ret}|${data||""}|${ex||""}`
        })
    }

    protected _getParamNames(fn: any){
        let fnStr = fn.toString().replace(SpanHelperBase.STRIP_COMMENTS, "")
        let result = fnStr.slice(fnStr.indexOf("(")+1, fnStr.indexOf(")")).match(SpanHelperBase.ARGUMENT_NAMES)
        if(result === null)
            result = []
        return result
    }

    /**
     * 参数对象转换为上报的base64
     * @param obj 
     * @returns 
     */
    protected _objToBase64(obj: any){
        let dataBuf = Buffer.from(JSON.stringify(obj))
        let data = ""
        if (dataBuf.length > this._options.maxLen * 1024) {
          data = SpanHelperBase.OVER_LIMIT
        } else {
          data = dataBuf.toString("base64")
        }
        return data
    }
}

export class ClientSpanHelper extends SpanHelperBase {

    public constructor(options: SpanHelperInterface){
        super(options)
        this._setup(true)
    }

    public addCSAnnotation(ret: number, fn:any, args:Array<any>) {
        let annotation = SpanType.EST_CS
        let { traceFlag} = this._options
        //当前环节不需要上报请求体，直接返回
        if(!(annotation & traceFlag)){
            this._addAnnotation(annotation, ret, "")
            return this
        }
        let paramNames = this._getParamNames(fn)
        let params: Record<string, any> = {}
        Array.from(args).forEach((param, index) => {
          if (!paramNames[index]) return
          params[paramNames[index]] = param.toObject ? param.toObject() : param
        })
        this._addAnnotation(annotation, ret, this._objToBase64(params))
        return this
    }

    public addCRAnnotation(ret: number, args?: Record<string, any>) {
        let annotation = SpanType.EST_CR
        let { traceFlag} = this._options
        //当前环节不需要上报请求体，直接返回
        if(!(annotation & traceFlag) || !args){
            this._addAnnotation(annotation, ret, "")
            return this
        }
        let params: Record<string, any> = {}
        for(let key of Object.keys(args)){
            let param = args[key]
            params[key] = param.toObject ? param.toObject() : param
        }
        this._addAnnotation(annotation, ret, this._objToBase64(params))
        return this
    }
}

export class ServerSpanHelper extends SpanHelperBase {
    static RET_FIELD_NAME = "_ret"
    public constructor(options: SpanHelperInterface){
        super(options)
        this._setup(false)
    }

    public addSRAnnotation(ret: number, fn:any, args:Array<any>){
        let annotation = SpanType.EST_SR
        let { traceFlag} = this._options
        //当前环节不需要上报请求体，直接返回
        if(!(annotation & traceFlag)){
            this._addAnnotation(annotation, ret, "")
            return this
        }
        let current = args[0]
        let impParams = this._getParamNames(fn)
        let rspParams = this._getParamNames(current.sendResponse)
        //imp函数的参数顺序：[current, req1, req2... , rsp1, rsp2]
        //current.sendResponse的参数顺序: [return?, rsp1, rsp2 ...]
        //通过第一个参数名来判断是否有返回值，以获取请求参数列表
        let rspLen = rspParams[0] == ServerSpanHelper.RET_FIELD_NAME ? (rspParams.length - 1) : rspParams.length
        //截取出请求参数的部分
        impParams = impParams.slice(1, rspLen + 1) 
        args = args.slice(1, rspLen + 1)
        let params: Record<string, any> = {}
        args.forEach((param, index) => {
          if (!impParams[index]) return
          params[impParams[index]] = param.toObject ? param.toObject() : param
        })
        this._addAnnotation(annotation, ret, this._objToBase64(params))
        return this
    }

    public addSSAnnotation(ret: number, args?: Record<string, any>) {
        let annotation = SpanType.EST_SS
        let { traceFlag} = this._options
        //当前环节不需要上报请求体，直接返回
        if(!(annotation & traceFlag) || !args){
            this._addAnnotation(annotation, ret, "")
            return this
        }
        let params: Record<string, any> = {}
        for(let key of Object.keys(args)){
            let param = args[key]
            params[key] = param.toObject ? param.toObject() : param
        }
        this._addAnnotation(annotation, ret, this._objToBase64(params))
        return this
    }
}