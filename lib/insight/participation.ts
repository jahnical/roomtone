export interface ParticipationSummary {
  joined: number;
  responded: number;
  responseRate: number; // 0..1
  silent: number; // joined but hasn't answered this question
}

/** "7 people are here but not answering" — the gap between who's in the room and who's actually responding. */
export function computeParticipation(joined: number, responded: number): ParticipationSummary {
  const silent = Math.max(0, joined - responded);
  const responseRate = joined > 0 ? responded / joined : 0;
  return { joined, responded, responseRate, silent };
}
