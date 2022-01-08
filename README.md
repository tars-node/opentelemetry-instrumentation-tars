# @tars/opentelemetry-instrumentation-tars
TARS 自动插桩上报调用链的模块。  

## 安装
```sh
$ npm install @tars/opentelemetry-instrumentation-tars
```
需要 nodejs 版本v10+。  
## 基本用法
```typescript
import {Instrumentation} from "@tars/opentelemetry-instrumentation-tars"
Instrumentation.start()
```
注意：必须在引入 `@tars/rpc` 模块之前调用插桩。

## 更多功能
模块提供一些额外的功能：  
- 设置参数上报点位和最大参数大小
- 禁用部分服务、客户端，或者某服务中部分函数、某客户端中部分函数的上报
- 设置采样策略
- 自定义上Span Processor，将 trace 信息上报到其它系统中

### 设置参数上报点位和最大参数大小
traceFlag：值为 0 ~ 0x1111 的整数，标记flat是否上报请求体，从低位到高位分别控制CS、CR、SR、SS，为1则输出对应参数，0则不输出。  
maxLen：输出参数最大大小，超过则输出固定的值 `{"trace_param_over_max_len":true}`，单位为kb，默认1kb。  

例如设置为仅客户端发送和服务端发送参数输出，最大参数大小为5kb，则：  
```typescript
import {Instrumentation} from "@tars/opentelemetry-instrumentation-tars"
Instrumentation.tracePlugin.traceFlag = 0b1001
Instrumentation.tracePlugin.maxLen = 5
Instrumentation.start()
```
### 禁用servant、obj及其部分函数
Instrumentation.disablePlugin.disableObj 禁用client obj，tars客户端在调用此obj时不会上报trace。  
Instrumentation.disablePlugin.disableObjFn 禁用某client obj的部分函数，tars客户端在调用这些函数时不会上报trace。  
Instrumentation.disablePlugin.disableServant 禁用某servant的部分函数，tars服务端在处理此servant请求时不会上报trace。  
Instrumentation.disablePlugin.disableServantFn 禁用某servant的部分函数，tars服务端在处理此servant的这些函数请求时不会上报trace。  

```typescript
import {Instrumentation} from "@tars/opentelemetry-instrumentation-tars"
Instrumentation.disablePlugin.disableObj("App.Sever.demoObj")
Instrumentation.disablePlugin.disableObjFn("App.Sever.Obj", ["fn1", "fn2"])
Instrumentation.disablePlugin.disableServant("App.Sever.svrObj")
Instrumentation.disablePlugin.disableServantFn("App.Sever.svrObj", ["fn1", "fn2"])
Instrumentation.start()
```
### 设置采样策略
默认采样策略是持续采样，可以设置为opentelemetry 其它 Sampler。  
如使用50%概率采样：  
```typescript
import {Instrumentation} from "@tars/opentelemetry-instrumentation-tars"
import { TraceIdRatioBasedSampler,} from "@opentelemetry/core"
Instrumentation.sampler = new TraceIdRatioBasedSampler(0.5)
Instrumentation.start()
```
### 自定义Span Processor
可以使用的opentelemetry 其它 Processor，或者继承 `@opentelemetry/sdk-trace-base` 模块中的 `SpanExporter` 实现自定义exporter，设置给此模块。  

```typescript
import {Instrumentation} from "@tars/opentelemetry-instrumentation-tars"
Instrumentation.spanProcessors = [new SimpleSpanProcessor(new TestSpanExporter())]
Instrumentation.start()
```