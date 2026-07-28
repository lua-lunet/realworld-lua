package.path = "./lib/?.lua;./?.lua;" .. package.path

local http = require("http")

local total = 0

local function check(name, condition)
    total = total + 1
    if not condition then error("FAIL: " .. name, 2) end
end

local function read_chunks(chunks)
    local index = 0
    return function()
        index = index + 1
        return chunks[index]
    end
end

local response = http.response(200, {
    ["Content-Type"] = "text/plain",
    ["content-type"] = "application/problem+json",
    ["Connection"] = "keep-alive",
    ["Content-Length"] = "999",
}, "ok")
check("one normalized content type", select(2, response:gsub("[Cc]ontent%-[Tt]ype:", "")) == 1)
check("one generated content length", select(2, response:gsub("[Cc]ontent%-[Ll]ength:", "")) == 1)
check("connection is explicitly close", response:find("connection: close\r\n", 1, true) ~= nil)
check("caller content length is ignored", response:find("999", 1, true) == nil)

local request = assert(http.read_request(read_chunks({
    "POST /api/users HTTP/1.1\r\nHost: example.test\r\nContent-L",
    "ength: 5\r\n\r\nhe",
    "llo",
})))
check("fragmented request method", request.method == "POST")
check("fragmented request body", request.body == "hello")

local function rejected(name, raw, expected_error, expected_status)
    local parsed, err, status = http.parse_request(raw)
    check(name .. " rejected", parsed == nil)
    check(name .. " error", err == expected_error)
    check(name .. " status", status == expected_status)
end

rejected("incomplete body", "POST /api/users HTTP/1.1\r\nHost: example.test\r\nContent-Length: 5\r\n\r\nno", "Incomplete request body", 400)
rejected("invalid content length", "POST /api/users HTTP/1.1\r\nHost: example.test\r\nContent-Length: 2x\r\n\r\n", "Invalid Content-Length", 400)
rejected("duplicate content length", "POST /api/users HTTP/1.1\r\nHost: example.test\r\nContent-Length: 1\r\ncontent-length: 1\r\n\r\na", "Duplicate HTTP header", 400)
rejected("transfer encoding", "POST /api/users HTTP/1.1\r\nHost: example.test\r\nTransfer-Encoding: chunked\r\n\r\n", "Transfer-Encoding is not supported", 400)
rejected("pipelined bytes", "GET /health HTTP/1.1\r\nHost: example.test\r\n\r\nGET /health HTTP/1.1\r\nHost: example.test\r\n\r\n", "Unexpected data after request body", 400)
rejected("unsupported version", "GET /health HTTP/1.0\r\nHost: example.test\r\n\r\n", "Only HTTP/1.1 is supported", 505)
rejected("oversized headers", "GET /health HTTP/1.1\r\nHost: example.test\r\nX-Test: " .. string.rep("a", http.MAX_HEADER_BYTES) .. "\r\n\r\n", "Request headers too large", 431)
rejected("oversized body", "POST /health HTTP/1.1\r\nHost: example.test\r\nContent-Length: " .. (http.MAX_BODY_BYTES + 1) .. "\r\n\r\n", "Request body too large", 413)

local parsed, err, status = http.read_request(read_chunks({
    "POST /health HTTP/1.1\r\nHost: example.test\r\nContent-Length: 3\r\n\r\nab",
}))
check("incremental EOF rejected", parsed == nil and err == "Incomplete HTTP request" and status == 400)

print(string.format("PASS: %d HTTP transport assertions", total))
