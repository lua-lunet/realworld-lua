-- Shared HTTP helpers for route modules

local db = require("db")
local jwt = require("jwt")
local response = require("response")

local web = {}

-- Wrap a status and body into the router's response shape
web.json_response = response.json

-- Wrap a status and errors table into the RealWorld error shape
web.error_response = response.error

-- Distinguish a failed query from an absent row: raises on error (the
-- router turns it into a logged 500), so nil means only "not found"
function web.fetched(row, err)
    if err then
        error(err, 0)
    end
    return row
end

-- Resolve the authenticated user from the Authorization header.
-- The checked-in OpenAPI security scheme requires "Token <jwt>".
-- @return user, token, errors (errors is a RealWorld errors table when user is nil)
function web.get_current_user(env_config, ctx)
    local auth_header = ctx.headers["authorization"]
    if not auth_header then
        return nil, nil, { token = { "is missing" } }
    end

    local token = auth_header:match("^Token%s+([^%s]+)$")
    if not token then
        return nil, nil, { token = { "is invalid" } }
    end

    local payload = jwt.decode(token, env_config.JWT_SECRET)
    if not payload then
        return nil, nil, { token = { "is invalid" } }
    end

    local user = web.fetched(db.get_user_by_id(env_config, payload.id))
    if not user then
        return nil, nil, { token = { "is invalid" } }
    end

    return user, token, nil
end

return web
