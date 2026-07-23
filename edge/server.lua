-- Conduit edge server — a standalone lunet app that serves the prebuilt
-- vanilla HTML/JS RealWorld frontend from edge/public/ and reverse-proxies
-- /api/* to the backend (default 127.0.0.1:8081).
--
-- This is deliberately NOT part of the backend (server.lua): static file IO
-- does not belong in the API demo. Run it as a second lunet-run instance:
--
--     ./bin/lunet-run edge/server.lua
--
-- It exists to dogfood the lunet binary release as a statics+proxy edge, the
-- role nginx would play in a real deployment (see edge/README.md). Demo-grade:
-- requests are read in a single shot and every connection is closed after its
-- response — fine on loopback, not a production server.

-- ./bin/?.lua is needed for require("lunet.jsonic") (used by lib/http.lua's
-- JSON error responses); lunet-run handles package.cpath itself.
package.path = "./lib/?.lua;./bin/?.lua;./?.lua;" .. package.path

local lunet = require("lunet")
local socket = require("lunet.socket")
local http = require("http")

local PUBLIC_DIR = os.getenv("EDGE_PUBLIC") or "edge/public"
local BACKEND_HOST = os.getenv("EDGE_BACKEND_HOST") or "127.0.0.1"
local BACKEND_PORT = tonumber(os.getenv("EDGE_BACKEND_PORT")) or 8081
local LISTEN_HOST = os.getenv("EDGE_HOST") or "127.0.0.1"
local LISTEN_PORT = tonumber(os.getenv("EDGE_PORT")) or 8083

local MIME = {
    html = "text/html; charset=utf-8",
    css = "text/css",
    js = "text/javascript",
    json = "application/json",
    map = "application/json",
    ico = "image/x-icon",
    png = "image/png",
    jpg = "image/jpeg",
    jpeg = "image/jpeg",
    gif = "image/gif",
    svg = "image/svg+xml",
    webp = "image/webp",
    txt = "text/plain; charset=utf-8",
    xml = "application/xml",
    woff = "font/woff",
    woff2 = "font/woff2",
    ttf = "font/ttf",
}

local function read_file(path)
    local f = io.open(path, "rb")
    if not f then return nil end
    local content = f:read("*a")
    f:close()
    return content
end

local function file_exists(path)
    return read_file(path) ~= nil
end

-- Inline SSI directives: <!--#include virtual="/include/navbar.html" -->
-- (the frontend ships pages written for nginx's `ssi on`). Single pass,
-- paths resolve against the public root.
local function ssi(body)
    return (body:gsub('<!%-%-#include%s+virtual="([^"]+)"%s*%-%->', function(include_path)
        return read_file(PUBLIC_DIR .. include_path) or ""
    end))
end

-- Mirror the frontend's reference nginx/default.conf routing:
--   location / { try_files $uri $uri.html $uri/ =404; }
--   /article/* -> article.html, /profile/* -> profile.html, /editor/* -> editor.html
local function resolve(path)
    if path == "/" then return "/index.html" end
    if file_exists(PUBLIC_DIR .. path) then return path end
    if file_exists(PUBLIC_DIR .. path .. ".html") then return path .. ".html" end
    local first = path:match("^/([^/]+)")
    if first == "article" or first == "profile" or first == "editor" then
        return "/" .. first .. ".html"
    end
    return nil
end

-- Raw TCP relay: the backend answers with `connection: close`, so forwarding
-- the request bytes verbatim and relaying the response until EOF just works.
local function proxy_to_backend(client, raw_request)
    local upstream, err = socket.connect(BACKEND_HOST, BACKEND_PORT)
    if not upstream then
        socket.write(client, http.error_response(502, { "Bad gateway: " .. tostring(err) }))
        return
    end
    socket.write(upstream, raw_request)
    while true do
        local chunk = socket.read(upstream)
        if not chunk then break end
        socket.write(client, chunk)
    end
    socket.close(upstream)
end

local function handle_client(client)
    local data = socket.read(client)
    if not data then
        socket.close(client)
        return
    end

    local method, path = data:match("^(%u+)%s+([^%s]+)")
    if not method then
        socket.write(client, http.error_response(400, { "Bad request" }))
        socket.close(client)
        return
    end

    local query_start = path:find("?")
    if query_start then
        path = path:sub(1, query_start - 1)
    end

    if path:sub(1, 5) == "/api/" then
        proxy_to_backend(client, data)
        socket.close(client)
        return
    end

    local file = resolve(path)
    if not file then
        socket.write(client, http.error_response(404, { "Not found" }))
        socket.close(client)
        return
    end

    local body = read_file(PUBLIC_DIR .. file)
    if file:sub(-5) == ".html" then
        body = ssi(body)
    end
    local ctype = MIME[file:match("%.([^.]+)$") or ""] or "application/octet-stream"
    -- Note: http.response only skips its default content-type when the key is
    -- lowercase "content-type".
    socket.write(client, http.response(200, { ["content-type"] = ctype }, body))
    socket.close(client)
end

lunet.spawn(function()
    local listener, err = socket.listen("tcp", LISTEN_HOST, LISTEN_PORT)
    if not listener then
        print("Failed to listen: " .. tostring(err))
        os.exit(1)
    end

    print(string.format(
        "Conduit edge serving %s on http://%s:%d (proxying /api/* -> %s:%d)",
        PUBLIC_DIR, LISTEN_HOST, LISTEN_PORT, BACKEND_HOST, BACKEND_PORT))

    while true do
        local client = socket.accept(listener)
        if client then
            lunet.spawn(function()
                handle_client(client)
            end)
        end
    end
end)
