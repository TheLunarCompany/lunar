local http = require('http')

RETRY_TIMEOUT = tonumber(os.getenv("LUNAR_RETRY_REQUEST_TIMEOUT_SEC")) or 100
GATEWAY_BIND_PORT = os.getenv("BIND_PORT") or "8000"

local function get_env_number(var_name, default)
    local value = os.getenv(var_name)
    local num_value = tonumber(value)
    
    if num_value == nil then
        return default
    end
    
    return num_value
end

local function add_lunar_generated_header(headers)
    headers["x-lunar-generated"] = "true"
end

local function parse_headers(headers)
    if not headers then
        return {} -- Return empty table immediately
    end

    local parsed_headers = {}
    
    for header in string.gmatch(headers, "([^\n]+)") do
        local key_value = string.gmatch(header, "[^:]+")        
        parsed_headers[key_value(0)] = key_value(1)
    end
    return parsed_headers
end

local function parse_req_headers(headers)
    if not headers then
        return {} -- Return empty table immediately
    end
    
    local parsed_headers = {}   
    
    for line in headers:gmatch("[^\r\n]+") do
        local key, value = line:match("^([%w%-]+):%s*(.*)$")
        
        if key then
            parsed_headers[key:lower()] = value
        end
    end
    return parsed_headers
end

local function copyTable(t)
    if type(t) ~= "table" then
        return nil
    end
  
    local r = {}
  
    for k, v in pairs(t) do
        if type(v) == "table" then
            r[k] = copyTable(v)
        else
            r[k] = v
        end
    end
  
    return r
  end

core.register_service("mock_response", "http", function(applet)
    local headers = applet.f:var("txn.lunar.response_headers")
    local response_body = applet.f:var("txn.lunar.response_body")
    local parsed_headers = parse_headers(headers)
    
    add_lunar_generated_header(parsed_headers)

    for key, value in pairs(parsed_headers) do
        applet:add_header(key, value)
    end
    
    applet:set_status(applet.f:var("txn.lunar.status_code"))
    applet:start_response()
    
    applet:send(response_body)
end)

core.register_service("generate_request", "http", function(a_http)
    local headers = a_http.f:var("req.lunar.request_headers")
    local modified_body = a_http.f:var("req.lunar.request_body") or ""
    local parsed_headers = parse_headers(headers)
    local method = a_http.method

    local dest_addr = a_http.f:var("txn.scheme") .. "://" .. a_http.f:var("req.host_ip") .. ":" .. a_http.f:var("txn.dst_port") .. "/" .. a_http.f:var("txn.path")
    local res, err = http.send(method, {url=dest_addr, headers=parsed_headers, data=modified_body})
    http.response.create{status_code=res.status_code, content=res.content}:send(a_http)
end)

core.register_action("modify_headers", { "http-req" }, function(txn)
    local headers = txn.f:var("req.lunar.request_headers")

    for key, value in pairs(parse_headers(headers)) do
        txn.http:req_set_header(key, value)
    end
end, 0)

core.register_service("modify_request", "http", function(applet)
    -- Get the modified request details from variables or fallback to original values
    local headers = applet.f:var("req.lunar.request_headers") or ""
    
    local parsed_headers = parse_headers(headers)
    -- read the pre-captured body (or default to empty string)
    local new_body = applet.f:var("req.lunar.request_body") or ""
    local method = applet.f:var("txn.lunar.method") or applet.method
    local new_host = applet.f:var("req.lunar.request_host") or applet.f:var("txn.host")
    local new_path = applet.f:var("req.lunar.request_path") or applet.f:var("txn.path")
    local query = applet.f:var("req.lunar.request_query_params") or ""
    if query ~= "" then
        query = "?" .. query
    end

    -- Set the x-lunar-host header to the target host
    parsed_headers["x-lunar-internal"] = "true"
    parsed_headers["x-lunar-host"] = new_host
    parsed_headers["x-lunar-scheme"] = applet.f:var("txn.scheme")
    parsed_headers["x-lunar-lua-handled"] = "true"

    applet:set_var("txn.url", new_host .. new_path)
    applet:set_var("txn.host", new_host)
    applet:set_var("txn.path", path)
    applet:set_var("txn.lua_handled", "true")
    
    -- Send the request to the proxy (localhost:8000)
    local proxy_url = "http://127.0.0.1:" .. GATEWAY_BIND_PORT .. new_path .. query
    
    local res, err = http.send(method, { url = proxy_url, headers = parsed_headers, data = new_body, timeout=RETRY_TIMEOUT })
    if err then
        applet:set_status(500)
        applet:start_response()
        applet:send("Error sending request to proxy: " .. err)
        return
    end

    -- Forward the response to the client
    applet:set_status(res.status_code)
    
    if res.headers then
        for k, v in pairs(res.headers) do
            if type(v) == "string" then
                applet:add_header(k, v)
            elseif type(v) == "table" then
                for _, single_value in ipairs(v) do
                    if type(single_value) == "string" then
                       applet:add_header(k, single_value)
                    end
                end
            end
        end
    end

    applet:start_response()
    applet:send(res.content or "")
end)

core.register_action("modify_response", { "http-res" }, function(txn)
    local headers = txn.f:var("res.lunar.response_headers")
    local parsed_headers = parse_headers(headers)
    local status_code = txn.f:var("res.lunar.status_code") or txn.status or 200
    local with_body = txn.f:var("res.lunar.with_response_body")
    with_body = with_body == "true"
    
    if with_body then
        local modified_body = txn.f:var("res.lunar.response_body") or ""
        txn:done({
            status = status_code,
            headers = parsed_headers,
            body = modified_body
        })
    else
        -- If no body modification, just update headers and status code
        for key, value in pairs(parsed_headers) do
            txn.http:res_set_header(key, value)
        end
        txn.http:res_set_status(status_code)
    end
end, 0)

core.register_action("retry_request", { "http-res" }, function(txn)
    local query = txn.f:var("txn.lunar.query_params") or ""
    if query ~= "" then
        query = "?" .. query
    end

    local dest_addr = "http://127.0.0.1:" .. GATEWAY_BIND_PORT .. txn.f:var("txn.path") .. query
    local method = tostring(txn.f:var("txn.lunar.method"))
    local modified_body = txn.f:var("txn.lunar.request_body") or ""
    local headers = txn.f:var("txn.lunar.request_headers_str")
    local parsed_headers = parse_req_headers(headers)
    parsed_headers["x-lunar-sequence-id"] = txn.f:var("txn.lunar_sequence_id")
    parsed_headers["x-lunar-scheme"] = txn.f:var("txn.scheme")
    parsed_headers["x-lunar-internal"] = "true"
    parsed_headers["x-lunar-retry-attempt"] = "true"
    
    local res, err = http.send(method, {url=dest_addr, headers=parsed_headers, data=modified_body, timeout=RETRY_TIMEOUT})
    if err then
        core.Warning("Got an error when retrying request: " .. err)
        core.Info("Please verify that the timeout is set correctly current value: " .. tostring(RETRY_TIMEOUT))
        txn:done({status = 500})
    end
    
    local content = res.content or ""
    res.headers["x-lunar-internal"] = "false"
    txn:done({
        status = res.status_code,
        headers = copyTable(res.headers) or {},
        body = content,
    })
end, 0)
