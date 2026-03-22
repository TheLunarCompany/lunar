package actions

import "github.com/goccy/go-json"

func (r RemedyReqRunResult) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.String())
}

func (r *RemedyReqRunResult) UnmarshalJSON(data []byte) error {
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	parsed, err := ParseRemedyReqRunResult(raw)
	if err != nil {
		return err
	}

	*r = parsed

	return nil
}

func (r RemedyRespRunResult) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.String())
}

func (r *RemedyRespRunResult) UnmarshalJSON(data []byte) error {
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	parsed, err := ParseRemedyRespRunResult(raw)
	if err != nil {
		return err
	}

	*r = parsed

	return nil
}
