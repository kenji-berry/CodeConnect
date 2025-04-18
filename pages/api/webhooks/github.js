import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get the project ID from query params
  const projectId = req.query.projectId;
  
  // Verify webhook signature
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'No signature provided' });
  }
  
  try {
    // Get the webhook secret from database
    const supabase = createPagesServerClient({ req, res });
    const { data: webhook, error } = await supabase
      .from('project_webhooks')
      .select('webhook_secret')
      .eq('project_id', projectId)
      .single();
    
    if (error || !webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    // Verify signature
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', webhook.webhook_secret);
    const calculatedSignature = `sha256=${hmac.update(payload).digest('hex')}`;
    
    if (signature !== calculatedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process the webhook event based on type
    const event = req.headers['x-github-event'];
    
    switch (event) {
      case 'push':
        await handlePushEvent(req.body, projectId, supabase);
        break;
      case 'issues':
        await handleIssueEvent(req.body, projectId, supabase);
        break;
      case 'pull_request':
        await handlePullRequestEvent(req.body, projectId, supabase);
        break;
      default:
        // Ignore unhandled events
        break;
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper functions to process different event types

async function handlePushEvent(payload, projectId, supabase) {
  // payload.commits is an array of commits
  if (!Array.isArray(payload.commits)) return;
  const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : null;
  const rows = payload.commits.map(commit => ({
    project_id: projectId,
    commit_id: commit.id,
    message: commit.message,
    author: commit.author?.name || null,
    timestamp: commit.timestamp ? new Date(commit.timestamp) : null,
    url: commit.url,
    branch,
  }));
  if (rows.length > 0) {
    await supabase.from('project_commits').insert(rows);
  }
}

async function handleIssueEvent(payload, projectId, supabase) {
  // payload.action: opened, closed, edited, etc.
  // payload.issue: the issue object
  if (!payload.issue) return;
  const issue = payload.issue;
  const labels = Array.isArray(issue.labels) ? issue.labels.map(l => l.name) : [];
  const row = {
    project_id: projectId,
    issue_id: issue.id,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    created_at: issue.created_at ? new Date(issue.created_at) : null,
    updated_at: issue.updated_at ? new Date(issue.updated_at) : null,
    number: issue.number,
    labels,
    url: issue.html_url,
  };
  // Upsert by (project_id, issue_id)
  await supabase.from('project_issues').upsert(row, { onConflict: ['project_id', 'issue_id'] });
}

async function handlePullRequestEvent(payload, projectId, supabase) {
  // payload.action: opened, closed, edited, etc.
  // payload.pull_request: the PR object
  if (!payload.pull_request) return;
  const pr = payload.pull_request;
  const labels = Array.isArray(pr.labels) ? pr.labels.map(l => l.name) : [];
  const row = {
    project_id: projectId,
    pr_id: pr.id,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    created_at: pr.created_at ? new Date(pr.created_at) : null,
    updated_at: pr.updated_at ? new Date(pr.updated_at) : null,
    number: pr.number,
    labels,
    url: pr.html_url,
    merged: !!pr.merged_at,
  };
  // Upsert by (project_id, pr_id)
  await supabase.from('project_pull_requests').upsert(row, { onConflict: ['project_id', 'pr_id'] });
}