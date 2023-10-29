package urltree_test

import (
	"lunar/toolkit-core/urltree"
)

type TestStruct struct {
	Data int
}

func constantURLTree(testValue *TestStruct) urltree.URLTree[TestStruct] {
	return urltree.URLTree[TestStruct]{
		Root: &urltree.Node[TestStruct]{
			ConstantChildren: map[string]*urltree.Node[TestStruct]{
				"twitter.com": {
					ConstantChildren: map[string]*urltree.Node[TestStruct]{
						"user": {
							ConstantChildren: map[string]*urltree.Node[TestStruct]{
								"1234": {Value: testValue},
							},
						},
					},
				},
			},
		},
	}
}

func wildcardURLTree(testValue *TestStruct) urltree.URLTree[TestStruct] {
	return urltree.URLTree[TestStruct]{
		Root: &urltree.Node[TestStruct]{
			ConstantChildren: map[string]*urltree.Node[TestStruct]{
				"twitter.com": {
					ConstantChildren: map[string]*urltree.Node[TestStruct]{
						"user": {
							WildcardChild: &urltree.Node[TestStruct]{
								Value: testValue,
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
				"twitter.com": {
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
	}
}

func pathParamURLTree(wantValue *TestStruct) urltree.URLTree[TestStruct] {
	return urltree.URLTree[TestStruct]{
		Root: &urltree.Node[TestStruct]{
			ConstantChildren: map[string]*urltree.Node[TestStruct]{
				"twitter.com": {
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
	}
}
