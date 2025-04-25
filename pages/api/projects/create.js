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
    hasMore = Array.isArray(res.data) && res.data.length === 100;
    page++;
  }
  return results;
}

export default async function handler(req, res) {
  console.log('📥 API: Project create/update request received', { method: req.method, url: req.url });
  let tempFilePath = null;
  let createdProjectIdForRollback = null;

  try {
    if (req.method !== 'POST') {
      console.log('❌ API: Method not allowed', { method: req.method });
      return res.status(405).json({ error: 'Method not allowed' });
    }

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
          console.log('✅ API: Form parsed successfully');
          resolve({ fields, files });
        }
      });
    });

    console.log('🔄 API: Checking Supabase session');
    const supabase = createPagesServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('❌ API: No Supabase session found');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.log('✅ API: Supabase session valid', { userId: session.user.id });

    console.log('🔄 API: Checking GitHub token');
    const githubToken = req.cookies.github_access_token;
    if (!githubToken) {
      console.log('⚠️ API: No GitHub token found (continuing, may affect GitHub data fetch)');
    } else {
      console.log('✅ API: GitHub token found');
    }

    console.log('🔄 API: Parsing form fields');
    const project_id_raw = parseField(data.fields.project_id);
    const project_id = project_id_raw ? parseInt(project_id_raw, 10) : null;
    const repoName = parseField(data.fields.repoName);
    const owner = parseField(data.fields.owner);
    const github_link = parseField(data.fields.github_link);
    const description_type = parseField(data.fields.description_type);
    const custom_description = parseField(data.fields.custom_description);
    const difficulty_level_raw = parseField(data.fields.difficulty_level);
    const tags = JSON.parse(parseField(data.fields.tags) || '[]');
    const technologies = JSON.parse(parseField(data.fields.technologies) || '[]');
    const highlighted_technologies = JSON.parse(parseField(data.fields.highlighted_technologies) || '[]');
    const highlighted_tags = JSON.parse(parseField(data.fields.highlighted_tags) || '[]');
    const links = JSON.parse(parseField(data.fields.links) || '[]');
    const status = parseField(data.fields.status);
    const contribution_types = JSON.parse(parseField(data.fields.contribution_types) || '[]');
    const mentorship = parseField(data.fields.mentorship);
    const license = parseField(data.fields.license);
    const setup_time_raw = parseField(data.fields.setup_time);

    let isUpdate = !!project_id;
    console.log('✅ API: Fields parsed', { isUpdate, project_id });

    if (!Array.isArray(tags) || tags.length === 0) return res.status(400).json({ error: "At least one tag is required." });
    if (!Array.isArray(highlighted_tags) || highlighted_tags.length === 0) return res.status(400).json({ error: "At least one highlighted tag is required." });
    if (!Array.isArray(technologies) || technologies.length === 0) return res.status(400).json({ error: "At least one technology is required." });
    if (!Array.isArray(highlighted_technologies) || highlighted_technologies.length === 0) return res.status(400).json({ error: "At least one highlighted technology is required." });
    if (!setup_time_raw || isNaN(setup_time_raw) || Number(setup_time_raw) < 1) return res.status(400).json({ error: "Estimated setup time is required." });
    if (!custom_description || custom_description.trim().length < 50) return res.status(400).json({ error: "Project description is required and should be at least 50 characters." });

    const difficulty = difficulty_level_raw ? parseInt(difficulty_level_raw, 10) : null;
    const setupTime = setup_time_raw ? parseInt(setup_time_raw, 10) : null;

    let imageUrl = null;
    if (data.files && data.files.banner_image) {
      console.log('🔄 API: Processing banner image');
      const file = Array.isArray(data.files.banner_image)
        ? data.files.banner_image[0]
        : data.files.banner_image;

      if (file && file.filepath) {
        tempFilePath = file.filepath;
        try {
          const fileExt = file.originalFilename.split('.').pop();
          const fileType = file.mimetype;
          const buffer = fs.readFileSync(file.filepath);
          console.log('🔄 API: Image buffer loaded');

          console.log('🔄 API: Starting image moderation');
          const formData = new FormData();
          formData.append('models', 'nudity-2.1,weapon,alcohol,recreational_drug,medical,offensive-2.0,scam,text-content,face-attributes,gore-2.0,text,qr-content,tobacco,violence,self-harm,money,gambling');
          formData.append('api_user', process.env.SIGHTENGINE_USER);
          formData.append('api_secret', process.env.SIGHTENGINE_SECRET);
          formData.append('media', buffer, { filename: file.originalFilename, contentType: fileType });

          try {
            const sightengineResponse = await axios({
              method: 'post',
              url: 'https://api.sightengine.com/1.0/check.json',
              data: formData,
              headers: formData.getHeaders(),
              timeout: 30000,
              validateStatus: status => true
            });
            console.log('🔄 API: Sightengine response received', { status: sightengineResponse.status });

            if (sightengineResponse.status === 500 && sightengineResponse.data?.error?.code === 950) {
              console.log('⚠️ API: Sightengine server error, proceeding without moderation');
            } else if (sightengineResponse.status !== 200) {
              let errorMsg = `Sightengine API returned status ${sightengineResponse.status}`;
              if (sightengineResponse.data?.error?.message) errorMsg += `: ${sightengineResponse.data.error.message}`;
              throw new Error(errorMsg);
            } else {
              const result = sightengineResponse.data;
              console.log('✅ API: Sightengine moderation result obtained');
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
                throw new Error("Image failed moderation: contains inappropriate or restricted content.");
              }
              console.log('✅ API: Image passed moderation');
            }
          } catch (error) {
            console.error('❌ API: Image moderation request failed', error.message);
            throw new Error(`Image moderation failed: ${error.message}`);
          }

          const tempImageId = isUpdate ? project_id : Date.now();
          const filename = `${session.user.id}/project_banners/${tempImageId}.${fileExt}`;
          console.log('🔄 API: Uploading image to storage', { filename });

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('project-images')
            .upload(filename, buffer, {
              contentType: fileType,
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('❌ API: Image upload error:', uploadError);
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }

          console.log('✅ API: Image uploaded successfully');
          const { data: { publicUrl } } = supabase.storage
            .from('project-images')
            .getPublicUrl(filename);
          imageUrl = publicUrl;
          console.log('✅ API: Image public URL obtained', { imageUrl });

        } catch (error) {
          console.error('❌ API: Image processing/upload failed:', error);
          if (tempFilePath) {
            try { fs.unlinkSync(tempFilePath); tempFilePath = null; } catch (e) { console.error('❌ API: Error cleaning up temp file after image error:', e); }
          }
          return res.status(400).json({ error: error.message || 'Image processing failed.' });
        }
      }
    }

    let existingImageUrl = null;
    if (isUpdate && !imageUrl) {
      const { data: existingData, error: fetchError } = await supabase
        .from('project')
        .select('image')
        .eq('id', project_id)
        .maybeSingle();
      if (fetchError) console.warn('⚠️ API: Could not fetch existing image URL', fetchError.message);
      existingImageUrl = existingData?.image;
    }
    if (!imageUrl && !existingImageUrl) {
      console.log('❌ API: Missing banner image');
      if (tempFilePath) {
        try { fs.unlinkSync(tempFilePath); tempFilePath = null; } catch (e) { console.error('❌ API: Error cleaning up temp file after image requirement check:', e); }
      }
      return res.status(400).json({ error: 'Project banner image is required' });
    }

    console.log(`🔄 API: ${isUpdate ? 'Updating' : 'Creating'} project in database`);
    let project;
    let projectError;
    const finalImageUrl = imageUrl || existingImageUrl;

    if (isUpdate) {
      const { data: updated, error: updateError } = await supabase
        .from('project')
        .update({
          repo_name: repoName || 'Untitled Project',
          repo_owner: owner || session.user.email,
          github_link: github_link || null,
          description_type: description_type || null,
          custom_description: custom_description || null,
          difficulty_level: isNaN(difficulty) ? null : difficulty,
          links: links,
          status: status || null,
          repo_name_owner: `${repoName || 'Untitled Project'} by ${owner || session.user.email}`,
          mentorship: mentorship === "Yes",
          license: license || null,
          setup_time: isNaN(setupTime) ? null : setupTime,
          image: finalImageUrl
        })
        .eq('id', project_id)
        .eq('user_id', session.user.id)
        .select()
        .single();
      project = updated;
      projectError = updateError;

      if (updateError) {
        console.error('❌ API: Project update error', updateError);
      } else if (!project) {
        console.error('❌ API: Project update failed (not found or permission denied)', { project_id });
        projectError = { message: 'Project not found or permission denied for update.' };
      } else {
        console.log('✅ API: Project updated successfully', { project_id: project.id });
      }
    } else {
      const { data: created, error: createError } = await supabase
        .from('project')
        .insert([{
          repo_name: repoName || 'Untitled Project',
          repo_owner: owner || session.user.email,
          github_link: github_link || null,
          description_type: description_type || null,
          custom_description: custom_description || null,
          difficulty_level: isNaN(difficulty) ? null : difficulty,
          links: links,
          status: status || null,
          user_id: session.user.id,
          created_at: new Date().toISOString(),
          repo_name_owner: `${repoName || 'Untitled Project'} by ${owner || session.user.email}`,
          mentorship: mentorship === "Yes",
          license: license || null,
          setup_time: isNaN(setupTime) ? null : setupTime,
          image: finalImageUrl,
          webhook_active: false
        }])
        .select()
        .single();
      project = created;
      projectError = createError;

      if (createError) {
        console.error('❌ API: Project creation error', createError);
      } else if (project) {
        console.log('✅ API: Project created successfully', { project_id: project.id });
        createdProjectIdForRollback = project.id;
      } else {
        console.error('❌ API: Project creation failed (no data returned)');
        projectError = { message: 'Project creation failed unexpectedly.' };
      }
    }

    if (projectError || !project) {
      if (tempFilePath) {
        try { fs.unlinkSync(tempFilePath); tempFilePath = null; } catch (e) { console.error('❌ API: Error cleaning up temp file after project DB error:', e); }
      }
      return res.status(500).json({ error: projectError?.message || 'Failed to save project details.' });
    }

    const finalProjectId = project.id;

    try {
      console.log('🔄 API: Updating related tables for project', finalProjectId);

      if (isUpdate) {
        console.log('🔄 API: Clearing existing relations for update');
        const { error: deleteTagsError } = await supabase.from('project_tags').delete().eq('project_id', finalProjectId);
        if (deleteTagsError) throw new Error(`Failed to clear project tags: ${deleteTagsError.message}`);

        const { error: deleteTechsError } = await supabase.from('project_technologies').delete().eq('project_id', finalProjectId);
        if (deleteTechsError) throw new Error(`Failed to clear project technologies: ${deleteTechsError.message}`);

        const { error: deleteContribsError } = await supabase.from('project_contribution_type').delete().eq('project_id', finalProjectId);
        if (deleteContribsError) throw new Error(`Failed to clear project contribution types: ${deleteContribsError.message}`);
        console.log('✅ API: Existing relations cleared');
      }

      console.log('🔄 API: Fetching IDs for related items');
      const { data: tagData, error: tagFetchError } = await supabase.from('tags').select('id, name').in('name', tags);
      if (tagFetchError) throw new Error(`Failed to fetch tag IDs: ${tagFetchError.message}`);
      const tagMap = new Map(tagData.map(t => [t.name, t.id]));

      const { data: techData, error: techFetchError } = await supabase.from('technologies').select('id, name').in('name', technologies);
      if (techFetchError) throw new Error(`Failed to fetch technology IDs: ${techFetchError.message}`);
      const techMap = new Map(techData.map(t => [t.name, t.id]));

      const { data: contribData, error: contribFetchError } = await supabase.from('contribution_type').select('id, name').in('name', contribution_types);
      if (contribFetchError) throw new Error(`Failed to fetch contribution type IDs: ${contribFetchError.message}`);
      const contribMap = new Map(contribData.map(c => [c.name, c.id]));
      console.log('✅ API: Related item IDs fetched');

      console.log('🔄 API: Inserting new relations');
      const projectTagsToInsert = tags
        .map(name => ({
          project_id: finalProjectId,
          tag_id: tagMap.get(name),
          is_highlighted: highlighted_tags.includes(name)
        }))
        .filter(pt => pt.tag_id !== undefined);

      const projectTechsToInsert = technologies
        .map(name => ({
          project_id: finalProjectId,
          technology_id: techMap.get(name),
          is_highlighted: highlighted_technologies.includes(name)
        }))
        .filter(pt => pt.technology_id !== undefined);

      const projectContribsToInsert = contribution_types
        .map(name => ({
          project_id: finalProjectId,
          contribution_type_id: contribMap.get(name)
        }))
        .filter(pc => pc.contribution_type_id !== undefined);

      if (projectTagsToInsert.length !== tags.length) console.warn('⚠️ API: Some tags were not found in the database and were skipped.');
      if (projectTechsToInsert.length !== technologies.length) console.warn('⚠️ API: Some technologies were not found in the database and were skipped.');
      if (projectContribsToInsert.length !== contribution_types.length) console.warn('⚠️ API: Some contribution types were not found in the database and were skipped.');

      if (projectTagsToInsert.length > 0) {
        const { error: insertTagsError } = await supabase.from('project_tags').insert(projectTagsToInsert);
        if (insertTagsError) throw new Error(`Failed to insert project tags: ${insertTagsError.message}`);
      }
      if (projectTechsToInsert.length > 0) {
        const { error: insertTechsError } = await supabase.from('project_technologies').insert(projectTechsToInsert);
        if (insertTechsError) throw new Error(`Failed to insert project technologies: ${insertTechsError.message}`);
      }
      if (projectContribsToInsert.length > 0) {
        const { error: insertContribsError } = await supabase.from('project_contribution_type').insert(projectContribsToInsert);
        if (insertContribsError) throw new Error(`Failed to insert project contribution types: ${insertContribsError.message}`);
      }
      console.log('✅ API: New relations inserted successfully');

      if (!isUpdate && github_link && owner && repoName && githubToken) {
        console.log('🔄 API: Starting GitHub data fetch (synchronous, critical)');
        try {
          const issues = await fetchAllFromGitHub(`https://api.github.com/repos/${owner}/${repoName}/issues?state=all`, githubToken);
          console.log(`🔄 API: Processing ${issues.length} GitHub issues`);
          const onlyIssues = issues.filter(issue => !issue.pull_request);
          if (onlyIssues.length > 0) {
            const issuesToInsert = onlyIssues.map(issue => {
              const labels = Array.isArray(issue.labels) ? issue.labels.map(l => l.name) : [];
              return {
                project_id: finalProjectId,
                issue_id: String(issue.id),
                title: issue.title?.substring(0, 1000) || null,
                body: issue.body?.substring(0, 10000) || null,
                state: issue.state?.substring(0, 100) || null,
                created_at: issue.created_at ? new Date(issue.created_at) : null,
                updated_at: issue.updated_at ? new Date(issue.updated_at) : null,
                number: issue.number,
                labels,
                url: issue.html_url?.substring(0, 500) || null,
              };
            });
            for (let i = 0; i < issuesToInsert.length; i += 50) {
              const batch = issuesToInsert.slice(i, i + 50);
              const { error } = await supabase.from('project_issues').insert(batch);
              if (error) console.error(`❌ API: Error inserting issues batch ${i}-${i+50}:`, error);
            }
            console.log(`✅ API: Finished processing ${onlyIssues.length} issues`);
          }

          const pulls = await fetchAllFromGitHub(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=all`, githubToken);
          console.log(`🔄 API: Processing ${pulls.length} GitHub pull requests`);
          if (pulls.length > 0) {
            const prsToInsert = pulls.map(pr => {
              const labels = Array.isArray(pr.labels) ? pr.labels.map(l => l.name) : [];
              return {
                project_id: finalProjectId,
                pr_id: String(pr.id),
                title: pr.title?.substring(0, 1000) || null,
                body: pr.body?.substring(0, 10000) || null,
                state: pr.state?.substring(0, 100) || null,
                created_at: pr.created_at ? new Date(pr.created_at) : null,
                updated_at: pr.updated_at ? new Date(pr.updated_at) : null,
                number: pr.number,
                labels,
                url: pr.html_url?.substring(0, 500) || null,
                merged: !!pr.merged_at,
              };
            });
            for (let i = 0; i < prsToInsert.length; i += 50) {
              const batch = prsToInsert.slice(i, i + 50);
              const { error } = await supabase.from('project_pull_requests').insert(batch);
              if (error) console.error(`❌ API: Error inserting PRs batch ${i}-${i+50}:`, error);
            }
            console.log(`✅ API: Finished processing ${pulls.length} pull requests`);
          }

          const commits = await fetchAllFromGitHub(`https://api.github.com/repos/${owner}/${repoName}/commits`, githubToken);
          console.log(`🔄 API: Processing ${commits.length} GitHub commits`);
          if (commits.length > 0) {
            const commitsToInsert = commits.map(commit => ({
              project_id: finalProjectId,
              commit_id: commit.sha,
              message: commit.commit?.message?.substring(0, 1000) || null,
              author: commit.commit?.author?.name?.substring(0, 100) || null,
              timestamp: commit.commit?.author?.date ? new Date(commit.commit.author.date) : null,
              url: commit.html_url?.substring(0, 500) || null,
              branch: null,
            }));
            for (let i = 0; i < commitsToInsert.length; i += 50) {
              const batch = commitsToInsert.slice(i, i + 50);
              const { error } = await supabase.from('project_commits').insert(batch);
              if (error) console.error(`❌ API: Error inserting commits batch ${i}-${i+50}:`, error);
            }
            console.log(`✅ API: Finished processing ${commits.length} commits`);
          }
          console.log('✅ API: GitHub data fetch and processing completed successfully for project', finalProjectId);

        } catch (githubError) {
          console.error('❌ API: GitHub data fetch failed for project', finalProjectId, githubError.message);
        }
      }

    } catch (relationError) {
      console.error('❌ API: Error updating related tables:', relationError);

      if (createdProjectIdForRollback) {
        console.warn(`🔄 API: Attempting to roll back project creation (ID: ${createdProjectIdForRollback}) due to relation error.`);
        try {
          const { error: deleteError } = await supabase
            .from('project')
            .delete()
            .eq('id', createdProjectIdForRollback);
          if (deleteError) {
            console.error(`❌ API: Failed to roll back project creation (ID: ${createdProjectIdForRollback}):`, deleteError);
          } else {
            console.log(`✅ API: Successfully rolled back project creation (ID: ${createdProjectIdForRollback}).`);
          }
        } catch (rollbackErr) {
          console.error(`❌ API: Exception during project rollback attempt (ID: ${createdProjectIdForRollback}):`, rollbackErr);
        }
      }

      if (tempFilePath) {
        try { fs.unlinkSync(tempFilePath); tempFilePath = null; } catch (e) { console.error('❌ API: Error cleaning up temp file after relation error:', e); }
      }
      return res.status(500).json({ error: `Failed to update project relations: ${relationError.message}` });
    }

    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('✅ API: Temporary file cleaned up');
      } catch (cleanupError) {
        console.error('❌ API: File cleanup error:', cleanupError);
      }
    }

    console.log('✅ API: Project process completed successfully', { projectId: finalProjectId, isUpdate });
    return res.status(isUpdate ? 200 : 201).json({ projectId: finalProjectId });

  } catch (error) {
    console.error('❌ API: Unhandled error in project create/update handler:', error);
    if (tempFilePath) {
      try { fs.unlinkSync(tempFilePath); } catch (e) { console.error('❌ API: Error cleaning up temp file in final catch block:', e); }
    }
    if (createdProjectIdForRollback) {
      console.warn(`🔄 API: Attempting rollback for project ${createdProjectIdForRollback} due to unhandled error.`);
      try {
        await supabase.from('project').delete().eq('id', createdProjectIdForRollback);
        console.log(`✅ API: Rollback successful for project ${createdProjectIdForRollback}.`);
      } catch (rollbackErr) {
        console.error(`❌ API: Rollback failed for project ${createdProjectIdForRollback}:`, rollbackErr);
      }
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
