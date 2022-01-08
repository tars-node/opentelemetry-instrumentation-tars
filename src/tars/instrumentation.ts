import { trace, propagation, SpanKind, context } from "@opentelemetry/api"

import { InstrumentationBase, InstrumentationConfig, InstrumentationNodeModuleDefinition, InstrumentationNodeModuleFile, isWrapped } from "@opentelemetry/instrumentation"
import type * as Tars from "@tars/rpc"
import ClsContext from "../cls-context"
import { TARS_MESSAGE_TYPE_TRACE } from "./constants"
import { ClientSpanHelper, ServerSpanHelper } from "./span-helper"
import {DefaultDisablePlugin, BaseDisablePlugin} from "./disable-plugin"

type addServant = typeof Tars.server.prototype["addServant"]
type stringToProxy = typeof Tars.Communicator.prototype["stringToProxy"]

export class TarsInstrumentationPlugin extends InstrumentationBase {
  //tars框架服务obj name前缀
  static TARS_OBJ = /^tars\./
  //tars框架客户端代理类自有函数
  static TARS_CLIENT_FN = /^(constructor|setTimeout|getTimeout|setVersion|getVersion)$/
  static TARS_IMP_FN = /^(constructor|initialize|__tars_ping|onDispatch)$/
  //禁用开关
  private _disablePlugin:BaseDisablePlugin = new DefaultDisablePlugin()
  //trace flag 调用链日志输出参数控制，取值范围0-15， 0 不用打参数， 其他情况按位做控制开关，从低位到高位分别控制CS、CR、SR、SS，为1则输出对应参数
  private _traceFlag: number = 0b1111
  //参数上报最大大小，单位为kb，默认为1kb
  private _maxLen: number = 1

  public constructor(config: InstrumentationConfig = {}) {
    super("TarsInstrumentationPlugin", "0.0.1", config)
  }

  public get traceFlag() { return this._traceFlag }
  public set traceFlag(value: number) { this._traceFlag = value }

  public get maxLen() { return this._maxLen }
  public set maxLen(value: number) { this._maxLen = value }

  public get disablePlugin() { return this._disablePlugin }
  public set disablePlugin(value: BaseDisablePlugin) { this._disablePlugin = value }

  protected init() {
    //对客户端组包编码函数进行插桩
    const requestPacketWriteInstrumentation = new InstrumentationNodeModuleDefinition(
      "@tars/rpc",
      ["*"],
      undefined,
      undefined,
      [new InstrumentationNodeModuleFile<{ tars: { RequestPacket: Tars.Handle } }>(
        "@tars/rpc/core/rpc-tars/RequestF.js",
        ["*"],
        this._onPatchRequestPacket.bind(this),
        this._onUnPatchRequestPacket.bind(this),
      )]
    )
    //对客户端 stringToProxy 进行插桩
    const stringToProxyInstrumentation = new InstrumentationNodeModuleDefinition<typeof Tars>(
      "@tars/rpc",
      ["*"],
      this._onPatchStringToProxy.bind(this),
      this._onUnPatchStringToProxy.bind(this)
    )
    //对服务端 addServant 进行插桩
    const addServantInstrumentation = new InstrumentationNodeModuleDefinition<typeof Tars>(
      "@tars/rpc",
      ["*"],
      this._onPatchAddServant.bind(this),
      this._onUnPatchAddServant.bind(this),
    )
    return [requestPacketWriteInstrumentation, addServantInstrumentation, stringToProxyInstrumentation]
  }

  private _onPatchAddServant(moduleExports: typeof Tars) {
    //如果已经插桩过了，直接返回
    if (isWrapped(moduleExports.server.prototype.addServant)) {
      return moduleExports
    }

    this._wrap(
      moduleExports.server.prototype,
      "addServant",
      (original: addServant) => {
        const instrumentation = this
        return function PatchedAddServant(this: Tars.HeroServer, ...args: any): ReturnType<addServant> {
          let [ServantHandle, ServantName] = args
          //判断servant禁用
          if(instrumentation.disablePlugin.isServantDisabled(ServantName)) return original.apply(this, args)
          //对业务函数进行插桩
          for (let fnName of Object.getOwnPropertyNames(ServantHandle.prototype)) {
            //判断函数禁用
            if(instrumentation.disablePlugin.isServantDisabled(ServantName, fnName)) continue
            if (TarsInstrumentationPlugin.TARS_IMP_FN.test(fnName)) continue
            instrumentation._patchServantImpFn(ServantHandle, fnName)
          }
          let ctx = ClsContext.getClsContext(context)
          return context.with(ctx, () => original.apply(this, args))
        }
      }
    )
    return moduleExports
  }

  private _onPatchStringToProxy(moduleExports: typeof Tars) {
    //如果已经插桩过了，直接返回
    if (isWrapped(moduleExports.Communicator.prototype.stringToProxy)) {
      return moduleExports
    }
    this._wrap(
      moduleExports.Communicator.prototype,
      "stringToProxy",
      (original: stringToProxy) => {
        const instrumentation = this
        return function PatchedStringToProxy(this: Tars.Communicator, ...args: any): ReturnType<stringToProxy> {
          let [ProxyHandle, objName] = args
          //参数错误或者是tars框架服务不用插桩
          if (!ProxyHandle || !objName || TarsInstrumentationPlugin.TARS_OBJ.test(objName)) return original.apply(this, args)
          //判断obj禁用
          let obj = objName.split("@")[0]
          if (instrumentation.disablePlugin.isObjDisabled(obj)) return original.apply(this, args)
          //对业务函数进行插桩
          for (let fnName of Object.getOwnPropertyNames(ProxyHandle.prototype)) {
            //判断函数禁用
            if(instrumentation.disablePlugin.isObjDisabled(obj, fnName)) continue
            if (TarsInstrumentationPlugin.TARS_CLIENT_FN.test(fnName)) continue
            instrumentation._patchClientProxyFn(ProxyHandle, objName, fnName)
          }
          return original.apply(this, args)
        }
      }
    )
    return moduleExports
  }

