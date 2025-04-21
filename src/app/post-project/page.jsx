"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FaExternalLinkAlt } from "react-icons/fa";
import Link from 'next/link';
import { fetchUserRepositories, fetchRepositoryLanguages } from "../../utils/githubUtils";

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

const CACHE_DURATION = 60 * 60 * 1000;

const Page = () => {
  const { session, loading: authLoading, error: authError } = useAuth();
  const [repositories, setRepositories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [languages, setLanguages] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !session) {
      setIsLoading(false);
      return;
    }
    if (!authLoading && session) {
      fetchRepositories(false);
    }
  }, [session, authLoading]);

  const fetchRepositories = async (forceRefresh = false) => {
    try {
      const cachedReposTime = localStorage.getItem('github_repos_time');
      const cachedRepos = localStorage.getItem('github_repos');
      const cachedLangs = localStorage.getItem('github_langs');
      const now = new Date().getTime();
      const isCacheValid = cachedReposTime && cachedRepos && cachedLangs && 
        (now - parseInt(cachedReposTime) < CACHE_DURATION);

      if (isCacheValid && !forceRefresh) {
        setRepositories(JSON.parse(cachedRepos));
        setLanguages(JSON.parse(cachedLangs));
        setIsLoading(false);
        return;
      }

      const repos = await fetchUserRepositories();
      setRepositories(repos || []);
      const languagesData = {};
      const languagePromises = repos?.map(async (repo) => {
        if (repo?.owner?.login && repo?.name) {
          try {
            const repoLanguages = await fetchRepositoryLanguages(
              repo.owner.login, 
              repo.name
            );
            languagesData[repo.id] = repoLanguages;
          } catch (error) {
            // ignore
          }
        }
      });
      if (languagePromises?.length) {
        await Promise.all(languagePromises);
        setLanguages(languagesData);
      }
      localStorage.setItem('github_repos', JSON.stringify(repos));
      localStorage.setItem('github_langs', JSON.stringify(languagesData));
      localStorage.setItem('github_repos_time', now.toString());
    } catch (error) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--title-red)] mx-auto"></div>
          </div>
          <h1 className="text-xl text-[var(--off-white)]">Loading Your Repositories</h1>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-[var(--title-red)]">{authError}</div>
      </div>
    );
  }

  const filteredRepositories = repositories
    .filter((repo) => !repo.private)
    .filter((repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-[1200px]">
        <header className="mb-10 flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--off-white)] tracking-tight mb-2">
            Select a Repository
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl text-center">
            Choose a repository to post your project. Only public repositories are shown.
          </p>
        </header>
        <div className="flex flex-col items-center mb-8">
          <input
            type="text"
            placeholder="Search repositories"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-4 rounded-xl w-full max-w-xl bg-[#232323] border border-[var(--muted-red)] text-[var(--off-white)] placeholder-gray-400 shadow focus:ring-2 focus:ring-[var(--title-red)] focus:border-[var(--title-red)] outline-none transition"
          />
        </div>
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredRepositories.map((repo) => (
            <Link
              key={repo.id}
              href={`/post-project/project-form?repo=${repo.name}&owner=${repo.owner.login}`}
              className="group rounded-xl bg-[#232323] border-2 border-transparent hover:border-[var(--title-red)] shadow-lg p-7 flex flex-col gap-3 transition-all duration-200 cursor-pointer hover:scale-[1.025] focus:outline-none focus:ring-2 focus:ring-[var(--title-red)]"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--orange)] font-bold hover:underline truncate max-w-[220px]"
                    >
                      {repo.name}
                    </a>
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-1 text-sm opacity-60 group-hover:opacity-100 transition-opacity text-[var(--off-white)]"
                      aria-label="Open on GitHub"
                    >
                      <FaExternalLinkAlt />
                    </a>
                  </div>
                  <span className="text-xs text-gray-400">
                    Updated: {formatDate(repo.updated_at)}
                  </span>
                </div>
                <p className="text-[var(--off-white)] text-base line-clamp-2 min-h-[2.5rem]">
                  {repo.description || <span className="italic text-gray-500">No description available</span>}
                </p>
              </div>
              <div className="flex justify-between items-end mt-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center text-yellow-400 font-bold">
                    <span className="mr-1">★</span>
                    {repo.stargazers_count}
                  </span>
                  <span className="flex items-center text-[var(--off-white)]">
                    <span className="mr-1">🍴</span>
                    {repo.forks_count}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {languages[repo.id] && typeof languages[repo.id] === 'object' && !('message' in languages[repo.id]) ? (
                    Object.keys(languages[repo.id])
                      .slice(0, 3)
                      .map((lang) => (
                        <span
                          key={lang}
                          className="px-3 py-1 rounded-full bg-[var(--orange)] bg-opacity-80 text-white text-xs font-bold shadow-sm"
                        >
                          {lang}
                        </span>
                      ))
                  ) : (
                    <span className="text-xs text-gray-400">
                      {repo.language || 'No languages detected'}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {filteredRepositories.length === 0 && (
          <div className="text-center text-gray-400 mt-16 text-lg">
            No repositories found.
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
