package testutils

import "testing"

func TestInParallel(
	t *testing.T,
	times int,
	testName string,
	testFunction func(t *testing.T),
) {
	for i := 0; i < times; i++ {
		t.Run(testName, func(t *testing.T) {
			t.Parallel()
			testFunction(t)
		})
	}
}
