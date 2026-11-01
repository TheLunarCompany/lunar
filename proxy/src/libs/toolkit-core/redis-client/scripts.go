//go:build pro

package lunarredisclient

// Lua script to atomically pop the lowest scoring member from source and add to destination
// Returns nil if source is empty or move fails, otherwise returns {member, score}
const popMoveLowestZSetScript = `
local item = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
if not item or #item == 0 then
  return nil
end
local member = item[1]
local score = item[2]
local removed = redis.call('ZREM', KEYS[1], member)
if removed == 1 then
  redis.call('ZADD', KEYS[2], score, member)
  return {member, score}
else
  return nil
end
`

const moveMemberBetweenSortedSetsScript = `
-- 1. Get the score of the member in the source sorted set.
--    ZSCORE returns the score if the member exists, or nil otherwise.
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])

-- 2. Check if the member was found (score is not nil).
if score then
  -- 3. Member exists. Atomically remove it from the source set...
  local removed = redis.call('ZREM', KEYS[1], ARGV[1])
  -- Note: ZREM returns 1 if removed, 0 if not found. We already know it exists
  -- from the ZSCORE check, so 'removed' should theoretically always be 1 here,
  -- but we don't strictly need to check it again.

  -- 4. ...and add it to the destination set with the retrieved score.
  redis.call('ZADD', KEYS[2], score, ARGV[1])

  -- 5. Return 1 to indicate the member was successfully moved.
  return 1
else
  -- 6. Member was not found in the source set. Return 0.
  return 0
end
`

var (
	popMoveLowestZSetKey           = "popMoveLowestZSet"
	moveMemberBetweenSortedSetsKey = "moveMemberBetweenSortedSets"
	scripts                        = map[string]string{
		popMoveLowestZSetKey:           popMoveLowestZSetScript,
		moveMemberBetweenSortedSetsKey: moveMemberBetweenSortedSetsScript,
	}
)
