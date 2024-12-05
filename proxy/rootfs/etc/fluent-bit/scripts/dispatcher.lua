kb_to_mb = 1 / 1000
bytes_to_mb = 1 / (1024 * 1024)
buffered_records = buffered_records or {}

local function check_all_values_exists()
  return buffered_records["system_memory"] and buffered_records["system_disk"] and buffered_records["engine_memory"] and buffered_records["engine_cpu"] and buffered_records["fluent_memory"] and buffered_records["fluent_cpu"] and buffered_records["haproxy_memory"] and buffered_records["haproxy_cpu"] and buffered_records["squid_memory"] and buffered_records["squid_cpu"]
end

local function check_all_values_not_empty()
  return #buffered_records["system_memory"] > 0 and #buffered_records["system_disk"] > 0 and #buffered_records["engine_memory"] > 0 and #buffered_records["engine_cpu"] > 0 and #buffered_records["fluent_memory"] > 0 and #buffered_records["fluent_cpu"] > 0 and #buffered_records["haproxy_memory"] > 0 and #buffered_records["haproxy_cpu"] > 0 and #buffered_records["squid_memory"] > 0 and #buffered_records["squid_cpu"] > 0
end

local function truncate_to_two_decimal_places(value)
  local multiplier = 10^2
  return math.floor(value * multiplier) / multiplier
end

local function is_numeric(value)
  return tonumber(value) ~= nil
end

local function create_record(cpu, memory)
  new_record = cpu
  new_record["memory"] = memory["memory"]
  new_record["fd"] = memory["fd"]
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
    new_record["memory"]["used_mb"] = truncate_to_two_decimal_places(record["mem.VmRSS"] * bytes_to_mb)
    new_record["fd"] = tonumber(record["fd"])
  
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
      new_record["cpu"]["use_percentage"] = tonumber(cpu)
      new_record["uptime"] = uptime
      return new_record
    end
  end
  return nil
end

function buffer_and_dispatch(tag, timestamp, record)
  if not buffered_records[tag] then
      buffered_records[tag] = {}
  end

  table.insert(buffered_records[tag], record)

  if check_all_values_exists() and check_all_values_not_empty() then
    local system_mem_record = add_memory_info(table.remove(buffered_records["system_memory"], 1))
    local system_disk_record = add_disk_info(table.remove(buffered_records["system_disk"], 1))
    local engine_mem_record = convert_process_memory_to_mb(table.remove(buffered_records["engine_memory"], 1))
    local engine_cpu_record = get_cpu_stats(table.remove(buffered_records["engine_cpu"], 1))
    local fluent_mem_record = convert_process_memory_to_mb(table.remove(buffered_records["fluent_memory"], 1))
    local fluent_cpu_record = get_cpu_stats(table.remove(buffered_records["fluent_cpu"], 1))
    local haproxy_mem_record = convert_process_memory_to_mb(table.remove(buffered_records["haproxy_memory"], 1))
    local haproxy_cpu_record = get_cpu_stats(table.remove(buffered_records["haproxy_cpu"], 1))
    local squid_mem_record = convert_process_memory_to_mb(table.remove(buffered_records["squid_memory"], 1))
    local squid_cpu_record = get_cpu_stats(table.remove(buffered_records["squid_cpu"], 1))

    local combined_record = {
        ["system"] = {
          ["memory"] = system_mem_record,
          ["disk"] = system_disk_record
        },
        ["engine"] = create_record(engine_cpu_record, engine_mem_record),
        ["fluent"] = create_record(fluent_cpu_record, fluent_mem_record),
        ["haproxy"] = create_record(haproxy_cpu_record, haproxy_mem_record),
        ["squid"] = create_record(squid_cpu_record, squid_mem_record)
    }

    return 2, timestamp, combined_record
  end

  return -1, timestamp, nil
end
