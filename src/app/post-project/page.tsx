"use client"

import React, { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';

const Page = () => {
  const [repositories, setRepositories] = useState([]);

  useEffect(() => {
    const fetchRepositories = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error fetching session:', error.message);
        return;
      }

      if (session?.provider_token) {
        try {
          const repoResponse = await fetch('https://api.github.com/user/repos', {
            headers: {
              'Authorization': `Bearer ${session.provider_token}`
            }
          });
          const repos = await repoResponse.json();
          setRepositories(repos);
          console.log(repos)
        } catch (error) {
          console.error('Error fetching GitHub repositories:', error);
        }
      }
    };

    fetchRepositories();
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <h1 className="text-2xl font-bold">GitHub Repositories</h1>
      <div className="w-full flex flex-wrap justify-center">
        {repositories.map((repo) => (
          <div key={repo.id} className="m-4 p-4 border rounded shadow-lg w-full">
            <h2 className="text-xl font-semibold"><a href={repo.html_url} target='blank'>{repo.name}</a></h2>
            <p>{repo.description}</p>
            <p><strong>Stars:</strong> {repo.stargazers_count}</p>
            <p><strong>Forks:</strong> {repo.forks_count}</p>
            <p><strong>Language:</strong> {repo.language}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Page;