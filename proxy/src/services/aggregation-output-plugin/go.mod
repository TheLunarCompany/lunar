module lunar/aggregation-plugin

go 1.23.0

require (
	github.com/fluent/fluent-bit-go v0.0.0-20230731091245-a7a013e2473c
	github.com/goccy/go-json v0.10.2
	github.com/rs/zerolog v1.31.0
	github.com/samber/lo v1.44.0
	github.com/stretchr/testify v1.9.0
	gopkg.in/yaml.v2 v2.4.0
	lunar/shared-model v0.0.0
	lunar/toolkit-core v0.0.0
)

replace (
	lunar/shared-model v0.0.0 => ../../libs/shared-model
	lunar/toolkit-core v0.0.0 => ../../libs/toolkit-core
)

require (
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/gabriel-vasile/mimetype v1.4.3 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.16.0 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/pkg/errors v0.9.1 //indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/ugorji/go/codec v1.2.12 // indirect
	golang.org/x/crypto v0.36.0 // indirect
	golang.org/x/net v0.38.0 // indirect
	golang.org/x/sys v0.31.0 // indirect
	golang.org/x/text v0.23.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
