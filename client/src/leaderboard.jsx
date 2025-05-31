import React, { useEffect, useState } from "react";

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`/api/leaderboard?page=${page}&limit=10`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success === "true") setLeaders(data.data);
        else setLeaders([]);
      });
  }, [page]);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <ul className="space-y-2">
        {leaders.map((user, index) => (
          <li key={user.userId} className="p-2 border rounded bg-white shadow">
            #{(page - 1) * 10 + index + 1} - {user.userId} ({user.rating})
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <button onClick={() => setPage((p) => Math.max(p - 1, 1))} className="px-4 py-2 bg-blue-500 text-white rounded">Prev</button>
        <button onClick={() => setPage((p) => p + 1)} className="px-4 py-2 bg-blue-500 text-white rounded">Next</button>
      </div>
    </div>
  );
}
