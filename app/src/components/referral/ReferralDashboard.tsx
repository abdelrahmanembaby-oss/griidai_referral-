import React, { useEffect, useState } from "react";
import axios from "axios";
import LinkCard from "./LinkCard";
import StatsPanel from "./StatsPanel";
import ReferralTable from "./ReferralTable";

interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  status: string;
  reward_type?: string;
}

const ReferralDashboard: React.FC = () => {
  const [link, setLink] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [list, setList] = useState<Referral[]>([]);

  useEffect(() => {
    axios.get("/api/referral/link").then((r) => setLink(r.data.link));
    axios.get("/api/referral/stats").then((r) => setStats(r.data));
    axios.get("/api/referral/list").then((r) => setList(r.data));
  }, []);

  return (
    <div className="p-8 space-y-6">
      <LinkCard link={link} />
      {stats && <StatsPanel stats={stats} />}
      <ReferralTable referrals={list} />
    </div>
  );
};

export default ReferralDashboard;
