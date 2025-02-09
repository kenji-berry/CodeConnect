import React, { useEffect, useState } from 'react';

interface ActivityGraphProps {
  owner: string;
  repo: string;
  token: string;
}

interface CommitData {
  date: string;
  count: number;
}

const ActivityGraph = ({ owner, repo, token }: ActivityGraphProps) => {
  const [commitData, setCommitData] = useState<CommitData[]>([]);
  const [maxCount, setMaxCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommitActivity = async () => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();

        // Check if data is valid and is an array
        if (!Array.isArray(data)) {
          if (response.status === 202) {
            setError('GitHub is computing statistics. Please refresh in a moment.'); // Maybe adjust to just be loading in the future?
          } else {
            setError('Invalid data format received from GitHub');
          }
          return;
        }
        
        // Process last 12 weeks of data
        const last12Weeks = data.slice(-12).map((week: any) => ({
          date: new Date(week.week * 1000).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }),
          count: week.total
        }));
        
        const max = Math.max(...last12Weeks.map(week => week.count));
        setMaxCount(max || 1); // Use 1 as minimum to avoid division by zero
        setCommitData(last12Weeks);
        setError(null);
      } catch (error) {
        console.error('Error fetching commit activity:', error);
        setError('Failed to fetch commit activity data');
      }
    };

    if (owner && repo && token) {
      fetchCommitActivity();
    }
  }, [owner, repo, token]);

  const width = 800;
  const height = 300;
  const padding = 40;
  const graphWidth = width - (padding * 2);
  const graphHeight = height - (padding * 2);

  const getPath = () => {
    if (commitData.length === 0) return '';
    
    const points = commitData.map((data, i) => {
      const x = (i * (graphWidth / (commitData.length - 1))) + padding;
      const y = height - (padding + (data.count / maxCount * graphHeight));
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });

    return points.join(' ');
  };

  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center border border-gray-200 rounded-lg">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (commitData.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center border border-gray-200 rounded-lg">
        <p className="text-gray-500">Loading commit activity...</p>
      </div>
    );
  }

  return (
    <svg width="100%" height="300" viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[...Array(5)].map((_, i) => {
        const y = padding + (i * (graphHeight / 4));
        return (
          <line
            key={i}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke="#e0e0e0"
            strokeDasharray="4"
          />
        );
      })}

      {/* Y-axis labels */}
      {[...Array(5)].map((_, i) => {
        const y = padding + (i * (graphHeight / 4));
        const value = Math.round(maxCount - ((maxCount / 4) * i));
        return (
          <text
            key={i}
            x={padding - 10}
            y={y}
            textAnchor="end"
            alignmentBaseline="middle"
            fontSize="12"
          >
            {value}
          </text>
        );
      })}

      {/* X-axis labels */}
      {commitData.map((data, i) => {
        const x = (i * (graphWidth / (commitData.length - 1))) + padding;
        return (
          <text
            key={i}
            x={x}
            y={height - (padding / 2)}
            textAnchor="middle"
            fontSize="12"
          >
            {data.date}
          </text>
        );
      })}

      {/* Graph line */}
      <path
        d={getPath()}
        fill="none"
        stroke="#4CAF50"
        strokeWidth="2"
      />

      {/* Data points */}
      {commitData.map((data, i) => {
        const x = (i * (graphWidth / (commitData.length - 1))) + padding;
        const y = height - (padding + (data.count / maxCount * graphHeight));
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill="#4CAF50"
          />
        );
      })}

      {/* Axes */}
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#333"
        strokeWidth="1"
      />
      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={height - padding}
        stroke="#333"
        strokeWidth="1"
      />
    </svg>
  );
};

export default ActivityGraph;