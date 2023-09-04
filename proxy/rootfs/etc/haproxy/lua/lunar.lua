local http = require('http')

local function add_lunar_generated_header(headers)
    headers["x-lunar-generated"] = "true"
end

local function parse_headers(headers)
    local parsed_headers = {}
    
    for header in string.gmatch(headers, "([^\n]+)") do
        local key_value = string.gmatch(header, "[^:]+")
        parsed_headers[key_value(0)] = key_value(1)
    end
    return parsed_headers
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
    local modified_body = a_http.f:var("req.lunar.request_body")
    local parsed_headers = parse_headers(headers)
    local method = a_http.method

    if modified_body ~= nil and string.len(modified_body) > 0 then 

        local cli_req = nil
        if method == "GET" then
            cli_req = http.get
        elseif method == "POST" then
            cli_req = http.post
        elseif method == "PUT" then
            cli_req = http.put
        elseif method == "HEAD" then
            cli_req = http.head
        elseif method == "DELETE" then 
            cli_req = http.delete
        end
        
        local dest_addr = a_http.f:var("txn.scheme") .. "://" .. a_http.f:var("req.host_ip") .. ":" .. a_http.f:var("txn.dst_port") .. "/" .. a_http.f:var("txn.path")
        local res, err = cli_req{url=dest_addr, headers=parsed_headers, data=modified_body}
        http.response.create{status_code=res.status_code, content=res.content}:send(a_http)
    end

end)

core.register_action("modify_request", { "http-req" }, function(txn)
    local headers = txn.f:var("req.lunar.request_headers")

    for key, value in pairs(parse_headers(headers)) do
        txn.http:req_set_header(key, value)
    end

end, 0)

core.register_action("modify_response", { "http-res" }, function(txn)
    local headers = txn.f:var("res.lunar.response_headers")
    
    for key, value in pairs(parse_headers(headers)) do
        txn.http:res_set_header(key, value)
    end
end, 0)
