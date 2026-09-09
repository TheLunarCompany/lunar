package runner

func NewRunner() (AsyncServiceI, error) {
	return newRunner()
}
