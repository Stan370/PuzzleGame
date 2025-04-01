import { Devvit, useState, useWebView, useAsync } from "@devvit/public-api";
import { LeaderboardPage, Leaderboard, Page as PageType } from "../webroot/LeaderboardPage.js";

// Defines the messages that are exchanged between Devvit and Web View
type WebViewMessage =
  | {
      type: "initialData";
      data: { username: string; bestScore: number; level: number };
    }
  | {
      type: "updateScore";
      data: { username: string; level: number; score: number };
    }
    | {
      type: "getBestScore";
      data: { username: string; level: number };
    }
  | {
      type: "changeLevel";
      data: { username: string; level: number };
    }
  | {
      type: "bestScoreResponse";
      data: { score: number | null };
    }
  | {
      type: "webViewReady";
    }
  | {
      type: "getLeaderboard";
      data: { level: number };
    }
  | {
      type: "leaderboardResponse";
      data: { entries: Array<{ username: string; score: number; rank: number }> };
    }
  | {
      type: "openLeaderboard";
    }
  | {
      type: "testRedis";
    }
  | {
      type: "testRedisResponse";
      data: { success: boolean; message: string };
    };

Devvit.configure({
  redditAPI: true,
  redis: true,
});

type PageProps = {
  setPage: (page: PageType) => void;
  context?: any;
  username?: string;
  leaderboardData?: Leaderboard;
  currentLevel?: number;
  setCurrentLevel?: (level: number) => void;
};

const PageHome = ({ setPage, context, username }: PageProps) => {
  return (
    <vstack grow padding="small" alignment="middle center">
      <vstack grow height="100%" alignment="middle center">
        <text size="xxlarge" weight="bold" color="white">
          Huarong Dao
        </text>
        <spacer />
        <vstack alignment="start middle">
          <hstack>
            <text size="xlarge" color="white">
              Username:
            </text>
            <text size="xlarge" weight="bold" color="white">
              {" "}
              {username ?? ""}
            </text>
          </hstack>
        </vstack>
        <spacer />
        <button onPress={() => setPage("tutorial")} size="medium">
          How to Play
        </button>
        <spacer size="medium" />
        <button onPress={() => setPage("game")}>Launch App</button>
        <spacer size="medium" />
        <button onPress={() => setPage("leaderboard")}>Leaderboard</button>
      </vstack>
    </vstack>
  );
};
const PageTutorial = ({ setPage, context, username }: PageProps) => {
  return (
    <vstack
      backgroundColor="rgba(200, 226, 198, 0.92)"
      padding="small"
      cornerRadius="medium"
      gap="small"
      height="85%"
      width="100%"
      maxWidth="350px"
    >
      <text
        color="LightBlue-950"
        size="xxlarge"
        weight="bold"
        alignment="center middle"
      >
        Tutorial
      </text>
      <text wrap>
        📜 Welcome to Huarongdao, Your goal is simple: Move Cao Cao (the big red
        block) to the exit at the bottom center of the board.{"\n"}✨ Tips for
        First-Time Players: Blocks come in different sizes, plan your moves
        wisely.{"\n"}
        Free up space by moving small blocks first.{"\n"}
        Sometimes you need to take a few steps back to move forward.{"\n"}
        Don't worry if you get stuck! You can always reset the level and try
        again.{"\n"}
        💡 Pro Tip Great players find clever ways to solve puzzles in the
        minimum number of moves.{"\n"}
        Advanced levels require patience and strategy — think like a general,
        like Cao Cao himself!
      </text>
      <button onPress={() => setPage("game")}>Play</button>
      <button onPress={() => setPage("home")}>Back to Home</button>
    </vstack>
  );
};

