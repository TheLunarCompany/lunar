// caller must match the delimiter used to build the existing value,mismatches are undetectable
// This function mutate the query params that are sent to it
export function appendToQueryParam(props: {
  searchParams: URLSearchParams;
  paramName: string;
  valueToAppend: string;
  delimiter: string;
}): void {
  const { searchParams, paramName, valueToAppend, delimiter } = props;
  const existing = searchParams.get(paramName);
  const values = existing?.split(delimiter) ?? [];
  if (!values.includes(valueToAppend)) {
    values.push(valueToAppend); // add valueToAppend if the param exist and doesn't include it
    searchParams.set(paramName, values.join(delimiter));
  }
}
