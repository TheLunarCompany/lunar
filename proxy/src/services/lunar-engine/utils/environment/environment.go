package environment

import (
	"os"

	"github.com/rs/zerolog/log"
)

type Environment int

const (
	Development Environment = iota
	Staging
	Production
)

func (e Environment) IsDevelopment() bool {
	return e == Development
}

func (e Environment) IsStaging() bool {
	return e == Staging
}

func (e Environment) IsProduction() bool {
	return e == Production
}

func (e Environment) ToString() string {
	var res string
	switch e {
	case Development:
		res = "dev"
	case Staging:
		res = "staging"
	case Production:
		res = "prod"
	}

	return res
}

func GetEnvironment() Environment {
	envString := os.Getenv("ENV")
	var environment Environment

	switch envString {
	case "dev":
		environment = Development
	case "staging":
		environment = Staging
	case "prod":
		environment = Production
	default:
		log.Warn().Msgf("Unknown environment, setting environment to [dev]")
		environment = Development

	}
	return environment
}
