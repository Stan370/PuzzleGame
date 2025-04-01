import { Devvit } from '@devvit/public-api';

// Define types
export type Page = 'home' | 'tutorial' | 'game' | 'leaderboard';
export type LeaderboardEntry = {
  username: string;
  score: number;
  rank: number;
};
export type Leaderboard = LeaderboardEntry[];

// Sample test data for each level
const SAMPLE_DATA: { [key: number]: LeaderboardEntry[] } = {
  0: [
    { username: "Stan", score: 89, rank: 1 },
    { username: "bigD", score: 111, rank: 2 },
    { username: "rookie", score: 140, rank: 3 },
    { username: "Player3", score: 155, rank: 4 },
    { username: "BrightComplain1", score: 178, rank: 5 }
  ],
  1: [
    { username: "Champion123", score: 170, rank: 1 },
  ],
  2: [
    { username: "Legendqaq", score: 119, rank: 1 },
  ],
  4: [
    { username: "Lieutenant", score: 182, rank: 1 }
  ]
};

export interface LeaderboardPageProps {
  setPage: (page: Page) => void;
  openUserPage?: (username: string) => void | Promise<void>;
  leaderboard: Leaderboard;
  currentUserName?: string;
  gameActive?: boolean;
  currentLevel: number;
  onLevelChange: (level: number) => void;
}

// Simple icon button component
const IconButton = ({ icon, onPress }: { icon: string; onPress: () => void }) => {
  return (
    <button onPress={onPress}>
      {icon === 'close' ? '✕' : icon}
    </button>
  );
};

export const LeaderboardPage = (props: LeaderboardPageProps): JSX.Element => {
  const { 
    setPage, 
    leaderboard, 
    currentUserName, 
    gameActive = true, 
    openUserPage,
    currentLevel,
    onLevelChange 
  } = props;
  
  // Use sample data if the real leaderboard is empty
  const displayData = leaderboard.length > 0 
    ? leaderboard 
    : SAMPLE_DATA[currentLevel] || [];
  
  return (
    <vstack width="100%" height="100%" alignment="center" padding="medium" gap="medium">
      {/* Header */}
      <hstack width="100%" alignment="middle">
        <text color="white" weight="bold" size="xlarge" overflow="ellipsis" grow>
          Level {currentLevel + 1} Leaderboard
        </text>
        <spacer size="medium" />
        {gameActive ? <IconButton icon="close" onPress={() => setPage('home')} /> : null}
      </hstack>

      {/* Level Selector */}
      <hstack gap="small" width="100%" alignment="middle center">
        {[0, 1, 2, 3, 4].map((level) => (
          <button 
            key={`level-${level}`}
            onPress={() => onLevelChange(level)}
            appearance={level === currentLevel ? 'primary' : 'secondary'}
          >
            {`${level + 1}`}
          </button>
        ))}
      </hstack>

      {/* Leaderboard */}
      <vstack gap="small" width="100%">
        {displayData.length > 0 ? (
          displayData.map((user) => (
            <LeaderboardRow
              key={`user-${user.username}`}
              rank={user.rank}
              name={user.username}
              score={user.score}
              isCurrentUser={user.username === currentUserName}
              onPress={openUserPage ? () => openUserPage(user.username) : undefined}
            />
          ))
        ) : (
          <text color="white" alignment="middle center">No scores recorded yet!</text>
        )}
      </vstack>
    </vstack>
  );
};

export type LeaderboardRowProps = {
  key?: string;
  rank: number;
  name: string;
  score: number;
  isCurrentUser?: boolean;
  onPress?: () => void | Promise<void>;
};

export const LeaderboardRow = (props: LeaderboardRowProps) => {
  const { rank, name, score, onPress, isCurrentUser } = props;
  const isDistinguished = rank <= 3;

  return (
    <hstack
      backgroundColor="rgba(255, 255, 255, 0.1)"
      cornerRadius="small"
      height="40px"
      width="100%"
      alignment="middle"
      onPress={onPress}
    >
      <spacer size="small" />
      <text color="rgba(255,255,255,0.7)" selectable={false}>{`${rank}.`}</text>
      <spacer size="xsmall" />
      <text weight="bold" color="white" grow overflow="ellipsis" selectable={false}>
        {`${name}${isCurrentUser ? ' (you)' : ''}`}
      </text>
      <spacer size="small" />
      <text color="white" selectable={false}>
        {score} moves
      </text>
      <spacer size="small" />
      {isDistinguished && (
        <>
          <text weight="bold" color="gold">
            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
          </text>
          <spacer size="small" />
        </>
      )}
    </hstack>
  );
};

