package writers

type NullWriter struct{}

func NewNullWriter() *NullWriter {
	return &NullWriter{}
}

func (*NullWriter) Write(b []byte) (int, error) {
	return len(b), nil
}

func (*NullWriter) Close() error {
	return nil
}
