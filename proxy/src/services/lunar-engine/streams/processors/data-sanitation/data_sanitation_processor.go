package datasanitation

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"strings"

	piiscrubber "github.com/aavaz-ai/pii-scrubber"
	"github.com/rs/zerolog/log"
)

const (
	blocklistedEntitiesParam = "blocklisted_entities"
	ignoredEntitiesParam     = "ignored_entities"
)

// Mapping from lowercase user input to pii-scrubber entities
var entityMap = map[string]piiscrubber.Entity{
	"date":          piiscrubber.Date,
	"time":          piiscrubber.Time,
	"creditcard":    piiscrubber.CreditCard,
	"email":         piiscrubber.Email,
	"emailaddress":  piiscrubber.Email,
	"phone":         piiscrubber.Phone,
	"unknownport":   piiscrubber.NotKnownPort,
	"ssn":           piiscrubber.SSN,
	"ip":            piiscrubber.IP,
	"ipaddress":     piiscrubber.IP,
	"link":          piiscrubber.Link,
	"strictlink":    piiscrubber.StrictLink,
	"iban":          piiscrubber.IBAN,
	"mac":           piiscrubber.MACAddress,
	"macaddress":    piiscrubber.MACAddress,
	"guid":          piiscrubber.GUID,
	"address":       piiscrubber.StreetAddress,
	"streetaddress": piiscrubber.StreetAddress,
	"zipcode":       piiscrubber.ZipCode,
	"zip":           piiscrubber.ZipCode,
	"pobox":         piiscrubber.PoBox,
	"hashmd5":       piiscrubber.MD5Hex,
	"md5":           piiscrubber.MD5Hex,
	"md5hex":        piiscrubber.MD5Hex,
	"hashsha1":      piiscrubber.SHA1Hex,
	"sha1hex":       piiscrubber.SHA1Hex,
	"sha1":          piiscrubber.SHA1Hex,
	"hashsha256":    piiscrubber.SHA256Hex,
	"sha256hex":     piiscrubber.SHA256Hex,
	"sha256":        piiscrubber.SHA256Hex,
	"bitcoin":       piiscrubber.BtcAddress,
	"btcaddress":    piiscrubber.BtcAddress,
	"isbn":          piiscrubber.ISBN,
	"git":           piiscrubber.GitRepo,
	"gitrepo":       piiscrubber.GitRepo,
}

type dataSanitationProcessor struct {
	name     string
	scrubber piiscrubber.Scrubber
	metaData *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	processor := dataSanitationProcessor{
		name:     metaData.Name,
		metaData: metaData,
	}

	if err := processor.init(); err != nil {
		return nil, err
	}

	return &processor, nil
}

func (p *dataSanitationProcessor) GetName() string {
	return p.name
}

func (p *dataSanitationProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *dataSanitationProcessor) Execute(
	_ string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	if apiStream.GetType() != public_types.StreamTypeRequest {
		return streamtypes.ProcessorIO{}, fmt.Errorf(
			"invalid stream type: %s",
			apiStream.GetType(),
		)
	}

	if len(apiStream.GetBody()) == 0 {
		log.Trace().Msgf("%s received empty request body", p.name)
		return streamtypes.ProcessorIO{
			Failure:   true,
			Type:      apiStream.GetType(),
			ReqAction: &actions.NoOpAction{},
		}, nil
	}

	originalRequest := apiStream.GetRequest()
	onRequest, success := originalRequest.(*streamtypes.OnRequest)
	if !success {
		return streamtypes.ProcessorIO{}, fmt.Errorf("failed to cast request to OnRequest")
	}

	scrubbedBody, err := p.scrubber.ScrubTexts([]string{onRequest.Body})
	if err != nil {
		log.Trace().Err(err).Msg("failed to scrub request body")
		return streamtypes.ProcessorIO{
			Failure:   true,
			Type:      apiStream.GetType(),
			ReqAction: &actions.NoOpAction{},
		}, nil
	}

	if scrubbedBody[0] == "" || scrubbedBody[0] == onRequest.Body {
		log.Trace().Msgf("No sensitive data found in request body: %s", onRequest.Body)
		return streamtypes.ProcessorIO{
			Type:      apiStream.GetType(),
			ReqAction: &actions.NoOpAction{},
		}, nil
	}

	log.Trace().Str("requestID", onRequest.ID).Msgf("Scrubbed request body: %s", scrubbedBody[0])
	onRequest.SetBody(scrubbedBody[0])
	apiStream.SetRequest(onRequest)

	reqAction := &actions.ModifyRequestAction{
		HeadersToSet: onRequest.GetHeaders(),
		Host:         onRequest.GetHost(),
		Body:         onRequest.GetBody(),
		Path:         onRequest.GetParsedURL().Path,
		QueryParams:  onRequest.GetQuery(),
	}

	return streamtypes.ProcessorIO{
		Type:      apiStream.GetType(),
		ReqAction: reqAction,
	}, nil
}

