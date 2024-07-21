package utils

import (
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDumpHeaders(t *testing.T) {
	t.Parallel()
	input := map[string]string{
		"Auth":         "Bla",
		"Content-Type": "application/json",
	}

	res := DumpHeaders(input)
	slicedRes := strings.Split(strings.Trim(res, "\n"), "\n")
	wantParts := []string{"Auth:Bla", "Content-Type:application/json"}
	sort.Strings(slicedRes)
	sort.Strings(wantParts)
	assert.Equal(t, slicedRes, wantParts)
}

func TestParseHeaders(t *testing.T) {
	t.Parallel()
	input := "Auth: Bla\nContent-Type: application/json\n"
	res := ParseHeaders(&input)

	want := map[string]string{
		"Auth":         "Bla",
		"Content-Type": "application/json",
	}

	assert.Equal(t, res, want)
}
