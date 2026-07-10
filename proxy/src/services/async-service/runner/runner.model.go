package runner

type AsyncServiceI interface {
	Run() error
	Stop()
}
