class ScoringStrategy {
  calculatePoints(predictedHome, predictedAway, actualHome, actualAway) {
    throw new Error('calculatePoints method must be implemented by subclasses');
  }
}

module.exports = ScoringStrategy;