const PageGame = ({ setPage, context, username }: PageProps) => {
  const [mounted, setMounted] = useState<boolean>(false);

  // We'll set the page to game automatically trigger the mount
  const { mount } = useWebView<WebViewMessage, any>({
    url: "index.html",
    //message handler 
    onMessage: async (message, webView) => {
      if (message.type === "webViewReady") {
        // Send initial state to the web view
        webView.postMessage({
          type: "initialData",
          data: {
            username: username ?? "anonymous",
            bestScore: 0,
            level: 0,
          },
        });
      }

      if (message.type === "testRedis") {
        await testRedisConnection(context.redis, webView);
      }

      if (message.type === "updateScore") {
        const { username, level, score } = message.data;
        
        console.log(`[DEBUG] Received updateScore: username=${username}, level=${level}, score=${score}`);
        
        try {
          // Use sorted set for leaderboard with scores (lower is better)
          const leaderboardKey = `leaderboard:level${level}`;
          console.log(`[DEBUG] Adding score to leaderboard: ${leaderboardKey}`);
          
          // Add user score to sorted set (score = number of moves, lower is better)
          await context.redis.zadd(leaderboardKey, score, username);
          console.log(`[DEBUG] Successfully added to leaderboard: ${username}:${score}`);
          
          // Also update user's personal best if needed
          const userKey = `bestscore:${username}:level${level}`;
          const currentBest = await context.redis.get(userKey);
          console.log(`[DEBUG] Current best score for user: ${currentBest}`);
          
          if (!currentBest || score < parseInt(currentBest)) {
            await context.redis.set(userKey, score.toString());
            console.log(`[DEBUG] Updated personal best: ${score}`);
          }
          
          // Update leaderboard display
          console.log(`[DEBUG] Fetching updated leaderboard`);
          await fetchLeaderboard(context.redis, level, webView);
          
          // Send acknowledgment back to webview
          webView.postMessage({
            type: "updateScoreAck",
            data: { success: true }
          });
        } catch (error) {
          console.error(`[ERROR] Failed to update score: ${error}`);
          // Send error response back to webview
          webView.postMessage({
            type: "updateScoreAck",
            data: { success: false, error: String(error) }
          });
        }
      }

      if (message.type === "getBestScore") {
        const { username, level } = message.data;
        const key = `bestscore:${username}:level${level}`;
        const score = await context.redis.get(key);

        webView.postMessage({
          type: "bestScoreResponse",
          data: { score: score ? parseInt(score) : null },
        });
      }

      if (message.type === "getLeaderboard") {
        try {
          const { level } = message.data;
          console.log(`[DEBUG] Received getLeaderboard request for level ${level}`);
          
          if (!context.redis) {
            console.error("[ERROR] Redis context is unavailable");
            webView.postMessage({
              type: "leaderboardResponse",
              data: { entries: [], error: "Redis unavailable" }
            });
            return;
          }
          
          await fetchLeaderboard(context.redis, level, webView);
        } catch (error) {
          console.error(`[ERROR] Failed to get leaderboard: ${error}`);
          webView.postMessage({
            type: "leaderboardResponse",
            data: { entries: [], error: String(error) }
          });
        }
      }
      
      if (message.type === "openLeaderboard") {
        // User wants to see the full leaderboard
        setPage("leaderboard");
      }
    },
    onUnmount: () => {
      context.ui.showToast({ text: "Game closed!" });
      setPage("home");
    },
  });

  // Only mount once when component is first rendered
  if (!mounted) {
    setMounted(true);
    mount();
  }

  return (
    <vstack grow height="100%" width={"100%"} alignment="middle center">
      <vstack border="thick" borderColor="black" height="100%">
        <image url="loading.gif" imageWidth={400} imageHeight={400} />
      </vstack>
    </vstack>
  );
};

const PageLeaderboard = ({ setPage, context, username, currentLevel = 0, setCurrentLevel }: PageProps) => {
  const [leaderboard, setLeaderboard] = useState<Leaderboard>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(currentLevel);
  
  // Load initial leaderboard data - this will run once when component mounts
  if (leaderboard.length === 0) {
    loadLeaderboardData(selectedLevel);
  }
  
  // Function to load leaderboard data
  async function loadLeaderboardData(level: number) {
    try {
      if (!context?.redis) {
        console.error("Redis context is not available");
        setLeaderboard([]);
        return;
      }
      const leaderboardKey = `leaderboard:level${level}`;
      
      // Get top 10 scores from sorted set
      const leaderboardEntries = await context.redis.zRange(
        leaderboardKey,0,9,"WITHSCORES"
      );
      
      // Format the data for display
    const entries = [];
      for (let i = 0; i < leaderboardEntries.length; i += 2) {
        const username = leaderboardEntries[i];
        const scoreStr = leaderboardEntries[i + 1];
        const score = parseInt(scoreStr);
        
        // Only add entry if we have valid data
        if (username && !isNaN(score)) {
          entries.push({ 
            username, 
            score, 
            rank: Math.floor(i/2) + 1 
          });
        }
      }
      
      console.log(`[DEBUG] Loaded leaderboard entries for level ${level}:`, entries);
      setLeaderboard(entries);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
      setLeaderboard([]);
    }
  }
  
  const handleLevelChange = async (level: number) => {
    setSelectedLevel(level);
    if (setCurrentLevel) {
      setCurrentLevel(level);
    }
    await loadLeaderboardData(level);
  };
  
  return (
    <vstack>
      <LeaderboardPage
        setPage={setPage}
        leaderboard={leaderboard}
        currentUserName={username}
        gameActive={true}
        currentLevel={selectedLevel}
        onLevelChange={handleLevelChange}
      />
    </vstack>
  );
};

