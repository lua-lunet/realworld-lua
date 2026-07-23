-- Per-connection HTTP request context: one fresh table per request, never a
-- global, so concurrent lunet coroutines never share mutable state.
--
-- Request fields (read-only by convention):
--   method, path, query (table of query params), headers, body
--
-- Response fields (mutated by the router/handlers):
--   status        - HTTP status code, defaults to 200
--   res_headers   - response headers table
--   write(text)   - append a chunk to the response body
--   log(level, ..)- log to stderr; level is a string ("err", "notice", ...)
--   env_config    - app config, set by the server before routing
--
-- server.lua reads the result back via ctx.status / ctx.res_headers /
-- ctx.response_body().

local LOG_LEVELS = { err = true, warn = true, notice = true, info = true, debug = true }

local http_context = {}

-- request: the table returned by lib/http.lua's parse_request
-- (method, path, headers, body, query_params, query_string)
function http_context.new(request)
    local response_body = {}

    local ctx = {
        method = request.method,
        path = request.path,
        query = request.query_params,
        headers = request.headers,
        body = request.body,

        status = 200,
        res_headers = {},
    }

    function ctx.write(text)
        response_body[#response_body + 1] = text or ""
    end

    function ctx.log(level, ...)
        assert(LOG_LEVELS[level], "unknown log level: " .. tostring(level))
        local args = { ... }
        for i, v in ipairs(args) do args[i] = tostring(v) end
        io.stderr:write("[", level, "] ", table.concat(args), "\n")
    end

    -- Read back the accumulated write() output (server only)
    function ctx.response_body()
        return table.concat(response_body)
    end

    return ctx
end

return http_context
