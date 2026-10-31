-- Password hashing module using Argon2id via lunet.sodium
-- Provides secure password hashing without any OpenResty/luarocks dependency

local sodium = require("lunet.sodium")

local password = {}

-- Generate a random salt via the runtime's CSPRNG (lunet.sodium.random)
-- @return salt: string hex-encoded salt (32 hex chars = 16 bytes), or nil
function password.generate_salt()
    local salt_bytes = sodium.random(16)
    if not salt_bytes then
        return nil
    end
    return (salt_bytes:gsub(".", function(c) return string.format("%02x", c:byte()) end))
end

-- Hash a password using Argon2id (lunet.sodium.pwhash_str, interactive limits)
-- @param plain_password: string password to hash
-- @param salt: string salt (optional, if not provided will generate one)
-- @return hash: string hashed password (Argon2 encoded string, salt embedded)
-- @return salt: string salt used (kept only for the `salt` column; not needed to verify)
-- @return err: string error message or nil
function password.hash(plain_password, salt)
    if not plain_password or #plain_password == 0 then
        return nil, nil, "Password cannot be empty"
    end

    if not salt then
        salt = password.generate_salt()
    end

    local hash, err = sodium.pwhash_str(plain_password)
    if not hash then
        return nil, salt, err or "Failed to hash password"
    end

    return hash, salt, nil
end

-- Verify a password against a hash (lunet.sodium.pwhash_str_verify)
-- @param plain_password: string password to verify
-- @param stored_hash: string Argon2 encoded hash
-- @param salt: string salt (unused; Argon2id's encoded hash embeds its own salt)
-- @return valid: boolean true if password matches
function password.verify(plain_password, stored_hash, salt)
    if not plain_password or not stored_hash then
        return false
    end

    local ok = sodium.pwhash_str_verify(plain_password, stored_hash)
    return ok == true
end

return password
