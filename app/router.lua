-- Router module: method+path dispatch with :param extraction and JSON responses

-- lunet.jsonic: fast Rust-backed decode, dkjson encode. dkjson encodes empty
-- tables as [] by default, which is what the RealWorld spec wants for empty
-- collections (tagList, articles, comments, tags).
local json = require("lunet.jsonic")

local router = {}

-- Routes table - populated by route() function
local routes = {}

-- Add a route to the router
-- @param method: HTTP method (GET, POST, etc.)
-- @param path: URL path pattern (e.g., "/users/:id")
-- @param handler: function(env_config, ctx, params) returning { status, body }
function router.route(method, path, handler)
    table.insert(routes, {
        method = method:upper(),
        pattern = path,
        handler = handler
    })
end

-- Match a path against a pattern and extract parameters
-- @param pattern: route pattern (e.g., "/users/:id/posts/:post_id")
-- @param path: request path (e.g., "/users/123/posts/456")
-- @return params: table of parameters, or nil if no match
local function match_pattern(pattern, path)
    local pattern_parts = {}
    for part in pattern:gmatch("[^/]+") do
        table.insert(pattern_parts, part)
    end

    local path_parts = {}
    for part in path:gmatch("[^/]+") do
        table.insert(path_parts, part)
    end

    if #pattern_parts ~= #path_parts then
        return nil
    end

    local params = {}
    for i, pp in ipairs(pattern_parts) do
        if pp:sub(1, 1) == ":" then
            params[pp:sub(2)] = path_parts[i]
        elseif pp ~= path_parts[i] then
            return nil
        end
    end

    return params
end

-- Find a matching route
-- @param method: HTTP method
-- @param path: request path
-- @return route: route table, or nil
-- @return params: parameters table, or nil
function router.match(method, path)
    for _, route in ipairs(routes) do
        if route.method == method:upper() then
            local params = match_pattern(route.pattern, path)
            if params then
                return route, params
            end
        end
    end
    return nil, nil
end

-- Handle a request: dispatch to the matching route and write the JSON response
function router.handle(ctx)
    local method = ctx.method
    local path = ctx.path

    local route, params = router.match(method, path)
    if not route then
        ctx.status = 404
        ctx.res_headers["Content-Type"] = "application/json"
        ctx.write(json.encode({ error = "Not found", path = path }))
        return
    end

    local status = 200
    local result
    local ok, handler_result = pcall(route.handler, ctx.env_config, ctx, params)
    if ok then
        result = handler_result
        if type(result) == "table" and result.status then
            status = result.status
            result = result.body or result
        end
    else
        ctx.log("err", "Handler error for ", method, " ", path, ": ", tostring(handler_result))
        status = 500
        result = { error = "Internal server error" }
    end

    ctx.status = status
    ctx.res_headers["Content-Type"] = "application/json"

    if status == 204 then
        ctx.write("")
        return
    end

    if type(result) == "string" then
        ctx.write(result)
        return
    end

    local encode_ok, encoded = pcall(json.encode, result)
    if not encode_ok then
        ctx.log("err", "JSON encode error for ", method, " ", path, ": ", tostring(encoded))
        ctx.status = 500
        ctx.write('{"error":"Internal server error"}')
        return
    end
    ctx.write(encoded)
end

return router
