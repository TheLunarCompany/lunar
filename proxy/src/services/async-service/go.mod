module lunar/async-service

go 1.21

require (
	github.com/rs/zerolog v1.34.0
	github.com/stretchr/testify v1.9.0
	lunar/engine v0.0.0
	lunar/toolkit-core v0.0.0
)

require (
	github.com/alicebob/gopher-json v0.0.0-20200520072559-a9ecdc9d1d3a // indirect
	github.com/ohler55/ojg v1.26.1 // indirect
	github.com/yuin/gopher-lua v1.1.1 // indirect
	golang.org/x/text v0.16.0 // indirect
)

require (
	github.com/alicebob/miniredis/v2 v2.33.0
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/goccy/go-json v0.10.2 // indirect
	github.com/gorilla/websocket v1.5.1 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/negasus/haproxy-spoe-go v1.0.5 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/redis/go-redis/v9 v9.3.0
	github.com/samber/lo v1.44.0 // indirect
	golang.org/x/exp v0.0.0-20231214170342-aacd6d4b4611 // indirect
	golang.org/x/net v0.26.0 // indirect
	golang.org/x/sys v0.21.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	lunar/shared-model v0.0.0 // indirect
)

replace lunar/toolkit-core v0.0.0 => ../../libs/toolkit-core

replace lunar/shared-model v0.0.0 => ../../libs/shared-model

replace lunar/engine v0.0.0 => ../lunar-engine
