// Worker entry for the public synthetic demo gateway.
// workerd treats every named export of the entry module as an entrypoint, so the
// shared constants and helpers live in demo-gateway-core.mjs and only the handler is exported here.
import gateway from "./demo-gateway-core.mjs";

export default gateway;
