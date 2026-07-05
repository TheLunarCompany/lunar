//nolint:tagliatelle
package har

// Entry represents one HTTP request/response record in a HAR log.
type Entry struct {
	Pageref         string   `json:"pageref,omitempty"`         // ID of the parent page
	StartedDateTime string   `json:"startedDateTime"`           // ISO8601 timestamp
	Time            float64  `json:"time"`                      // Total time (ms)
	Request         Request  `json:"request"`                   // Request data
	Response        Response `json:"response"`                  // Response data
	Cache           Cache    `json:"cache"`                     // Cache before/after
	Timings         Timings  `json:"timings"`                   // Timing breakdown
	ServerIPAddress string   `json:"serverIPAddress,omitempty"` // Server IP (if known)
	Connection      string   `json:"connection,omitempty"`      // Connection ID (e.g. port)
	Comment         string   `json:"comment,omitempty"`         // Optional comment
}

// Header represents a single HTTP header.
type Header struct {
	Name    string `json:"name"`              // header name
	Value   string `json:"value"`             // header value
	Comment string `json:"comment,omitempty"` // optional comment
}

type Query struct {
	Name    string `json:"name"`              // parameter name
	Value   string `json:"value"`             // parameter value
	Comment string `json:"comment,omitempty"` // optional comment
}

// PostData represents posted data (either params or raw text).
type PostData struct {
	MimeType string  `json:"mimeType"`          // e.g. "application/json"
	Params   []Param `json:"params,omitempty"`  // form params
	Text     string  `json:"text,omitempty"`    // raw body text
	Comment  string  `json:"comment,omitempty"` // optional comment
}

// Param is one name/value pair in a form post.
type Param struct {
	Name        string `json:"name"`                  // parameter name
	Value       string `json:"value,omitempty"`       // param value or file content
	FileName    string `json:"fileName,omitempty"`    // uploaded file name
	ContentType string `json:"contentType,omitempty"` // uploaded file MIME type
	Comment     string `json:"comment,omitempty"`     // optional comment
}

// Cookie represents one HTTP cookie.
type Cookie struct {
	Name     string `json:"name"`               // cookie name
	Value    string `json:"value"`              // cookie value
	Path     string `json:"path,omitempty"`     // optional path
	Domain   string `json:"domain,omitempty"`   // optional domain
	Expires  string `json:"expires,omitempty"`  // ISO8601 expiry
	HTTPOnly bool   `json:"httpOnly,omitempty"` // HTTP-only flag
	Secure   bool   `json:"secure,omitempty"`   // Secure flag
	Comment  string `json:"comment,omitempty"`  // optional comment
}

// Request contains the details of the HTTP request.
type Request struct {
	Method      string    `json:"method"`             // e.g. "GET"
	URL         string    `json:"url"`                // full URL
	HTTPVersion string    `json:"httpVersion"`        // e.g. "HTTP/1.1"
	Cookies     []Cookie  `json:"cookies"`            // parsed cookies
	Headers     []Header  `json:"headers"`            // HTTP headers
	QueryString []Query   `json:"queryString"`        // URL query parameters
	PostData    *PostData `json:"postData,omitempty"` // request body (if any)
	HeadersSize int64     `json:"headersSize"`        // size of headers in bytes
	BodySize    int64     `json:"bodySize"`           // size of body in bytes
	Comment     string    `json:"comment,omitempty"`  // optional comment
}

// Response contains the details of the HTTP response.
type Response struct {
	Status      int      `json:"status"`            // e.g. 200
	StatusText  string   `json:"statusText"`        // e.g. "OK"
	HTTPVersion string   `json:"httpVersion"`       // e.g. "HTTP/1.1"
	Cookies     []Cookie `json:"cookies"`           // response cookies
	Headers     []Header `json:"headers"`           // response headers
	Content     Content  `json:"content"`           // response body details
	RedirectURL string   `json:"redirectURL"`       // from Location header
	HeadersSize int64    `json:"headersSize"`       // size of headers in bytes
	BodySize    int64    `json:"bodySize"`          // size of body in bytes
	Comment     string   `json:"comment,omitempty"` // optional comment
}

// Content holds the response body metadata.
type Content struct {
	Size        int64  `json:"size"`                  // bytes returned
	Compression int64  `json:"compression,omitempty"` // bytes saved (if any)
	MimeType    string `json:"mimeType"`              // e.g. "text/html; charset=UTF-8"
	Text        string `json:"text,omitempty"`        // body text or base64
	Encoding    string `json:"encoding,omitempty"`    // e.g. "base64"
	Comment     string `json:"comment,omitempty"`     // optional comment
}

// Timings breaks down the phases of the request.
type Timings struct {
	Blocked float64 `json:"blocked,omitempty"` // waiting for a connection
	DNS     float64 `json:"dns,omitempty"`     // DNS lookup
	Connect float64 `json:"connect,omitempty"` // TCP connect
	Send    float64 `json:"send"`              // request send
	Wait    float64 `json:"wait"`              // time to first byte
	Receive float64 `json:"receive"`           // response read
	SSL     float64 `json:"ssl,omitempty"`     // TLS negotiation
	Comment string  `json:"comment,omitempty"` // optional comment
}

// CacheDetails describes one snapshot of the cache.
type CacheDetails struct {
	Expires    string `json:"expires,omitempty"` // ISO8601 expiry
	LastAccess string `json:"lastAccess"`        // ISO8601 last used
	ETag       string `json:"eTag"`              // strong validator
	HitCount   int64  `json:"hitCount"`          // number of uses
	Comment    string `json:"comment,omitempty"` // optional comment
}

// Cache shows what was cached before/after the request.
type Cache struct {
	BeforeRequest *CacheDetails `json:"beforeRequest,omitempty"` // cache state before
	AfterRequest  *CacheDetails `json:"afterRequest,omitempty"`  // cache state after
	Comment       string        `json:"comment,omitempty"`       // optional comment
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
