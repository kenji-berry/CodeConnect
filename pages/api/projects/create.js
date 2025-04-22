import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

export const config = {
  api: { bodyParser: false }
};

function parseField(field) {
  if (Array.isArray(field)) return field[0];
  return field;
}

async function fetchAllFromGitHub(url, githubToken) {
  let results = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const res = await axios.get(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`, {
      headers: { Authorization: `token ${githubToken}` }
    });
    results = results.concat(res.data);
    // If less than 100 returned, we're done
    hasMore = Array.isArray(res.data) && res.data.length === 100;
    page++;
  }
  return results;
}

export default async function handler(req, res) {
  console.log('📥 API: Project create/update request received', { method: req.method, url: req.url });
  try {
    if (req.method !== 'POST') {
      console.log('❌ API: Method not allowed', { method: req.method });
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Parse FormData
    console.log('🔄 API: Starting form parsing');
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024,
      multiples: true
    });

    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('❌ API: Form parsing error', err);
          reject(err);
        } else {
          console.log('✅ API: Form parsed successfully', { 
            fieldsReceived: Object.keys(fields),
            filesReceived: Object.keys(files)
          });
          resolve({ fields, files });
        }
      });
    });

    // Check Supabase session
    console.log('🔄 API: Checking Supabase session');
    const supabase = createPagesServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('❌ API: No Supabase session found');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.log('✅ API: Supabase session valid', { userId: session.user.id, email: session.user.email });

    // Check GitHub token
    console.log('🔄 API: Checking GitHub token');
    const githubToken = req.cookies.github_access_token;
    if (!githubToken) {
      console.log('❌ API: No GitHub token found');
      return res.status(401).json({ error: 'GitHub authentication required' });
    }
    console.log('✅ API: GitHub token found');

    // Parse all fields
    console.log('🔄 API: Parsing form fields');
    const project_id = parseField(data.fields.project_id); 
    const repoName = parseField(data.fields.repoName);
    const owner = parseField(data.fields.owner);
    const github_link = parseField(data.fields.github_link);
    const description_type = parseField(data.fields.description_type);
    const custom_description = parseField(data.fields.custom_description);
    const difficulty_level = parseField(data.fields.difficulty_level);
    const tags = JSON.parse(parseField(data.fields.tags) || '[]');
    const technologies = JSON.parse(parseField(data.fields.technologies) || '[]');
    const highlighted_technologies = JSON.parse(parseField(data.fields.highlighted_technologies) || '[]');
    const highlighted_tags = JSON.parse(parseField(data.fields.highlighted_tags) || '[]');
    const links = JSON.parse(parseField(data.fields.links) || '[]');
    const status = parseField(data.fields.status);
    const contribution_types = JSON.parse(parseField(data.fields.contribution_types) || '[]');
    const mentorship = parseField(data.fields.mentorship);
    const license = parseField(data.fields.license);
    const setup_time = parseField(data.fields.setup_time);

    let isUpdate = !!project_id;
    console.log('✅ API: Fields parsed successfully', { 
      isUpdate,
      project_id,
      repoName,
      owner,
      github_link,
      description_type,
      difficulty_level,
      tagsCount: tags.length,
      techCount: technologies.length,
      status
    });

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: "At least one tag is required." });
    }
    if (!Array.isArray(highlighted_tags) || highlighted_tags.length === 0) {
      return res.status(400).json({ error: "At least one highlighted tag is required." });
    }
    if (!Array.isArray(technologies) || technologies.length === 0) {
      return res.status(400).json({ error: "At least one technology is required." });
    }
    if (!Array.isArray(highlighted_technologies) || highlighted_technologies.length === 0) {
      return res.status(400).json({ error: "At least one highlighted technology is required." });
    }
    if (!setup_time || isNaN(setup_time) || Number(setup_time) < 1) {
      return res.status(400).json({ error: "Estimated setup time is required." });
    }
    if (!custom_description || custom_description.trim().length < 50) {
      return res.status(400).json({ error: "Project description is required and should be at least 50 characters." });
    }

    let finalDescription = custom_description;

    const difficulty = difficulty_level ? parseInt(difficulty_level, 10) : null;
    const setupTime = setup_time ? parseInt(setup_time, 10) : null;

    let imageUrl = null;
    if (data.files && data.files.banner_image) {
      console.log('🔄 API: Processing banner image');
      const file = Array.isArray(data.files.banner_image)
        ? data.files.banner_image[0]
        : data.files.banner_image;

      if (file && file.filepath) {
        try {
          const fileExt = file.originalFilename.split('.').pop();
          const fileType = file.mimetype;
          console.log('🔄 API: Image details', { 
            originalFilename: file.originalFilename, 
            fileType, 
            fileExt,
            size: fs.statSync(file.filepath).size 
          });
          
          // Use buffer approach since it worked previously
          const buffer = fs.readFileSync(file.filepath);
          console.log('🔄 API: Image buffer loaded, starting moderation');

          // Sightengine moderation
          const formData = new FormData();
          formData.append('models', 'nudity-2.1,weapon,alcohol,recreational_drug,medical,offensive-2.0,scam,text-content,face-attributes,gore-2.0,text,qr-content,tobacco,violence,self-harm,money,gambling');
          formData.append('api_user', process.env.SIGHTENGINE_USER);
          formData.append('api_secret', process.env.SIGHTENGINE_SECRET);
          formData.append('media', buffer, {
            filename: file.originalFilename,
            contentType: fileType,
          });

          console.log('🔄 API: Sending image to Sightengine for moderation');
          try {
            // Make request with explicit timeout and better error handling
            const sightengineResponse = await axios({
              method: 'post',
              url: 'https://api.sightengine.com/1.0/check.json',
              data: formData,
              headers: formData.getHeaders(),
              timeout: 30000, // 30 second timeout for larger images
              validateStatus: status => true // Don't throw on any status code
            });
            
            console.log('🔄 API: Sightengine response received', { 
              status: sightengineResponse.status, 
              statusText: sightengineResponse.statusText,
              hasData: !!sightengineResponse.data
            });
            
            // Handle server errors (code 950) differently
            if (sightengineResponse.status === 500 && 
                sightengineResponse.data?.error?.code === 950) {
              console.log('⚠️ API: Sightengine server error, proceeding without moderation');
              // Continue without moderation
            } else if (sightengineResponse.status !== 200) {
              // For other errors, return a 400
              let errorMsg = `Sightengine API returned status ${sightengineResponse.status}`;
              if (sightengineResponse.data?.error?.message) {
                errorMsg += `: ${sightengineResponse.data.error.message}`;
              }
              return res.status(400).json({ error: errorMsg });
            } else {
              // Successful response, check moderation results
              const result = sightengineResponse.data;
              console.log('✅ API: Sightengine moderation result', { 
                nudity_safe: result.nudity?.safe, 
                weapon: result.weapon?.weapon,
                offensive_prob: result.offensive?.prob,
                gore_prob: result.gore?.prob
              });
              
              if (
                result.nudity?.safe === false ||
                result.weapon?.weapon === true ||
                result.alcohol?.alcohol === true ||
                result.gore?.prob > 0.5 ||
                result.offensive?.prob > 0.5 ||
                result.violence?.violence === true ||
                result.scam?.scam === true ||
                result.self_harm?.self_harm === true ||
                result.gambling?.gambling === true
              ) {
                console.log('❌ API: Image failed moderation');
                return res.status(400).json({ error: "Image failed moderation: contains inappropriate or restricted content." });
              }
            }
          } catch (error) {
            console.error('❌ API: Image moderation failed', error.message);
            if (error.response) {
              console.error('API response status:', error.response.status);
              console.error('API response data:', error.response.data);
            }
            
            // For network errors or other exceptions, log but proceed
            console.log('⚠️ API: Error during moderation request, proceeding without moderation');
            // Continue execution without returning error
          }
        } catch (error) {
          console.error('❌ API: Image moderation failed', error);
          let errorMsg = "Image moderation failed.";
          if (error.response && error.response.data && error.response.data.error) {
            errorMsg = typeof error.response.data.error === "string"
              ? error.response.data.error
              : JSON.stringify(error.response.data.error);
          }
          return res.status(400).json({ error: errorMsg });
        }
      }
    }
    // Check if banner image is provided
    console.log('🔄 API: Validating image requirements', { isUpdate, hasImage: !!(data.files && data.files.banner_image) });
    if (!isUpdate && (!data.files || !data.files.banner_image)) {
      console.log('❌ API: Missing banner image for new project');
      return res.status(400).json({ error: 'Project banner image is required' });
    }

    // For updates, check if there's an existing image
    if (isUpdate && (!data.files || !data.files.banner_image)) {
      console.log('🔄 API: No new image provided for update, checking if existing image exists');
      // Check if the project already has an image
      const { data: existingProject, error: existingProjectError } = await supabase
        .from('project')
        .select('image')
        .eq('id', project_id)
        .single();

      if (existingProjectError) {
        console.error('❌ API: Error checking existing project', existingProjectError);
      }

      if (!existingProject || !existingProject.image) {
        console.log('❌ API: No existing image found for project update');
        return res.status(400).json({ error: 'Project banner image is required' });
      }
      
      console.log('✅ API: Existing image found, proceeding with update');
    }

    // --- CREATE or UPDATE LOGIC ---
    console.log(`🔄 API: ${isUpdate ? 'Updating' : 'Creating'} project`);
    let project;
    let projectError;

    if (isUpdate) {
      // UPDATE existing project
      console.log('🔄 API: Updating project in database', { project_id });
      const { data: updated, error: updateError } = await supabase
        .from('project')
        .update({
          repo_name: repoName || 'Untitled Project',
          repo_owner: owner || session.user.email,
          github_link: github_link || null,
          description_type: description_type || null,
          custom_description: finalDescription || null,
          difficulty_level: isNaN(difficulty) ? null : difficulty,
          links: links,
          status: status || null,
          user_id: session.user.id,
          repo_name_owner: `${repoName || 'Untitled Project'} by ${owner || session.user.email}`,
          mentorship: mentorship === "Yes",
          license: license || null,
          setup_time: isNaN(setupTime) ? null : setupTime,
          // image: will update below if needed
        })
        .eq('id', project_id)
        .select()
        .single();
      project = updated;
      projectError = updateError;
      
      if (updateError) {
        console.error('❌ API: Project update error', updateError);
      } else {
        console.log('✅ API: Project updated successfully', { project_id: project.id });
      }
    } else {
      // CREATE new project
      console.log('🔄 API: Creating new project in database');
      const { data: created, error: createError } = await supabase
        .from('project')
        .insert([{
          repo_name: repoName || 'Untitled Project',
          repo_owner: owner || session.user.email,
          github_link: github_link || null,
          description_type: description_type || null,
          custom_description: finalDescription || null,
          difficulty_level: isNaN(difficulty) ? null : difficulty,
          links: links,
          status: status || null,
          user_id: session.user.id,
          created_at: new Date().toISOString(),
          repo_name_owner: `${repoName || 'Untitled Project'} by ${owner || session.user.email}`,
          mentorship: mentorship === "Yes",
          license: license || null,
          setup_time: isNaN(setupTime) ? null : setupTime,
          image: null,
          webhook_active: false 
        }])
        .select()
        .single();
      project = created;
      projectError = createError;
      
      if (createError) {
        console.error('❌ API: Project creation error', createError);
      } else {
        console.log('✅ API: Project created successfully', { project_id: project.id });
      }
    }

    if (projectError) {
      return res.status(500).json({ error: projectError.message });
    }

    // --- IMAGE UPLOAD (for both create and update) ---
    if (data.files && data.files.banner_image) {
      console.log('🔄 API: Processing image upload');
      const file = Array.isArray(data.files.banner_image)
        ? data.files.banner_image[0]
        : data.files.banner_image;

      if (file && file.filepath) {
        try {
          const fileExt = file.originalFilename.split('.').pop();
          const fileType = file.mimetype;
          const buffer = fs.readFileSync(file.filepath);

          const filename = `${session.user.id}/project_banners/${project.id}.${fileExt}`;
          console.log('🔄 API: Uploading image to storage', { filename, fileType });

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('project-images')
            .upload(filename, buffer, {
              contentType: fileType,
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('❌ API: Image upload error:', uploadError);
          } else {
            console.log('✅ API: Image uploaded successfully');
            const { data: { publicUrl } } = supabase.storage
              .from('project-images')
              .getPublicUrl(filename);

            imageUrl = publicUrl;
            console.log('🔄 API: Updating project with image URL', { imageUrl });
            
            const { error: imageUpdateError } = await supabase
              .from('project')
              .update({ image: imageUrl })
              .eq('id', project.id);
              
            if (imageUpdateError) {
              console.error('❌ API: Error updating project with image URL', imageUpdateError);
            } else {
              console.log('✅ API: Project updated with image URL');
            }
          }
        } catch (error) {
          console.error('❌ API: File processing error:', error);
          // Better error handling - continue with the project creation
          // but log the error for debugging
        } finally {
          // Clean up the temporary file
          try {
            fs.unlinkSync(file.filepath);
            console.log('✅ API: Temporary file cleaned up');
          } catch (cleanupError) {
            console.error('❌ API: File cleanup error:', cleanupError);
          }
        }
      }
    }

    // --- TECHNOLOGIES & TAGS ---
    console.log('🔄 API: Processing technologies and tags');
    // Remove old project_technologies/project_tags if updating
    if (isUpdate) {
      console.log('🔄 API: Removing old technologies and tags associations');
      const { error: techDeleteError } = await supabase.from('project_technologies').delete().eq('project_id', project.id);
      const { error: tagDeleteError } = await supabase.from('project_tags').delete().eq('project_id', project.id);
      
      if (techDeleteError) console.error('❌ API: Error deleting old technologies', techDeleteError);
      if (tagDeleteError) console.error('❌ API: Error deleting old tags', tagDeleteError);
    }

    // Map technology names to IDs
    let technologyIds = [];
    if (technologies.length > 0) {
      console.log('🔄 API: Fetching technology IDs', { technologies });
      const { data: techRows, error: techFetchError } = await supabase
        .from('technologies')
        .select('id, name')
        .in('name', technologies);

      if (techFetchError) {
        console.error('❌ API: Error fetching technologies', techFetchError);
        return res.status(500).json({ error: techFetchError.message });
      }

      console.log('✅ API: Technology rows fetched', { count: techRows?.length });
      const techNameToId = {};
      techRows.forEach(row => {
        techNameToId[row.name.toLowerCase()] = row.id;
      });

      technologyIds = technologies.map(name => techNameToId[name.toLowerCase()]).filter(Boolean);
      console.log('🔄 API: Technology IDs mapped', { count: technologyIds.length });

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
        console.log('🔄 API: Inserting project technologies', { count: techRowsToInsert.length });
        const { error: techError } = await supabase
          .from('project_technologies')
          .insert(techRowsToInsert);
        if (techError) {
          console.error('❌ API: Error inserting technologies', techError);
          return res.status(500).json({ error: techError.message });
        }
        console.log('✅ API: Project technologies inserted');
      }
    }

    // Insert project_tags
    if (tags.length > 0) {
      console.log('🔄 API: Fetching tag IDs', { tags });
      // Get tag IDs
      const { data: tagRows, error: tagFetchError } = await supabase
        .from('tags')
        .select('id, name')
        .in('name', tags);

      if (tagFetchError) {
        console.error('❌ API: Error fetching tags', tagFetchError);
        return res.status(500).json({ error: tagFetchError.message });
      }

      console.log('✅ API: Tag rows fetched', { count: tagRows?.length });
      const tagNameToId = {};
      tagRows.forEach(row => {
        tagNameToId[row.name.toLowerCase()] = row.id;
      });

      const tagIds = tags.map(name => tagNameToId[name.toLowerCase()]).filter(Boolean);
      console.log('🔄 API: Tag IDs mapped', { count: tagIds.length });

      const tagRowsToInsert = tagIds.map(tagId => ({
        project_id: project.id,
        tag_id: tagId,
        is_highlighted: highlighted_tags
          .map(str => str.toLowerCase())
          .includes(
            Object.keys(tagNameToId).find(key => tagNameToId[key] === tagId)
          )
      }));

      if (tagRowsToInsert.length > 0) {
        console.log('🔄 API: Inserting project tags', { count: tagRowsToInsert.length });
        const { error: tagError } = await supabase
          .from('project_tags')
          .insert(tagRowsToInsert);
        if (tagError) {
          console.error('❌ API: Error inserting tags', tagError);
          return res.status(500).json({ error: tagError.message });
        }
        console.log('✅ API: Project tags inserted');
      }
    }

    // --- CONTRIBUTION TYPES ---
    console.log('🔄 API: Processing contribution types');
    // Remove old project_contribution_type if updating
    if (isUpdate) {
      console.log('🔄 API: Removing old contribution types');
      const { error: contTypeDeleteError } = await supabase.from('project_contribution_type').delete().eq('project_id', project.id);
      if (contTypeDeleteError) console.error('❌ API: Error deleting contribution types', contTypeDeleteError);
    }

    // Insert project_contribution_type
    if (contribution_types.length > 0) {
      console.log('🔄 API: Fetching contribution type IDs', { contribution_types });
      // Get contribution type IDs
      const { data: contTypeRows, error: contTypeFetchError } = await supabase
        .from('contribution_type')
        .select('id, name')
        .in('name', contribution_types);

      if (contTypeFetchError) {
        console.error('❌ API: Error fetching contribution types', contTypeFetchError);
        return res.status(500).json({ error: contTypeFetchError.message });
      }

      console.log('✅ API: Contribution type rows fetched', { count: contTypeRows?.length });
      const contTypeNameToId = {};
      contTypeRows.forEach(row => {
        contTypeNameToId[row.name.toLowerCase()] = row.id;
      });

      const contTypeIds = contribution_types.map(name => contTypeNameToId[name.toLowerCase()]).filter(Boolean);
      console.log('🔄 API: Contribution type IDs mapped', { count: contTypeIds.length });

      const contTypeRowsToInsert = contTypeIds.map(contTypeId => ({
        project_id: project.id,
        contribution_type_id: contTypeId
      }));

      if (contTypeRowsToInsert.length > 0) {
        console.log('🔄 API: Inserting contribution types', { count: contTypeRowsToInsert.length });
        const { error: contTypeError } = await supabase
          .from('project_contribution_type')
          .insert(contTypeRowsToInsert);
        if (contTypeError) {
          console.error('❌ API: Error inserting contribution types', contTypeError);
          return res.status(500).json({ error: contTypeError.message });
        }
        console.log('✅ API: Project contribution types inserted');
      }
    }

    // --- FETCH ALL ISSUES, PRs, AND COMMITS FROM GITHUB ---
    if (!isUpdate && github_link && owner && repoName) {
      try {
        // Fetch all issues (excluding PRs)
        const allIssues = await fetchAllFromGitHub(
          `https://api.github.com/repos/${owner}/${repoName}/issues?state=all`,
          githubToken
        );
        const issues = allIssues.filter(issue => !issue.pull_request);

        if (issues.length > 0) {
          const issueRows = issues.map(issue => ({
            project_id: project.id,
            issue_id: issue.id,
            title: issue.title?.substring(0, 1000) || null,
            body: issue.body?.substring(0, 10000) || null,
            state: issue.state?.substring(0, 100) || null,
            created_at: issue.created_at ? new Date(issue.created_at) : null,
            updated_at: issue.updated_at ? new Date(issue.updated_at) : null,
            number: issue.number,
            labels: Array.isArray(issue.labels) ? issue.labels.map(l => l.name) : [],
            url: issue.html_url?.substring(0, 500) || null,
          }));
          // Insert in batches of 1000 to avoid hitting Supabase limits
          for (let i = 0; i < issueRows.length; i += 1000) {
            await supabase.from('project_issues').upsert(issueRows.slice(i, i + 1000), { onConflict: ['project_id', 'issue_id'] });
          }
        }

        // Fetch all pull requests
        const prs = await fetchAllFromGitHub(
          `https://api.github.com/repos/${owner}/${repoName}/pulls?state=all`,
          githubToken
        );

        if (prs.length > 0) {
          const prRows = prs.map(pr => ({
            project_id: project.id,
            pr_id: pr.id,
            title: pr.title?.substring(0, 1000) || null,
            body: pr.body?.substring(0, 10000) || null,
            state: pr.state?.substring(0, 100) || null,
            created_at: pr.created_at ? new Date(pr.created_at) : null,
            updated_at: pr.updated_at ? new Date(pr.updated_at) : null,
            number: pr.number,
            labels: Array.isArray(pr.labels) ? pr.labels.map(l => l.name) : [],
            url: pr.html_url?.substring(0, 500) || null,
            merged: !!pr.merged_at,
          }));
          for (let i = 0; i < prRows.length; i += 1000) {
            await supabase.from('project_pull_requests').upsert(prRows.slice(i, i + 1000), { onConflict: ['project_id', 'pr_id'] });
          }
        }

        // Fetch all commits
        const commits = await fetchAllFromGitHub(
          `https://api.github.com/repos/${owner}/${repoName}/commits`,
          githubToken
        );

        if (commits.length > 0) {
          const commitRows = commits.map(commit => ({
            project_id: project.id,
            commit_id: commit.sha,
            message: commit.commit?.message?.substring(0, 1000) || null,
            author: commit.commit?.author?.name?.substring(0, 100) || null,
            timestamp: commit.commit?.author?.date ? new Date(commit.commit.author.date) : null,
            url: commit.html_url?.substring(0, 500) || null,
            branch: null,
          }));
          for (let i = 0; i < commitRows.length; i += 1000) {
            await supabase.from('project_commits').insert(commitRows.slice(i, i + 1000));
          }
        }

        console.log('✅ API: Fetched and stored ALL issues, PRs, and commits from GitHub');
      } catch (err) {
        console.error('❌ API: Error fetching GitHub data on project creation', err);
        // Optionally, you can return an error or continue
      }
    }

    console.log('✅ API: Project process completed successfully', { projectId: project.id, isUpdate });
    return res.status(isUpdate ? 200 : 201).json({ projectId: project.id });
  } catch (error) {
    console.error('❌ API: Unhandled error in project create/update', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