  private _onPatchRequestPacket(moduleExports: { tars: { RequestPacket: Tars.Handle } }) {
    const instrumentation = this
    //如果已经插桩过了，直接返回
    if (isWrapped(moduleExports.tars.RequestPacket.prototype._writeTo)) {
      return moduleExports
    }
    this._wrap(
      moduleExports.tars.RequestPacket.prototype,
      "_writeTo",
      (original: () => void) => {
        return function PatchRequestPacket(this: Tars.Handle, ...args: any): ReturnType<stringToProxy> {
          let $this = this as any
          //调用流程中，判断 obj / 函数 禁用
          if(instrumentation.disablePlugin.isObjDisabled($this.sServantName, $this.sFuncName)){
            return original.apply(this, args)
          }
          let ctx = ClsContext.getClsContext(context)
          return context.with(ctx, () => {
            //发起调用时，向请求status中注入tracekey相关信息
            $this.iMessageType = $this.iMessageType | TARS_MESSAGE_TYPE_TRACE
            propagation.inject(ctx, $this.status)
            return original.apply(this, args)
          })

        }
      }
    )
    return moduleExports
  }

  /**
   * 为单个客户端函数插桩
   * @param ProxyHandle 
   * @param objName 
   * @param fnName 
   */
  private _patchClientProxyFn(ProxyHandle: Tars.Handle, objName: string, fnName: string) {
    if (ProxyHandle.prototype[fnName].__wrapped) {
      return
    }
    const instrumentation = this
    const originFn = ProxyHandle.prototype[fnName]
    ProxyHandle.prototype[fnName] = function () {
      let ctx = ClsContext.getClsContext(context)
      return context.with(ctx, () => {
        let server = this._worker._objname.split(".").slice(0, 2).join(".")
        //生成span
        const span = instrumentation.tracer.startSpan(`${server} ${fnName}`, { kind: SpanKind.CLIENT }, ctx)
        //初始化tars上报需要的字段
        let spanHelper = new ClientSpanHelper({
          span: span,
          ctx,
          server,
          traceFlag: instrumentation._traceFlag,
          maxLen: instrumentation._maxLen,
          func: fnName
        })
        //打客户端发包的上报点
        spanHelper.addCSAnnotation(0, originFn, Array.from(arguments))
        const result = originFn.apply(this, arguments)
        result.then((data: any) => {
          if (data && data.response && data.response.arguments) {
            let rsp = data.response.arguments
            //打客户端收包的上报点
            spanHelper.addCRAnnotation(0, rsp)
            span.end()
            return data
          }
        }).catch((e: any) => {
          let code = e?.response?.error?.code
          //打客户端异常的上报点
          spanHelper.addCRAnnotation(code || -1, e?.response?.error || {})
          span.end()
          throw e
        })
        return result
      })
    }
    ProxyHandle.prototype[fnName].__wrapped = true
  }

  private _patchServantImpFn(ServantHandle: Tars.Handle, fnName: string) {
    if (ServantHandle.prototype[fnName].__wrapped) {
      return
    }
    const instrumentation = this
    const originFn = ServantHandle.prototype[fnName]
    ServantHandle.prototype[fnName] = function () {
      let ctx = ClsContext.getClsContext(context)
      return context.with(ctx, () => {
        //非框架函数不要插桩
        if (!arguments.length || !arguments[0].sendResponse) return originFn.apply(this, arguments)
        let current = arguments[0]
        //收到请求时，从status中读取tracekey相关信息
        propagation.extract(ctx, current._origin.status)
        let server = current._origin.sServantName.split(".").slice(0, 2).join(".")
        //生成span
        const span = instrumentation.tracer.startSpan(`${server} ${fnName}`, { kind: SpanKind.SERVER }, ctx)
        //初始化tars上报需要的字段
        let spanHelper = new ServerSpanHelper({
          span: span,
          ctx,
          server,
          traceFlag: instrumentation._traceFlag,
          maxLen: instrumentation._maxLen,
          func: fnName
        })
        //打服务端收包的上报点
        spanHelper.addSRAnnotation(0, originFn, Array.from(arguments))
        const originSendResponse = current.sendResponse, originSendErrorResponse = current.sendErrorResponse
        //为sendResponse插桩
        current.sendResponse = function () {
          spanHelper.addSSAnnotation(0, arguments)
          span.end()
          originSendResponse.apply(this, arguments)
        }
        //为originSendErrorResponse插桩
        current.originSendErrorResponse = function () {
          let [iRet, sMessage] = arguments
          spanHelper.addSSAnnotation(iRet, { sMessage })
          span.end()
          originSendErrorResponse.apply(this, arguments)
        }
        return originFn.apply(this, arguments)
      })
    }
    ServantHandle.prototype[fnName].__wrapped = true
  }

  private _onUnPatchAddServant(moduleExports: typeof Tars) {
    this._unwrap(moduleExports.server.prototype, "addServant")
  }

  private _onUnPatchStringToProxy(moduleExports: typeof Tars) {
    this._unwrap(moduleExports.Communicator.prototype, "stringToProxy")
  }

  private _onUnPatchRequestPacket(moduleExports: { tars: { RequestPacket: Tars.Handle } } | undefined) {
    if (moduleExports === undefined) return
    this._unwrap(moduleExports.tars.RequestPacket.prototype, "_writeTo")
  }
}