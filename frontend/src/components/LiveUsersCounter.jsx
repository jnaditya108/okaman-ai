import { useLiveUsers } from '../hooks/useLiveUsers';
import { Users } from 'lucide-react';

export default function LiveUsersCounter() {
  const liveUsers = useLiveUsers();

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 w-fit">
      <div className="flex items-center gap-1">
        <Users className="w-4 h-4 text-green-400" />
        <span className="text-xs text-zinc-400">
          <span className="font-semibold text-white">{liveUsers.toLocaleString()}</span>
          {' '}active users
        </span>
      </div>
      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
    </div>
  );
}
