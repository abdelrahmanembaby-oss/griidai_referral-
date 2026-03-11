import React from "react";

interface Stats {
  total_invited: number;
  signed_up: number;
  qualified: number;
  rewards_earned: number;
  next_reward_tier: string;
  progress_percent: number;
}

interface Props {
  stats: Stats;
}

const StatsPanel: React.FC<Props> = ({ stats }) => {
  return (
    <div className="bg-white shadow rounded p-4">
      <div className="grid grid-cols-4 gap-4">
        <div>
          <div className="text-sm text-gray-500">Invited</div>
          <div className="text-xl font-semibold">{stats.total_invited}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Signed Up</div>
          <div className="text-xl font-semibold">{stats.signed_up}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Qualified</div>
          <div className="text-xl font-semibold">{stats.qualified}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Rewards</div>
          <div className="text-xl font-semibold">{stats.rewards_earned}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-sm text-gray-600">Next tier: {stats.next_reward_tier}</div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
          <div
            className="bg-blue-500 h-2 rounded-full"
            style={{ width: `${stats.progress_percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
