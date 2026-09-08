package config

// encoding.MarshalText & encoding.UnmarshalText are required
// in order encode/decode from/into map keys.
// See https://tinyurl.com/go-marshal-custom-map-key

func (remedyType RemedyType) MarshalText() (text []byte, err error) {
	return []byte(remedyType.String()), nil
}

func (remedyType *RemedyType) UnmarshalText(b []byte) error {
	parsed, err := ParseRemedyType(string(b))
	if err != nil {
		return err
	}

	*remedyType = parsed
	return nil
}
