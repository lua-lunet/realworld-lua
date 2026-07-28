-- Dependency-free response shapes shared by route helpers.

local response = {}

function response.json(status, data)
    return { status = status, body = data }
end

function response.error(status, errors)
    return response.json(status, { errors = errors })
end

return response
