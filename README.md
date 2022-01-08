# @tars/opentelemetry-instrumentation-tars
TARS 自动插桩上报调用链的模块。  

## 安装
```sh
$ npm install @tars/opentelemetry-instrumentation-tars
```
需要 nodejs 版本v10+。  
## 基本用法
```js
import {Instrumentation} from "@tars/opentelemetry-instrumentation-tars"
Instrumentation.start()
```
注意：必须在引入 `@tars/rpc` 模块之前调用插桩。

## 更多功能
模块提供一些额外的功能：  
- 设置自定义上报器，将 trace 信息上报到其它系统中
- 设置参数上报最大大小
- 自定义上报范围，可以禁用部分服务、客户端，或者某服务中部分函数、某客户端中部分函数的上报
