
"use client";


export default function TrendingProjectsPage() {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen w-full">
            <div className="text-center">
            <div className="mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
            </div>
            <h1 className="inria-sans-bold text-xl text-off-white">Loading Trending Projects</h1>
            </div>
        </div>
    }>
      <ProjectListPage
        title="Trending Projects"
        getInitialProjectIds={getInitialTrendingProjectIds}
        rpcFunctionName="get_filtered_paginated_projects"
        sortOptions={SORT_OPTIONS}
        defaultSortOption={SORT_OPTIONS.DATE_POSTED_NEWEST}
        recommended={false}
      />
    </Suspense>
  );
}