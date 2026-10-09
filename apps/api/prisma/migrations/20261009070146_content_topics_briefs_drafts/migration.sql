-- CreateTable
CREATE TABLE "content_topics" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "reader_need" TEXT,
    "angle" TEXT NOT NULL,
    "call_to_action" TEXT,
    "relevance" TEXT,
    "information_needed" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'generated',
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "sources" JSONB,
    "generation_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_briefs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "business_outcome" TEXT,
    "outline" TEXT,
    "call_to_action" TEXT,
    "destination_url" TEXT,
    "sources" JSONB,
    "confirmations" JSONB,
    "settings_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_drafts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "brief_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT,
    "excerpt" TEXT,
    "body_markdown" TEXT NOT NULL,
    "slug" TEXT,
    "seo_title" TEXT,
    "meta_description" TEXT,
    "call_to_action" TEXT,
    "sources" JSONB,
    "unresolved_claims" JSONB,
    "settings_snapshot" JSONB,
    "brief_snapshot" JSONB,
    "generation_run_id" TEXT,
    "saved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "topic_id" TEXT,
    "draft_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "input_snapshot" JSONB NOT NULL,
    "evidence" JSONB,
    "result" JSONB,
    "error" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_usd" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_topics_project_id_created_at_idx" ON "content_topics"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "content_topics_project_id_status_idx" ON "content_topics"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "article_briefs_topic_id_key" ON "article_briefs"("topic_id");

-- CreateIndex
CREATE INDEX "article_drafts_project_id_created_at_idx" ON "article_drafts"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "article_drafts_topic_id_version_key" ON "article_drafts"("topic_id", "version");

-- CreateIndex
CREATE INDEX "content_runs_project_id_created_at_idx" ON "content_runs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "content_runs_status_idx" ON "content_runs"("status");

-- AddForeignKey
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_briefs" ADD CONSTRAINT "article_briefs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_briefs" ADD CONSTRAINT "article_briefs_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "content_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_drafts" ADD CONSTRAINT "article_drafts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_drafts" ADD CONSTRAINT "article_drafts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "content_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_drafts" ADD CONSTRAINT "article_drafts_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "article_briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_runs" ADD CONSTRAINT "content_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
