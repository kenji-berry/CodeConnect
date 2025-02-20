<div className="full-width">
<h2 className="inria-sans-semibold">READ ONLY Project Information (as of xx/xx/xx)</h2>
</div>
<div className="bento-box half-width radial-background">
<h4>Owner: {repoInfo.owner}</h4>
<h4>License: {repoInfo.license}</h4>
<h4>Stars: {repoInfo.stars}</h4>
<h4>Forks: {repoInfo.forks}</h4>
<h4>Contributors: {repoInfo.contributors}</h4>
</div>
<div className="bento-box half-width radial-background">
<h4>Issues Open: {repoInfo.openIssues}</h4>
<h4>Good First Issues: {repoInfo.goodFirstIssues}</h4>
<h4>Pull Requests: {repoInfo.pullRequests}</h4>
</div>
<div className="bento-box full-width radial-background">
<h3 className="inria-sans-semibold">Recent Activity:</h3>
<h4>Most Recent Commit: {repoInfo.latestCommit}</h4>
<div>
  <h4>Activity Graph:</h4>
  <ActivityGraph 
    owner={owner || ''} 
    repo={repoName || ''} 
    token={session?.provider_token || ''}
  />
</div>
</div>