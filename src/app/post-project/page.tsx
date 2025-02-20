"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FaExternalLinkAlt } from "react-icons/fa";
import Link from 'next/link';

const Page = () => {
  const { session, loading: authLoading, error: authError, refreshToken } = useAuth();
  const [repositories, setRepositories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [languages, setLanguages] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "numeric", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const fetchRepositories = async () => {
    try {
      if (!session?.provider_token) {
        throw new Error('No GitHub access token found');
      }

      const repoResponse = await fetch("https://api.github.com/user/repos", {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${session.provider_token}`,
        },
      });

      if (!repoResponse.ok) {
        if (repoResponse.status === 401) {
          // Token might be expired, try to refresh
          const newSession = await refreshToken();
          if (!newSession?.provider_token) {
            throw new Error('Failed to refresh GitHub token');
          }
          // Retry the fetch with new token
          return fetchRepositories();
        }
        throw new Error(`GitHub API error: ${repoResponse.status}`);
      }

      const repos = await repoResponse.json();
      setRepositories(repos);

      // Fetch languages for each repository
      repos.forEach(async (repo) => {
        try {
          const languagesResponse = await fetch(
            `https://api.github.com/repos/${repo.owner.login}/${repo.name}/languages`,
            {
              headers: {
                Accept: "application/vnd.github.v3+json",
                Authorization: `Bearer ${session.provider_token}`,
              },
            }
          );

          if (!languagesResponse.ok) {
            throw new Error(`Error fetching languages: ${languagesResponse.status}`);
          }

          const languagesData = await languagesResponse.json();
          setLanguages((prev) => ({
            ...prev,
            [repo.id]: languagesData,
          }));
        } catch (error) {
          console.error(`Error fetching languages for ${repo.name}:`, error);
        }
      });
    } catch (error) {
      console.error("Error fetching repositories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && session) {
      fetchRepositories();
    }
  }, [session, authLoading]);

  if (isLoading) {
    return <div className="w-screen h-screen flex items-center justify-center">
      <div className="text-neutral-100">Loading...</div>
    </div>;
  }

  if (authError) {
    return <div className="w-screen h-screen flex items-center justify-center">
      <div className="text-red-500">{authError}</div>
    </div>;
  }

  const filteredRepositories = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-screen h-screen flex flex-col items-center inria-sans-regular p-8 radial-background">
      <h1 className="text-3xl font-bold mb text-neutral-100">
        Select a Repository:
      </h1>
      <input
        type="text"
        placeholder="Search repositories"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-8 p-3 border rounded-lg w-full max-w-xl shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-transparent text-neutral-100 placeholder-neutral-400"
      />
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredRepositories.map((repo) => (
          <Link
            key={repo.id}
            href={`/post-project/project-form?repo=${repo.name}&owner=${repo.owner.login}`}
            className="p-6 border-2 border-neutral-200 rounded-xl hover:border-red-300 transition-all duration-300 backdrop-blur-sm cursor-pointer"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex justify-between items-start">
                <div className="flex items-center group">
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-red-400 hover:text-red-300"
                  >
                    {repo.name}
                  </a>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-2 text-sm opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <FaExternalLinkAlt />
                  </a>
                </div>
              </h2>
              <p className="text-sm text-neutral-300 mt-1">
                Updated: {formatDate(repo.updated_at)}
              </p>
            </div>

            <p className="text-neutral-200 mb-4 line-clamp-2">
              {repo.description || "No description available"}
            </p>

            <div className="flex justify-between text-sm text-neutral-300">
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <span className="text-yellow-300 mr-1">★</span>
                  {repo.stargazers_count}
                </span>
                <span className="flex items-center">
                  <span className="mr-1">🍴</span>
                  {repo.forks_count}
                </span>
              </div>
              <div className="text-neutral-300">
                {languages[repo.id] ? 
                  (typeof languages[repo.id] === 'object' && languages[repo.id] !== null) ?
                    ('message' in languages[repo.id] ? 
                      (repo.language || 'Not specified') :
                      (Object.keys(languages[repo.id])
                        .slice(0, 3)
                        .join(', ') || 'No languages detected')
                    ) : 'Loading...'
                  : 'Loading...'
                }
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Page;
