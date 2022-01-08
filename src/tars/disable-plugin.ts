export interface BaseDisablePlugin {
    disableServant(servant: string): void
    disableServantFn(servant: string, fn: Array<string>): void
    disableObj(obj: string): void
    disableObjFn(obj: string, fn: Array<string>): void
    isServantDisabled(servant: string, fn?: string): boolean
    isObjDisabled(obj: string, fn?: string): boolean
}

interface Disabled {
    disabledAll: boolean
    disabledFn: Array<string>
}

export class DefaultDisablePlugin implements BaseDisablePlugin {
    //禁用上报的 servant
    private _disabledServant: Record<string, Disabled> = {}
    //禁用上报的 obj
    private _disabledObj: Record<string, Disabled> = {}

    /**
    * 禁用某个servant所有函数的上报
    * @param servant 
    */
    public disableServant(servant: string) {
        this._disablePatchAll(servant, this._disabledServant)
    }

    /**
     * 禁用某个servant部分函数的上报
     * @param servant 
     */
    public disableServantFn(servant: string, fn: Array<string>) {
        this._disablePatchFn(servant, fn, this._disabledServant)
    }

    /**
     * 禁用某个servant所有函数的上报
     * @param servant 
     */
    public disableObj(obj: string) {
        this._disablePatchAll(obj, this._disabledObj)
    }

    /**
     * 禁用某个servant部分函数的上报
     * @param servant 
     */
    public disableObjFn(servant: string, fn: Array<string>) {
        this._disablePatchFn(servant, fn, this._disabledObj)
    }

    /**
     * 某个servant或者其中一个函数是否禁用
     * @param servant 
     * @param fn 
     * @returns 
     */
    public isServantDisabled(servant: string, fn?: string): boolean{
        return this._disabled(this._disabledServant, servant, fn)
    }

    /**
     * 某个servant或者其中一个函数是否禁用
     * @param servant 
     * @param fn 
     * @returns 
     */
    public isObjDisabled(servant: string, fn?: string): boolean{
        return this._disabled(this._disabledObj, servant, fn)
    }

    /**
     * 禁用全部上报
     * @param name 
     * @param record 
     */
    private _disablePatchAll(name: string, record: Record<string, Disabled>) {
        if (!record[name]) record[name] = { disabledAll: false, disabledFn: [] }
        record[name].disabledAll = true
    }
    /**
     * 禁用部分函数的上报
     * @param name 
     */
    private _disablePatchFn(name: string, fn: Array<string>, record: Record<string, Disabled>) {
        if (!record[name]) record[name] = { disabledAll: false, disabledFn: [] }
        let disabledFn = record[name].disabledFn
        disabledFn = disabledFn.concat(fn)
        disabledFn = Array.from(new Set(disabledFn))
        record[name].disabledFn = disabledFn
    }

    /**
     * 某项是否被禁用
     * @param record 
     * @param name 
     * @param fn 
     * @returns 
     */
    private _disabled(record: Record<string, Disabled>, name: string, fn?: string){
        if(!name || !record) return false
        if(!record[name]) return false
        if(record[name].disabledAll) return true
        if(fn && record[name].disabledFn.indexOf(fn) > -1) return true
        return false
    }
}