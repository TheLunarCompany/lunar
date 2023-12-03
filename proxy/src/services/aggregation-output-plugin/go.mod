module lunar/aggregation-plugin

go 1.20

require (
	github.com/fluent/fluent-bit-go v0.0.0-20200420155746-e125cab17963
	github.com/goccy/go-json v0.10.2
	github.com/rs/zerolog v1.29.1
	github.com/samber/lo v1.37.0
	github.com/stretchr/testify v1.8.4
	lunar/shared-model v0.0.0
	lunar/toolkit-core v0.0.0
)

replace (
	lunar/shared-model v0.0.0 => ../../libs/shared-model
	lunar/toolkit-core v0.0.0 => ../../libs/toolkit-core
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.2 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.14.1 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.19 // indirect
	github.com/pkg/errors v0.9.1 //indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/ugorji/go/codec v1.2.7 // indirect
	golang.org/x/crypto v0.9.0 // indirect
	golang.org/x/exp v0.0.0-20220303212507-bbda1eaf7a17 // indirect
	golang.org/x/net v0.10.0 // indirect
	golang.org/x/sys v0.8.0 // indirect
	golang.org/x/text v0.9.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
