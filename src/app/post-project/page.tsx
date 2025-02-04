"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";
import { FaExternalLinkAlt } from "react-icons/fa";

const Page = () => {
  const [repositories, setRepositories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [languages, setLanguages] = useState({});

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "numeric", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  useEffect(() => {
    const fetchRepositories = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Error fetching session:", error.message);
        return;
      }

      if (session?.provider_token) {
        try {
          const repoResponse = await fetch(
            "https://api.github.com/user/repos",
            {
              headers: {
                Authorization: `Bearer ${session.provider_token}`,
              },
            }
          );
          const repos = await repoResponse.json();
          setRepositories(repos);

          // Fetch languages for each repository
          repos.forEach(async (repo) => {
            const languagesResponse = await fetch(
              `https://api.github.com/repos/${repo.owner.login}/${repo.name}/languages`
            );
            const languagesData = await languagesResponse.json();
            setLanguages((prevLanguages) => ({
              ...prevLanguages,
              [repo.id]: languagesData,
            }));
          });
        } catch (error) {
          console.error("Error fetching GitHub repositories:", error);
        }
      }
    };

    fetchRepositories();
  }, []);

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
          <div
            key={repo.id}
            className="p-6 border-2 border-neutral-200 rounded-xl hover:border-red-200 transition-all duration-300 backdrop-blur-sm"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex justify-between items-start">
                <a
                  href={repo.html_url}
                  target="blank"
                  className="text-red-400 hover:text-red-300 flex items-center group"
                >
                  {repo.name}
                  <span className="ml-2 text-sm opacity-60 group-hover:opacity-100 transition-opacity">
                    <FaExternalLinkAlt />
                  </span>
                </a>
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default Page;
