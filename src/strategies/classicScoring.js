const ScoringStrategy = require('./scoringStrategy');

class ClassicScoring extends ScoringStrategy {
  calculatePoints(predictedHome, predictedAway, actualHome, actualAway) {
    if (predictedHome === actualHome && predictedAway === actualAway) {
      return 5; // Exact score
    }

    const predictedOutcome = Math.sign(predictedHome - predictedAway); // -1 (away win), 0 (draw), 1 (home win)
    const actualOutcome = Math.sign(actualHome - actualAway);

    if (predictedOutcome === actualOutcome) {
      return 2; // Correct 1X2 outcome
    }

    return 0; // No points
  }
}

module.exports = ClassicScoring;