func (p *dataSanitationProcessor) init() error {
	var ignoredEntities, blocklistedEntities []string

	if err := utils.ExtractListOfStringParam(p.metaData.Parameters,
		blocklistedEntitiesParam,
		&blocklistedEntities); err != nil || len(blocklistedEntities) == 0 {
		log.Trace().Msgf("No %s parameter found", blocklistedEntitiesParam)
	}

	if err := utils.ExtractListOfStringParam(p.metaData.Parameters,
		ignoredEntitiesParam,
		&ignoredEntities); err != nil ||
		len(ignoredEntities) == 0 {
		log.Trace().Msgf("No %s parameter found", ignoredEntitiesParam)
	}

	params := piiscrubber.Params{
		BlacklistedEntities: p.convertToEntities(blocklistedEntities),
		IgnoredEntities:     p.convertToEntities(ignoredEntities),
		Config:              defaultEntityMaskConfig(),
	}
	log.Trace().Msgf("Creating scrubber with following configuration %+v for %s", params, p.name)
	var err error
	p.scrubber, err = piiscrubber.New(params)
	if err != nil {
		log.Error().Err(err).Msgf("failed to create custom scrubber for %s", p.name)
		return err
	}
	return nil
}

// convertToEntities converts user input strings to pii-scrubber entities
func (p *dataSanitationProcessor) convertToEntities(userInputs []string) []piiscrubber.Entity {
	var result []piiscrubber.Entity
	for _, input := range userInputs {
		// normalize snake_case and camelCase
		key := strings.ToLower(strings.ReplaceAll(input, "_", ""))
		if entity, ok := entityMap[key]; ok {
			result = append(result, entity)
		} else {
			log.Warn().Msgf("Skipping unknown entity %q for processor %s", key, p.name)
		}
	}
	return result
}

// defaultEntityMaskConfig changes the default entity mask (default uses <> that breaks JSON)
func defaultEntityMaskConfig() map[piiscrubber.Entity]*piiscrubber.EntityConfig {
	return map[piiscrubber.Entity]*piiscrubber.EntityConfig{
		piiscrubber.Date:          {ReplaceWith: stringPtr("***DATE***")},
		piiscrubber.Time:          {ReplaceWith: stringPtr("***TIME***")},
		piiscrubber.CreditCard:    {ReplaceWith: stringPtr("***CREDIT_CARD***")},
		piiscrubber.Email:         {ReplaceWith: stringPtr("***EMAIL***")},
		piiscrubber.Phone:         {ReplaceWith: stringPtr("***PHONE***")},
		piiscrubber.NotKnownPort:  {ReplaceWith: stringPtr("***NOTKNOWNPORT***")},
		piiscrubber.SSN:           {ReplaceWith: stringPtr("***SSN***")},
		piiscrubber.IP:            {ReplaceWith: stringPtr("***IP***")},
		piiscrubber.Link:          {ReplaceWith: stringPtr("***LINK***")},
		piiscrubber.StrictLink:    {ReplaceWith: stringPtr("***STRICTLINK***")},
		piiscrubber.IBAN:          {ReplaceWith: stringPtr("***IBAN***")},
		piiscrubber.MACAddress:    {ReplaceWith: stringPtr("***MACADDRESS***")},
		piiscrubber.GUID:          {ReplaceWith: stringPtr("***GUID***")},
		piiscrubber.StreetAddress: {ReplaceWith: stringPtr("***STREET_ADDRESS***")},
		piiscrubber.ZipCode:       {ReplaceWith: stringPtr("***ZIPCODE***")},
		piiscrubber.PoBox:         {ReplaceWith: stringPtr("***POBOX***")},
		piiscrubber.MD5Hex:        {ReplaceWith: stringPtr("***MD5HEX***")},
		piiscrubber.SHA1Hex:       {ReplaceWith: stringPtr("***SHA1HEX***")},
		piiscrubber.SHA256Hex:     {ReplaceWith: stringPtr("***SHA256HEX***")},
		piiscrubber.BtcAddress:    {ReplaceWith: stringPtr("***BTCADDRESS***")},
		piiscrubber.ISBN:          {ReplaceWith: stringPtr("***ISBN***")},
		piiscrubber.GitRepo:       {ReplaceWith: stringPtr("***GITREPO***")},
	}
}

func stringPtr(s string) *string {
	return &s
}
