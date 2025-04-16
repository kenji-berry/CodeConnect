import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check Supabase session
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check GitHub token
  const githubToken = req.cookies.github_access_token;
  if (!githubToken) {
    return res.status(401).json({ error: 'GitHub authentication required' });
  }

  // Extract fields from request body
  const {
    repoName,
    owner,
    github_link,
    description_type,
    custom_description,
    difficulty_level,
    tags = [],
    technologies = [],
    highlighted_technologies = [],
    links = [],
    status,
    contribution_types = []
  } = req.body;

  // Insert project (matching your schema)
  const { data: project, error: projectError } = await supabase
    .from('project')
    .insert([{
      repo_name: repoName || 'Untitled Project',
      repo_owner: owner || session.user.email,
      github_link: github_link || null,
      description_type: description_type || null,
      custom_description: custom_description || null,
      difficulty_level: difficulty_level || null,
      links: links || [],
      status: status || null,
      user_id: session.user.id,
      created_at: new Date().toISOString(),
      repo_name_owner: `${repoName || 'Untitled Project'} by ${owner || session.user.email}`,
    }])
    .select()
    .single();

  if (projectError) {
    return res.status(500).json({ error: projectError.message });
  }

  // Map technology names to IDs
  let technologyIds = [];
  if (technologies.length > 0) {
    const { data: techRows, error: techFetchError } = await supabase
      .from('technologies')
      .select('id, name')
      .in('name', technologies);

    if (techFetchError) {
      return res.status(500).json({ error: techFetchError.message });
    }

    // Lowercase mapping for robustness
    const techNameToId = {};
    techRows.forEach(row => {
      techNameToId[row.name.toLowerCase()] = row.id;
    });

    technologyIds = technologies.map(name => techNameToId[name.toLowerCase()]).filter(Boolean);

    // Insert project_technologies
    const techRowsToInsert = technologyIds.map(techId => ({
      project_id: project.id,
      technology_id: techId,
      is_highlighted: highlighted_technologies
        .map(str => str.toLowerCase())
        .includes(
          Object.keys(techNameToId).find(key => techNameToId[key] === techId)
        ),
    }));

    if (techRowsToInsert.length > 0) {
      const { error: techError } = await supabase
        .from('project_technologies')
        .insert(techRowsToInsert);
      if (techError) {
        return res.status(500).json({ error: techError.message });
      }
    }
  }

  // Map tag names to IDs
  let tagIds = [];
  if (tags.length > 0) {
    const { data: tagRows, error: tagFetchError } = await supabase
      .from('tags')
      .select('id, name')
      .in('name', tags);

    if (tagFetchError) {
      return res.status(500).json({ error: tagFetchError.message });
    }

    const tagNameToId = {};
    tagRows.forEach(row => {
      tagNameToId[row.name.toLowerCase()] = row.id;
    });

    tagIds = tags.map(name => tagNameToId[name.toLowerCase()]).filter(Boolean);

    // Insert project_tags
    const tagRowsToInsert = tagIds.map(tagId => ({
      project_id: project.id,
      tag_id: tagId,
    }));

    if (tagRowsToInsert.length > 0) {
      const { error: tagError } = await supabase
        .from('project_tags')
        .insert(tagRowsToInsert);
      if (tagError) {
        return res.status(500).json({ error: tagError.message });
      }
    }
  }

  // Map contribution type names to IDs and insert into project_contribution_type
  if (contribution_types.length > 0) {
    const { data: ctRows, error: ctFetchError } = await supabase
      .from('contribution_type')
      .select('id, name')
      .in('name', contribution_types);

    if (ctFetchError) {
      return res.status(500).json({ error: ctFetchError.message });
    }

    const ctNameToId = {};
    ctRows.forEach(row => {
      ctNameToId[row.name.toLowerCase()] = row.id;
    });

    const ctIds = contribution_types.map(name => ctNameToId[name.toLowerCase()]).filter(Boolean);

    const ctRowsToInsert = ctIds.map(ctId => ({
      project_id: project.id,
      contribution_type_id: ctId,
    }));

    if (ctRowsToInsert.length > 0) {
      const { error: ctError } = await supabase
        .from('project_contribution_type')
        .insert(ctRowsToInsert);
      if (ctError) {
        return res.status(500).json({ error: ctError.message });
      }
    }
  }

  return res.status(201).json({ projectId: project.id });
}