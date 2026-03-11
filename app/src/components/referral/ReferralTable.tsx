import React from "react";

interface Referral {
  id: string;
  status: string;
  reward_type?: string;
}

interface Props {
  referrals: Referral[];
}

const statusColors: Record<string, string> = {
  pending: "gray",
  signed_up: "yellow",
  qualified: "blue",
  rewarded: "green",
  rejected: "red",
};

const ReferralTable: React.FC<Props> = ({ referrals }) => {
  return (
    <div className="bg-white shadow rounded p-4">
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="py-2">Name / Email</th>
            <th className="py-2">Status</th>
            <th className="py-2">Reward</th>
          </tr>
        </thead>
        <tbody>
          {referrals.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2">{r.id}</td>
              <td className="py-2">
                <span
                  className={`px-2 py-1 rounded-full bg-${statusColors[r.status]}-100 text-${statusColors[r.status]}-800 text-xs`}
                >
                  {r.status}
                </span>
              </td>
              <td className="py-2">{r.reward_type || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReferralTable;
