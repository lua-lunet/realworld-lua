-- Cryptography utilities.
--
-- Argon2id password hashing and CSPRNG remain libsodium-backed via FFI
-- (no lunet pwhash surface). HMAC-SHA-256 and base64 (incl. base64url)
-- now delegate to lunet.security.crypto / lunet.sodium instead of a
-- hand-rolled implementation.

local ffi = require("ffi")
local crypto = {}

ffi.cdef[[
    int sodium_init(void);

    // Password hashing (Argon2id)
    int crypto_pwhash_str(
        char out[128],
        const char * const passwd,
        unsigned long long passwdlen,
        unsigned long long opslimit,
        size_t memlimit
    );

    int crypto_pwhash_str_verify(
        const char str[128],
        const char * const passwd,
        unsigned long long passwdlen
    );

    // Random bytes
    void randombytes_buf(void * const buf, const size_t size);

    // Constant time comparison
    int sodium_memcmp(const void * const b1_, const void * const b2_, size_t len);
]]

local sodium = ffi.load("sodium")
local initialized = false

local function init()
    if not initialized then
        if sodium.sodium_init() < 0 then
            error("libsodium initialization failed")
        end
        initialized = true
    end
end

local OPSLIMIT_INTERACTIVE = 2ULL
local MEMLIMIT_INTERACTIVE = 67108864ULL
local PWHASH_STRBYTES = 128

local security = require("lunet.security")
local lunet_sodium = require("lunet.sodium")

-- Hash a password with Argon2id. The salt is embedded in the returned string.
function crypto.hash_password(password)
    init()
    local out = ffi.new("char[?]", PWHASH_STRBYTES)
    local result = sodium.crypto_pwhash_str(
        out,
        password,
        #password,
        OPSLIMIT_INTERACTIVE,
        MEMLIMIT_INTERACTIVE
    )
    if result ~= 0 then
        return nil, "password hashing failed"
    end
    return ffi.string(out)
end

function crypto.verify_password(password, hash)
    init()
    local result = sodium.crypto_pwhash_str_verify(hash, password, #password)
    return result == 0
end

function crypto.hmac_sha256(message, key)
    return security.crypto.sign(message, key)
end

-- Aliases matching lunet.security.crypto's naming.
function crypto.sign(data, key)
    return security.crypto.sign(data, key)
end

function crypto.verify(data, key, sig)
    return security.crypto.verify(data, key, sig)
end

function crypto.random_bytes(size)
    init()
    local buf = ffi.new("unsigned char[?]", size)
    sodium.randombytes_buf(buf, size)
    return ffi.string(buf, size)
end

function crypto.constant_time_compare(a, b)
    init()
    if #a ~= #b then return false end
    return sodium.sodium_memcmp(a, b, #a) == 0
end

function crypto.base64_encode(data, url_safe)
    if url_safe then
        return security.crypto.b64url_encode(data)
    end
    return lunet_sodium.base64_encode(data, lunet_sodium.BASE64_VARIANT_ORIGINAL)
end

function crypto.base64_decode(data, url_safe)
    if url_safe then
        return security.crypto.b64url_decode(data)
    end
    return lunet_sodium.base64_decode(data, lunet_sodium.BASE64_VARIANT_ORIGINAL)
end

-- Base64url helpers (unpadded, URL-safe) delegating to lunet.security.crypto.
function crypto.b64url_encode(data)
    return security.crypto.b64url_encode(data)
end

function crypto.b64url_decode(data)
    return security.crypto.b64url_decode(data)
end

return crypto