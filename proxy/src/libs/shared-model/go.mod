module lunar/shared-model

go 1.20

require (
	github.com/go-playground/validator/v10 v10.14.1
	github.com/goccy/go-json v0.10.2
	github.com/rs/zerolog v1.29.1
	github.com/stretchr/testify v1.8.4
	gopkg.in/yaml.v3 v3.0.1
	lunar/toolkit-core v0.0.0
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.2 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.19 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	golang.org/x/crypto v0.9.0 // indirect
	golang.org/x/net v0.10.0 // indirect
	golang.org/x/sys v0.8.0 // indirect
	golang.org/x/text v0.9.0 // indirect
)

replace lunar/toolkit-core v0.0.0 => ../../libs/toolkit-core
