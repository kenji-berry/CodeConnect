import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/supabaseClient';

interface ActivityGraphProps {
  projectId: number;
  weeks?: number;
}

interface CommitData {
  date: string;
  count: number;
  timestamp: number;
}

interface ProjectCommit {
  timestamp: string;
  id?: number;
  project_id?: number;
  commit_id?: string;
  message?: string;
  author?: string;
  url?: string;
  branch?: string | null;
}

const ActivityGraph: React.FC<ActivityGraphProps> = ({ projectId, weeks = 8 }) => {
  const [commitData, setCommitData] = useState<CommitData[]>([]);
  const [maxCount, setMaxCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDateToWeekKey = (date: Date): string => {
    const dayOfWeek = date.getDay();
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - dayOfWeek);
    
    return weekStart.toISOString().split('T')[0];
  };
  
  const formatWeekLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric'
    }).format(date);
  };

  const processCommitsByWeek = useCallback((commits: ProjectCommit[], weeksToShow: number) => {
    const weeklyBuckets: { [key: string]: number } = {};
    const today = new Date();
    
    for (let i = 0; i < weeksToShow; i++) {
      const weekStart = new Date();
      weekStart.setDate(today.getDate() - ((weeksToShow - i - 1) * 7));
      
      const weekKey = formatDateToWeekKey(weekStart);
      weeklyBuckets[weekKey] = 0;
    }
    
    commits.forEach(commit => {
      const commitDate = new Date(commit.timestamp);
      const weekKey = formatDateToWeekKey(commitDate);
      
      if (weeklyBuckets[weekKey] !== undefined) {
        weeklyBuckets[weekKey]++;
      }
    });
    
    return Object.entries(weeklyBuckets).map(([date, count]) => ({
      date: formatWeekLabel(date),
      count,
      timestamp: new Date(date).getTime()
    }));
  }, []);

  useEffect(() => {
    const fetchCommitActivity = async () => {
      if (!projectId) {
        setError("Project ID is missing");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (weeks * 7));
        
        const { data: commits, error: commitError } = await supabase
          .from('project_commits')
          .select('timestamp')
          .eq('project_id', projectId)
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .order('timestamp', { ascending: true });
        
        if (commitError) {
          throw new Error(commitError.message);
        }
        
        if (!commits || commits.length === 0) {
          setError(`No commit activity found in the last ${weeks} weeks`);
          setIsLoading(false);
          return;
        }
        
        const weeklyData = processCommitsByWeek(commits, weeks);
        
        const max = Math.max(...weeklyData.map(week => week.count));
        setMaxCount(max || 1);
        setCommitData(weeklyData);
        setError(null);
      } catch (error: unknown) {
        console.error('Error fetching commit activity:', error);
        
        let errorMessage = 'Failed to fetch commit activity data';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommitActivity();
  }, [projectId, weeks, processCommitsByWeek]);

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

  const getPath = () => {
    if (commitData.length === 0) return '';

    const points = commitData.map((data, i) => {
      const x = i * (graphWidth / (commitData.length - 1)) + padding;
      const y = height - (padding + (data.count / maxCount) * graphHeight);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });

    return points.join(' ');
  };

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
        <rect x={padding} y={padding} width={graphWidth} height={graphHeight} fill="#232323" />
        
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

        {commitData.map((data, i) => {
          const x = i * (graphWidth / (commitData.length - 1)) + padding;
          const angle = -25;
          
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

        <path 
          d={getAreaPath()} 
          fill="#FF5D73" 
          fillOpacity="0.1" 
        />

        <path 
          d={getPath()} 
          fill="none" 
          stroke="#FF5D73" 
          strokeWidth="2" 
        />

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