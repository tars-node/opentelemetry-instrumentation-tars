//定义span属性值
//在调用链中传递的traceid
export const TRACE_ID_KEY = "TRACE_ID"
//当前调用客户端的span_id
export const SPAN_ID_KEY = "SPAN_ID"
//当前环节的parent
export const PARENT_SPAN_ID_KEY = "PARENT_SPAN_ID"
//rpc server从请求status中获取的上游spanid，若有，需要用作客户端的parantid
export const SERVER_SPAN_ID_KEY = "SPAN_ID"
//在请求context中传递用的key
export const STATUS_TRACE_KEY = "STATUS_TRACE_KEY"
//带trace 的 message type
export const TARS_MESSAGE_TYPE_TRACE = 0x100

//span的上报点
export enum SpanType 
{
    EST_CS = 0b0001,
    EST_CR = 0b0010,
    EST_SR = 0b0100,
    EST_SS = 0b1000,
    EST_TS = 0b1001,
    EST_TE = 0b1010
}