package streamconfig

import "fmt"

func validateFlowRepresentation(flowRepresentation *FlowRepresentation) error {
	if flowRepresentation.Name == "" {
		return fmt.Errorf("flow name is required")
	}
	filterValidationErr := validateFilter(&flowRepresentation.Filters)
	if filterValidationErr != nil {
		return filterValidationErr
	}

	flowValidationErr := validateFlow(&flowRepresentation.Flow)
	if flowValidationErr != nil {
		return flowValidationErr
	}

	for processorName, processor := range flowRepresentation.Processors {
		processorValidationErr := validateProcessor(&processor)
		if processorValidationErr != nil {
			return fmt.Errorf("processor %s: %s", processorName, processorValidationErr)
		}
	}

	return nil
}

func validateFlow(flow *Flow) error {
	requestValidationErr := validateFlowConnection(flow.Request)
	if requestValidationErr != nil {
		return fmt.Errorf("flow request: %s", requestValidationErr)
	}

	responseValidationErr := validateFlowConnection(flow.Response)
	if responseValidationErr != nil {
		return fmt.Errorf("flow response: %s", responseValidationErr)
	}

	return nil
}

func validateProcessor(processor *Processor) error {
	if processor.Processor == "" {
		return fmt.Errorf("processor identifier is required")
	}

	return nil
}

func validateFilter(filter *Filter) error {
	if filter.Name == "" {
		return fmt.Errorf("filter name is required")
	}

	if filter.URL == "" {
		return fmt.Errorf("filter url is required")
	}

	return nil
}

func validateFlowConnection(flowConnection []*FlowConnection) error {
	for _, connection := range flowConnection {
		if connection.From == nil {
			return fmt.Errorf("connection from is required")
		}

		if connection.To == nil {
			return fmt.Errorf("connection to is required")
		}

		if connection.From.Stream == nil &&
			connection.From.Flow == nil &&
			connection.From.Processor == nil {
			return fmt.Errorf("connection from stream, flow or processor is required")
		}

		if connection.To.Stream == nil &&
			connection.To.Flow == nil &&
			connection.To.Processor == nil {
			return fmt.Errorf("connection to stream, flow or processor is required")
		}

		streamRefValidationErr := validateStreamRef(connection.From.Stream)
		if streamRefValidationErr != nil {
			return fmt.Errorf("connection from stream: %s", streamRefValidationErr)
		}

		streamRefValidationErr = validateStreamRef(connection.To.Stream)
		if streamRefValidationErr != nil {
			return fmt.Errorf("connection to stream: %s", streamRefValidationErr)
		}

		flowRefValidationErr := validateFlowRef(connection.From.Flow)
		if flowRefValidationErr != nil {
			return fmt.Errorf("connection from flow: %s", flowRefValidationErr)
		}

		flowRefValidationErr = validateFlowRef(connection.To.Flow)
		if flowRefValidationErr != nil {
			return fmt.Errorf("connection to flow: %s", flowRefValidationErr)
		}

		processorRefValidationErr := validateProcessorRef(connection.From.Processor)
		if processorRefValidationErr != nil {
			return fmt.Errorf("connection from processor: %s", processorRefValidationErr)
		}

		processorRefValidationErr = validateProcessorRef(connection.To.Processor)
		if processorRefValidationErr != nil {
			return fmt.Errorf("connection to processor: %s", processorRefValidationErr)
		}

	}

	return nil
}

func validateStreamRef(streamRef *StreamRef) error {
	if streamRef == nil {
		return nil
	}

	if streamRef.Name == "" {
		return fmt.Errorf("stream name is required")
	}

	return nil
}

func validateFlowRef(flowRef *FlowRef) error {
	if flowRef == nil {
		return nil
	}

	if flowRef.Name == "" {
		return fmt.Errorf("flow name is required")
	}

	return nil
}

func validateProcessorRef(processorRef *ProcessorRef) error {
	if processorRef == nil {
		return nil
	}

	if processorRef.Name == "" {
		return fmt.Errorf("processor name is required")
	}

	return nil
}
