package logic

func HasCommonDenominator(numbers []int) bool {
	numbersCount := len(numbers)
	if numbersCount == 0 {
		return false
	}
	if numbersCount < 2 {
		return true
	}
	gcd := greatestCommonDivisor(numbers[0], numbers[1])
	for i := 2; i < numbersCount; i++ {
		gcd = greatestCommonDivisor(gcd, numbers[i])
		if gcd == 1 {
			return false
		}
	}

	return gcd > 1
}

func greatestCommonDivisor(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	return a
}
