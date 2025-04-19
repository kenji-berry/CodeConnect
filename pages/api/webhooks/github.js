import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import crypto from 'crypto';

export default async function handler(req, res) {
  // First, respond to GitHub quickly to prevent timeout
  // GitHub only cares that we received the webhook, not what we do with it
  res.status(200).json({ success: true });
  
  try {
    // Get raw body for signature verification
    const rawBody = await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        resolve(data);
      });
    });
    
    // Basic validation
    if (req.method !== 'POST') return;
    
    const projectId = req.query.projectId;
    if (!projectId) return;
    
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return;
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', secret);
    const calculatedSignature = `sha256=${hmac.update(rawBody).digest('hex')}`;
    
    let isSignatureValid = false;
    try {
      isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(calculatedSignature)
      );
    } catch (e) {
      console.error('Signature comparison error:', e.message);
      return;
    }
    
    if (!isSignatureValid) return;
    
    // Process the webhook asynchronously
    const supabase = createPagesServerClient({ req, res });
    await supabase
      .from('project')
      .update({ webhook_active: true })
      .eq('id', projectId);
    
    // Process webhook events with lightweight operations
    const event = req.headers['x-github-event'];
    const body = JSON.parse(rawBody);
    
    switch (event) {
      case 'push':
        processCommits(body, projectId, supabase);
        break;
      case 'issues':
        processIssue(body, projectId, supabase);
        break;
      case 'pull_request':
        processPullRequest(body, projectId, supabase);
        break;
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
  }
}

// non async functions for processing events
function processCommits(payload, projectId, supabase) {
  // Only process the latest few commits to avoid timeout
  const commits = Array.isArray(payload.commits) ? payload.commits.slice(0, 10) : [];
  const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : null;
  
  if (commits.length === 0) return;
  
  const rows = commits.map(commit => ({
    project_id: projectId,
    commit_id: commit.id,
    message: commit.message?.substring(0, 1000) || null,
    author: commit.author?.name?.substring(0, 100) || null,
    timestamp: commit.timestamp ? new Date(commit.timestamp) : null,
    url: commit.url?.substring(0, 500) || null,
    branch: branch?.substring(0, 100) || null,
  }));
  
  // Fire and forget
  supabase.from('project_commits').insert(rows).then(() => {
    console.log(`Processed ${rows.length} commits for project ${projectId}`);
  }).catch(err => {
    console.error('Error storing commits:', err);
  });
}

function processIssue(payload, projectId, supabase) {
  // payload.action: opened, closed, edited, etc.
  // payload.issue: the issue object
  if (!payload.issue) return;
  const issue = payload.issue;
  const labels = Array.isArray(issue.labels) ? issue.labels.map(l => l.name) : [];
  const row = {
    project_id: projectId,
    issue_id: issue.id,
    title: issue.title?.substring(0, 1000) || null,
    body: issue.body?.substring(0, 10000) || null,
    state: issue.state?.substring(0, 100) || null,
    created_at: issue.created_at ? new Date(issue.created_at) : null,
    updated_at: issue.updated_at ? new Date(issue.updated_at) : null,
    number: issue.number,
    labels,
    url: issue.html_url?.substring(0, 500) || null,
  };
  // Fire and forget
  supabase.from('project_issues').upsert(row, { onConflict: ['project_id', 'issue_id'] }).then(() => {
    console.log(`Processed issue ${issue.id} for project ${projectId}`);
  }).catch(err => {
    console.error('Error storing issue:', err);
  });
}

function processPullRequest(payload, projectId, supabase) {
  // payload.action: opened, closed, edited, etc.
  // payload.pull_request: the PR object
  if (!payload.pull_request) return;
  const pr = payload.pull_request;
  const labels = Array.isArray(pr.labels) ? pr.labels.map(l => l.name) : [];
  const row = {
    project_id: projectId,
    pr_id: pr.id,
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
  // Fire and forget
  supabase.from('project_pull_requests').upsert(row, { onConflict: ['project_id', 'pr_id'] }).then(() => {
    console.log(`Processed pull request ${pr.id} for project ${projectId}`);
  }).catch(err => {
    console.error('Error storing pull request:', err);
  });
}