package writers

type Writer interface {
	Write(b []byte) (int, error)
}
