const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();

async function runTest() {
  console.log("Starting full flow test...");

  // 1. Check/create a test league
  let league = await prisma.league.findFirst({
    where: { inviteCode: 'LEAGUE_TEST' }
  });
  if (!league) {
    console.log("Test league not found. Creating it...");
    league = await prisma.league.create({
      data: {
        id: 'test-league-id-' + Math.random().toString(36).substring(2, 7),
        name: 'World Cup 2026 Test League',
        inviteCode: 'LEAGUE_TEST',
        scoringStrategy: 'CLASSIC'
      }
    });
  }
  console.log(`Using League: ${league.name} (ID: ${league.id})`);

  // 2. Select a SCHEDULED match
  const match = await prisma.match.findFirst({
    where: { status: 'SCHEDULED' }
  });
  if (!match) {
    console.error("No SCHEDULED matches found in DB! Run sync first or update a match.");
    process.exit(1);
  }
  console.log(`Using Match: ${match.homeTeam} vs ${match.awayTeam} (ID: ${match.id}, Status: ${match.status})`);

  // 3. Register a new user
  const email = `testuser_${Math.random().toString(36).substring(2, 7)}@example.com`;
  const nickname = `TestNick_${Math.random().toString(36).substring(2, 7)}`;
  const password = "password123";

  console.log(`Registering user: ${email} (${nickname})`);
  const registerResponse = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, nickname, password })
  });

  if (!registerResponse.ok) {
    const errorText = await registerResponse.text();
    console.error(`Register failed: ${registerResponse.status} - ${errorText}`);
    process.exit(1);
  }

  const registerData = await registerResponse.json();
  const token = registerData.token;
  const userId = registerData.user.id;
  console.log(`User registered successfully. ID: ${userId}`);

  // 4. Join the user to the league (insert LeagueMember)
  console.log("Joining user to the league...");
  await prisma.leagueMember.create({
    data: {
      userId: userId,
      leagueId: league.id,
      totalPoints: 0
    }
  });

  // 5. Submit prediction
  console.log("Submitting prediction...");
  const predictionResponse = await fetch('http://localhost:3000/api/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      userId,
      matchId: match.id,
      leagueId: league.id,
      predictedHome: 2,
      predictedAway: 1
    })
  });

  if (!predictionResponse.ok) {
    const errorText = await predictionResponse.text();
    console.error(`Prediction failed: ${predictionResponse.status} - ${errorText}`);
    process.exit(1);
  }

  const predictionData = await predictionResponse.json();
  console.log(`Prediction submitted successfully. ID: ${predictionData.id}`);

  // 6. Simulate Webhook for match end
  console.log("Simulating webhook for match end (Result: 2-1)...");
  const webhookBody = {
    matchId: match.id,
    homeGoals: 2,
    awayGoals: 1
  };
  const secret = process.env.WEBHOOK_SECRET || '8f4b7a6d8c9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a';
  const payload = JSON.stringify(webhookBody);
  const hmac = crypto.createHmac('sha256', secret);
  const signature = hmac.update(payload).digest('hex');

  const webhookResponse = await fetch('http://localhost:3000/api/webhooks/nostradamus', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature
    },
    body: payload
  });

  if (!webhookResponse.ok) {
    const errorText = await webhookResponse.text();
    console.error(`Webhook failed: ${webhookResponse.status} - ${errorText}`);
    process.exit(1);
  }

  const webhookData = await webhookResponse.json();
  console.log(`Webhook processed:`, webhookData);

  // 7. Verify result in DB
  console.log("Verifying results in database...");
  const updatedPrediction = await prisma.prediction.findUnique({
    where: { id: predictionData.id }
  });
  const updatedMember = await prisma.leagueMember.findUnique({
    where: { userId_leagueId: { userId, leagueId: league.id } }
  });
  const updatedMatch = await prisma.match.findUnique({
    where: { id: match.id }
  });

  console.log("-----------------------------------------");
  console.log("TEST RESULTS:");
  console.log(`Match Status: ${updatedMatch.status} (Goals: ${updatedMatch.homeGoals}-${updatedMatch.awayGoals})`);
  console.log(`Prediction pointsEarned: ${updatedPrediction.pointsEarned} (Expected: 5)`);
  console.log(`LeagueMember totalPoints: ${updatedMember.totalPoints} (Expected: 5)`);
  console.log("-----------------------------------------");

  if (updatedPrediction.pointsEarned === 5 && updatedMember.totalPoints === 5 && updatedMatch.status === 'FINISHED') {
    console.log("🎉 SUCCESS: All assertions passed!");
  } else {
    console.error("❌ FAILURE: Results do not match expectations.");
  }

  // Cleanup (optional, but keep it so database doesn't bloat)
  await prisma.prediction.delete({ where: { id: predictionData.id } });
  await prisma.leagueMember.delete({ where: { userId_leagueId: { userId, leagueId: league.id } } });
  await prisma.user.delete({ where: { id: userId } });
  // Reset the match back to scheduled so it can be reused
  await prisma.match.update({
    where: { id: match.id },
    data: { status: 'SCHEDULED', homeGoals: null, awayGoals: null }
  });
  console.log("Cleaned up test data and reset match status.");
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
