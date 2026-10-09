-- AlterTable
ALTER TABLE "article_briefs" ADD COLUMN     "answers" JSONB;

-- AlterTable
ALTER TABLE "content_topics" ADD COLUMN     "requirements" JSONB;

-- CreateTable
CREATE TABLE "project_knowledge" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "origin_question" TEXT,
    "origin_topic_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_images" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "draft_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "kind" TEXT NOT NULL DEFAULT 'generated',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "prompt" TEXT,
    "alt_text" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "storage_path" TEXT,
    "usage" JSONB,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_knowledge_project_id_created_at_idx" ON "project_knowledge"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "article_images_project_id_created_at_idx" ON "article_images"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "article_images_draft_id_idx" ON "article_images"("draft_id");

-- AddForeignKey
ALTER TABLE "project_knowledge" ADD CONSTRAINT "project_knowledge_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_images" ADD CONSTRAINT "article_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_images" ADD CONSTRAINT "article_images_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "article_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
