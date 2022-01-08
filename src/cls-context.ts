import { Context, ContextAPI } from "@opentelemetry/api"

/**
 * 用于在整个调用链中传递context的class
 */
class ClsContext implements Context{
    /**
     * 从context manager中获取当前活跃的ctx，若是ClsContext对象则返回，否则创建一个新的ClsContext对象并返回
     * @param context 
     * @returns 
     */
    public static getClsContext(context: ContextAPI){
        let ctx = context.active()
        return ctx instanceof ClsContext ? ctx : new ClsContext()
    }
    private _valueMap = new Map()
    public setValue(key: symbol | string, value: unknown): Context {
        this._valueMap.set(key, value)
        return this
    }
    public getValue(key: symbol | string): unknown {
        return this._valueMap.get(key)
    }
    public deleteValue(key: symbol): Context {
        this._valueMap.delete(key)
        return this
    }
}

export default ClsContext