import * as assert from "assert"
import {Instrumentation} from "../src"
import {TestSpanExporter, getTestSpans} from "./utils/test-span-exporter"
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
Instrumentation.spanProcessors = [new SimpleSpanProcessor(new TestSpanExporter())]
Instrumentation.start()
import server1 from "./utils/server1"
import server2 from "./utils/server2"
import "./test"
import * as TarsRpc from "@tars/rpc"
import { Hello } from "./utils/protocol/HelloProxy"
const proxy = TarsRpc.client.stringToProxy(Hello.DemoProxy, "Hello.Server.DemoObj@tcp -h 127.0.0.1 -p 20001 -t 60000")
proxy.setTimeout(6000)

before(async () => {
    await server1.start()
    await server2.start()
});
  
after(() => {
    server1.stop()
    server2.stop()
})
  
it("client → server1 → server2", async () => {
    let stReq = new Hello.TestReq()
    stReq.iAge = 1
    stReq.sName = "client req"
    try{
        await proxy.testFn(1, "name", stReq)
    } catch(e){
        console.error("call fn fail out:", e)
    }
    let spans = getTestSpans()
    assert.strictEqual(spans.length, 4)
    let traceId = spans[0].spanContext().traceId
    for(let span of spans){
        assert.strictEqual(span.spanContext().traceId, traceId)
    }
}).timeout(10000)
