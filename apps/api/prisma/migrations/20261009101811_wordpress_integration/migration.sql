-- CreateTable
CREATE TABLE "wordpress_integrations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "site_url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "last_test_status" TEXT,
    "last_test_at" TIMESTAMP(3),
    "last_test_error" TEXT,
    "last_test_identity" JSONB,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wordpress_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordpress_exports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "draft_version" INTEGER NOT NULL,
    "site_url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "remote_post_id" INTEGER,
    "remote_media_id" INTEGER,
    "remote_modified" TEXT,
    "remote_link" TEXT,
    "media_hash" TEXT,
    "payload_hash" TEXT NOT NULL,
    "error" TEXT,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wordpress_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wordpress_integrations_project_id_key" ON "wordpress_integrations"("project_id");

-- CreateIndex
CREATE INDEX "wordpress_exports_project_id_created_at_idx" ON "wordpress_exports"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "wordpress_exports_draft_id_created_at_idx" ON "wordpress_exports"("draft_id", "created_at");

-- AddForeignKey
ALTER TABLE "wordpress_integrations" ADD CONSTRAINT "wordpress_integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordpress_exports" ADD CONSTRAINT "wordpress_exports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordpress_exports" ADD CONSTRAINT "wordpress_exports_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "article_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prevent concurrent exports for the same draft (repeated clicks, parallel requests).
CREATE UNIQUE INDEX "wordpress_exports_one_in_progress_per_draft"
    ON "wordpress_exports" ("draft_id")
    WHERE "status" = 'in_progress';
