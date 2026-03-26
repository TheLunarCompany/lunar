package pathparamsresource

type PathParamsRaw struct {
	PathParams []*PathParam `yaml:"path_params" validate:"required"`
}

type PathParam struct {
	URL string `yaml:"url" validate:"required"`
}
