
"use client";
import React, { Suspense } from "react";
import ProjectListPage from "../Components/ProjectListPage";

const SORT_OPTIONS = {
  LAST_UPDATED_NEWEST: 'Last Updated (Newest)',
  LAST_UPDATED_OLDEST: 'Last Updated (Oldest)',
  DATE_POSTED_NEWEST: 'Date Posted (Newest)',
  DATE_POSTED_OLDEST: 'Date Posted (Oldest)',
  MOST_INTERACTIONS: 'Most Interactions',
  LEAST_INTERACTIONS: 'Least Interactions',
};

function rpcArgsTransform(args) {
  // Always filter for difficulty 1 (beginner)
  if (!args.filters) args.filters = {};
  args.filters.difficulties = [1];
  return args;
}

export default function BeginnerProjectsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Beginner Projects</h1>
        </div>
      </div>
    }>
      <ProjectListPage
        title="Beginner Projects"
        rpcFunctionName="get_filtered_paginated_projects"
        rpcArgsTransform={rpcArgsTransform}
        sortOptions={SORT_OPTIONS}
        defaultSortOption={SORT_OPTIONS.LAST_UPDATED_NEWEST}
        recommended={false}
      />
    </Suspense>
  );
}