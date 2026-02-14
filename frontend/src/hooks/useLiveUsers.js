import { useState, useEffect } from 'react';

export const useLiveUsers = () => {
  const [liveUsers, setLiveUsers] = useState(1247);

  useEffect(() => {
    // Simulate users joining/leaving every 2-8 seconds
    const interval = setInterval(() => {
      setLiveUsers(prevCount => {
        // Random change between -3 and +5
        const change = Math.floor(Math.random() * 9) - 3;
        const newCount = Math.max(1200, prevCount + change); // Keep minimum at 1200
        return newCount;
      });
    }, 2000 + Math.random() * 6000); // 2-8 seconds

    return () => clearInterval(interval);
  }, []);

  return liveUsers;
};