async function fetchLeaderboard(redis: any, level: number, webView: any) {
  try {
    console.log(`[DEBUG] Fetching leaderboard for level ${level}`);
    const leaderboardKey = `leaderboard:level${level}`;
    
    // Get top 10 scores from sorted set (with scores)
    // ZRANGE returns entries sorted from low to high score (which is what we want - fewer moves is better)
    console.log(`[DEBUG] Running ZRANGE on ${leaderboardKey}`);
    const leaderboardEntries = await redis.zRange(
      leaderboardKey,
      0,
      9,
      "WITHSCORES"
    );
    
    if (!leaderboardEntries || leaderboardEntries.length === 0) {
      console.log(`[DEBUG] No leaderboard entries found for level ${level}`);
      webView.postMessage({
        type: "leaderboardResponse",
        data: { entries: [] }
      });
      return;
    }
    
    console.log(`[DEBUG] Raw leaderboard entries: ${JSON.stringify(leaderboardEntries)}`);
    
    // Format the data for display
    const entries = [];
    for (let i = 0; i < leaderboardEntries.length; i += 2) {
      const username = leaderboardEntries[i];
      const score = parseInt(leaderboardEntries[i + 1]);
      entries.push({ username, score, rank: i/2 + 1 });
    }
    
    console.log(`[DEBUG] Formatted leaderboard entries: ${JSON.stringify(entries)}`);
    
    // Send leaderboard data to web view
    webView.postMessage({
      type: "leaderboardResponse",
      data: { entries }
    });
    console.log(`[DEBUG] Sent leaderboard data to web view`);
  } catch (error) {
    console.error(`[ERROR] Error fetching leaderboard: ${error}`);
    webView.postMessage({
      type: "leaderboardResponse",
      data: { entries: [], error: String(error) }
    });
  }
}

// Function to test Redis connectivity
async function testRedisConnection(redis: any, webView: any) {
  try {
    console.log("[DEBUG] Testing Redis connection");
    
    // Try a simple Redis operation
    const testKey = "test:connection";
    const testValue = "connected-" + Date.now();
    
    // Set a value
    await redis.set(testKey, testValue);
    console.log(`[DEBUG] Successfully set test value: ${testValue}`);
    
    // Get the value back
    const retrievedValue = await redis.get(testKey);
    console.log(`[DEBUG] Retrieved test value: ${retrievedValue}`);
    
    // Check if values match
    const success = retrievedValue === testValue;
    
    // Send result back to webview
    webView.postMessage({
      type: "testRedisResponse",
      data: { 
        success, 
        message: success 
          ? "Redis connection successful" 
          : `Redis test failed: expected ${testValue}, got ${retrievedValue}`
      }
    });
  } catch (error) {
    console.error(`[ERROR] Redis test failed: ${error}`);
    webView.postMessage({
      type: "testRedisResponse",
      data: { success: false, message: `Redis test error: ${error}` }
    });
  }
}

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: "Webview Example",
  height: "tall",
  render: (context) => {
    // Initialize hooks at the top level
    const [username] = useState(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return currUser?.username ?? "Secret guest";
    });
    const [page, setPage] = useState<PageType>("home");
    const [currentLevel, setCurrentLevel] = useState<number>(0);

    let currentPage;
    switch (page) {
      case "tutorial":
        currentPage = <PageTutorial setPage={setPage} />;
        break;
      case "game":
        currentPage = (
          <PageGame 
            setPage={setPage} 
            context={context} 
            username={username} 
          />
        );
        break;
      case "leaderboard":
        currentPage = (
          <PageLeaderboard 
            setPage={setPage} 
            context={context} 
            username={username}
            currentLevel={currentLevel}
            setCurrentLevel={setCurrentLevel}
          />
        );
        break;
      default:
        currentPage = (
          <PageHome setPage={setPage} context={context} username={username} />
        );
    }

    // Show loading state while initializing

    // Render the custom post type
    return (
      <zstack width="100%" height="100%" alignment="middle center">
        <image
          url="CaocaoFailed.webp"
          imageWidth={400}
          imageHeight={400}
          resizeMode="cover"
          width="100%"
          height="100%"
        />
        {currentPage}
      </zstack>
    );
  },
});

Devvit.addMenuItem({
  label: "Create New Devvit Post (with Klotski)",
  location: "subreddit",
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: "Webview Example",
      subredditName: subreddit.name,
      // The preview appears while the post loads
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <image url="loading.gif" imageWidth={400} imageHeight={400} />

          <text size="large">Loading ...</text>
        </vstack>
      ),
    });
    ui.showToast({ text: "Created post!" });
    ui.navigateTo(post);
  },
});

// Function to initialize sample data in Redis
async function initializeSampleData(redis: any) {
  try {
    console.log("[DEBUG] Initializing sample leaderboard data...");
    
    // Sample data for each level
    const sampleData = {
      0: [
        { username: "Stan", score: 89 },
        { username: "bigD", score: 111 },
        { username: "rookie", score: 140 },
        { username: "Player3", score: 155 },
        { username: "BrightComplain1", score: 178 }
      ],
      1: [
        { username: "Champion123", score: 170 }
      ],
      2: [
        { username: "Legendqaq", score: 119 }
      ],
      4: [
        { username: "Lieutenant", score: 182 }
      ]
    };

    // Add sample data for each level
    for (const [level, entries] of Object.entries(sampleData)) {
      const leaderboardKey = `leaderboard:level${level}`;
      console.log(`[DEBUG] Adding sample data for level ${level}`);
      // Add each entry to the sorted set
      for (const entry of entries) {
        await redis.zAdd(leaderboardKey, entry.score, entry.username);
        console.log(`[DEBUG] Added ${entry.username} with score ${entry.score} to level ${level}`);
      }
    }
    
    console.log("[DEBUG] Sample data initialization complete");
  } catch (error) {
    console.error("[ERROR] Failed to initialize sample data:", error);
  }
}

export default Devvit;