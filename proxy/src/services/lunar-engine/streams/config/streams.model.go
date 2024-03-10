package streamconfig

import streamfilter "lunar/engine/streams/filter"

type Streams struct {
	Streams []*Stream
}

type Stream struct {
	Filter streamfilter.Filter
}
