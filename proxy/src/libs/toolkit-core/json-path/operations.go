package jsonpath

/*
OperationI is an interface for custom operations that can be executed on JSON data.
This allows for custom operations to be defined and executed on JSON data.
The Execute method should be implemented to perform the custom operation.
Operation Examples:

func addValue(data any, jsonPathExpr string, args ...any) (any, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("addValue operation requires one argument (the value to add)")
	}

	valueToAdd, ok := args[0].(float64)
	if !ok {
		return nil, fmt.Errorf("addValue argument must be a number (float64)")
	}

	return JsonPathWrapper.WriteJSON(data, jsonPathExpr, valueToAdd)
}

func replaceValue(data any, jsonPathExpr string, args ...any) (any, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("replaceValue operation requires one argument (the value to replace)")
	}

	valueToAdd, ok := args[0].(string)
	if !ok {
		return nil, fmt.Errorf("addValue argument must be a string")
	}

	return JsonPathWrapper.WriteJSON(data, jsonPathExpr, valueToAdd)
}

func main() {
	jsonFile, err := os.ReadFile("test.json")
	if err != nil {
		log.Fatalf("Error reading JSON file: %v", err)
	}

	jPath, err := JsonPathWrapper.NewJSONWrapper(&jsonFile)
	if err != nil {
		log.Fatalf("Error creating JSON wrapper: %v", err)
	}

	jPath.RegisterOperation("addValue", JsonPathWrapper.OperationFunc(addValue))
	jPath.RegisterOperation("replaceValue", JsonPathWrapper.OperationFunc(replaceValue))

	newData, err := jPath.ExecuteOperation("addValue", "$.request.price", 5.0)

	if err != nil {
		log.Fatalf("Error executing operation: %v", err)
	}
	// o[?@.u || @.x]
	newJSON, err := json.MarshalIndent(newData, "", "  ")
	if err != nil {
		log.Fatalf("Error marshaling JSON: %v", err)
	}

	fmt.Println(string(newJSON))
}
*/

type OperationI interface {
	Execute(data any, jsonPathExpr string, args ...any) (any, error)
}

type OperationFunc func(data any, jsonPathExpr string, args ...any) (any, error)

func (f OperationFunc) Execute(data any, jsonPathExpr string, args ...any) (any, error) {
	return f(data, jsonPathExpr, args...)
}
