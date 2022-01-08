import { propagation, TracerProvider, Sampler } from "@opentelemetry/api"
import { AlwaysOnSampler } from "@opentelemetry/core"
import { SpanProcessor, BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { AsyncHooksContextManager, AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { TarsInstrumentationPlugin } from "./tars/instrumentation"
import { TarsPropagation } from "./tars/propagation"


//将tars的上下文解析和传递工具设置为默认的
propagation.setGlobalPropagator(new TarsPropagation())

class TarsInstrumentation{
    private _contextManager = AsyncHooksContextManager ? new AsyncHooksContextManager(): new AsyncLocalStorageContextManager()
    private _tracePlugin = new TarsInstrumentationPlugin()
    private _sampler:Sampler
    private _traceProvider:BasicTracerProvider

    private _spanProcessors:Array<SpanProcessor> = []
    
    public get tracePlugin(){return this._tracePlugin}

    public get disablePlugin(){ return this._tracePlugin.disablePlugin}

    public set disablePlugin(value){ this._tracePlugin.disablePlugin = value}

    public get sampler(){ return this._sampler}

    public set sampler(value){ this._sampler = value}

    public get spanProcessors(){ return this._spanProcessors}

    public set spanProcessors(value){ this._spanProcessors = value}

    public start(){
        // 默认持续采样
        if(!this._sampler) this._sampler = new AlwaysOnSampler()
        this._traceProvider = new BasicTracerProvider({
            // 默认持续采样
            sampler: this._sampler,
        })
        //开启异步上下文管理器
        this._traceProvider.register({
            contextManager: this._contextManager.enable(),
        })
        //支持传入exporter，若未传入，默认上报到tars trace
        if(!this._spanProcessors.length){
            //注意由于 tars span exporter 中也使用了patch目标模块 @tars/rpc，所以它只能在 instrumentation 初始化之后再引入
            const TarsSpanExporter  = require("./tars/span-exporter").TarsSpanExporter
            this._spanProcessors = [new SimpleSpanProcessor(new TarsSpanExporter())]
        }
        for(let processer of this._spanProcessors){
            this._traceProvider.addSpanProcessor(processer)
        }
        registerInstrumentations({
            tracerProvider: this._traceProvider,
            instrumentations: [this._tracePlugin]
        })
    }
}

const Instrumentation = new TarsInstrumentation()

export {Instrumentation}


