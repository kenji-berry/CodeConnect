"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from "@/supabaseClient";

const ProjectDetails = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);

  useEffect(() => {
    if (id) {
      const fetchProject = async () => {
        const { data, error } = await supabase
          .from('project')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching project:', error);
        } else {
          console.log(data);
          setProject(data);
        }
      };

      fetchProject();
    }
  }, [id]);

  if (!project) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{project.repo_name}</h1>
      <p>{project.custom_description}</p>
    </div>
  );
};

export default ProjectDetails;