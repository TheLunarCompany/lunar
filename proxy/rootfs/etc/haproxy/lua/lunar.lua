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
