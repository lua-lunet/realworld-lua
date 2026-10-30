-- JWT module delegating to lunet.security.jwt (HS256).
local security = require("lunet.security")

local jwt = {}

-- Encode a JWT token.
-- @param payload: table with claims
-- @param secret: string secret key
-- @param algorithm_or_opts: optional "HS256" (string) or opts table {expires_in=seconds}
-- @return token: string JWT token, or nil
-- @return err: string error message, or nil
function jwt.encode(payload, secret, algorithm_or_opts)
    if type(algorithm_or_opts) == "table" then
        return security.jwt.encode(payload, secret, algorithm_or_opts)
    end

    local algorithm = algorithm_or_opts or "HS256"
    if algorithm ~= "HS256" then
        return nil, "Unsupported algorithm: " .. tostring(algorithm)
    end

    return security.jwt.encode(payload, secret)
end

-- Verify a JWT token and return its payload.
-- @param token: string JWT token
-- @param secret: string secret key used to verify the signature
-- @return payload: table with claims, or nil
-- @return err: string error message, or nil
function jwt.decode(token, secret)
    return security.jwt.decode(token, secret)
end

return jwt