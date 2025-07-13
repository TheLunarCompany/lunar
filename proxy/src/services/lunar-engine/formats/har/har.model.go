//nolint:tagliatelle
package har

import "time"

type Header struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type Query struct {
	Name  string   `json:"name"`
	Value []string `json:"value"`
}

type Cookie struct {
	Name     string    `json:"name"`
	Value    string    `json:"value"`
	Path     string    `json:"path"`
	Domain   string    `json:"domain"`
	Expires  time.Time `json:"expires"`
	HTTPOnly bool      `json:"httpOnly"`
	Secure   bool      `json:"secure"`
}

type Request struct {
	Method      string      `json:"method"`
	URL         string      `json:"url"`
	HTTPVersion string      `json:"httpVersion"`
	Headers     []Header    `json:"headers"`
	QueryString []Query     `json:"queryString"`
	Cookies     []Cookie    `json:"cookies"`
	HeadersSize int         `json:"headersSize"`
	BodySize    int         `json:"bodySize"`
	Body        interface{} `json:"body,omitempty"`
}

type Response struct {
	Status      int         `json:"status"`
	StatusText  string      `json:"statusText"`
	HTTPVersion string      `json:"httpVersion"`
	Headers     []Header    `json:"headers"`
	Cookies     []Cookie    `json:"cookies"`
	Content     interface{} `json:"content,omitempty"`
	Size        int         `json:"size,omitempty"`
	MimeType    string      `json:"mimeType,omitempty"`
}

type Entry struct {
	StartedDateTime time.Time     `json:"startedDateTime"`
	Time            time.Duration `json:"time"`
	Request         Request       `json:"request"`
	Response        Response      `json:"response"`
}

type Creator struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Comment string `json:"comment"`
}

type Log struct {
	Version string  `json:"version"`
	Creator Creator `json:"creator"`
	Entries []Entry `json:"entries"`
}

type HAR struct {
	Log Log `json:"log"`
}
