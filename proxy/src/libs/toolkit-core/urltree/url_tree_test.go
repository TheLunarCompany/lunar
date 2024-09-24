package urltree_test

import (
	"lunar/toolkit-core/urltree"
)

type TestStruct struct {
	Data int
}

func constantURLTree[T any](testValue *T) urltree.URLTree[T] {
	return urltree.URLTree[T]{
		Root: &urltree.Node[T]{
			ConstantChildren: map[string]*urltree.Node[T]{
				"twitter": {
					IsPartOfHost: true,
					ConstantChildren: map[string]*urltree.Node[T]{
						"com": {
							IsPartOfHost: true,
							ConstantChildren: map[string]*urltree.Node[T]{
								"user": {
									ConstantChildren: map[string]*urltree.Node[T]{
										"1234": {Value: testValue},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func wildcardURLTree[T any](testValue *T) urltree.URLTree[T] {
	return urltree.URLTree[T]{
		Root: &urltree.Node[T]{
			ConstantChildren: map[string]*urltree.Node[T]{
				"twitter": {
					IsPartOfHost: true,
					ConstantChildren: map[string]*urltree.Node[T]{
						"com": {
							IsPartOfHost: true,
							ConstantChildren: map[string]*urltree.Node[T]{
								"user": {
									WildcardChild: &urltree.Node[T]{
										Value: testValue,
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func mixedURLTree(
	constantTestValue *TestStruct,
	wildcardTestValue *TestStruct,
) urltree.URLTree[TestStruct] {
	return urltree.URLTree[TestStruct]{
		Root: &urltree.Node[TestStruct]{
			ConstantChildren: map[string]*urltree.Node[TestStruct]{
				"twitter": {
					IsPartOfHost: true,
					ConstantChildren: map[string]*urltree.Node[TestStruct]{
						"com": {
							IsPartOfHost: true,
							ConstantChildren: map[string]*urltree.Node[TestStruct]{
								"user": {
									ConstantChildren: map[string]*urltree.Node[TestStruct]{
										"1234": {
											ConstantChildren: map[string]*urltree.Node[TestStruct]{
												"messages": {
													Value: constantTestValue,
												},
											},
										},
									},
									WildcardChild: &urltree.Node[TestStruct]{
										Value: wildcardTestValue,
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func pathParamURLTree(wantValue *TestStruct) urltree.URLTree[TestStruct] {
	return urltree.URLTree[TestStruct]{
		Root: &urltree.Node[TestStruct]{
			ConstantChildren: map[string]*urltree.Node[TestStruct]{
				"twitter": {
					IsPartOfHost: true,
					ConstantChildren: map[string]*urltree.Node[TestStruct]{
						"com": {
							IsPartOfHost: true,
							ConstantChildren: map[string]*urltree.Node[TestStruct]{
								"user": {
									ParametricChild: urltree.ParametricChild[TestStruct]{
										Name: "userID",
										Child: &urltree.Node[TestStruct]{
											Value: wantValue,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func parametricPathInHostURLTree(wantValue *TestStruct) urltree.URLTree[TestStruct] {
	return urltree.URLTree[TestStruct]{
		Root: &urltree.Node[TestStruct]{
			ParametricChild: urltree.ParametricChild[TestStruct]{
				Name: "host",
				Child: &urltree.Node[TestStruct]{
					IsPartOfHost: true,
					ConstantChildren: map[string]*urltree.Node[TestStruct]{
						"com": {
							IsPartOfHost: true,
							ConstantChildren: map[string]*urltree.Node[TestStruct]{
								"user": {
									ConstantChildren: map[string]*urltree.Node[TestStruct]{
										"1234": {
											WildcardChild: &urltree.Node[TestStruct]{
												Value: wantValue,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func FlowsWithWildcardAtStartURLTree[T any](testValue *T, testValue2 *T) urltree.URLTree[T] {
	return urltree.URLTree[T]{
		Root: &urltree.Node[T]{
			WildcardChild: &urltree.Node[T]{
				Value: testValue,
			},
			ConstantChildren: map[string]*urltree.Node[T]{
				"twitter": {
					IsPartOfHost: true,
					ConstantChildren: map[string]*urltree.Node[T]{
						"com": {
							IsPartOfHost: true,
							ConstantChildren: map[string]*urltree.Node[T]{
								"user": {
									Value: testValue2,
								},
							},
						},
					},
				},
			},
		},
	}
}
