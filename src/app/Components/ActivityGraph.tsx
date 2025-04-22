import React, { useEffect, useState } from 'react';

interface ActivityGraphProps {
  owner: string;
  repo: string;
  weeks?: number;
}

interface CommitData {
  date: string;
  count: number;
  timestamp: number;
}

const ActivityGraph: React.FC<ActivityGraphProps> = ({ owner, repo, weeks = 8 }) => {
  const [commitData, setCommitData] = useState<CommitData[]>([]);
  const [maxCount, setMaxCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommitActivity = async () => {
      if (!owner || !repo) {
        setError("Repository information is missing");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/github/weekly-commits?owner=${owner}&repo=${repo}&weeks=${weeks}`);
        
        if (response.status === 202) {
          setError("GitHub is processing statistics. Please try again in a moment.");
          setIsLoading(false);
          return;
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch commit data');
        }
        
        const data = await response.json();
        
        // Check if data is valid
        if (!Array.isArray(data)) {
          setError('Invalid data received from GitHub');
          setIsLoading(false);
          return;
        }
        
        if (data.length === 0) {
          setError(`No commit activity found in the last ${weeks} weeks`);
          setIsLoading(false);
          return;
        }
        
        const max = Math.max(...data.map(week => week.count));
        setMaxCount(max || 1); // Use 1 as minimum to avoid division by zero
        setCommitData(data);
        setError(null);
      } catch (error: any) {
        console.error('Error fetching commit activity:', error);
        setError(error.message || 'Failed to fetch commit activity data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommitActivity();
  }, [owner, repo, weeks]);

  if (isLoading) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FF5D73] mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[200px] flex items-center justify-center text-gray-400 bg-[#232323] rounded-lg border border-gray-700">
        <div className="text-center p-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (commitData.length === 0) {
    return (
      <div className="w-full h-[200px] flex items-center justify-center text-gray-400 bg-[#232323] rounded-lg border border-gray-700">
        <p>No commit data available</p>
      </div>
    );
  }

  const width = 800;
  const height = 300;
  const padding = 50;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // We can show all week labels since there are only ~8-9 of them
  const getPath = () => {
    if (commitData.length === 0) return '';

    const points = commitData.map((data, i) => {
      const x = i * (graphWidth / (commitData.length - 1)) + padding;
      const y = height - (padding + (data.count / maxCount) * graphHeight);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });

    return points.join(' ');
  };

  // Add area under the line for better visual impact
  const getAreaPath = () => {
    if (commitData.length === 0) return '';

    let path = getPath();
    const lastPoint = commitData.length - 1;
    const lastX = lastPoint * (graphWidth / (commitData.length - 1)) + padding;
    
    path += ` L ${lastX} ${height - padding}`;
    path += ` L ${padding} ${height - padding}`;
    path += ' Z';
    
    return path;
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" height="300" viewBox={`0 0 ${width} ${height}`} className="max-w-full">
        {/* Background */}
        <rect x={padding} y={padding} width={graphWidth} height={graphHeight} fill="#232323" />
        
        {/* Grid lines */}
        {[...Array(5)].map((_, i) => {
          const y = padding + i * (graphHeight / 4);
          return (
            <line
              key={i}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#444"
              strokeDasharray="4"
            />
          );
        })}

        {/* Y-axis labels */}
        {[...Array(5)].map((_, i) => {
          const y = padding + i * (graphHeight / 4);
          const value = Math.round(maxCount - (maxCount / 4) * i);
          return (
            <text
              key={i}
              x={padding - 10}
              y={y}
              textAnchor="end"
              alignmentBaseline="middle"
              fontSize="12"
              fill="#ccc"
            >
              {value}
            </text>
          );
        })}

        {/* X-axis labels - since we have fewer data points, we can show all labels */}
        {commitData.map((data, i) => {
          const x = i * (graphWidth / (commitData.length - 1)) + padding;
          const angle = -25; // Angle the text to prevent overlap
          
          return (
            <text
              key={i}
              x={x}
              y={height - padding / 3}
              textAnchor="middle"
              fontSize="11"
              fill="#ccc"
              transform={`rotate(${angle}, ${x}, ${height - padding / 3})`}
            >
              {data.date}
            </text>
          );
        })}

        {/* Area under the line */}
        <path 
          d={getAreaPath()} 
          fill="#FF5D73" 
          fillOpacity="0.1" 
        />

        {/* Graph line */}
        <path 
          d={getPath()} 
          fill="none" 
          stroke="#FF5D73" 
          strokeWidth="2" 
        />

        {/* Data points and tooltips */}
        {commitData.map((data, i) => {
          const x = i * (graphWidth / (commitData.length - 1)) + padding;
          const y = height - (padding + (data.count / maxCount) * graphHeight);
          return (
            <g key={i}>
              <circle 
                cx={x} 
                cy={y} 
                r="5" 
                fill="#FF5D73" 
              />
              <circle
                cx={x}
                cy={y}
                r="10"
                fill="transparent"
                stroke="transparent"
                className="group"
              >
                <title>{`Week of ${data.date}: ${data.count} commits`}</title>
              </circle>
            </g>
          );
        })}

        {/* Axes */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#666"
          strokeWidth="1"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#666"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};

export default ActivityGraph;