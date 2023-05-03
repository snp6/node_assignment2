const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
const dbPath = path.join(__dirname, "twitterClone.db");
app.use(express.json());

let db = null;

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  };
};

//API 1 REGISTER

app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const addQuery = `
    INSERT INTO
      user (name,username,password,gender)
    VALUES
      (
        '${name}',
        '${username}',
         '${hashedPassword}',
         '${gender}'
          
      );`;

    const dbResponse = await db.run(addQuery);
    const user_id = dbResponse.lastID;
    response.status = 200;
    response.send("User created successfully");
  } else if (`${password}`.length < 6) {
    response.status = 400;
    response.send("Password is too short");
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//API 2 LOGIN

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3 GET

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getTweetQuery = `
  SELECT 
  user.username as username,
  tweet.tweet as tweet,
  tweet.date_time as dateTime
  FROM 
  ((user
  JOIN 
  follower 
  ON
  user.user_id=follower.follower_user_id)
  JOIN
  tweet 
  ON
  user.user_id=tweet.user_id )
  where user.user_id!=follower.following_user_id
  GROUP BY
  user.user_id 
  ORDER BY
  date_time desc
  LIMIT 4 OFFSET 0;`;
  const tweet = await db.all(getTweetQuery);
  response.send(convertDbObjectToResponseObject(tweet));
});

///API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getQuery = `
  SELECT 
  username as name
  FROM 
  user
  join 
  follower 
  where 
  user_id=follower.following_user_id and username not like '%${request.username}%'
  group by user_id;`;

  const follow = await db.all(getQuery);
  response.send(follow);
});

// API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getQuery = `
  SELECT 
  username as name
  FROM 
  user
  join 
  follower
  where 
  following_user_id=user_id and username not like '%${request.username}%'
  group by user_id
  ;`;

  const follower = await db.all(getQuery);
  response.send(follower);
});

//API 6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const tweetsQuery = `
SELECT
*
FROM tweet
WHERE tweet_id=${tweetId}
`;
  const tweetResult = await database.get(tweetsQuery);
  const userFollowersQuery = `
SELECT
*
FROM follower INNER JOIN user on user.user_id = follower.following_user_id
WHERE follower.follower_user_id = ${request.user_id};`;
  const userFollowers = await database.all(userFollowersQuery);
  if (
    userFollowers.some((item) => item.following_user_id === tweetResult.user_id)
  ) {
    response.status = 200;
    response.send(tweetResult);
  } else {
    response.status = 401;
    response.send("User already exists");
  }
});

//API 7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const tweetsQuery = `
SELECT
user.username as likes
FROM tweet inner join user on user.user_id=tweet.user_id
WHERE tweet_id=${tweetId}
`;
    const tweetResult = await database.get(tweetsQuery);
    const userFollowersQuery = `
SELECT
*
FROM follower INNER JOIN user on user.user_id = follower.following_user_id
WHERE follower.follower_user_id = ${tweetResult.user_id};`;
    const userFollowers = await database.all(userFollowersQuery);
    if (
      userFollowers.some(
        (item) => item.following_user_id === tweetResult.user_id
      )
    ) {
      response.status = 200;
      response.send(tweetResult);
    } else {
      response.status = 401;
      response.send("User already exists");
    }
  }
);

//API 8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const tweetsQuery = `
SELECT
user.username as name,
reply.reply as reply
FROM (tweet inner join user on user.user_id=tweet.user_id)as t1 
inner join reply on reply.user_id=t1.user_id
WHERE tweet_id=${tweetId}
`;
    const tweetResult = await database.get(tweetsQuery);
    const userFollowersQuery = `
SELECT
*
FROM follower INNER JOIN user on user.user_id = follower.following_user_id
WHERE follower.follower_user_id = ${user_id};`;
    const userFollowers = await database.all(userFollowersQuery);
    if (
      userFollowers.some(
        (item) => item.following_user_id === tweetResult.user_id
      )
    ) {
      response.status = 200;
      response.send(tweetResult);
    } else {
      response.status = 401;
      response.send("Invalid Request");
    }
  }
);

//API 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const getStateQuery = `select * from tweet;`;
  const state = await db.get(getStateQuery);
  const userFollowersQuery = `
SELECT
*
FROM follower INNER JOIN user on user.user_id = follower.following_user_id
WHERE follower.follower_user_id = ${user_id};`;
  const userFollowers = await database.all(userFollowersQuery);
  if (userFollowers.some((item) => item.following_user_id === state.user_id)) {
    response.status = 200;
    response.send(tweetResult);
  } else {
    response.status = 401;
    response.send("Invalid Request");
  }
});

//API 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const Details = request.body;
  const { tweet, userId, dateTime } = Details;
  const addQuery = `
    INSERT INTO
      tweet (tweet,user_id,date_time)
    VALUES
      (
        '${tweet}',
         ${userId},
         '${dateTime}'
          
      );`;

  const dbResponse = await db.run(addQuery);
  const tweet_id = dbResponse.lastID;
  response.send("Created a Tweet");
});

//API 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteQuery = `
    DELETE FROM
      tweet
    WHERE
      tweet_id = ${tweetId};`;
    await db.run(deleteQuery);
    response.send("Tweet Removed");
  }
);

module.exports = app;
