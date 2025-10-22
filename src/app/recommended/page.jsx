
"use client";

import React, { Suspense } from "react";
import ProjectListPage from "../Components/ProjectListPage";
import { supabase } from "../../supabaseClient";
import { getHybridRecommendations } from "../../services/recommendation-service";

const SORT_OPTIONS = {
  LAST_UPDATED_NEWEST: 'Last Updated (Newest)',
  LAST_UPDATED_OLDEST: 'Last Updated (Oldest)',
  DATE_POSTED_NEWEST: 'Date Posted (Newest)',
  DATE_POSTED_OLDEST: 'Date Posted (Oldest)',
  MOST_INTERACTIONS: 'Most Interactions',
  LEAST_INTERACTIONS: 'Least Interactions',
};

async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

async function getInitialRecommendedProjectIds(limit = 100, userId) {
  if (!userId) return [];
  const recs = await getHybridRecommendations(userId, limit, false);
  return Array.isArray(recs) ? recs.map(p => p.id).filter(id => id !== undefined) : [];
}

export default function RecommendedProjectsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Recommendations</h1>
        </div>
      </div>
    }>
      <ProjectListPage
        title="Recommended Projects"
        getInitialProjectIds={getInitialRecommendedProjectIds}
        rpcFunctionName="get_recommended_filtered_paginated_projects"
        sortOptions={SORT_OPTIONS}
        defaultSortOption={SORT_OPTIONS.LAST_UPDATED_NEWEST}
        recommended={true}
        requireUser={true}
        getUserId={getUserId}
      />
    </Suspense>
  );
}