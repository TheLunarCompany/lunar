kb_to_mb = 1 / 1000
bytes_to_mb = 1 / (1024 * 1024)
buffered_records = buffered_records or {}
process_names = {"lunar_engine", "fluent-bit", "haproxy", "squid"}
process_to_buffer_key = {
  ["lunar_engine"] = "engine",
  ["fluent-bit"] = "fluent",
  ["haproxy"] = "haproxy",
  ["squid"] = "squid"
}

local function process_exists(process_name)
  local result = os.execute("pgrep -x " .. process_name .. " > /dev/null 2>&1")
  return result == 0
end

local function get_running_processes()
  local running_processes = {}

  for _, process_name in ipairs(process_names) do
    if process_exists(process_name) then
      running_processes[process_name] = true
    else
      running_processes[process_name] = false
    end
  end

  return running_processes
end

local function check_all_values_exists(processes)
  value_exists = buffered_records["system_memory"] and buffered_records["system_disk"]
  for process_name, process_running in pairs(processes) do
    if process_running then
      local key = process_to_buffer_key[process_name]
      value_exists = value_exists and buffered_records[key .. "_memory"] and buffered_records[key .. "_cpu"]
    end
  end
  return value_exists
end

local function check_all_values_not_empty(processes)
  values_not_empty = #buffered_records["system_memory"] > 0 and #buffered_records["system_disk"] > 0
  for process_name, process_running in pairs(processes) do
    if process_running then
      local key = process_to_buffer_key[process_name]
      values_not_empty = values_not_empty and #buffered_records[key .. "_memory"] > 0 and #buffered_records[key .. "_cpu"] > 0
    end
  end
  return values_not_empty
end

local function truncate_to_two_decimal_places(value)
  local multiplier = 10^2
  return math.floor(value * multiplier) / multiplier
end

local function is_numeric(value)
  return tonumber(value) ~= nil
end

local function create_disabled_record()
  return {
    ["cpu"] = {
      ["use_percentage"] = 0
    },
    ["memory"] = {
      ["used_mb"] = 0,
      ["total_mb"] = 0,
      ["use_percentage"] = 0
    },
    ["fd"] = 0,
    ["uptime"] = "00:00",
    ["running"] = false
  }
end

local function create_record(cpu, memory)
  if not cpu or not memory then
    return nil
  end
  new_record = cpu
  new_record["memory"] = memory["memory"]
  new_record["fd"] = memory["fd"]
  new_record["running"] = true
  return new_record
end

function read_file(file_path)
  local file = io.open(file_path, "r")
  if file then
      local content = file:read("*a")
      file:close()
      return content
  end
  return nil
end

function get_cgroup_memory_info(max_memory)
  local usage_path = "/sys/fs/cgroup/memory.current"
  local limit_path = "/sys/fs/cgroup/memory.max"
  local usage = 0
  local limit = 0

  local usage_file = read_file(usage_path)
  if usage_file then
      usage = tonumber(usage_file) * bytes_to_mb
  end

  local limit_file = read_file(limit_path)
  if limit_file and is_numeric(limit_file) then
    limit = tonumber(limit_file) * bytes_to_mb
  elseif max_memory then
    limit = tonumber(max_memory) * kb_to_mb
  end
  
  local usage_mb = math.floor(usage * 10 + 0.5) / 10
  local limit_mb = math.floor(limit * 10 + 0.5) / 10

  return usage_mb, limit_mb
end

function add_memory_info(record)
  local usage_mb, limit_mb = get_cgroup_memory_info(record["Mem.total"])
  new_record = {}
  new_record["used_mb"] = truncate_to_two_decimal_places(usage_mb)
  new_record["total_mb"] = truncate_to_two_decimal_places(limit_mb)
  new_record["use_percentage"] = truncate_to_two_decimal_places((usage_mb / limit_mb) * 100)
  return new_record
end

function add_disk_info(record)
  if record["exec"] then
    local total, used = string.match(record["exec"], "(%d+)%a+%s+(%d+)%a")
    if not total or not used then
      return nil
    end
    new_record = {}
    new_record["total_gb"] = tonumber(total)
    new_record["used_gb"] = tonumber(used)
    return new_record
  end
  return nil
end

function convert_process_memory_to_mb(record)
  new_record = {}
  if record["mem.VmRSS"] and record["fd"] then
    new_record["memory"] = {}
    new_record["memory"]["used_mb"] = truncate_to_two_decimal_places(record["mem.VmRSS"] * bytes_to_mb) or 0
    new_record["fd"] = tonumber(record["fd"]) or 0
  
    return new_record
  end
  return nil
end

function get_cpu_stats(record)
  if record["exec"] then
    local cpu, uptime = string.match(record["exec"], "([%d%.]+)%s+(%S+)")
    new_record = {}
    new_record["cpu"] = {}
    if is_numeric(cpu) and uptime then
      new_record["cpu"]["use_percentage"] = tonumber(cpu) or 0
      new_record["uptime"] = uptime or 0
      return new_record
    end
  end
  return nil
end

function generate_combined_record(running_processes)
  local combined_record = {
    ["system"] = {
      ["memory"] = add_memory_info(table.remove(buffered_records["system_memory"], 1)),
      ["disk"] = add_disk_info(table.remove(buffered_records["system_disk"], 1))
    }
  }

  for process_name, process_running in pairs(running_processes) do
    local key = process_to_buffer_key[process_name]
    if process_running then
      local engine_mem_record = convert_process_memory_to_mb(table.remove(buffered_records[key .. "_memory"], 1))
      local engine_cpu_record = get_cpu_stats(table.remove(buffered_records[key .. "_cpu"], 1))
      combined_record[key] = create_record(engine_cpu_record, engine_mem_record)
    else
      combined_record[key] = create_disabled_record()
    end
  end
  return combined_record
end

function buffer_and_dispatch(tag, timestamp, record)
  if not buffered_records[tag] then
      buffered_records[tag] = {}
  end

  table.insert(buffered_records[tag], record)

  running_processes = get_running_processes()

  if check_all_values_exists(running_processes) and check_all_values_not_empty(running_processes) then
    local combined_record = generate_combined_record(running_processes)
    return 2, timestamp, combined_record
  end

  return -1, timestamp, nil
end
