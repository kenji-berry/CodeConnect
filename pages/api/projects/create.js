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

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Parse FormData
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024,
      multiples: true
    });

    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

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

    // Parse all fields
    const project_id = parseField(data.fields.project_id); // <-- NEW
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

    // If description_type is "Use existing description", fetch from GitHub
    let finalDescription = custom_description;
    const descType = description_type;
    if (
      descType &&
      String(descType).toLowerCase().includes('existing') &&
      github_link
    ) {
      try {
        let repoOwner = owner;
        let repoNameValue = repoName;
        const match = github_link.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
          repoOwner = match[1];
          repoNameValue = match[2];
        }
        const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoNameValue}`, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (response.ok) {
          const repoData = await response.json();
          finalDescription = repoData.description || '';
        }
      } catch (err) {
        // fallback to custom_description if fetch fails
      }
    }

    const difficulty = difficulty_level ? parseInt(difficulty_level, 10) : null;
    const setupTime = setup_time ? parseInt(setup_time, 10) : null;

    let imageUrl = null;
    if (data.files && data.files.banner_image) {
      const file = Array.isArray(data.files.banner_image)
        ? data.files.banner_image[0]
        : data.files.banner_image;

      if (file && file.filepath) {
        try {
          const fileExt = file.originalFilename.split('.').pop();
          const fileType = file.mimetype;
          const buffer = fs.readFileSync(file.filepath);

          // Sightengine moderation
          const formData = new FormData();
          formData.append('models', 'nudity-2.1,weapon,alcohol,recreational_drug,medical,offensive-2.0,scam,text-content,face-attributes,gore-2.0,text,qr-content,tobacco,violence,self-harm,money,gambling');
          formData.append('api_user', process.env.SIGHTENGINE_USER);
          formData.append('api_secret', process.env.SIGHTENGINE_SECRET);
          formData.append('media', buffer, {
            filename: file.originalFilename,
            contentType: fileType,
          });

          const sightengineResponse = await axios.post(
            'https://api.sightengine.com/1.0/check.json',
            formData,
            { headers: formData.getHeaders() }
          );

          const result = sightengineResponse.data;
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
            return res.status(400).json({ error: "Image failed moderation: contains inappropriate or restricted content." });
          }
        } catch (error) {
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
    if (!isUpdate && (!data.files || !data.files.banner_image)) {
      return res.status(400).json({ error: 'Project banner image is required' });
    }

    // For updates, check if there's an existing image
    if (isUpdate && (!data.files || !data.files.banner_image)) {
      // Check if the project already has an image
      const { data: existingProject } = await supabase
        .from('project')
        .select('image')
        .eq('id', project_id)
        .single();

      if (!existingProject || !existingProject.image) {
        return res.status(400).json({ error: 'Project banner image is required' });
      }
    }

    // --- CREATE or UPDATE LOGIC ---
    let project;
    let projectError;
    let isUpdate = !!project_id;

    if (isUpdate) {
      // UPDATE existing project
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
    } else {
      // CREATE new project
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
    }

    if (projectError) {
      return res.status(500).json({ error: projectError.message });
    }

    // --- IMAGE UPLOAD (for both create and update) ---
    if (data.files && data.files.banner_image) {
      const file = Array.isArray(data.files.banner_image)
        ? data.files.banner_image[0]
        : data.files.banner_image;

      if (file && file.filepath) {
        try {
          const fileExt = file.originalFilename.split('.').pop();
          const fileType = file.mimetype;
          const buffer = fs.readFileSync(file.filepath);

          const filename = `${session.user.id}/project_banners/${project.id}.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('project-images')
            .upload(filename, buffer, {
              contentType: fileType,
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Image upload error:', uploadError);

          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('project-images')
              .getPublicUrl(filename);

            imageUrl = publicUrl;
            await supabase
              .from('project')
              .update({ image: imageUrl })
              .eq('id', project.id);
          }
        } catch (error) {
          console.error('File processing error:', error);
          // Better error handling - continue with the project creation
          // but log the error for debugging
        } finally {
          // Clean up the temporary file
          try {
            fs.unlinkSync(file.filepath);
          } catch (cleanupError) {
            console.error('File cleanup error:', cleanupError);
          }
        }
      }
    }

    // --- TECHNOLOGIES & TAGS ---
    // Remove old project_technologies/project_tags if updating
    if (isUpdate) {
      await supabase.from('project_technologies').delete().eq('project_id', project.id);
      await supabase.from('project_tags').delete().eq('project_id', project.id);
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

    // Insert project_tags
    if (tags.length > 0) {
      // Get tag IDs
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

      const tagIds = tags.map(name => tagNameToId[name.toLowerCase()]).filter(Boolean);

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
        const { error: tagError } = await supabase
          .from('project_tags')
          .insert(tagRowsToInsert);
        if (tagError) {
          return res.status(500).json({ error: tagError.message });
        }
      }
    }

    // --- CONTRIBUTION TYPES ---
    // Remove old project_contribution_type if updating
    if (isUpdate) {
      await supabase.from('project_contribution_type').delete().eq('project_id', project.id);
    }

    // Insert project_contribution_type
    if (contribution_types.length > 0) {
      // Get contribution type IDs
      const { data: contTypeRows, error: contTypeFetchError } = await supabase
        .from('contribution_type')
        .select('id, name')
        .in('name', contribution_types);

      if (contTypeFetchError) {
        return res.status(500).json({ error: contTypeFetchError.message });
      }

      const contTypeNameToId = {};
      contTypeRows.forEach(row => {
        contTypeNameToId[row.name.toLowerCase()] = row.id;
      });

      const contTypeIds = contribution_types.map(name => contTypeNameToId[name.toLowerCase()]).filter(Boolean);

      const contTypeRowsToInsert = contTypeIds.map(contTypeId => ({
        project_id: project.id,
        contribution_type_id: contTypeId
      }));

      if (contTypeRowsToInsert.length > 0) {
        const { error: contTypeError } = await supabase
          .from('project_contribution_type')
          .insert(contTypeRowsToInsert);
        if (contTypeError) {
          return res.status(500).json({ error: contTypeError.message });
        }
      }
    }

    return res.status(isUpdate ? 200 : 201).json({ projectId: project.id });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
