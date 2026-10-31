package.path = "./app/?.lua;./?.lua;" .. package.path

local security = require("lunet.security")

local total = 0

local function check(name, condition)
    total = total + 1
    if not condition then error("FAIL: " .. name, 2) end
end

local jwt = security.jwt
local secret = "unit-test-secret"
local valid_token = assert(jwt.encode({ id = "user-1", exp = os.time() + 60 }, secret))
local payload, err = jwt.decode(valid_token, secret)
check("decodes a valid token", payload and payload.id == "user-1" and err == nil)

local expired_token = assert(jwt.encode({ id = "user-1", exp = os.time() - 1 }, secret))
local expired_payload, expired_err = jwt.decode(expired_token, secret)
check("rejects expired tokens", expired_payload == nil and type(expired_err) == "string" and expired_err:find("exp", 1, true) ~= nil)

local last = valid_token:sub(-1)
local tampered_token = valid_token:sub(1, -2) .. (last == "A" and "B" or "A")
local tampered_payload, tampered_err = jwt.decode(tampered_token, secret)
check("rejects tampered signatures", tampered_payload == nil and type(tampered_err) == "string" and tampered_err:find("sig", 1, true) ~= nil)

print(string.format("PASS: %d JWT assertions", total))
