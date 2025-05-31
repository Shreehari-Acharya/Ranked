import redis from "../exports/redis.js";

// Name of the sorted set in Redis
// currently using 'leaderboard' as the key/name
const LEADERBOARD_KEY = 'leaderboard';


// function to update the leaderboard with new score
// or add a new user if they don't exist with provided score
export async function updateLeaderboard(userId, rating) {
    try {
        await redis.zadd(LEADERBOARD_KEY, rating, userId);
    } catch (error) {
        console.error(`updating leaderboard failed for ${userId}`, error);
    }
}

// function to get the leaderboard
// returns the top n users with their scores
export async function getLeaderboard(limit) {
    try {
        const leaderboard = await redis.zrevrange(LEADERBOARD_KEY, 0, limit - 1, 'WITHSCORES');
        return leaderboard;
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
}

// function to get the rank of a user
// returns the rank of the user in the leaderboard
export async function getUserRank(userId) {
    try {
        const rank = await redis.zrank(LEADERBOARD_KEY, userId);
        return rank + 1; // Redis ranks are 0-based, so we add 1 to make it 1-based
    } catch (error) {
        console.error(`Error fetching rank for user ${userId}:`, error);
        return null;
    }
}

// function to get the rating of a user
// returns the rating of the user in the leaderboard
export async function getUserRating(userId) {
    try {
        const rating = await redis.zscore(LEADERBOARD_KEY, userId);
        return rating;
    } catch (error) {
        console.error(`Error fetching rating for user ${userId}:`, error);
        return null;
    }
}

export async function getLeaderboardPage(page = 1, limit = 10) {
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  try {
    const entries = await redis.zrevrange('leaderboard', start, end, 'WITHSCORES');
    const pagedLeaderboard = [];

    for (let i = 0; i < entries.length; i += 2) {
      pagedLeaderboard.push({
        userId: entries[i],
        rating: Number(entries[i + 1]),
      });
    }

    return pagedLeaderboard;
  } catch (error) {
    console.error('Error in paginated leaderboard:', error);
    return [];
  }
}
