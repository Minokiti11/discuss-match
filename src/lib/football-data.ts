// Football-data.org API integration for Premier League matches
// Free tier: 10 requests/minute, 500 requests/day
// Docs: https://www.football-data.org/documentation/quickstart

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

export interface FootballMatch {
  id: number;
  competition: { name: string; code: string };
  homeTeam: { name: string; crest: string };
  awayTeam: { name: string; crest: string };
  utcDate: string;
  status: "SCHEDULED" | "LIVE" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED";
  score: {
    fullTime: { home: number | null; away: number | null };
  };
  minute?: number;
}

export async function fetchPremierLeagueMatches(
  dateFrom?: string,
  dateTo?: string
): Promise<FootballMatch[]> {
  if (!FOOTBALL_DATA_API_KEY) {
    throw new Error("FOOTBALL_DATA_API_KEY not configured");
  }

  const params = new URLSearchParams({
    competitions: "PL", // Premier League code
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const response = await fetch(`${BASE_URL}/matches?${params}`, {
    headers: {
      "X-Auth-Token": FOOTBALL_DATA_API_KEY,
    },
    // Cache for 5 minutes to reduce API calls
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Football-data.org API error: ${response.status} - ${error}`
    );
  }

  const data = await response.json();
  return data.matches || [];
}

export async function fetchMatchById(matchId: number): Promise<FootballMatch> {
  if (!FOOTBALL_DATA_API_KEY) {
    throw new Error("FOOTBALL_DATA_API_KEY not configured");
  }

  const response = await fetch(`${BASE_URL}/matches/${matchId}`, {
    headers: {
      "X-Auth-Token": FOOTBALL_DATA_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Football-data.org API error: ${response.status} - ${error}`
    );
  }

  return response.json();
}

// Helper to normalize match status for our database
export function normalizeMatchStatus(
  apiStatus: string
): "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" {
  if (["LIVE", "IN_PLAY", "PAUSED"].includes(apiStatus)) {
    return "LIVE";
  }
  if (apiStatus === "FINISHED") {
    return "FINISHED";
  }
  if (apiStatus === "POSTPONED") {
    return "POSTPONED";
  }
  return "SCHEDULED";
}
