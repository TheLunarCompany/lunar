package environment

func UseSentry(environment Environment) bool {
	return environment.IsProduction() || environment.IsStaging()
}
