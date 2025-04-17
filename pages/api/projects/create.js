import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

export const config = {
  api: { bodyParser: false }
};

function parseField(field) {
  // If field is an array, return the first element, else return as is
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
      maxFileSize: 50 * 1024 * 1024, // 50MB
      multiples: true
    });

    console.log("Starting form parse...");
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("Form parse error:", err);
          reject(err);
        } else {
          console.log("Form parsed successfully");
          console.log("Fields received:", Object.keys(fields));
          console.log("Files received:", Object.keys(files));
          resolve({ fields, files });
        }
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

    // Parse all fields to correct types
    const repoName = parseField(data.fields.repoName);
    const owner = parseField(data.fields.owner);
    const github_link = parseField(data.fields.github_link);
    const description_type = parseField(data.fields.description_type);
    const custom_description = parseField(data.fields.custom_description);
    const difficulty_level = parseField(data.fields.difficulty_level);
    const tags = JSON.parse(parseField(data.fields.tags) || '[]');
    const technologies = JSON.parse(parseField(data.fields.technologies) || '[]');
    const highlighted_technologies = JSON.parse(parseField(data.fields.highlighted_technologies) || '[]');
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
        console.log(`Fetching GitHub description for ${repoOwner}/${repoNameValue}`);
        const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoNameValue}`, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (response.ok) {
          const repoData = await response.json();
          finalDescription = repoData.description || '';
          console.log("Got GitHub description:", finalDescription);
        }
      } catch (err) {
        console.error("Error fetching GitHub description:", err);
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
          console.log(`File read successfully, size: ${buffer.length} bytes`);

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

          // Block if not safe for work or contains restricted content
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
            // Return a clear error message
            return res.status(400).json({ error: "Image failed moderation: contains inappropriate or restricted content." });
          }

          // Image passed moderation, upload to storage after project is created below

        } catch (error) {
          // Return a clear error message
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

    //create the project (only if image moderation passed or no image)
    const { data: project, error: projectError } = await supabase
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
        image: null // Initially set to null
      }])
      .select()
      .single();

    if (projectError) {
      console.error("Project insert error:", projectError);
      return res.status(500).json({ error: projectError.message });
    }

    console.log("Project created:", project.id);

    // If image exists and passed moderation, upload it now and update project
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

          if (!uploadError) {
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
          console.error("Error uploading image after project creation:", error);
          // Optionally, you could delete the project if image upload fails
        }
      }
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
          console.error("Tech insert error:", techError);
          return res.status(500).json({ error: techError.message });
        }
      }
    }

    return res.status(201).json({ projectId: project.id });
  } catch (error) {
    console.error("API route error:", error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
