-- Process-wide request metrics backed by lunet.lnt_shared (sharded shared
-- dictionary with atomic incr()). The store lives in an anonymous mmap inside
-- the lunet-run process, so counters are shared by every coroutine serving a
-- connection without any locking in Lua land.

local lnt = require("lunet.lnt_shared")

local STORE_BYTES = 256 * 1024
local METHODS = { "GET", "POST", "PUT", "DELETE" }

local store = lnt.store("metrics", STORE_BYTES)

local metrics = {}

-- Atomically bump the counters for one incoming request. incr on a missing
-- key needs an explicit init value (same semantics as ngx.shared.DICT:incr).
function metrics.count_request(method)
    store:incr("requests_total", 1, 0)
    store:incr("requests_method_" .. method, 1, 0)
end

-- Read the counters back out for the /health endpoint.
function metrics.snapshot()
    local by_method = {}
    for _, method in ipairs(METHODS) do
        by_method[method:lower()] = store:get("requests_method_" .. method) or 0
    end
    return {
        total = store:get("requests_total") or 0,
        by_method = by_method,
    }
end

return metrics
