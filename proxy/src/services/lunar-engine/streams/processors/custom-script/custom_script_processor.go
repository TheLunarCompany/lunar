package customscript

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"
	"strings"

	streamtypes "lunar/engine/streams/types"

	"github.com/dop251/goja"
	"github.com/rs/zerolog/log"
)

const (
	scriptTextParam = "script_text"
	request         = "request"
	response        = "response"

	successConditionName = "success"
	failureConditionName = "failure"
)

type customScriptProcessor struct {
	name         string
	scriptText   string
	metaData     *streamtypes.ProcessorMetaData
	gojaVM       *goja.Runtime
	gojaCallable goja.Callable
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	processor := customScriptProcessor{
		name:     metaData.Name,
		metaData: metaData,
	}

	if err := processor.init(); err != nil {
		return nil, err
	}

	return &processor, nil
}

func (p *customScriptProcessor) GetName() string {
	return p.name
}

func (p *customScriptProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *customScriptProcessor) Execute(
	_ string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	condition := successConditionName
	if err := p.runScript(apiStream); err != nil {
		log.Trace().Err(err).Msg("Failed to run script")
		condition = failureConditionName
	}

	return streamtypes.ProcessorIO{
		Type:       apiStream.GetType(),
		ReqAction:  &actions.NoOpAction{},
		RespAction: &actions.NoOpAction{},
		Name:       condition,
	}, nil
}

// init initializes the custom script processor
func (p *customScriptProcessor) init() error {
	if err := utils.ExtractStrParam(p.metaData.Parameters,
		scriptTextParam,
		&p.scriptText); err != nil {
		log.Error().Err(err).Msgf("Missing %s parameter", scriptTextParam)
		return err
	}

	p.scriptText = strings.ReplaceAll(p.scriptText, ".body.", ".body_map.")

	if err := p.initGojaVM(); err != nil {
		log.Error().Err(err).Msg("Failed to initialize Goja VM")
		return err
	}
	return nil
}

func (p *customScriptProcessor) initGojaVM() error {
	p.gojaVM = goja.New()

	if err := p.gojaVM.Set("btoa", func(s string) string {
		return base64.StdEncoding.EncodeToString([]byte(s))
	}); err != nil {
		log.Error().Err(err).Msg("Failed to set btoa function")
		return err
	}

	funcTemplate := `
function onAPICall(){
	%s
}`
	p.scriptText = fmt.Sprintf(funcTemplate, p.scriptText)

	// Run the script - needed to be run in order to validate the script
	_, err := p.gojaVM.RunString(p.scriptText)
	if err != nil {
		return fmt.Errorf("failed to validate JS: %s %w", p.scriptText, err)
	}

	// Retrieve the onAPICall function from the VM.
	fnValue := p.gojaVM.Get("onAPICall")
	callable, success := goja.AssertFunction(fnValue)
	if !success {
		return fmt.Errorf("failed to assert onAPICall function")
	}
	p.gojaCallable = callable

	return nil
}

// runScript runs the custom script on the stream
func (p *customScriptProcessor) runScript(apiStream public_types.APIStreamI) error {
	streamMap, err := utils.ConvertStreamToDataMap(apiStream)
	if err != nil {
		return err
	}

	if err = p.setStreamToGojaVM(streamMap); err != nil {
		return fmt.Errorf("failed to set stream to Goja VM: %w", err)
	}

	_, err = p.gojaVM.RunString(p.scriptText)
	if err != nil {
		return fmt.Errorf("failed to run script: %w", err)
	}

	if p.gojaCallable == nil {
		return fmt.Errorf("onAPICall function is not defined")
	}

	// The 'nil' passed as the first argument means the 'this' value in JS is undefined.
	if _, err = p.gojaCallable(nil); err != nil {
		return fmt.Errorf("failed to call onAPICall function: %w", err)
	}

	// Extract the modified maps back
	if err := p.storeRequestChanges(apiStream); err != nil {
		return fmt.Errorf("failed to store request changes: %w", err)
	}

	if err := p.storeResponseChanges(apiStream); err != nil {
		return fmt.Errorf("failed to store response changes: %w", err)
	}

	return nil
}

// storeRequestChanges stores the changes made by Goja VM to the stream
func (p *customScriptProcessor) storeRequestChanges(apiStream public_types.APIStreamI) error {
	original := apiStream.GetRequest()
	if original == nil {
		return nil
	}

	var requestValExported any
	if requestVal := p.gojaVM.Get(request); requestVal != nil {
		requestValExported = requestVal.Export()
	}
	if requestValExported == nil {
		return nil
	}

	originalReq, success := original.(*streamtypes.OnRequest)
	if !success {
		return fmt.Errorf("failed to cast request to OnRequest")
	}

	// should make headers zero, otherwise json.Unmarshal will perform union
	originalReq.Headers = make(map[string]string)

	updatedReqMap := requestValExported.(map[string]any)
	jsonData, err := json.Marshal(updatedReqMap)
	if err != nil {
		return err
	}
	err = json.Unmarshal(jsonData, originalReq)
	if err != nil {
		return err
	}
	originalReq.UpdateBodyFromBodyMap()
	apiStream.SetRequest(originalReq)
	return nil
}

// storeResponseChanges stores the changes made by Goja VM to the stream
func (p *customScriptProcessor) storeResponseChanges(apiStream public_types.APIStreamI) error {
	original := apiStream.GetResponse()
	if original == nil {
		return nil
	}

	var responseValExported any
	if responseVal := p.gojaVM.Get(response); responseVal != nil {
		responseValExported = responseVal.Export()
	}
	if responseValExported == nil {
		return nil
	}

	originalResp, success := original.(*streamtypes.OnResponse)
	if !success {
		return fmt.Errorf("failed to cast request to OnResponse")
	}

	// should make headers zero, otherwise json.Unmarshal will perform union
	originalResp.Headers = make(map[string]string)

	updatedResMap := responseValExported.(map[string]any)
	jsonData, err := json.Marshal(updatedResMap)
	if err != nil {
		return err
	}
	err = json.Unmarshal(jsonData, originalResp)
	if err != nil {
		return err
	}
	originalResp.UpdateBodyFromBodyMap()
	apiStream.SetResponse(originalResp)
	return nil
}

// setStreamToGojaVM sets the request and response maps to the Goja VM
func (p *customScriptProcessor) setStreamToGojaVM(streamMap map[string]any) error {
	if req, ok := streamMap[request]; ok {
		reqMap := req.(map[string]any)
		if err := p.gojaVM.Set(request, reqMap); err != nil {
			return err
		}
	}

	if res, ok := streamMap[response]; ok {
		resMap := res.(map[string]any)
		if err := p.gojaVM.Set(response, resMap); err != nil {
			return err
		}
	}
	return nil
}
