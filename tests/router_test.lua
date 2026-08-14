package.path = "./app/?.lua;./lib/?.lua;./?.lua;" .. package.path

local json = require("lunet.jsonic")
local router = require("router")

local total = 0

local function check(name, condition)
    total = total + 1
    if not condition then error("FAIL: " .. name, 2) end
end

router.route("GET", "/profiles/:username", function(_, ctx, params)
    return { status = 200, body = { username = params.username, request_id = ctx.request_id } }
end)
router.route("DELETE", "/profiles/:username", function()
    return { status = 204 }
end)
router.route("GET", "/broken", function()
    error("unexpected handler failure")
end)

local route, params = router.match("get", "/profiles/alice")
check("matches methods case-insensitively", route ~= nil)
check("extracts named parameters", params ~= nil and params.username == "alice")

local missing = router.match("GET", "/profiles/alice/posts")
check("does not match longer paths", missing == nil)
local wrong_method = router.match("POST", "/profiles/alice")
check("does not match a different method", wrong_method == nil)

local function context(method, path)
    local writes = {}
    local logs = {}
    return {
        method = method,
        path = path,
        request_id = "request-42",
        env_config = {},
        res_headers = {},
        write = function(value) table.insert(writes, value) end,
        log = function(...) table.insert(logs, table.concat({ ... })) end,
    }, writes, logs
end

local ctx, writes = context("GET", "/profiles/alice")
router.handle(ctx)
local body = assert(json.decode(writes[1]))
check("dispatches matching handlers", ctx.status == 200 and body.username == "alice")
check("passes request context to handlers", body.request_id == "request-42")
check("writes JSON content type", ctx.res_headers["Content-Type"] == "application/json")

local no_content, no_content_writes = context("DELETE", "/profiles/alice")
router.handle(no_content)
check("writes no body for 204", no_content.status == 204 and no_content_writes[1] == "")

local not_found, not_found_writes = context("GET", "/missing")
router.handle(not_found)
local missing_body = assert(json.decode(not_found_writes[1]))
check("returns JSON 404 at dispatch boundary", not_found.status == 404 and missing_body.error == "Not found")

local broken, _, logs = context("GET", "/broken")
router.handle(broken)
check("converts handler failures to 500", broken.status == 500)
check("logs handler failures", #logs == 1)

print(string.format("PASS: %d router assertions", total))
