import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import userRouter from './routes/userRouter.js'
import { getLeaderboardPage } from './helpers/leaderboard.js';


dotenv.config()
import prisma from './exports/prisma.js'
import fs from 'fs'
import axios from 'axios'
import { loadTestCases } from './helpers/loadTestCases.js'
import { checkPlayer } from './helpers/redisPlayersManagement.js'
import { addToMatchmakingQueue, getMatchForPlayer, matchmakerWorker, getMatchDetails, updateMatchDetails } from './helpers/redisMatchMaking.js'
import { setSubmissionForUser, getSubmissionForUser } from './helpers/redisSubmissionManagement.js'
import { addNewMatch } from './helpers/db.js'
import { updateMatchResults } from './helpers/glicko.js'
import cookieParser from 'cookie-parser'
const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json())


app.use('/users', userRouter)
const port = 3000

app.get('/', (req, res) => {
  res.send('API is running')
})

app.get('/api/leaderboard', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const leaderboard = await getLeaderboardPage(page, limit);
    res.json({
      success: "true",
      data: leaderboard
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: "false",
      message: "Failed to load leaderboard"
    });
  }
});


app.post('/submit', async (req, res) => {
  const {problemId , solutionCode, username} = req.body;

  if(!problemId || !solutionCode)
    return res.json({
      success: "false",
      message: "Problem ID and solution code are required"
    })

  const problem = await prisma.problem.findFirst({
    where:{
      id: problemId
    }
  })
  
  if(!problem)
    return res.json({
      success: "false",
      message: "Problem does not exists"
    })
  
  let fullCode = fs.readFileSync(`${process.env.PATH_TO_PROBLEMS}/${problem.slug}/boilerplateFullCode.txt`, 'utf8').replace('##USER_CODE##', solutionCode);
  console.log('Full code:', fullCode);
  const testCases = loadTestCases(problem.slug);
  const submissions = testCases.map(tc => ({
    source_code: fullCode,
    language_id: 71, 
    stdin: tc.input,
    cpu_time_limit: 10,
    expected_output: tc.output,
    memory_limit: null,
    max_processes_and_or_threads: 10,
    callback_url: process.env.CALLBACK_URL,
  }));
  
  let response = null;
  try {
    response = await axios.post(
      `${process.env.JUDGE0_API_URL}/submissions/batch`,
      { submissions },
      {
        headers: {
          'X-Auth-Token': process.env.JUDGE0_API_KEY,
          'Content-Type': 'application/json'
        },
        params: {
          base64_encoded: false,
        }
      }
    );

    response.data.forEach(element => {
        console.log(element.token);
        setSubmissionForUser(element.token, {status: 'PENDING'});
    })

    res.json({
      success: "true",
      message: "Code submitted successfully",
      tokens: response.data.map(submission => submission.token)
    })

  } catch (error) {
    console.error('Error submitting code:', error.code);
  }

  
})

app.put('/judge0/callback', async (req, res) => {
  try {
    const body = req.body;

    console.log('Judge0 callback received:', body);

    const submissionId = body.token
    const status = body.status.description;

    await setSubmissionForUser(submissionId, {status: status});

    if (!submissionId || !status) {
      return res.status(400).json({ error: 'Missing token/submission_id or status' });
    }

    // You can now update the submission status in your DB
    // Example:
    // await prisma.submission.update({ where: { id: submissionId }, data: { status } });

    res.status(200).json({ message: 'Callback received successfully' });
  } catch (error) {
    console.error('Error handling Judge0 callback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/find-match', async (req, res) => {
  const {userId, username} = req.body;

  if(!userId || !username)
    return res.json({
      success: "false",
      message: "Unauthorized"
    })
  const player = await checkPlayer(username);
  console.log('Player:', player);
  console.log('Player rating:', player.getRating());
  const response = await addToMatchmakingQueue(player.id, player.getRating());
  if(response) {
    return res.json({
      success: "true",
    });
  } else {
    return res.json({
      success: "false",
    });
  }
})

app.get('/status-fm' , async (req, res) => {
  const {userId, username} = req.body;

  if(!userId || !username)
    return res.json({
      success: "false",
      message: "Unauthorized"
    })
  
  const matchFound = await getMatchForPlayer(username);
  if(matchFound) {
    return res.json({
      success: "true",
      matchDetails: matchFound
    });
  } else {
    return res.json({
      success: "false",
      message: "No match found"
    });
  }
})

app.get('/status-submission', async (req, res) => {
  const {tokens} = req.body;

  if(tokens.length === 0)
    return res.json({
      success: "false",
      message: "Submission ID is required"
    })

  for(const token of tokens) {
    const submission = await getSubmissionForUser(token);
    if(!submission) {
      return res.json({
        success: "false",
        message: "Invalid submission ID"
      });
    }

    if(submission.status !== 'Accepted'){
      res.json({
        success: "false",
        message: submission.status
      });
      return;
    }
  }
  
  const matchDetails = await getMatchDetails(req.body.matchId);

  if(matchDetails.status === 'pending') { // if true, he is the first person to finish (hence winner)
    
    try {

      const lostPlayerUsername = matchDetails.players[0] === req.body.username ? matchDetails.players[1] : matchDetails.players[0];
      await addNewMatch(req.body.username, lostPlayerUsername, req.body.matchId, matchDetails.problem.id, matchDetails.playedAt);
      
      // get winner and opponent players details before this match
      const winner = await checkPlayer(req.body.username);
      const opponent = await checkPlayer(lostPlayerUsername);
      // update match results [ranks and players] & get back the rating Difference
      const ratingDifference = await updateMatchResults(winner, opponent, 1);

      // update matchData for opponent
      await updateMatchDetails(req.body.matchId, ratingDifference)

      // send back response
      res.json({
        success: "true",
        result: "You won the match",
        ratingDifference: ratingDifference.winner
      });
    } catch (error) {
      console.error('Error adding new match:', error);
    }
  }
  else{
    console.log(matchDetails),
    res.json({
      
      success: "true",
      message: "Better luck next time",
      ratingDifference: matchDetails.loser
    });
  }
})


app.listen(port, async () => {
  console.log(`Server listening on port: ${port}`)
  await matchmakerWorker();
})

