-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website_url" TEXT,
    "business_context" TEXT,
    "audience" TEXT,
    "objectives" TEXT,
    "content_language" TEXT NOT NULL DEFAULT 'en',
    "tone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Vilnius',
    "publishing_policy" TEXT NOT NULL DEFAULT 'review',
    "status" TEXT NOT NULL DEFAULT 'active',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");
