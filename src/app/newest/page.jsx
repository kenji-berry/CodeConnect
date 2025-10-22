"use client";
import React, { Suspense } from "react";
import ProjectListPage from "../Components/ProjectListPage";


export default function NewestProjectsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading Page...</div>}>
      <ProjectListPage
        title="Newest Projects"
        rpcFunctionName="get_filtered_paginated_projects"
        sortOptions={SORT_OPTIONS}
        defaultSortOption={SORT_OPTIONS.DATE_POSTED_NEWEST}
        recommended={false}
      />
    </Suspense>
  );
}