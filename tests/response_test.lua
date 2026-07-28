package.path = "./app/?.lua;./?.lua;" .. package.path

local response = require("response")

local total = 0

local function check(name, condition)
    total = total + 1
    if not condition then error("FAIL: " .. name, 2) end
end

local payload = { user = { username = "alice" } }
local success = response.json(201, payload)
check("preserves success status", success.status == 201)
check("preserves success body", success.body == payload)

local errors = { email = { "can't be blank" } }
local failure = response.error(422, errors)
check("preserves error status", failure.status == 422)
check("wraps errors in the RealWorld envelope", failure.body.errors == errors)

print(string.format("PASS: %d response assertions", total))
