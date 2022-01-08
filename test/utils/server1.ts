import path from "path"
import * as TarsRpc from "@tars/rpc"
import {Hello} from "./Server1Imp"

const svr = new TarsRpc.server()
svr.initialize(path.resolve(__dirname, "./conf/server1.conf"), function (server){
    server.addServant(Hello.DemoImp, server.Application + "." + server.ServerName + ".DemoObj");
})
export default svr